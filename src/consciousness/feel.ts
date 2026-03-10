import { getHours } from "date-fns"
import { computeEmotionModifiers, computeSomaModifiers, isExpired } from "@/affect/altered/compute.ts"
import { clearAlteredState, getActiveAlteredState } from "@/affect/altered/state.ts"
import {
  computeDriveEmotionTriggers,
  computeDriveUpdate,
  inferBlockedDrives,
  inferSatisfiedDrives
} from "@/affect/drive/compute.ts"
import { getDriveState, saveDriveState } from "@/affect/drive/state.ts"
import { getAllSecondaryEmotionStates, saveAllSecondaryEmotionStates } from "@/affect/emotion/batch.ts"
import { detectNostalgia } from "@/affect/emotion/nostalgia.ts"
import { computeAttentionState } from "@/cognition/attention.ts"
import { getMetacognitiveState, saveMetacognitiveState } from "@/cognition/awareness.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { updateMetacognitiveState } from "@/cognition/metacognition.ts"
import { saveAttentionState, saveInstinctImpression } from "@/cognition/state.ts"
import { computeCommunicationRegister } from "@/expression/communication/register.ts"
import { getActiveConversation, saveCommunicationRegister } from "@/expression/communication/state.ts"
import { updateCreativeUrgeState } from "@/expression/creativity/compute.ts"
import { getCreativeUrgeState, saveCreativeUrgeState } from "@/expression/creativity/state.ts"
import { DREAM_AFTERGLOW } from "@/expression/dream/constants.ts"
import { clearDreamAfterglow, getDreamAfterglow, saveDreamAfterglow } from "@/expression/dream/state.ts"
import { updateAnticipatoryState } from "@/perception/anticipation/compute.ts"
import { getAnticipatoryState, saveAnticipatoryState } from "@/perception/anticipation/state.ts"
import { getAttachmentStyle } from "@/relational/attachment/state.ts"
import { evaluateAttachmentDynamics, isOperatorReturning } from "@/relational/attachment/update.ts"
import { updateBoundaryState } from "@/self/boundaries/compute.ts"
import { getBoundaryState, saveBoundaryState } from "@/self/boundaries/state.ts"
import { updateCoherenceState } from "@/self/coherence/compute.ts"
import { getCoherenceState, saveCoherenceState } from "@/self/coherence/state.ts"
import { processDeceptionCycle } from "@/self/deception/compute.ts"
import { getDeceptionState, saveDeceptionState } from "@/self/deception/state.ts"
import { buildDissonanceState, checkDissonance, resolveDissonance } from "@/self/dissonance/compute.ts"
import { saveDissonanceState } from "@/self/dissonance/state.ts"
import "@/affect/emotion/init.ts"
import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import { computeShameState, detectColdResponse, getShameState, saveShameState } from "@/affect/emotion/shame.ts"
import {
  getAfterglowEntries,
  getEmotionalMomentum,
  getEmotionalState,
  saveAfterglowEntries,
  saveEmotionalMomentum,
  saveEmotionalState,
  setLastEmotionTimestamp,
  setTriggerTimestamps
} from "@/affect/emotion/state.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow
} from "@/affect/emotion/update.ts"
import {
  getSomaticLastTimestamp,
  getSomaticState,
  querySomaticMemories,
  saveSomaticState
} from "@/affect/soma/state.ts"
import { computeSomaticUpdate } from "@/affect/soma/update.ts"
import { log } from "@/infra/lib/logger.ts"
import { setEmotionContext } from "@/infra/lib/sentry.ts"
import { elapsedMinutesSince, nowISO, nowLocal } from "@/infra/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { getConsecutiveConversationTicks, getConsecutiveIdleTicks, getRecentActions } from "@/memory/working.ts"
import { updateNoveltyState } from "@/perception/novelty/compute.ts"
import { getNoveltyState, saveNoveltyState } from "@/perception/novelty/state.ts"
import { computeSubjectiveTime } from "@/perception/time/compute.ts"
import { DEFAULT_SUBJECTIVE_TIME_STATE } from "@/perception/time/types.ts"
import {
  getVulnerabilityPrevLevel,
  saveVulnerability,
  saveVulnerableMessageStyle
} from "@/relational/attachment/store.ts"
import {
  computeIntimacyScore,
  computeVulnerability,
  computeVulnerableMessageStyle
} from "@/relational/attachment/vulnerability.ts"
import {
  getOperatorModel,
  getRelationalPatterns,
  saveOperatorModel,
  saveRelationalPatterns
} from "@/relational/mind/state.ts"
import { extractSignals, learnFromObservation } from "@/relational/mind/triggers.ts"
import { detectModelCorrection, updateOperatorModel } from "@/relational/mind/update.ts"
import { getAggregateTrustExperience } from "@/relational/trust/compute.ts"
import {
  addToBuffer,
  decayBuffer,
  detectSuppression,
  getHeldBackBuffer,
  type HeldBackReason,
  saveHeldBackBuffer
} from "@/self/psyche/heldback.ts"
import { getSelfConcept } from "@/self/psyche/state.ts"
import { buildEmotionContext, type SharedEmotionInput } from "./emotions.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

