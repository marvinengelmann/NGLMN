import { getAttachmentStyle } from "@/attachment/state.ts"
import { evaluateAttachmentDynamics, isOperatorReturning } from "@/attachment/update.ts"
import { computeInstinctImpression } from "@/cognition/instinct.ts"
import { buildDissonanceState, checkDissonance, resolveDissonance } from "@/dissonance/check.ts"
import { saveDissonanceState } from "@/dissonance/state.ts"
import { log } from "@/lib/logger.ts"
import { elapsedMinutesSince } from "@/lib/time.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { getRecentActions } from "@/memory/working.ts"
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
  const [currentSoma, lastSomaTs, selfConcept, attachmentStyle, trustExperience] = await Promise.all([
    getSomaticState(),
    getSomaticLastTimestamp(),
    getSelfConcept(),
    getAttachmentStyle(),
    getAggregateTrustExperience()
  ])

  const elapsed = elapsedMinutesSince(lastSomaTs)

  const messageText = senseResult.pendingMessages.map((m) => m.text).join(" ")
  const somaticMemories = messageText ? await querySomaticMemories(messageText) : []

  const soma = computeSomaticUpdate(currentSoma, senseResult.emotion, elapsed, somaticMemories)
  await saveSomaticState(soma, "feel_phase")

  const instinct = await computeInstinctImpression(senseResult.pendingMessages, senseResult.emotion, soma)

  const [knowledgeResult, recentActions] = await Promise.all([
    getKnowledge("insight", undefined, "self"),
    getRecentActions()
  ])

  const selfKnowledge = knowledgeResult.isOk() ? knowledgeResult.value.map((k) => ({ key: k.key, value: k.value })) : []

  let dissonanceEvents = checkDissonance(recentActions, selfConcept, senseResult.emotion, selfKnowledge)
  dissonanceEvents = dissonanceEvents.map((event) => ({
    ...event,
    resolution: resolveDissonance(event, senseResult.emotion)
  }))
  const dissonance = buildDissonanceState(dissonanceEvents)
  await saveDissonanceState(dissonance)

  const operatorSilenceMinutes = senseResult.moodContext.operatorSilenceMinutes
  const operatorJustReturned = isOperatorReturning(senseResult.pendingMessages.length, operatorSilenceMinutes)

  const attachmentDynamics = evaluateAttachmentDynamics(attachmentStyle, {
    operatorSilenceMinutes,
    operatorJustReturned,
    inConversation: senseResult.moodContext.inConversation,
    connectionLevel: senseResult.emotion.connection,
    frustrationLevel: senseResult.emotion.frustration,
    cautionLevel: senseResult.emotion.caution,
    trustExperience
  })

  const hourOfDay = new Date().getHours()
  const vulnerability = await computeVulnerability({
    trustExperience,
    attachmentSecurity: attachmentStyle.secure,
    connectionLevel: senseResult.emotion.connection,
    somaticOpenness: soma.openness,
    hourOfDay,
    recentIntimacyScore: computeIntimacyScore(senseResult.emotion.connection, selfConcept.selfWorth),
    authenticity: selfConcept.authenticity,
    energyLevel: senseResult.emotion.energy
  })
  await saveVulnerability(vulnerability)

  log.info("Feel complete", {
    somaticTension: soma.tension.toFixed(2),
    instinctImpulse: instinct.impulse,
    dissonance: dissonance.activeDissonance.toFixed(2),
    vulnerabilityOpen: vulnerability.windowOpen
  })

  return {
    soma,
    instinct,
    dissonance,
    vulnerability,
    attachmentDynamics,
    selfConcept
  }
}
