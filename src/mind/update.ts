import { MIND, MISCALIBRATION, OPERATOR_PROFILE } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { storeCorrectionPattern } from "@/mind/profile.ts"
import { OPERATOR_ANALYSIS_PROMPT } from "@/prompts/mind.ts"
import { type CorrectionPattern, type ModelCorrection, OperatorAnalysis, type OperatorModel } from "./types.ts"

interface OperatorModelContext {
  messageTexts: string[]
  messageTimestamps: string[]
  silenceMinutes: number
  previousModel: OperatorModel
}

/**
 * Update the operator model via lightweight LLM analysis of messages.
 * Includes correction delay (30% chance of keeping old model for 1-2 cycles)
 * and random confidence dips (5% chance per tick).
 */
export async function updateOperatorModel(context: OperatorModelContext): Promise<OperatorModel> {
  const { messageTexts, messageTimestamps, silenceMinutes, previousModel } = context
  const model = { ...previousModel, lastUpdated: nowISO() }

  if (model.correctionDelay > 0) {
    model.correctionDelay -= 1
    log.debug("Operator model correction delayed", { remainingCycles: model.correctionDelay })
  }

  if (Math.random() < MISCALIBRATION.RANDOM_CONFIDENCE_DIP_PROBABILITY) {
    const dip = MISCALIBRATION.DIP_MIN + Math.random() * (MISCALIBRATION.DIP_MAX - MISCALIBRATION.DIP_MIN)
    model.modelConfidence = Math.max(0.1, model.modelConfidence - dip)
    log.debug("Random confidence dip", { dip: dip.toFixed(2), newConfidence: model.modelConfidence.toFixed(2) })
  }

  if (messageTexts.length === 0) {
    if (silenceMinutes > MIND.LONG_SILENCE_MINUTES) {
      const decayHours = silenceMinutes / 60
      model.modelConfidence = Math.max(0.1, model.modelConfidence - MIND.CONFIDENCE_DECAY_PER_HOUR * decayHours)
    }
    return model
  }

  const userMessage = [
    "Messages:",
    ...messageTimestamps.map((ts, i) => `  [${ts}] "${messageTexts[i]}"`),
    `Silence before messages: ${Math.round(silenceMinutes)} minutes`,
    previousModel.estimatedMood !== "unknown" ? `Previous mood estimate: ${previousModel.estimatedMood}` : ""
  ]
    .filter(Boolean)
    .join("\n")

  const result = await callIntelligence({
    system: OPERATOR_ANALYSIS_PROMPT,
    userMessage,
    schema: OperatorAnalysis,
    maxTokens: 256,
    reasoning: false
  })

  if (result.isOk()) {
    const analysis = result.value

    if (model.correctionDelay > 0) {
      model.modelConfidence = analysis.confidence
      return model
    }

    const moodChanged = analysis.mood !== previousModel.estimatedMood
    if (moodChanged && Math.random() < MISCALIBRATION.CORRECTION_DELAY_PROBABILITY) {
      model.correctionDelay = 1 + Math.floor(Math.random() * MISCALIBRATION.MAX_DELAY_CYCLES)
      model.modelConfidence = analysis.confidence
      log.debug("Delaying model correction", { delayCycles: model.correctionDelay })
      return model
    }

    model.estimatedMood = analysis.mood
    model.estimatedIntent = analysis.intent
    model.estimatedExpectation = analysis.expectation
    model.modelConfidence = analysis.confidence
    model.correctionDelay = 0

    model.moodHistory = [...model.moodHistory, { mood: analysis.mood, timestamp: nowISO() }].slice(
      -OPERATOR_PROFILE.MAX_MOOD_HISTORY
    )
  } else {
    log.warn("Operator analysis LLM failed, keeping previous model", { error: result.error.message })
  }

  return model
}

/**
 * Detect implicit model corrections by comparing inferred mood to previous estimate.
 * A significant mood shift means the previous model was wrong.
 */
export function detectModelCorrection(previousModel: OperatorModel, newModel: OperatorModel): ModelCorrection | null {
  if (previousModel.estimatedMood === "unknown") return null
  if (previousModel.estimatedMood === newModel.estimatedMood) return null

  const correction: ModelCorrection = {
    previousEstimate: previousModel.estimatedMood,
    correctedTo: newModel.estimatedMood,
    source: "behavioral",
    timestamp: nowISO()
  }

  const pattern: CorrectionPattern = {
    signal: newModel.estimatedIntent,
    misinterpretation: previousModel.estimatedMood,
    actualMeaning: newModel.estimatedMood,
    timestamp: nowISO()
  }
  storeCorrectionPattern(pattern).catch((err) => {
    log.warn("Failed to store correction pattern", { error: String(err) })
  })

  return correction
}