function applyEmotionEffect(
  emotion: EmotionalState,
  effect: Partial<Record<keyof EmotionalState, number>>
): EmotionalState {
  let result = emotion
  for (const [dimension, delta] of Object.entries(effect)) {
    const key = dimension as keyof EmotionalState
    if (key in result) {
      result = { ...result, [key]: Math.max(0, Math.min(1, result[key] + delta)) }
    }
  }
  return result
}

function describeSuppressedState(emotion: EmotionalState, reason: HeldBackReason): string {
  const intensity = reason === "shame_suppression" ? "intensely" : "quietly"
  const dominant = (["frustration", "connection", "caution", "curiosity", "satisfaction"] as const)
    .filter((k) => emotion[k] > 0.6)
    .join(", ")
  return dominant
    ? `feeling ${dominant} ${intensity} but holding it back (${reason.replace(/_/g, " ")})`
    : `something stirring inside but suppressed (${reason.replace(/_/g, " ")})`
}

async function computeSecondaryEmotions(
  shared: SharedEmotionInput
): Promise<{ emotion: EmotionalState; states: Record<string, unknown> }> {
  const previousStates = await getAllSecondaryEmotionStates()
  const computedStates = new Map<string, SecondaryEmotionState>()
  computedStates.set("shame", shared.shameState)

  let emotion = shared.emotion

  for (const entry of getRegisteredEmotions()) {
    if (entry.name === "shame") continue
    const previous = previousStates.get(entry.name) ?? entry.defaultState
    const context = buildEmotionContext(entry.name, { ...shared, emotion }, previous, previousStates, computedStates)
    const state = entry.compute(context)
    computedStates.set(entry.name, state)
    if (entry.computeEffect && state.isActive) {
      emotion = applyEmotionEffect(emotion, entry.computeEffect(state))
    }
  }

  const statesToSave = new Map(computedStates)
  statesToSave.delete("shame")
  await saveAllSecondaryEmotionStates(statesToSave)

  if ([...computedStates.values()].some((s) => s.isActive)) {
    await saveEmotionalState(emotion, "ambient")
  }

  const states: Record<string, unknown> = {}
  for (const [name, state] of computedStates) {
    if (name !== "shame") states[name] = state
  }

  return { emotion, states }
}

/**
 * FEEL phase — pre-cognitive processing between SENSE and DELIBERATE.
 * Updates somatic markers, instinct, dissonance, attachment, vulnerability, and self-concept.
 */
