import { MIND } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { OPERATOR_ANALYSIS_PROMPT } from "@/prompts/mind.ts"
import { type ModelCorrection, OperatorAnalysis, type OperatorModel } from "./types.ts"

export interface OperatorModelContext {
  messageTexts: string[]
  messageTimestamps: string[]
  silenceMinutes: number
  previousModel: OperatorModel
}

/**
 * Update the operator model via lightweight LLM analysis of messages.
 */
export async function updateOperatorModel(context: OperatorModelContext): Promise<OperatorModel> {
  const { messageTexts, messageTimestamps, silenceMinutes, previousModel } = context
  const model = { ...previousModel, lastUpdated: nowISO() }

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
    previousModel.estimatedMood !== "unknown"
      ? `Previous mood estimate: ${previousModel.estimatedMood}`
      : ""
  ].filter(Boolean).join("\n")

  const result = await callIntelligence({
    system: OPERATOR_ANALYSIS_PROMPT,
    userMessage,
    schema: OperatorAnalysis,
    maxTokens: 256
  })

  if (result.isOk()) {
    const analysis = result.value
    model.estimatedMood = analysis.mood
    model.estimatedIntent = analysis.intent
    model.estimatedExpectation = analysis.expectation
    model.modelConfidence = analysis.confidence
  } else {
    log.warn("Operator analysis LLM failed, keeping previous model", { error: result.error.message })
  }

  return model
}

/**
 * Detect implicit model corrections by comparing inferred mood to previous estimate.
 * A significant mood shift means the previous model was wrong.
 */
export function detectModelCorrection(
  previousModel: OperatorModel,
  newModel: OperatorModel
): ModelCorrection | null {
  if (previousModel.estimatedMood === "unknown") return null
  if (previousModel.estimatedMood === newModel.estimatedMood) return null

  return {
    previousEstimate: previousModel.estimatedMood,
    correctedTo: newModel.estimatedMood,
    source: "behavioral",
    timestamp: nowISO()
  }
}
