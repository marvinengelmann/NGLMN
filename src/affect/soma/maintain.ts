import { getSomaticState } from "@/affect/soma/state.ts"
import { rechargeSocialBattery } from "@/affect/soma/update.ts"
import { somaticHistory } from "@/infra/db/schema.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import {
  incrementConsecutiveConversationTicks,
  incrementConsecutiveIdleTicks,
  resetConsecutiveConversationTicks,
  resetConsecutiveIdleTicks
} from "@/memory/working.ts"

const REDIS = {
  SOMA_CURRENT: "working:soma:current",
  SOMA_LAST_TIMESTAMP: "working:soma:lastTimestamp"
} as const

/**
 * Update idle/conversation counters and recharge social battery during rest.
 */
export async function maintainActivityCounters(
  action: string,
  responseSent: boolean,
  isDreaming: boolean,
  inConversation: boolean,
  buffer: WriteBuffer
): Promise<void> {
  const isRestingAction = (action === "idle" || action === "dream") && !responseSent

  if (isRestingAction) {
    await Promise.all([incrementConsecutiveIdleTicks(), resetConsecutiveConversationTicks()])

    const currentSoma = await getSomaticState()
    const effectivelyDreaming = isDreaming || action === "dream"
    const rechargedSoma = rechargeSocialBattery(currentSoma, effectivelyDreaming)
    if (rechargedSoma.socialBattery !== currentSoma.socialBattery) {
      buffer.stage(REDIS.SOMA_CURRENT, rechargedSoma)
      buffer.stage(REDIS.SOMA_LAST_TIMESTAMP, new Date().toISOString())
      buffer.stagePostgres(somaticHistory, { state: rechargedSoma, trigger: "social_battery_recharge" })
    }
  } else {
    await Promise.all([
      resetConsecutiveIdleTicks(),
      inConversation ? incrementConsecutiveConversationTicks() : resetConsecutiveConversationTicks()
    ])
  }
}