export async function feel(senseResult: SenseResult): Promise<FeelingResult> {
  const currentEmotion = await getEmotionalState()
  const computed = computeEmotionalUpdate(
    currentEmotion,
    senseResult.rawTriggers,
    senseResult.moodContext,
    Math.max(1, senseResult.elapsedMinutes),
    senseResult.triggerTimestamps
  )

  const [previousMomentum, existingAfterglow] = await Promise.all([getEmotionalMomentum(), getAfterglowEntries()])

  const eventIntensity = computeEmotionalIntensity(computed)
  const { state: momentumState, momentum: newMomentum } = applyMomentum(
    computed,
    currentEmotion,
    previousMomentum,
    eventIntensity
  )

  const { state: afterglowState, remainingEntries } = applyAfterglow(momentumState, existingAfterglow)
  const newAfterglowEntries = detectAfterglow(afterglowState, currentEmotion)
  const allAfterglowEntries = [...remainingEntries, ...newAfterglowEntries]

  let emotion = afterglowState

  const dreamAfterglow = await getDreamAfterglow()
  if (dreamAfterglow && dreamAfterglow.intensity >= DREAM_AFTERGLOW.MIN_INTENSITY) {
    for (const [dimension, residue] of Object.entries(dreamAfterglow.emotionalResidue)) {
      const key = dimension as keyof typeof emotion
      if (key in emotion && typeof residue === "number") {
        emotion = {
          ...emotion,
          [key]: Math.max(
            0,
            Math.min(1, emotion[key] + residue * dreamAfterglow.intensity * DREAM_AFTERGLOW.BLEND_WEIGHT)
          )
        }
      }
    }
    const decayedAfterglow = { ...dreamAfterglow, intensity: dreamAfterglow.intensity * DREAM_AFTERGLOW.DECAY_PER_TICK }
    if (decayedAfterglow.intensity >= DREAM_AFTERGLOW.MIN_INTENSITY) {
      await saveDreamAfterglow(decayedAfterglow)
    } else {
      await clearDreamAfterglow()
    }
  }

  const alteredState = await getActiveAlteredState()
  if (alteredState) {
    if (isExpired(alteredState)) {
      await clearAlteredState()
    } else {
      const emotionMods = computeEmotionModifiers(alteredState)
      for (const [dimension, delta] of Object.entries(emotionMods)) {
        const key = dimension as keyof typeof emotion
        if (key in emotion) {
          emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
        }
      }
    }
  }

  await Promise.all([saveEmotionalMomentum(newMomentum), saveAfterglowEntries(allAfterglowEntries)])

  const timestampNow = nowISO()
  await Promise.all([
    setLastEmotionTimestamp(timestampNow),
    setTriggerTimestamps(senseResult.rawTriggers.map((event) => ({ trigger: event.trigger, timestamp: timestampNow })))
  ])

  const previousDriveState = await getDriveState()
  const satisfied = inferSatisfiedDrives(
    senseResult.moodContext.inConversation,
    senseResult.pendingMessages.length,
    "idle"
  )
  const blocked = inferBlockedDrives(
    senseResult.moodContext.operatorSilenceMinutes,
    await getConsecutiveIdleTicks(),
    senseResult.moodContext.isDreaming
  )
  const driveState = computeDriveUpdate({
    current: previousDriveState,
    elapsedMinutes: Math.max(1, senseResult.elapsedMinutes),
    blocked,
    satisfied
  })
  const driveTriggers = computeDriveEmotionTriggers(driveState)
  for (const trigger of driveTriggers) {
    emotion = applyEvent(emotion, trigger)
  }
  await saveDriveState(driveState)

  const [
    currentSoma,
    lastSomaTs,
    selfConcept,
    attachmentStyle,
    trustExperience,
    previousOperatorModel,
    deceptionState,
    activeConversation,
    consecutiveIdleTicks,
    consecutiveConversationTicks
  ] = await Promise.all([
    getSomaticState(),
    getSomaticLastTimestamp(),
    getSelfConcept(),
    getAttachmentStyle(),
    getAggregateTrustExperience(),
    getOperatorModel(),
    getDeceptionState(),
    getActiveConversation(),
    getConsecutiveIdleTicks(),
    getConsecutiveConversationTicks()
  ])

  const elapsed = elapsedMinutesSince(lastSomaTs)

  const messageText = senseResult.pendingMessages.map((m) => m.text).join(" ")
  const somaticMemories = messageText ? await querySomaticMemories(messageText) : []

  let soma = computeSomaticUpdate(currentSoma, emotion, elapsed, somaticMemories)
  if (alteredState && !isExpired(alteredState)) {
    const somaMods = computeSomaModifiers(alteredState)
    for (const [dimension, delta] of Object.entries(somaMods)) {
      const key = dimension as keyof typeof soma
      if (key in soma && key !== "socialBattery") {
        soma = { ...soma, [key]: Math.max(0, Math.min(1, soma[key] + delta)) }
      }
    }
  }
  await saveSomaticState(soma, "feel_phase")

  const episodicHits = messageText ? await queryRelated(messageText, 5) : []
  const nostalgia = episodicHits.length > 0 ? detectNostalgia(episodicHits, new Date()) : null
  if (nostalgia) {
    emotion = applyEvent(emotion, nostalgia)
  }

  await saveEmotionalState(emotion, nostalgia ? "nostalgia_wave" : (senseResult.rawTriggers[0]?.trigger ?? "ambient"))
  setEmotionContext(emotion)

  const instinct = await computeInstinctImpression(senseResult.pendingMessages, emotion, soma)
  await saveInstinctImpression(instinct)

  const [knowledgeResult, recentActions] = await Promise.all([
    getKnowledge({ category: "insight", scope: "self" }),
    getRecentActions()
  ])

  const selfKnowledge = knowledgeResult.isOk() ? knowledgeResult.value.map((k) => ({ key: k.key, value: k.value })) : []

  let dissonanceEvents = await checkDissonance(recentActions, selfConcept, emotion, selfKnowledge)
  dissonanceEvents = dissonanceEvents.map((event) => ({
    ...event,
    resolution: resolveDissonance(event, emotion)
  }))
  const dissonance = buildDissonanceState(dissonanceEvents)
  await saveDissonanceState(dissonance)

  const operatorSilenceMinutes = senseResult.moodContext.operatorSilenceMinutes
  const operatorJustReturned = isOperatorReturning(senseResult.pendingMessages.length, operatorSilenceMinutes)

  const silenceFactor = Math.min(1, operatorSilenceMinutes / 120)
  const earlyWaitingPerception = Math.min(1, silenceFactor * (1 + attachmentStyle.anxious * 0.5))

  const attachmentDynamics = evaluateAttachmentDynamics(attachmentStyle, {
    operatorSilenceMinutes,
    operatorJustReturned,
    inConversation: senseResult.moodContext.inConversation,
    connectionLevel: emotion.connection,
    frustrationLevel: emotion.frustration,
    cautionLevel: emotion.caution,
    trustExperience,
    waitingPerception: earlyWaitingPerception
  })

  const messageTexts = senseResult.pendingMessages.map((m) => m.text)
  const messageTimestamps = senseResult.pendingMessages.map((m) => new Date(m.date * 1000).toISOString())
  const operatorModel = await updateOperatorModel({
    messageTexts,
    messageTimestamps,
    silenceMinutes: operatorSilenceMinutes,
    previousModel: previousOperatorModel
  })
  const correction = detectModelCorrection(previousOperatorModel, operatorModel)
  if (correction) {
    operatorModel.modelConfidence = Math.max(0.1, operatorModel.modelConfidence - 0.1)
    operatorModel.correctionCount++
  }
  await saveOperatorModel(operatorModel, correction ? "correction" : "update")

  if (messageTexts.length > 0) {
    const signals = extractSignals(messageTexts)
    const currentPatterns = await getRelationalPatterns()
    const updatedPatterns = learnFromObservation(signals, operatorModel, currentPatterns)
    if (updatedPatterns !== currentPatterns) {
      await saveRelationalPatterns(updatedPatterns)
    }
  }

  const hourOfDay = getHours(nowLocal())
  const prevLevel = await getVulnerabilityPrevLevel()
  const vulnerability = computeVulnerability({
    trustExperience,
    attachmentSecurity: attachmentStyle.secure,
    connectionLevel: emotion.connection,
    somaticOpenness: soma.openness,
    hourOfDay,
    recentIntimacyScore: computeIntimacyScore(emotion.connection, selfConcept.selfWorth),
    authenticity: selfConcept.authenticity,
    energyLevel: emotion.energy,
    prevLevel
  })
  await saveVulnerability(vulnerability)

  const vulnerableStyle = computeVulnerableMessageStyle(vulnerability)
  await saveVulnerableMessageStyle(vulnerableStyle)

  const previousShame = await getShameState()
  const previousVulnerabilityWasOpen = previousShame.trigger !== "" ? vulnerability.windowOpen : false
  const operatorRespondedColdly = detectColdResponse(
    operatorModel,
    messageTexts,
    previousVulnerabilityWasOpen || vulnerability.windowOpen
  )
  const recentAnimaMessages = activeConversation?.messages.filter((m) => m.role === "anima").slice(-3) ?? []
  const recentSelfDisclosure = vulnerableStyle.selfDisclosureDepth > 0.4 && recentAnimaMessages.length > 0

  const shameState = computeShameState({
    selfConcept,
    emotion,
    vulnerability,
    operatorModel,
    previousShame,
    operatorRespondedColdly,
    recentSelfDisclosure
  })
  await saveShameState(shameState)

  const previousBuffer = await getHeldBackBuffer()
  const decayedBuffer = decayBuffer(previousBuffer)
  const suppressionReason = detectSuppression({ emotion, vulnerability, shameState, previousBuffer: decayedBuffer })
  const heldBackBuffer = suppressionReason
    ? addToBuffer(decayedBuffer, describeSuppressedState(emotion, suppressionReason), suppressionReason)
    : decayedBuffer
  await saveHeldBackBuffer(heldBackBuffer)

  const [previousAnticipation, previousBoundaryState] = await Promise.all([getAnticipatoryState(), getBoundaryState()])

  const anticipatoryState = updateAnticipatoryState(
    previousAnticipation,
    {
      inConversation: senseResult.moodContext.inConversation,
      operatorSilenceMinutes,
      connectionLevel: emotion.connection,
      hasCalendarEvents: false
    },
    operatorJustReturned,
    operatorSilenceMinutes,
    senseResult.moodContext.inConversation
  )
  await saveAnticipatoryState(anticipatoryState)

  const messageTextsForBoundary = senseResult.pendingMessages.map((m) => m.text)
  const boundaryState = updateBoundaryState(previousBoundaryState, messageTextsForBoundary, {
    trustLevel: trustExperience,
    attachmentSecurity: attachmentStyle.secure,
    vulnerabilityLevel: vulnerability.level
  })
  await saveBoundaryState(boundaryState)

  const previousNovelty = await getNoveltyState()
  const noveltyState = updateNoveltyState(
    previousNovelty,
    senseResult.pendingMessages.map((m) => m.text),
    emotion
  )
  await saveNoveltyState(noveltyState)

  const secondaryResult = await computeSecondaryEmotions({
    emotion,
    shameState,
    vulnerability,
    operatorModel,
    senseResult,
    operatorSilenceMinutes,
    selfDisclosureDepth: vulnerableStyle.selfDisclosureDepth,
    operatorJustReturned,
    consecutiveIdleTicks,
    consecutiveConversationTicks,
    episodicHitCount: episodicHits.length,
    inConversation: senseResult.moodContext.inConversation,
    pendingMessageCount: senseResult.pendingMessages.length,
    triggeredWorkflowCount: senseResult.triggeredWorkflows.length,
    isDreaming: senseResult.moodContext.isDreaming,
    noveltyLevel: noveltyState.level,
    anticipatoryViolations: anticipatoryState.recentViolations
  })
  emotion = secondaryResult.emotion

  const emotionalIntensity = computeEmotionalIntensity(emotion)
  const subjectiveTime = computeSubjectiveTime(DEFAULT_SUBJECTIVE_TIME_STATE, {
    emotion,
    consecutiveIdleTicks,
    inConversation: senseResult.moodContext.inConversation,
    operatorSilenceMinutes,
    attachmentAnxiety: attachmentStyle.anxious,
    emotionalIntensity
  })

  const previousCreativeUrge = await getCreativeUrgeState()
  const creativeUrge = updateCreativeUrgeState(previousCreativeUrge, {
    emotion,
    driveState,
    heldBackBuffer,
    consecutiveIdleTicks
  })
  await saveCreativeUrgeState(creativeUrge)

  const updatedDeception = await processDeceptionCycle(deceptionState, {
    dissonance,
    selfConcept,
    vulnerabilityOpen: vulnerability.windowOpen,
    isDreaming: senseResult.moodContext.isDreaming,
    isReflecting: false
  })
  const register = computeCommunicationRegister(emotion, soma, vulnerability, shameState)

  const conversationMessageCount = activeConversation?.messages.length ?? 0
  const attentionState = computeAttentionState(
    emotion,
    soma,
    senseResult.pendingMessages.length > 0,
    consecutiveIdleTicks,
    conversationMessageCount
  )

  await Promise.all([
    saveDeceptionState(updatedDeception),
    saveCommunicationRegister(register),
    saveAttentionState(attentionState)
  ])

  const previousCoherence = await getCoherenceState()
  const stressLevel = (emotion.frustration + soma.tension + emotion.caution) / 3
  const coherenceState = updateCoherenceState(previousCoherence, {
    emotion,
    soma,
    driveState,
    dissonanceScore: dissonance.activeDissonance,
    selfConceptAuthenticity: selfConcept.authenticity,
    stressLevel
  })
  await saveCoherenceState(coherenceState)

  const previousMetacognition = await getMetacognitiveState()
  const metacognitiveState = updateMetacognitiveState(previousMetacognition, {
    emotion,
    soma,
    coherenceScore: coherenceState.integrationScore,
    recentReasonings: recentActions,
    isComplexDecision: false,
    isDreaming: senseResult.moodContext.isDreaming
  })
  await saveMetacognitiveState(metacognitiveState)

  const activeEmotions: Record<string, string> = {}
  for (const [name, state] of Object.entries(secondaryResult.states)) {
    const s = state as SecondaryEmotionState
    if (s.isActive) {
      activeEmotions[name] = s.level.toFixed(2)
    }
  }

  log.info("Feel complete", {
    somaticTension: soma.tension.toFixed(2),
    instinctImpulse: instinct.impulse,
    dissonance: dissonance.activeDissonance.toFixed(2),
    vulnerabilityOpen: vulnerability.windowOpen,
    shameActive: shameState.isActive,
    activeSecondaryEmotions: activeEmotions,
    heldBackEntries: heldBackBuffer.entries.length,
    suppressionPressure: heldBackBuffer.suppressionPressure.toFixed(2),
    register,
    attentionState,
    operatorMood: operatorModel.estimatedMood
  })

  return {
    emotion,
    soma,
    instinct,
    dissonance,
    vulnerability,
    shameState,
    heldBackBuffer,
    secondaryEmotions: secondaryResult.states,
    attachmentDynamics,
    selfConcept,
    register,
    attentionState,
    operatorModel,
    driveState,
    anticipatoryState,
    subjectiveTime,
    coherenceState,
    creativeUrge,
    boundaryState,
    metacognitiveState
  }
}
