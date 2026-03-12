import { differenceInSeconds, parseISO } from "date-fns"
import {
  clearConversationWaitingSince,
  getConversationWaitingSince,
  setConversationWaitingSince
} from "@/expression/communication/state.ts"
import { HEARTBEAT } from "@/infra/config/constants.ts"
import { distortionLog } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { setTickContext } from "@/infra/lib/sentry.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { clearBusy, tryAcquireBusy } from "@/memory/working.ts"
import { act } from "./act.ts"
import { deliberate } from "./deliberate.ts"
import { feel } from "./feel.ts"
import { maintain } from "./maintain.ts"
import { createWriteBuffer } from "./pipeline/persistence.ts"
import { preloadContextState } from "./pipeline/preload.ts"
import type { TickState } from "./pipeline/types.ts"
import { sense } from "./sense.ts"
import type { SenseData } from "./types.ts"

/**
 * Run the heartbeat loop: SENSE → FEEL → DELIBERATE → ACT, repeat while in conversation.
 * MAINTAIN runs once at the end.
 */
export async function runHeartbeat() {
  log.info("Heartbeat starting")
  const lockId = `tick-${Date.now()}`
  let tickId = lockId
  let startTime = Date.now()
  let timestamp = nowISO()
  setTickContext({ tickId })

  const acquired = await tryAcquireBusy(lockId)
  if (!acquired) {
    log.info("Heartbeat skipped — busy lock held by another tick")
    return
  }

  const buffer = createWriteBuffer()

  try {
    let lastTickState: TickState | null = null
    let lastDecision: Awaited<ReturnType<typeof deliberate>> | null = null
    let lastActResult: Awaited<ReturnType<typeof act>> | null = null
    let previousSendInterrupted = false
    let lastKnownUpdateId: number | null = null

    while (true) {
      tickId = `tick-${Date.now()}`
      startTime = Date.now()
      timestamp = nowISO()
      setTickContext({ tickId })

      const senseResult = await sense({
        interruptedPreviousSend: previousSendInterrupted,
        lastUpdateIdOverride: lastKnownUpdateId
      })

      if (senseResult.maxUpdateId != null) {
        lastKnownUpdateId = senseResult.maxUpdateId
        buffer.stage("working:telegram:lastUpdateId", senseResult.maxUpdateId)
      }

      const feelResult = await feel(senseResult, buffer)

      const senseData: SenseData = {
        pendingMessages: senseResult.pendingMessages,
        perception: senseResult.perception,
        health: senseResult.health,
        weather: senseResult.perception.weatherData ?? null,
        conversationState: senseResult.conversationState,
        triggeredWorkflows: senseResult.triggeredWorkflows,
        moodContext: senseResult.moodContext,
        interruptedPreviousSend: senseResult.interruptedPreviousSend
      }

      const preloaded = await preloadContextState(senseData, feelResult.emotion)

      preloaded.episodes
        .flatMap((ep) => ep.distortions)
        .forEach((d) => {
          buffer.stagePostgres(distortionLog, {
            type: d.type,
            originalEpisodeId: d.originalEpisodeId,
            alteredField: d.alteredField
          })
        })

      const tickState: TickState = {
        tickId,
        startTime,
        timestamp,
        sense: senseResult,
        feel: feelResult,
        preloaded
      }

      const deliberateResult = await deliberate(tickState)
      const actResult = await act(deliberateResult, senseResult, feelResult, buffer, tickId)

      lastTickState = tickState
      lastDecision = deliberateResult
      lastActResult = actResult

      if (actResult.interrupted) {
        previousSendInterrupted = true
        log.info("Send interrupted, re-sensing immediately")
        continue
      }

      previousSendInterrupted = false

      if (!deliberateResult.decision.expectsReply) break

      const waitingSince = await getConversationWaitingSince()
      if (!waitingSince) {
        await setConversationWaitingSince(nowISO())
      } else {
        const elapsed = differenceInSeconds(new Date(), parseISO(waitingSince))
        if (elapsed >= HEARTBEAT.MAX_CONVERSATION_WAIT) {
          log.info("Conversation hard cap reached", { elapsed })
          break
        }
      }
    }

    if (lastTickState && lastDecision && lastActResult) {
      await maintain(
        {
          tickId,
          startTime,
          timestamp,
          decision: lastDecision.decision,
          actResult: lastActResult,
          senseResult: lastTickState.sense
        },
        lastDecision,
        lastTickState.feel,
        buffer
      )
    }

    const stagedRedis = buffer.stagedRedisCount
    const stagedPostgres = buffer.stagedPostgresCount
    await buffer.flush()
    log.info("WriteBuffer flushed", { redisKeys: stagedRedis, postgresRows: stagedPostgres })
  } catch (error) {
    buffer.discard()
    throw error
  } finally {
    await clearConversationWaitingSince()
    await clearBusy(lockId)
  }
}
