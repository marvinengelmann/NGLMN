import { getHours } from "date-fns"
import { computeEmotionModifiers, computeSomaModifiers, isExpired } from "@/affect/altered/compute.ts"
import {
  computeDriveEmotionTriggers,
  computeDriveUpdate,
  inferBlockedDrives,
  inferSatisfiedDrives
} from "@/affect/drive/compute.ts"
import { toEpisodicContext } from "@/affect/emotion/construction.ts"
import { checkMaturedEvents, maturedEventToTrigger, storeDeferredEvent } from "@/affect/emotion/deferred.ts"
import { detectNostalgia } from "@/affect/emotion/nostalgia.ts"
import type { AppraisalContext } from "@/affect/emotion/types.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow
} from "@/affect/emotion/update.ts"
import {
  computeCopingModulation,
  computeLearningRateModulation,
  computeNeuromodulatorUpdate
} from "@/affect/neuromodulation/compute.ts"
import {
  assembleInteroceptivePrediction,
  computeInteroceptiveEmotionTriggers,
  computeSomaticTrajectory,
  predictSomaticState
} from "@/affect/soma/prediction.ts"
import { querySomaticMemories } from "@/affect/soma/state.ts"
import { computeSomaticUpdate } from "@/affect/soma/update.ts"
import {
  applyVagalEmotionConstraints,
  computeNeuroception,
  computeVagalConstraints,
  computeVagalTransition
} from "@/affect/soma/vagal.ts"
import { DREAM_AFTERGLOW } from "@/expression/dream/constants.ts"
import { applyClampedDeltas } from "@/infra/lib/math.ts"
import { setEmotionContext } from "@/infra/lib/sentry.ts"
import { elapsedMinutesSince, nowISO, nowLocal } from "@/infra/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { processReconsolidation } from "@/memory/reconsolidation.ts"
import { detectProustFlashback } from "@/perception/proust.ts"
import type { SenseResult } from "../../types.ts"
import type { EmotionChainResult, FeelPrefetch } from "./types.ts"

export async function runEmotionChain(sense: SenseResult, prefetch: FeelPrefetch): Promise<EmotionChainResult> {
  const hourOfDay = getHours(nowLocal())
  const messageText = sense.pendingMessages.map((m) => m.text).join(" ")

  const episodicHits = messageText ? await queryRelated(messageText, 5) : []
  const episodicContext = toEpisodicContext(episodicHits)

  const appraisalContext: AppraisalContext = {
    noveltyLevel: prefetch.previousNovelty.level,
    hasActiveGoals: sense.moodContext.hasActiveGoals,
    confidence: prefetch.currentEmotion.confidence,
    energy: prefetch.currentEmotion.energy,
    vagalZone: prefetch.previousVagalState.zone,
    selfConcept: prefetch.selfConcept,
    cortisolCopingModulation: computeCopingModulation(prefetch.previousNeuromodulatoryState)
  }

  const {
    state: computed,
    appraisals: appraisalResults,
    constructions: constructionResults
  } = computeEmotionalUpdate(
    prefetch.currentEmotion,
    sense.rawTriggers,
    sense.moodContext,
    Math.max(1, sense.elapsedMinutes),
    sense.triggerTimestamps,
    {
      dnaBaseline: prefetch.dnaBaseline ?? undefined,
      isIdle: prefetch.consecutiveIdleTicks > 0,
      trustExperience: prefetch.trustExperience,
      appraisalContext,
      soma: prefetch.currentSoma,
      episodicContext,
      neuromodulatoryState: prefetch.previousNeuromodulatoryState
    }
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
    satisfied,
    dopamineModulation: computeLearningRateModulation(prefetch.previousNeuromodulatoryState)
  })
  const driveTriggers = computeDriveEmotionTriggers(driveState)
  emotion = driveTriggers.reduce((acc, trigger) => applyEvent(acc, trigger), emotion)

  const somaticTrajectory = computeSomaticTrajectory(prefetch.recentSomaHistory)
  const predictedSoma = predictSomaticState({
    currentSoma: prefetch.currentSoma,
    currentEmotion: emotion,
    moodContext: sense.moodContext,
    vagalState: prefetch.previousVagalState,
    trajectory: somaticTrajectory,
    hourOfDay
  })

  const elapsed = elapsedMinutesSince(prefetch.lastSomaTimestamp)
  const somaticMemories = messageText ? await querySomaticMemories(messageText) : []

  let soma = computeSomaticUpdate({
    current: prefetch.currentSoma,
    emotion,
    elapsedMinutes: elapsed,
    hourOfDay,
    memories: somaticMemories
  })
  if (alteredState && !isExpired(alteredState)) {
    const somaMods = computeSomaModifiers(alteredState)
    soma = applyClampedDeltas(soma, somaMods, new Set(["socialBattery"]))
  }

  const interoceptivePrediction = assembleInteroceptivePrediction(
    predictedSoma,
    soma,
    prefetch.interoceptiveAccuracy,
    prefetch.previousVagalState.zone
  )

  const interoceptiveTriggers = computeInteroceptiveEmotionTriggers(interoceptivePrediction)
  emotion = interoceptiveTriggers.reduce((acc, t) => applyEvent(acc, t), emotion)

  const neuroception = computeNeuroception({
    soma,
    emotion,
    operatorPresent: sense.moodContext.inConversation
  })
  const vagalState = computeVagalTransition(prefetch.previousVagalState, neuroception, sense.moodContext.inConversation)
  const vagalConstraints = computeVagalConstraints(vagalState)

  emotion = applyVagalEmotionConstraints(emotion, vagalConstraints)

  let deferredQueue = prefetch.deferredQueue
  for (const trigger of sense.rawTriggers) {
    deferredQueue = storeDeferredEvent(deferredQueue, trigger.trigger, trigger.intensity, trigger.detail)
  }
  const { matured: maturedDeferredEvents, updated: updatedDeferredQueue } = checkMaturedEvents(deferredQueue)
  for (const maturedEvent of maturedDeferredEvents) {
    emotion = applyEvent(emotion, maturedEventToTrigger(maturedEvent))
  }

  const nostalgia = episodicHits.length > 0 ? detectNostalgia(episodicHits, new Date()) : null
  if (nostalgia) {
    emotion = applyEvent(emotion, nostalgia)
  }

  const proustFlashback = episodicHits.length > 0 ? detectProustFlashback(episodicHits) : null
  if (proustFlashback) {
    emotion = applyClampedDeltas(emotion, proustFlashback.emotionSpike)
  }

  const neuromodulatoryState = computeNeuromodulatorUpdate(
    prefetch.previousNeuromodulatoryState,
    emotion,
    soma,
    Math.max(1, sense.elapsedMinutes)
  )

  if (episodicHits.length > 0) {
    processReconsolidation(episodicHits, emotion, neuromodulatoryState).catch(() => {})
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
    emotionTrigger,
    proustFlashback,
    maturedDeferredEvents,
    updatedDeferredQueue,
    vagalState,
    vagalConstraints,
    interoceptivePrediction,
    appraisalResults,
    neuromodulatoryState,
    constructionResults
  }
}
