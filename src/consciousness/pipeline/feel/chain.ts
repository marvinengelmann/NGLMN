import { computeEmotionModifiers, computeSomaModifiers, isExpired } from "@/affect/altered/compute.ts"
import {
  computeDriveEmotionTriggers,
  computeDriveUpdate,
  inferBlockedDrives,
  inferSatisfiedDrives
} from "@/affect/drive/compute.ts"
import { detectNostalgia } from "@/affect/emotion/nostalgia.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow
} from "@/affect/emotion/update.ts"
import { querySomaticMemories } from "@/affect/soma/state.ts"
import { computeSomaticUpdate } from "@/affect/soma/update.ts"
import { DREAM_AFTERGLOW } from "@/expression/dream/constants.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { setEmotionContext } from "@/infra/lib/sentry.ts"
import { elapsedMinutesSince, nowISO } from "@/infra/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import type { SenseResult } from "../../types.ts"
import type { EmotionChainResult, FeelPrefetch } from "./types.ts"

export async function runEmotionChain(sense: SenseResult, prefetch: FeelPrefetch): Promise<EmotionChainResult> {
  const computed = computeEmotionalUpdate(
    prefetch.currentEmotion,
    sense.rawTriggers,
    sense.moodContext,
    Math.max(1, sense.elapsedMinutes),
    sense.triggerTimestamps
  )

  const eventIntensity = computeEmotionalIntensity(computed)
  const { state: momentumState, momentum: newMomentum } = applyMomentum(
    computed,
    prefetch.currentEmotion,
    eventIntensity,
    prefetch.previousMomentum
  )

  const { state: afterglowState, remainingEntries } = applyAfterglow(momentumState, prefetch.existingAfterglow)
  const newAfterglowEntries = detectAfterglow(afterglowState, prefetch.currentEmotion)
  const allAfterglowEntries = [...remainingEntries, ...newAfterglowEntries]

  let emotion = afterglowState

  let dreamAfterglowDecayed: EmotionChainResult["dreamAfterglowDecayed"] = null
  if (prefetch.dreamAfterglow && prefetch.dreamAfterglow.intensity >= DREAM_AFTERGLOW.MIN_INTENSITY) {
    const afterglow = prefetch.dreamAfterglow
    const scaledResidue = Object.fromEntries(
      Object.entries(afterglow.emotionalResidue)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, (v as number) * afterglow.intensity * DREAM_AFTERGLOW.BLEND_WEIGHT])
    )
    emotion = applyClampedDeltas(emotion, scaledResidue)
    const decayed = {
      ...prefetch.dreamAfterglow,
      intensity: prefetch.dreamAfterglow.intensity * DREAM_AFTERGLOW.DECAY_PER_TICK
    }
    dreamAfterglowDecayed = decayed.intensity >= DREAM_AFTERGLOW.MIN_INTENSITY ? decayed : null
  }

  const { alteredState } = prefetch
  let alteredStateCleared = false
  if (alteredState) {
    if (isExpired(alteredState)) {
      alteredStateCleared = true
    } else {
      const emotionMods = computeEmotionModifiers(alteredState)
      emotion = applyClampedDeltas(emotion, emotionMods)
    }
  }

  const timestampNow = nowISO()
  const mergedTimestamps: Record<string, string> = { ...prefetch.triggerTimestamps }
  for (const event of sense.rawTriggers) {
    mergedTimestamps[event.trigger] = timestampNow
  }

  const lastAction = prefetch.recentActions[0] ?? "idle"
  const satisfied = inferSatisfiedDrives(
    sense.moodContext.inConversation,
    sense.pendingMessages.length,
    lastAction,
    prefetch.recentActions
  )
  const blocked = inferBlockedDrives(
    sense.moodContext.operatorSilenceMinutes,
    prefetch.consecutiveIdleTicks,
    sense.moodContext.isDreaming,
    prefetch.recentActions
  )
  const driveState = computeDriveUpdate({
    current: prefetch.previousDriveState,
    elapsedMinutes: Math.max(1, sense.elapsedMinutes),
    blocked,
    satisfied
  })
  const driveTriggers = computeDriveEmotionTriggers(driveState)
  emotion = driveTriggers.reduce((acc, trigger) => applyEvent(acc, trigger), emotion)

  const elapsed = elapsedMinutesSince(prefetch.lastSomaTimestamp)
  const messageText = sense.pendingMessages.map((m) => m.text).join(" ")
  const somaticMemories = messageText ? await querySomaticMemories(messageText) : []

  let soma = computeSomaticUpdate(prefetch.currentSoma, emotion, elapsed, somaticMemories)
  if (alteredState && !isExpired(alteredState)) {
    const somaMods = computeSomaModifiers(alteredState)
    soma = applyClampedDeltas(soma, somaMods, new Set(["socialBattery"]))
  }

  const episodicHits = messageText ? await queryRelated(messageText, 5) : []
  const nostalgia = episodicHits.length > 0 ? detectNostalgia(episodicHits, new Date()) : null
  if (nostalgia) {
    emotion = applyEvent(emotion, nostalgia)
  }

  const emotionTrigger = nostalgia ? "nostalgia_wave" : (sense.rawTriggers[0]?.trigger ?? "ambient")
  setEmotionContext(emotion)

  return {
    emotion,
    driveState,
    soma,
    alteredState,
    episodicHits,
    momentum: newMomentum,
    afterglowEntries: allAfterglowEntries,
    emotionTimestamp: timestampNow,
    triggerTimestamps: mergedTimestamps,
    dreamAfterglowDecayed,
    alteredStateCleared,
    emotionTrigger
  }
}
