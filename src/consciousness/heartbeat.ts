import { differenceInSeconds, parseISO } from "date-fns"
import {
  clearConversationWaitingSince,
  getConversationWaitingSince,
  setConversationWaitingSinceIfAbsent
} from "@/expression/communication/state.ts"
import { HEARTBEAT } from "@/infra/config/constants.ts"
import { distortionLog } from "@/infra/db/schema.ts"
import { createWriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"
import { setTickContext } from "@/infra/lib/sentry.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { clearBusy, tryAcquireBusy } from "@/memory/working.ts"
import { act } from "./act.ts"
import { deliberate } from "./deliberate.ts"
import { feel } from "./feel.ts"
import { maintain } from "./maintain.ts"
import { preloadContextState } from "./pipeline/preload.ts"
import type { TickState } from "./pipeline/types.ts"
import { sense } from "./sense.ts"
import type { SenseData } from "./types.ts"

/**
 * Run the heartbeat loop: each iteration is a full SENSE → FEEL → DELIBERATE → ACT → MAINTAIN cycle.
 * State is flushed per tick so emotions, memory, and cognition update between conversation turns.
 */
export async function runHeartbeat() {
  log.info("Heartbeat starting")
  const lockId = `tick-${Date.now()}`
  setTickContext({ tickId: lockId })

  const acquired = await tryAcquireBusy(lockId)
  if (!acquired) {
    log.info("Heartbeat skipped — busy lock held by another tick")
    return
  }

  try {
    let previousSendInterrupted = false
    let lastKnownUpdateId: number | null = null
    let sentWithoutReply = false

    while (true) {
      const tickId = `tick-${Date.now()}`
      const startTime = Date.now()
      const timestamp = nowISO()
      setTickContext({ tickId })

      const buffer = createWriteBuffer()

      const senseResult = await sense({
        interruptedPreviousSend: previousSendInterrupted,
        lastUpdateIdOverride: lastKnownUpdateId
      })

      if (senseResult.maxUpdateId != null) {
        lastKnownUpdateId = senseResult.maxUpdateId
        buffer.stage("working:telegram:lastUpdateId", senseResult.maxUpdateId)
      }

      if (senseResult.pendingMessages.length > 0) {
        sentWithoutReply = false
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

      let deliberateResult = await deliberate(tickState)

      if (previousSendInterrupted && deliberateResult.decision.action === "life_event") {
        log.warn("Overriding life_event after mid-send interrupt — forcing idle to allow re-processing")
        deliberateResult = {
          ...deliberateResult,
          decision: {
            ...deliberateResult.decision,
            action: "idle",
            reasoning: `Override: life_event blocked after mid-send interrupt. Original: ${deliberateResult.decision.reasoning}`
          }
        }
      }

      if (sentWithoutReply && deliberateResult.decision.messages.length > 0) {
        log.info("Suppressing messages — already responded, awaiting operator reply", {
          suppressed: deliberateResult.decision.messages.length
        })
        deliberateResult = {
          ...deliberateResult,
          decision: {
            ...deliberateResult.decision,
            messages: [],
            reasoning: `${deliberateResult.decision.reasoning} [Messages suppressed: already sent, no reply yet]`
          }
        }
      }

      const actResult = await act(deliberateResult, senseResult, feelResult, buffer, tickId)

      if (actResult.responseSent) {
        sentWithoutReply = true
      }

      await maintain(
        {
          tickId,
          startTime,
          timestamp,
          decision: deliberateResult.decision,
          actResult,
          senseResult
        },
        deliberateResult,
        feelResult,
        buffer
      )

      const stagedRedis = buffer.stagedRedisCount
      const stagedPostgres = buffer.stagedPostgresCount
      await buffer.flush()
      log.info("WriteBuffer flushed", { redisKeys: stagedRedis, postgresRows: stagedPostgres })

      if (actResult.interrupted) {
        previousSendInterrupted = true
        log.info("Send interrupted, re-sensing immediately")
        continue
      }

      previousSendInterrupted = false

      if (!deliberateResult.decision.expectsReply) break

      try {
        await setConversationWaitingSinceIfAbsent(nowISO())
        const waitingSince = await getConversationWaitingSince()
        if (waitingSince) {
          const elapsed = differenceInSeconds(new Date(), parseISO(waitingSince))
          if (elapsed >= HEARTBEAT.MAX_CONVERSATION_WAIT) {
            log.info("Conversation hard cap reached", { elapsed })
            break
          }
        }
      } catch (e) {
        log.warn("Conversation wait check failed, breaking loop", { error: String(e) })
        break
      }
    }
  } finally {
    await clearConversationWaitingSince()
    await clearBusy(lockId)
  }
}
