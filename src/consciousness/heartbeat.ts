import { differenceInSeconds, parseISO } from "date-fns"
import { HEARTBEAT } from "@/config/constants.ts"
import { log } from "@/lib/logger.ts"
import { setTickContext } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import {
  clearBusy,
  clearConversationWaitingSince,
  getConversationWaitingSince,
  setConversationWaitingSince,
  tryAcquireBusy
} from "@/memory/working.ts"
import { act } from "./act.ts"
import { deliberate } from "./deliberate.ts"
import { feel } from "./feel.ts"
import { maintain } from "./maintain.ts"
import { sense } from "./sense.ts"

/**
 * Run the heartbeat loop: SENSE → FEEL → DELIBERATE → ACT, repeat while in conversation.
 * MAINTAIN runs once at the end.
 */
export async function runHeartbeat() {
  log.info("Heartbeat starting")
  const tickId = `tick-${Date.now()}`
  const startTime = Date.now()
  const timestamp = nowISO()
  setTickContext({ tickId })

  const acquired = await tryAcquireBusy(tickId)
  if (!acquired) {
    log.info("Heartbeat skipped — busy lock held by another tick")
    return
  }

  try {
    let lastDecision: Awaited<ReturnType<typeof deliberate>> | null = null
    let lastActResult: Awaited<ReturnType<typeof act>> | null = null
    let lastSenseResult: Awaited<ReturnType<typeof sense>> | null = null
    let lastFeelResult: Awaited<ReturnType<typeof feel>> | null = null

    while (true) {
      const senseResult = await sense()
      const feelResult = await feel(senseResult)
      const deliberateResult = await deliberate(senseResult, feelResult)
      const actResult = await act(deliberateResult, senseResult, feelResult)

      lastDecision = deliberateResult
      lastActResult = actResult
      lastSenseResult = senseResult
      lastFeelResult = feelResult

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

    if (lastDecision && lastActResult && lastSenseResult && lastFeelResult) {
      return await maintain(
        {
          tickId,
          startTime,
          timestamp,
          decision: lastDecision.decision,
          actResult: lastActResult,
          senseResult: lastSenseResult
        },
        lastDecision,
        lastFeelResult
      )
    }
  } finally {
    await clearConversationWaitingSince()
    await clearBusy()
  }
}
