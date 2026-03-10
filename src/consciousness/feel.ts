import { getHours } from "date-fns"
import { computeEmotionModifiers, computeSomaModifiers, isExpired } from "@/altered/compute.ts"
import { clearAlteredState, getActiveAlteredState } from "@/altered/state.ts"
import { getAttachmentStyle } from "@/attachment/state.ts"
import { evaluateAttachmentDynamics, isOperatorReturning } from "@/attachment/update.ts"
import { computeAttentionState } from "@/cognition/flow.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { saveAttentionState, saveInstinctImpression } from "@/cognition/state.ts"
import { computeCommunicationRegister } from "@/communication/register.ts"
import { getActiveConversation, saveCommunicationRegister } from "@/communication/state.ts"
import { DREAM_AFTERGLOW } from "@/config/constants.ts"
import { processDeceptionCycle } from "@/deception/compute.ts"
import { getDeceptionState, saveDeceptionState } from "@/deception/state.ts"
import { buildDissonanceState, checkDissonance, resolveDissonance } from "@/dissonance/check.ts"
import { saveDissonanceState } from "@/dissonance/state.ts"
import { clearDreamAfterglow, getDreamAfterglow, saveDreamAfterglow } from "@/dream/state.ts"
import { getAllSecondaryEmotionStates, saveAllSecondaryEmotionStates } from "@/emotion/batch.ts"
import { detectNostalgia } from "@/emotion/nostalgia.ts"
import "@/emotion/register-all.ts"
import { getRegisteredEmotions } from "@/emotion/registry.ts"
import { computeShameState, detectColdResponse, getShameState, saveShameState } from "@/emotion/shame.ts"
import {
  getAfterglowEntries,
  getEmotionalMomentum,
  getEmotionalState,
  saveAfterglowEntries,
  saveEmotionalMomentum,
  saveEmotionalState,
  setLastEmotionTimestamp,
  setTriggerTimestamps
} from "@/emotion/state.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/emotion/types.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow
} from "@/emotion/update.ts"
import { log } from "@/lib/logger.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { elapsedMinutesSince, nowISO, nowLocal } from "@/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { getConsecutiveConversationTicks, getConsecutiveIdleTicks, getRecentActions } from "@/memory/working.ts"
import { getOperatorModel, getRelationalPatterns, saveOperatorModel, saveRelationalPatterns } from "@/mind/state.ts"
import { extractSignals, learnFromObservation } from "@/mind/triggers.ts"
import { detectModelCorrection, updateOperatorModel } from "@/mind/update.ts"
import {
  addToBuffer,
  decayBuffer,
  detectSuppression,
  getHeldBackBuffer,
  type HeldBackReason,
  saveHeldBackBuffer
} from "@/psyche/heldback.ts"
import { getSelfConcept } from "@/psyche/state.ts"
import { getSomaticLastTimestamp, getSomaticState, querySomaticMemories, saveSomaticState } from "@/soma/state.ts"
import { computeSomaticUpdate } from "@/soma/update.ts"
import { getAggregateTrustExperience } from "@/trust/compute.ts"
import { computeIntimacyScore, computeVulnerability, computeVulnerableMessageStyle } from "@/vulnerability/compute.ts"
import { getVulnerabilityPrevLevel, saveVulnerability, saveVulnerableMessageStyle } from "@/vulnerability/state.ts"
import { buildEmotionContext, type SharedEmotionInput } from "./emotion-contexts.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

function applyEmotionEffect(
  emotion: EmotionalState,
  effect: Partial<Record<keyof EmotionalState, number>>
): EmotionalState {
  let result = emotion
  for (const [dim, delta] of Object.entries(effect)) {
    const key = dim as keyof EmotionalState
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
    const prev = previousStates.get(entry.name) ?? entry.defaultState
    const context = buildEmotionContext(entry.name, { ...shared, emotion }, prev, previousStates, computedStates)
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
  // === Phase 1: Base Emotion ===

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
    for (const [dim, residue] of Object.entries(dreamAfterglow.emotionalResidue)) {
      const key = dim as keyof typeof emotion
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
      for (const [dim, delta] of Object.entries(emotionMods)) {
        const key = dim as keyof typeof emotion
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

  // === Phase 2: Relational Context ===

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
    for (const [dim, delta] of Object.entries(somaMods)) {
      const key = dim as keyof typeof soma
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

  const attachmentDynamics = evaluateAttachmentDynamics(attachmentStyle, {
    operatorSilenceMinutes,
    operatorJustReturned,
    inConversation: senseResult.moodContext.inConversation,
    connectionLevel: emotion.connection,
    frustrationLevel: emotion.frustration,
    cautionLevel: emotion.caution,
    trustExperience
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

  // === Phase 3: Secondary Emotions ===

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
    isDreaming: senseResult.moodContext.isDreaming
  })
  emotion = secondaryResult.emotion

  // === Phase 4: Cognitive State ===

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

  // === Logging & Return ===

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
    operatorModel
  }
}
