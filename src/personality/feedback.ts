import { callClaude, HAIKU } from "@/integrations/anthropic.ts"
import { log } from "@/lib/logger.ts"
import type { PersonalityLayer } from "@/personality/types.ts"
import { updateAdaptiveLayer } from "./evolution.ts"

export interface FeedbackAnalysis {
  sentiment: "positive" | "negative" | "neutral"
  confidence: number
  dimension?: string
}

/**
 * Analyze operator feedback sentiment using Haiku.
 */
export async function analyzeOperatorFeedback(
  operatorMessages: string[],
  animaResponse: string
): Promise<FeedbackAnalysis> {
  const prompt = [
    "Analyze the operator's sentiment towards ANIMA's response.",
    "",
    "ANIMA said:",
    animaResponse,
    "",
    "Operator then said:",
    ...operatorMessages,
    "",
    'Respond with ONLY JSON: {"sentiment": "positive"|"negative"|"neutral", "confidence": 0.0-1.0, "dimension": "warmth"|"verbosity"|"directness"|"structure"|"empathy"|"abstraction"|null}'
  ].join("\n")

  const result = await callClaude({
    model: HAIKU,
    system: "You analyze conversation sentiment. Respond with ONLY valid JSON.",
    userMessage: prompt,
    maxTokens: 100
  })

  if (result.isErr()) {
    log.warn("Failed to analyze operator feedback", { error: result.error.message })
    return { sentiment: "neutral", confidence: 0 }
  }

  try {
    const cleaned = result.value
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```/g, "")
      .trim()
    return JSON.parse(cleaned) as FeedbackAnalysis
  } catch {
    return { sentiment: "neutral", confidence: 0 }
  }
}

const SENTIMENT_DELTAS: Record<string, Partial<PersonalityLayer>> = {
  positive: { warmth: 0.02 },
  "negative-verbose": { verbosity: -0.02 },
  "negative-direct": { directness: -0.02 },
  "negative-structure": { structure: -0.02 },
  "negative-empathy": { empathy: -0.02 },
  "negative-abstraction": { abstraction: -0.02 },
  negative: { warmth: -0.01 }
}

/**
 * Apply feedback analysis to personality adaptive layer.
 */
export async function applyFeedback(analysis: FeedbackAnalysis): Promise<void> {
  if (analysis.confidence < 0.6) return

  let deltaKey: string = analysis.sentiment
  if (analysis.sentiment === "negative" && analysis.dimension) {
    deltaKey = `negative-${analysis.dimension}`
  }

  const deltas = SENTIMENT_DELTAS[deltaKey] ?? SENTIMENT_DELTAS[analysis.sentiment]
  if (!deltas) return

  await updateAdaptiveLayer(
    deltas,
    `Operator feedback: ${analysis.sentiment} (confidence: ${analysis.confidence.toFixed(2)})`
  )
}
