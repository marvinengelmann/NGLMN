import { differenceInMinutes, parseISO } from "date-fns"
import { getDisappointmentState, markAcknowledged, saveDisappointmentState } from "@/affect/emotion/disappointment.ts"
import type { GuiltSource } from "@/affect/emotion/guilt.ts"
import { getGuiltState, markRepaired, saveGuiltState } from "@/affect/emotion/guilt.ts"
import { getMoodBaseline } from "@/affect/emotion/state.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { blendMoodBaseline, enforceEmotionFloors } from "@/affect/emotion/update.ts"
import type { TickSummary } from "@/core/types.ts"
import { emotionHistory } from "@/infra/db/schema.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"

const REDIS = {
  EMOTION_CURRENT: "working:emotion:current",
  MOOD_BASELINE: "working:emotion:moodBaseline"
} as const

const REPAIRABLE_GUILT_SOURCES: GuiltSource[] = [
  "unanswered_vulnerability",
  "emotional_neglect",
  "harsh_response",
  "withdrawal_during_need"
]

/**
 * Maintain guilt repair, disappointment acknowledgment, and final emotion state persistence.
 */
export async function maintainEmotion(
  responseSent: boolean,
  hasMessages: boolean,
  postActEmotion: EmotionalState | undefined,
  emotion: EmotionalState,
  primaryTrigger: string,
  tickId: string,
  lastTick: TickSummary | null,
  buffer: WriteBuffer
): Promise<void> {
  await maintainGuiltRepair(responseSent, buffer)
  await maintainDisappointmentAcknowledgment(hasMessages, buffer)
  await maintainEmotionState(responseSent, postActEmotion, emotion, primaryTrigger, tickId, lastTick, buffer)
}

async function maintainGuiltRepair(responseSent: boolean, buffer: WriteBuffer): Promise<void> {
  if (!responseSent) return

  const guiltState = await getGuiltState()
  const unrepaired = guiltState.recentEntries.filter((e) => !e.repaired)
  if (unrepaired.length === 0) return

  let updated = guiltState
  for (const source of REPAIRABLE_GUILT_SOURCES) {
    updated = markRepaired(updated, source)
  }
  if (JSON.stringify(updated.recentEntries) !== JSON.stringify(guiltState.recentEntries)) {
    await saveGuiltState(updated, buffer)
    log.info("Guilt entries repaired after response")
  }
}

async function maintainDisappointmentAcknowledgment(hasMessages: boolean, buffer: WriteBuffer): Promise<void> {
  if (!hasMessages) return

  const disappointmentState = await getDisappointmentState()
  const acknowledged = markAcknowledged(disappointmentState)
  if (acknowledged !== disappointmentState) {
    await saveDisappointmentState(acknowledged, buffer)
    log.info("Disappointment entries acknowledged after operator message")
  }
}

async function maintainEmotionState(
  responseSent: boolean,
  postActEmotion: EmotionalState | undefined,
  emotion: EmotionalState,
  primaryTrigger: string,
  tickId: string,
  lastTick: TickSummary | null,
  buffer: WriteBuffer
): Promise<void> {
  const currentEmotion = enforceEmotionFloors(postActEmotion ?? emotion)

  if (!responseSent) {
    buffer.stage(REDIS.EMOTION_CURRENT, currentEmotion)
    buffer.stagePostgres(emotionHistory, {
      state: currentEmotion,
      trigger: primaryTrigger,
      tickId
    })
  }

  const oldBaseline = await getMoodBaseline()
  const elapsedMinutes = lastTick ? differenceInMinutes(new Date(), parseISO(lastTick.timestamp)) : 1.5
  buffer.stage(REDIS.MOOD_BASELINE, blendMoodBaseline(currentEmotion, oldBaseline, Math.max(0.1, elapsedMinutes)))
}
