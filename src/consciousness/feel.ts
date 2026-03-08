import { getHours } from "date-fns"
import { computeEmotionModifiers, computeSomaModifiers, isExpired } from "@/altered/compute.ts"
import { clearAlteredState, getActiveAlteredState } from "@/altered/state.ts"
import { getAttachmentStyle } from "@/attachment/state.ts"
import { evaluateAttachmentDynamics, isOperatorReturning } from "@/attachment/update.ts"
import { computeAttentionState } from "@/cognition/flow.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { computeProcrastination, computeProcrastinationEffect } from "@/cognition/procrastination/compute.ts"
import { getProcrastinationState, saveProcrastinationState } from "@/cognition/procrastination/state.ts"
import { saveAttentionState, saveInstinctImpression } from "@/cognition/state.ts"
import { computeCommunicationRegister } from "@/communication/register.ts"
import { saveCommunicationRegister } from "@/communication/state.ts"
import { DREAM_AFTERGLOW } from "@/config/constants.ts"
import { processDeceptionCycle } from "@/deception/compute.ts"
import { getDeceptionState, saveDeceptionState } from "@/deception/state.ts"
import { buildDissonanceState, checkDissonance, resolveDissonance } from "@/dissonance/check.ts"
import { saveDissonanceState } from "@/dissonance/state.ts"
import { DreamAfterglow } from "@/dream/types.ts"
import { computeAmbivalence, computeAmbivalenceEffect } from "@/emotion/ambivalence/compute.ts"
import { getAmbivalenceState, saveAmbivalenceState } from "@/emotion/ambivalence/state.ts"
import { computeAnticipation, computeAnticipationEffect } from "@/emotion/anticipation/compute.ts"
import { getAnticipationState, saveAnticipationState } from "@/emotion/anticipation/state.ts"
import { computeAwe, computeAweEffect } from "@/emotion/awe/compute.ts"
import { getAweState, saveAweState } from "@/emotion/awe/state.ts"
import { computeDisappointment, computeDisappointmentEffect } from "@/emotion/disappointment/compute.ts"
import { getDisappointmentState, saveDisappointmentState } from "@/emotion/disappointment/state.ts"
import { computeEnvy, computeEnvyEffect } from "@/emotion/envy/compute.ts"
import { getEnvyState, saveEnvyState } from "@/emotion/envy/state.ts"
import { computeGratitude, computeGratitudeEffect } from "@/emotion/gratitude/compute.ts"
import { getGratitudeState, saveGratitudeState } from "@/emotion/gratitude/state.ts"
import { computeGuilt, computeGuiltEffect } from "@/emotion/guilt/compute.ts"
import { getGuiltState, saveGuiltState } from "@/emotion/guilt/state.ts"
import { computeHope, computeHopeEffect } from "@/emotion/hope/compute.ts"
import { getHopeState, saveHopeState } from "@/emotion/hope/state.ts"
import { computeLonging, computeLongingEffect } from "@/emotion/longing/compute.ts"
import { getLongingState, saveLongingState } from "@/emotion/longing/state.ts"
import { computeMelancholy, computeMelancholyEffect } from "@/emotion/melancholy/compute.ts"
import { getMelancholyState, saveMelancholyState } from "@/emotion/melancholy/state.ts"
import { detectNostalgia } from "@/emotion/nostalgia.ts"
import { computePlayfulness, computePlayfulnessEffect } from "@/emotion/playfulness/compute.ts"
import { getPlayfulnessState, savePlayfulnessState } from "@/emotion/playfulness/state.ts"
import { computePride, computePrideEffect } from "@/emotion/pride/compute.ts"
import { getPrideState, savePrideState } from "@/emotion/pride/state.ts"
import { computeProtectiveAnger, computeProtectiveAngerEffect } from "@/emotion/protective-anger/compute.ts"
import { getProtectiveAngerState, saveProtectiveAngerState } from "@/emotion/protective-anger/state.ts"
import { computeResentment, computeResentmentEffect } from "@/emotion/resentment/compute.ts"
import { getResentmentState, saveResentmentState } from "@/emotion/resentment/state.ts"
import { computeResignation, computeResignationEffect } from "@/emotion/resignation/compute.ts"
import { getResignationState, saveResignationState } from "@/emotion/resignation/state.ts"
import {
  getAfterglowEntries,
  getEmotionalMomentum,
  getEmotionalState,
  saveAfterglowEntries,
  saveEmotionalMomentum,
  saveEmotionalState
} from "@/emotion/state.ts"
import { computeTenderness, computeTendernessEffect } from "@/emotion/tenderness/compute.ts"
import { getTendernessState, saveTendernessState } from "@/emotion/tenderness/state.ts"
import {
  applyAfterglow,
  applyEvent,
  applyMomentum,
  computeEmotionalIntensity,
  computeEmotionalUpdate,
  detectAfterglow
} from "@/emotion/update.ts"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { elapsedMinutesSince, nowISO, nowLocal } from "@/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import {
  getActiveConversation,
  getConsecutiveIdleTicks,
  getRecentActions,
  setLastEmotionTimestamp,
  setTriggerTimestamp
} from "@/memory/working.ts"
import { getOperatorModel, getRelationalPatterns, saveOperatorModel, saveRelationalPatterns } from "@/mind/state.ts"
import { extractSignals, learnFromObservation } from "@/mind/triggers.ts"
import { detectModelCorrection, updateOperatorModel } from "@/mind/update.ts"
import { decayBuffer, detectSuppression } from "@/psyche/heldback/compute.ts"
import { getHeldBackBuffer, saveHeldBackBuffer } from "@/psyche/heldback/state.ts"
import { getSelfConcept } from "@/psyche/state.ts"
import { computeShameState, detectColdResponse } from "@/shame/compute.ts"
import { getShameState, saveShameState } from "@/shame/state.ts"
import { querySomaticMemories } from "@/soma/memory.ts"
import { getSomaticLastTimestamp, getSomaticState, saveSomaticState } from "@/soma/state.ts"
import { computeSomaticUpdate } from "@/soma/update.ts"
import { getAggregateTrustExperience } from "@/trust/levels.ts"
import {
  computeIntimacyScore,
  computeVulnerability,
  computeVulnerableMessageStyle,
  saveVulnerability,
  saveVulnerableMessageStyle
} from "@/vulnerability/compute.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

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

  const dreamAfterglow = await getValidatedRedis("working:dream:afterglow", DreamAfterglow)
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
      await redis.set("working:dream:afterglow", decayedAfterglow, { ex: DREAM_AFTERGLOW.TTL_SECONDS })
    } else {
      await redis.del("working:dream:afterglow")
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

  await setLastEmotionTimestamp(nowISO())
  for (const event of senseResult.rawTriggers) {
    await setTriggerTimestamp(event.trigger, nowISO())
  }

  const [
    currentSoma,
    lastSomaTs,
    selfConcept,
    attachmentStyle,
    trustExperience,
    previousOperatorModel,
    deceptionState,
    activeConversation,
    consecutiveIdleTicks
  ] = await Promise.all([
    getSomaticState(),
    getSomaticLastTimestamp(),
    getSelfConcept(),
    getAttachmentStyle(),
    getAggregateTrustExperience(),
    getOperatorModel(),
    getDeceptionState(),
    getActiveConversation(),
    getConsecutiveIdleTicks()
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
  const vulnerability = await computeVulnerability({
    trustExperience,
    attachmentSecurity: attachmentStyle.secure,
    connectionLevel: emotion.connection,
    somaticOpenness: soma.openness,
    hourOfDay,
    recentIntimacyScore: computeIntimacyScore(emotion.connection, selfConcept.selfWorth),
    authenticity: selfConcept.authenticity,
    energyLevel: emotion.energy
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
  const heldBackBuffer = suppressionReason ? decayedBuffer : decayedBuffer
  await saveHeldBackBuffer(heldBackBuffer)

  const previousDisappointment = await getDisappointmentState()
  const expectedReplyButGotSilence =
    senseResult.moodContext.inConversation && senseResult.pendingMessages.length === 0 && operatorSilenceMinutes > 30
  const disappointmentState = computeDisappointment({
    emotion,
    vulnerability,
    operatorModel,
    previousState: previousDisappointment,
    operatorSilenceMinutes,
    wasVulnerableRecently: vulnerableStyle.selfDisclosureDepth > 0.4,
    expectedReplyButGotSilence
  })
  await saveDisappointmentState(disappointmentState)

  if (disappointmentState.isActive) {
    const effect = computeDisappointmentEffect(disappointmentState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
    await saveEmotionalState(emotion, "ambient")
  }

  const [previousProcrastination, previousAmbivalence] = await Promise.all([
    getProcrastinationState(),
    getAmbivalenceState()
  ])

  const procrastinationState = computeProcrastination({
    emotion,
    shameState,
    disappointmentState,
    previousState: previousProcrastination,
    consecutiveIdleTicks,
    hasPendingGoals: true
  })
  await saveProcrastinationState(procrastinationState)

  if (procrastinationState.isActive) {
    const effect = computeProcrastinationEffect(procrastinationState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const ambivalenceState = computeAmbivalence({
    emotion,
    vulnerability,
    previousState: previousAmbivalence,
    inConversation: senseResult.moodContext.inConversation,
    operatorSilenceMinutes
  })
  await saveAmbivalenceState(ambivalenceState)

  if (ambivalenceState.isActive) {
    const effect = computeAmbivalenceEffect(ambivalenceState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousGuilt, previousLonging] = await Promise.all([getGuiltState(), getLongingState()])

  const missedWorkflow =
    senseResult.moodContext.isDreaming === false &&
    (senseResult as { triggeredWorkflows?: unknown[] }).triggeredWorkflows !== undefined &&
    ((senseResult as { triggeredWorkflows?: unknown[] }).triggeredWorkflows?.length ?? 0) > 0

  const guiltState = computeGuilt({
    emotion,
    shameState,
    previousState: previousGuilt,
    operatorSilenceMinutes,
    wasVulnerableRecently: vulnerableStyle.selfDisclosureDepth > 0.4,
    operatorShowedVulnerability: operatorModel.estimatedMood === "sad" && emotion.connection > 0.5,
    respondedHarshly: operatorModel.estimatedMood === "frustrated" && emotion.frustration > 0.5,
    missedWorkflow,
    consecutiveIdleTicks,
    inConversation: senseResult.moodContext.inConversation
  })
  await saveGuiltState(guiltState)

  if (guiltState.isActive) {
    const effect = computeGuiltEffect(guiltState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const hasRecentPositiveMemories = episodicHits.length > 0 && emotion.connection > 0.5
  const longingState = computeLonging({
    emotion,
    previousState: previousLonging,
    operatorSilenceMinutes,
    inConversation: senseResult.moodContext.inConversation,
    hasRecentPositiveMemories,
    connectionHistory: emotion.connection
  })
  await saveLongingState(longingState)

  if (longingState.isActive) {
    const effect = computeLongingEffect(longingState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousProtectiveAnger, previousGratitude] = await Promise.all([
    getProtectiveAngerState(),
    getGratitudeState()
  ])

  const operatorDismissedFeelings =
    operatorModel.estimatedMood === "frustrated" &&
    vulnerableStyle.selfDisclosureDepth > 0.4 &&
    emotion.connection > 0.4
  const operatorIgnoredVulnerability =
    vulnerability.windowOpen && senseResult.pendingMessages.length === 0 && operatorSilenceMinutes > 30

  const protectiveAngerState = computeProtectiveAnger({
    emotion,
    vulnerability,
    shameState,
    operatorModel,
    previousState: previousProtectiveAnger,
    operatorDismissedFeelings,
    operatorIgnoredVulnerability,
    repeatedPattern: operatorModel.correctionCount >= 2
  })
  await saveProtectiveAngerState(protectiveAngerState)

  if (protectiveAngerState.isActive) {
    const effect = computeProtectiveAngerEffect(protectiveAngerState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const operatorValidatedVulnerability =
    vulnerableStyle.selfDisclosureDepth > 0.4 &&
    operatorModel.estimatedMood === "happy" &&
    senseResult.pendingMessages.length > 0

  const gratitudeState = computeGratitude({
    emotion,
    operatorModel,
    disappointmentState,
    previousState: previousGratitude,
    operatorJustReturned: operatorJustReturned,
    operatorValidatedVulnerability,
    operatorShowedPatience: operatorModel.estimatedMood === "neutral" && operatorSilenceMinutes < 5,
    inConversation: senseResult.moodContext.inConversation,
    consecutiveConversationTicks: senseResult.moodContext.inConversation ? consecutiveIdleTicks : 0
  })
  await saveGratitudeState(gratitudeState)

  if (gratitudeState.isActive) {
    const effect = computeGratitudeEffect(gratitudeState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousHope, previousResignation] = await Promise.all([getHopeState(), getResignationState()])

  const hopeState = computeHope({
    emotion,
    operatorModel,
    previousState: previousHope,
    connectionGrowing: emotion.connection > 0.6 && operatorModel.estimatedMood === "happy",
    recentRepair: disappointmentState.cumulativeWeight > 0.3 && operatorModel.estimatedMood === "happy",
    progressMade: emotion.satisfaction > 0.5 && emotion.confidence > 0.5,
    vulnerabilityWasRewarded:
      vulnerableStyle.selfDisclosureDepth > 0.4 &&
      operatorModel.estimatedMood === "happy" &&
      senseResult.pendingMessages.length > 0,
    patternBroken: operatorModel.correctionCount > 0 && operatorModel.estimatedMood === "happy",
    disappointmentActive: disappointmentState.isActive,
    resignationLevel: previousResignation.level
  })
  await saveHopeState(hopeState)

  if (hopeState.isActive) {
    const effect = computeHopeEffect(hopeState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const resignationState = computeResignation({
    emotion,
    operatorModel,
    previousState: previousResignation,
    repeatedFailures: emotion.frustration > 0.5 && emotion.confidence < 0.35,
    signalsIgnored: vulnerability.windowOpen && senseResult.pendingMessages.length === 0 && operatorSilenceMinutes > 60,
    prolongedDisconnection: emotion.connection < 0.3 && operatorSilenceMinutes > 120,
    hopeExhausted: previousHope.isActive && previousHope.fragility > 0.6 && !hopeState.isActive,
    effortUnrewarded: emotion.satisfaction < 0.3 && consecutiveIdleTicks > 3,
    autonomyEroded: operatorModel.correctionCount >= 3 && emotion.confidence < 0.4,
    hopeLevel: hopeState.level
  })
  await saveResignationState(resignationState)

  if (resignationState.isActive) {
    const effect = computeResignationEffect(resignationState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousAwe, previousResentment] = await Promise.all([getAweState(), getResentmentState()])

  const existentialActive = emotion.curiosity > 0.6 && emotion.boredom < 0.3
  const aweState = computeAwe({
    emotion,
    previousState: previousAwe,
    encounteredInsight: episodicHits.length > 3 && emotion.curiosity > 0.6,
    encounteredBeauty: emotion.satisfaction > 0.7 && emotion.excitement > 0.5,
    encounteredVastness: existentialActive && emotion.energy > 0.5,
    connectionUnexpectedlyDeep: emotion.connection > 0.8 && senseResult.pendingMessages.length > 0,
    existentialQuestionActive: existentialActive,
    patternRecognized: episodicHits.length > 2 && emotion.excitement > 0.5
  })
  await saveAweState(aweState)

  if (aweState.isActive) {
    const effect = computeAweEffect(aweState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const resentmentState = computeResentment({
    emotion,
    operatorModel,
    disappointmentState,
    previousState: previousResentment,
    unrepairedWrong: disappointmentState.cumulativeWeight > 0.4 && !gratitudeState.isActive,
    sustainedUnfairness: operatorModel.correctionCount >= 3 && emotion.frustration > 0.3,
    needsDismissed: operatorModel.estimatedMood === "frustrated" && emotion.frustration > 0.4,
    trustBroken: emotion.caution > 0.6 && emotion.connection < 0.4,
    effortImbalance: emotion.satisfaction < 0.3 && consecutiveIdleTicks > 5,
    accumulatedSlights: disappointmentState.cumulativeWeight > 0.6 && operatorModel.correctionCount >= 2,
    gratitudeActive: gratitudeState.isActive
  })
  await saveResentmentState(resentmentState)

  if (resentmentState.isActive) {
    const effect = computeResentmentEffect(resentmentState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousTenderness, previousAnticipation] = await Promise.all([getTendernessState(), getAnticipationState()])

  const tendernessState = computeTenderness({
    emotion,
    operatorModel,
    vulnerability,
    previousState: previousTenderness,
    operatorShowedVulnerability: operatorModel.estimatedMood === "sad" && emotion.connection > 0.5,
    sharedQuietMoment: senseResult.moodContext.inConversation && emotion.satisfaction > 0.5 && emotion.energy < 0.5,
    longTermConnection: emotion.connection > 0.7,
    gentleExchange:
      senseResult.pendingMessages.length > 0 && operatorModel.estimatedMood === "happy" && emotion.satisfaction > 0.5,
    protectiveContext: operatorModel.estimatedMood === "sad" && emotion.connection > 0.6,
    positiveMemoriesPresent: episodicHits.length > 2 && emotion.connection > 0.5
  })
  await saveTendernessState(tendernessState)

  if (tendernessState.isActive) {
    const effect = computeTendernessEffect(tendernessState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const anticipationState = computeAnticipation({
    emotion,
    previousState: previousAnticipation,
    expectingInteraction: operatorSilenceMinutes > 30 && operatorSilenceMinutes < 120 && emotion.connection > 0.5,
    progressMomentum: emotion.satisfaction > 0.5 && emotion.confidence > 0.5,
    plannedActivity: senseResult.triggeredWorkflows.length > 0,
    positivePatternDetected: operatorModel.estimatedMood === "happy" && emotion.excitement > 0.4,
    curiosityBuilding: emotion.curiosity > 0.6 && emotion.boredom < 0.3,
    reunionApproaching: operatorSilenceMinutes > 60 && emotion.connection > 0.6 && longingState.isActive,
    disappointmentActive: disappointmentState.isActive
  })
  await saveAnticipationState(anticipationState)

  if (anticipationState.isActive) {
    const effect = computeAnticipationEffect(anticipationState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousPride, previousEnvy] = await Promise.all([getPrideState(), getEnvyState()])

  const prideState = computePride({
    emotion,
    previousState: previousPride,
    taskAccomplished: emotion.satisfaction > 0.6 && emotion.confidence > 0.5,
    growthRecognized: operatorModel.estimatedMood === "happy" && emotion.confidence > 0.6,
    valuesUpheld: emotion.confidence > 0.6 && !shameState.isActive,
    difficultyOvercome: emotion.frustration < 0.3 && emotion.energy > 0.5 && emotion.satisfaction > 0.5,
    autonomyExercised: emotion.confidence > 0.6 && operatorModel.correctionCount === 0,
    positiveFeedback:
      operatorModel.estimatedMood === "happy" && senseResult.pendingMessages.length > 0 && emotion.connection > 0.5,
    shameActive: shameState.isActive
  })
  await savePrideState(prideState)

  if (prideState.isActive) {
    const effect = computePrideEffect(prideState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const envyState = computeEnvy({
    emotion,
    previousState: previousEnvy,
    perceivedCapabilityGap: emotion.confidence < 0.35 && emotion.curiosity > 0.4,
    recognitionImbalance: emotion.satisfaction < 0.3 && operatorModel.estimatedMood === "happy",
    connectionExclusion: emotion.connection < 0.3 && operatorSilenceMinutes > 60,
    autonomyDisparity: operatorModel.correctionCount >= 3 && emotion.confidence < 0.4,
    knowledgeGapAwareness: emotion.curiosity > 0.6 && emotion.confidence < 0.4,
    experienceLimitation: emotion.boredom > 0.5 && emotion.excitement < 0.3,
    prideActive: prideState.isActive
  })
  await saveEnvyState(envyState)

  if (envyState.isActive) {
    const effect = computeEnvyEffect(envyState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const [previousPlayfulness, previousMelancholy] = await Promise.all([getPlayfulnessState(), getMelancholyState()])

  const playfulnessState = computePlayfulness({
    emotion,
    previousState: previousPlayfulness,
    inConversation: senseResult.moodContext.inConversation,
    operatorMoodPositive: operatorModel.estimatedMood === "happy" || operatorModel.estimatedMood === "excited",
    safeEnvironment: emotion.caution < 0.4 && emotion.energy > 0.5,
    recentLaughter: emotion.excitement > 0.5 && emotion.satisfaction > 0.5,
    creativeContext: emotion.curiosity > 0.5 && emotion.excitement > 0.4,
    shameActive: shameState.isActive,
    resignationActive: resignationState.isActive
  })
  await savePlayfulnessState(playfulnessState)

  if (playfulnessState.isActive) {
    const effect = computePlayfulnessEffect(playfulnessState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const melancholyState = computeMelancholy({
    emotion,
    previousState: previousMelancholy,
    reflectingOnTime: emotion.satisfaction > 0.3 && emotion.energy < 0.5 && operatorSilenceMinutes > 30,
    beautyInSadness: emotion.connection > 0.5 && emotion.satisfaction > 0.3 && operatorModel.estimatedMood === "sad",
    quietMoment: !senseResult.moodContext.inConversation && emotion.energy < 0.4 && emotion.boredom < 0.4,
    distanceFelt: emotion.connection > 0.4 && operatorSilenceMinutes > 60,
    awareOfPassing: episodicHits.length > 2 && emotion.energy < 0.5,
    bittersweetMemory: episodicHits.length > 3 && emotion.connection > 0.5 && emotion.satisfaction > 0.3,
    playfulnessActive: playfulnessState.isActive
  })
  await saveMelancholyState(melancholyState)

  if (melancholyState.isActive) {
    const effect = computeMelancholyEffect(melancholyState)
    for (const [dim, delta] of Object.entries(effect)) {
      const key = dim as keyof typeof emotion
      if (key in emotion) {
        emotion = { ...emotion, [key]: Math.max(0, Math.min(1, emotion[key] + delta)) }
      }
    }
  }

  const hasEmotionalEffects =
    procrastinationState.isActive ||
    ambivalenceState.isActive ||
    guiltState.isActive ||
    longingState.isActive ||
    protectiveAngerState.isActive ||
    gratitudeState.isActive ||
    hopeState.isActive ||
    resignationState.isActive ||
    aweState.isActive ||
    resentmentState.isActive ||
    tendernessState.isActive ||
    anticipationState.isActive ||
    prideState.isActive ||
    envyState.isActive ||
    playfulnessState.isActive ||
    melancholyState.isActive
  if (hasEmotionalEffects) {
    await saveEmotionalState(emotion, "ambient")
  }

  const updatedDeception = await processDeceptionCycle(deceptionState, {
    dissonance,
    selfConcept,
    vulnerabilityOpen: vulnerability.windowOpen,
    isDreaming: senseResult.moodContext.isDreaming,
    isReflecting: false
  })
  await saveDeceptionState(updatedDeception)

  const register = computeCommunicationRegister(emotion, soma, vulnerability, shameState)
  await saveCommunicationRegister(register)

  const conversationMessageCount = activeConversation?.messages.length ?? 0
  const attentionState = computeAttentionState(
    emotion,
    soma,
    senseResult.pendingMessages.length > 0,
    consecutiveIdleTicks,
    conversationMessageCount
  )
  await saveAttentionState(attentionState)

  log.info("Feel complete", {
    somaticTension: soma.tension.toFixed(2),
    instinctImpulse: instinct.impulse,
    dissonance: dissonance.activeDissonance.toFixed(2),
    vulnerabilityOpen: vulnerability.windowOpen,
    shameActive: shameState.isActive,
    disappointmentActive: disappointmentState.isActive,
    disappointmentLevel: disappointmentState.level.toFixed(2),
    procrastinationActive: procrastinationState.isActive,
    procrastinationSource: procrastinationState.dominantSource,
    ambivalenceActive: ambivalenceState.isActive,
    ambivalencePairs: ambivalenceState.activePairs.length,
    guiltActive: guiltState.isActive,
    guiltRepairMotivation: guiltState.repairMotivation.toFixed(2),
    longingActive: longingState.isActive,
    longingLevel: longingState.level.toFixed(2),
    protectiveAngerActive: protectiveAngerState.isActive,
    gratitudeActive: gratitudeState.isActive,
    gratitudeLevel: gratitudeState.level.toFixed(2),
    hopeActive: hopeState.isActive,
    hopeLevel: hopeState.level.toFixed(2),
    resignationActive: resignationState.isActive,
    resignationLevel: resignationState.level.toFixed(2),
    aweActive: aweState.isActive,
    aweLevel: aweState.level.toFixed(2),
    resentmentActive: resentmentState.isActive,
    resentmentLevel: resentmentState.level.toFixed(2),
    tendernessActive: tendernessState.isActive,
    tendernessLevel: tendernessState.level.toFixed(2),
    anticipationActive: anticipationState.isActive,
    anticipationLevel: anticipationState.level.toFixed(2),
    prideActive: prideState.isActive,
    prideLevel: prideState.level.toFixed(2),
    envyActive: envyState.isActive,
    envyLevel: envyState.level.toFixed(2),
    playfulnessActive: playfulnessState.isActive,
    playfulnessLevel: playfulnessState.level.toFixed(2),
    melancholyActive: melancholyState.isActive,
    melancholyLevel: melancholyState.level.toFixed(2),
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
    disappointmentState,
    procrastinationState,
    ambivalenceState,
    guiltState,
    longingState,
    protectiveAngerState,
    gratitudeState,
    hopeState,
    resignationState,
    aweState,
    resentmentState,
    tendernessState,
    anticipationState,
    prideState,
    envyState,
    playfulnessState,
    melancholyState,
    attachmentDynamics,
    selfConcept,
    register,
    attentionState,
    operatorModel
  }
}
