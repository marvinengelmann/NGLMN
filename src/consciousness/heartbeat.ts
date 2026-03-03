import { differenceInSeconds, parseISO } from "date-fns"
import { HEARTBEAT } from "@/config/constants.ts"
import { log } from "@/lib/logger.ts"
import { setTickContext } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import {
  clearBusy,
  clearConversationWaitingSince,
  getConversationWaitingSince,
  setBusy,
  setConversationWaitingSince
} from "@/memory/working.ts"
import { act } from "./act.ts"
import { maintain } from "./maintain.ts"
import { sense } from "./sense.ts"
import { think } from "./think.ts"

/**
 * Run the heartbeat loop: SENSE → THINK → ACT, repeat while in conversation.
 * MAINTAIN runs once at the end.
 */
export async function runHeartbeat() {
  log.info("Heartbeat starting")
  const tickId = `tick-${Date.now()}`
  const startTime = Date.now()
  const timestamp = nowISO()
  setTickContext({ tickId })

  await setBusy(tickId)

  try {
    let lastDecision: Awaited<ReturnType<typeof think>> | null = null
    let lastActResult: Awaited<ReturnType<typeof act>> | null = null
    let lastSenseResult: Awaited<ReturnType<typeof sense>> | null = null

    while (true) {
      const senseResult = await sense()
      const thinkResult = await think(senseResult)
      const actResult = await act(thinkResult, senseResult)

      lastDecision = thinkResult
      lastActResult = actResult
      lastSenseResult = senseResult

      if (!thinkResult.decision.expectsReply) break

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

    await clearConversationWaitingSince()

    if (lastDecision && lastActResult && lastSenseResult) {
      return await maintain(
        {
          tickId,
          startTime,
          timestamp,
          decision: lastDecision.decision,
          actResult: lastActResult,
          senseResult: lastSenseResult
        },
        lastDecision
      )
    }
  } finally {
    await clearBusy()
  }
}
