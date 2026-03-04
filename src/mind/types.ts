import * as z from "zod"

export const OperatorMood = z.enum(["happy", "neutral", "stressed", "sad", "excited", "frustrated", "tired", "unknown"])
export type OperatorMood = z.infer<typeof OperatorMood>

export const OperatorModel = z.object({
  estimatedMood: OperatorMood,
  estimatedIntent: z.string().max(200),
  estimatedExpectation: z.string().max(200),
  modelConfidence: z.number().min(0).max(1),
  correctionCount: z.number().default(0),
  lastUpdated: z.string()
})
export type OperatorModel = z.infer<typeof OperatorModel>

export const ModelCorrection = z.object({
  previousEstimate: z.string(),
  correctedTo: z.string(),
  source: z.enum(["explicit", "implicit", "behavioral"]),
  timestamp: z.string()
})
export type ModelCorrection = z.infer<typeof ModelCorrection>

export const OperatorAnalysis = z.object({
  mood: OperatorMood,
  intent: z.string().max(200),
  expectation: z.string().max(200),
  confidence: z.number().min(0).max(1)
})
export type OperatorAnalysis = z.infer<typeof OperatorAnalysis>

export const DEFAULT_OPERATOR_MODEL: OperatorModel = {
  estimatedMood: "unknown",
  estimatedIntent: "unknown",
  estimatedExpectation: "unknown",
  modelConfidence: 0.2,
  correctionCount: 0,
  lastUpdated: ""
}
