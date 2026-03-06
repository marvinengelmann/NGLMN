import * as z from "zod"

export const OperatorMood = z.enum(["happy", "neutral", "stressed", "sad", "excited", "frustrated", "tired", "unknown"])
export type OperatorMood = z.infer<typeof OperatorMood>

export const MoodUncertainty = z.object({
  alternatives: z.array(OperatorMood),
  reason: z.string()
})
export type MoodUncertainty = z.infer<typeof MoodUncertainty>

export const MoodHistoryEntry = z.object({
  mood: OperatorMood,
  timestamp: z.string()
})
export type MoodHistoryEntry = z.infer<typeof MoodHistoryEntry>

export const CorrectionPattern = z.object({
  signal: z.string(),
  misinterpretation: z.string(),
  actualMeaning: z.string(),
  timestamp: z.string()
})
export type CorrectionPattern = z.infer<typeof CorrectionPattern>

export const OperatorProfile = z.object({
  communicationStyle: z.string(),
  knownPreferences: z.array(z.string()),
  emotionalPatterns: z.string(),
  recurringTopics: z.array(z.string()),
  copingMechanisms: z.string(),
  unspokenNeeds: z.string(),
  lastProfileUpdate: z.string()
})
export type OperatorProfile = z.infer<typeof OperatorProfile>

export const DEFAULT_OPERATOR_PROFILE: OperatorProfile = {
  communicationStyle: "unknown",
  knownPreferences: [],
  emotionalPatterns: "not yet observed",
  recurringTopics: [],
  copingMechanisms: "unknown",
  unspokenNeeds: "unknown",
  lastProfileUpdate: ""
}

export const OperatorModel = z.object({
  estimatedMood: OperatorMood,
  estimatedIntent: z.string().max(200),
  estimatedExpectation: z.string().max(200),
  modelConfidence: z.number().min(0).max(1),
  correctionCount: z.number().default(0),
  correctionDelay: z.number().default(0),
  lastUpdated: z.string(),
  moodUncertainty: MoodUncertainty.nullable().default(null),
  contradiction: z.string().nullable().default(null),
  moodHistory: z.array(MoodHistoryEntry).default([])
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
  correctionDelay: 0,
  lastUpdated: "",
  moodUncertainty: null,
  contradiction: null,
  moodHistory: []
}
