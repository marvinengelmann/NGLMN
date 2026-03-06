import { getHours } from "date-fns"
import { getAttachmentStyle } from "@/attachment/state.ts"
import { evaluateAttachmentDynamics, isOperatorReturning } from "@/attachment/update.ts"
import { computeAttentionState } from "@/cognition/flow.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { computeCommunicationRegister } from "@/communication/register.ts"
import { processDeceptionCycle } from "@/deception/compute.ts"
import { getDeceptionState, saveDeceptionState } from "@/deception/state.ts"
import { buildDissonanceState, checkDissonance, resolveDissonance } from "@/dissonance/check.ts"
import { saveDissonanceState } from "@/dissonance/state.ts"
import { detectNostalgia } from "@/emotion/nostalgia.ts"
import { getEmotionalState, saveEmotionalState } from "@/emotion/state.ts"
import { applyEvent, computeEmotionalUpdate } from "@/emotion/update.ts"
import { log } from "@/lib/logger.ts"
import { setEmotionContext } from "@/lib/sentry.ts"
import { elapsedMinutesSince, nowISO, nowLocal } from "@/lib/time.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import {
  getConsecutiveIdleTicks,
  getRecentActions,
  setLastEmotionTimestamp,
  setTriggerTimestamp
} from "@/memory/working.ts"
import { getOperatorModel, saveOperatorModel } from "@/mind/state.ts"
import { detectModelCorrection, updateOperatorModel } from "@/mind/update.ts"
import { getSelfConcept } from "@/psyche/state.ts"
import { querySomaticMemories } from "@/soma/memory.ts"
import { getSomaticLastTimestamp, getSomaticState, saveSomaticState } from "@/soma/state.ts"
import { computeSomaticUpdate } from "@/soma/update.ts"
import { getAggregateTrustExperience } from "@/trust/levels.ts"
import { computeIntimacyScore, computeVulnerability, saveVulnerability } from "@/vulnerability/compute.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

/**
 * FEEL phase — pre-cognitive processing between SENSE and DELIBERATE.
 * Updates somatic markers, instinct, dissonance, attachment, vulnerability, and self-concept.
 */
export async function feel(senseResult: SenseResult): Promise<FeelingResult> {
  const currentEmotion = await getEmotionalState()
  let emotion = computeEmotionalUpdate(
    currentEmotion,
    senseResult.rawTriggers,
    senseResult.moodContext,
    Math.max(1, senseResult.elapsedMinutes),
    senseResult.triggerTimestamps
  )
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
    deceptionState
  ] = await Promise.all([
    getSomaticState(),
    getSomaticLastTimestamp(),
    getSelfConcept(),
    getAttachmentStyle(),
    getAggregateTrustExperience(),
    getOperatorModel(),
    getDeceptionState()
  ])

  const elapsed = elapsedMinutesSince(lastSomaTs)

  const messageText = senseResult.pendingMessages.map((m) => m.text).join(" ")
  const somaticMemories = messageText ? await querySomaticMemories(messageText) : []

  const soma = computeSomaticUpdate(currentSoma, emotion, elapsed, somaticMemories)
  await saveSomaticState(soma, "feel_phase")

  const episodicHits = messageText ? await queryRelated(messageText, 5) : []
  const nostalgia = episodicHits.length > 0 ? detectNostalgia(episodicHits, new Date()) : null
  if (nostalgia) {
    emotion = applyEvent(emotion, nostalgia)
  }

  await saveEmotionalState(emotion, nostalgia ? "nostalgia_wave" : (senseResult.rawTriggers[0]?.trigger ?? "ambient"))
  setEmotionContext(emotion)

  const instinct = await computeInstinctImpression(senseResult.pendingMessages, emotion, soma)

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

  const updatedDeception = await processDeceptionCycle(deceptionState, {
    dissonance,
    selfConcept,
    vulnerabilityOpen: vulnerability.windowOpen,
    isDreaming: senseResult.moodContext.isDreaming,
    isReflecting: false
  })
  await saveDeceptionState(updatedDeception)

  const register = computeCommunicationRegister(emotion, soma, vulnerability)

  const consecutiveIdleTicks = await getConsecutiveIdleTicks()
  const attentionState = computeAttentionState(
    emotion,
    soma,
    senseResult.pendingMessages.length > 0,
    consecutiveIdleTicks
  )

  log.info("Feel complete", {
    somaticTension: soma.tension.toFixed(2),
    instinctImpulse: instinct.impulse,
    dissonance: dissonance.activeDissonance.toFixed(2),
    vulnerabilityOpen: vulnerability.windowOpen,
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
    attachmentDynamics,
    selfConcept,
    register,
    attentionState,
    operatorModel
  }
}
