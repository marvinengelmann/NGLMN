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

export const OperatorPrediction = z.object({
  expectedResponseMinutes: z.number().nullable().default(null),
  expectedMood: OperatorMood.nullable().default(null),
  expectedEngagement: z.enum(["high", "low"]).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.3),
  madeAt: z.string().nullable().default(null)
})
export type OperatorPrediction = z.infer<typeof OperatorPrediction>

export const PredictionAccuracy = z.object({
  recentScores: z.array(z.number()).default([]),
  runningAverage: z.number().min(0).max(1).default(0.5),
  totalPredictions: z.number().default(0)
})
export type PredictionAccuracy = z.infer<typeof PredictionAccuracy>

export const DEFAULT_OPERATOR_PREDICTION: OperatorPrediction = {
  expectedResponseMinutes: null,
  expectedMood: null,
  expectedEngagement: null,
  confidence: 0.3,
  madeAt: null
}

export const DEFAULT_PREDICTION_ACCURACY: PredictionAccuracy = {
  recentScores: [],
  runningAverage: 0.5,
  totalPredictions: 0
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
  moodHistory: z.array(MoodHistoryEntry).default([]),
  predictions: OperatorPrediction.default(DEFAULT_OPERATOR_PREDICTION),
  predictionAccuracy: PredictionAccuracy.default(DEFAULT_PREDICTION_ACCURACY)
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

export const RelationalPatternType = z.enum([
  "punctuation_signal",
  "message_length",
  "response_timing",
  "word_choice",
  "silence_pattern",
  "emoji_pattern"
])
export type RelationalPatternType = z.infer<typeof RelationalPatternType>

export const RelationalPattern = z.object({
  pattern: z.string(),
  type: RelationalPatternType,
  associatedMood: OperatorMood,
  emotionalEffect: z.record(z.string(), z.number()).default({}),
  confidence: z.number().min(0).max(1),
  observations: z.number().default(1),
  lastMatchedAt: z.string().optional(),
  discoveredAt: z.string()
})
export type RelationalPattern = z.infer<typeof RelationalPattern>

export const RelationalPatternLibrary = z.object({
  patterns: z.array(RelationalPattern).default([]),
  lastUpdatedAt: z.string().optional()
})
export type RelationalPatternLibrary = z.infer<typeof RelationalPatternLibrary>

export const DEFAULT_RELATIONAL_PATTERN_LIBRARY: RelationalPatternLibrary = {
  patterns: [],
  lastUpdatedAt: undefined
}

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
  moodHistory: [],
  predictions: DEFAULT_OPERATOR_PREDICTION,
  predictionAccuracy: DEFAULT_PREDICTION_ACCURACY
}

export const TemporalMoodPattern = z.object({
  hourBucket: z.number().min(0).max(23),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dominantMood: OperatorMood,
  frequency: z.number().min(0),
  confidence: z.number().min(0).max(1)
})
export type TemporalMoodPattern = z.infer<typeof TemporalMoodPattern>

export const TopicResonance = z.object({
  topic: z.string(),
  engagementScore: z.number().min(0).max(1),
  averageOutcomeScore: z.number().min(0).max(1),
  occurrences: z.number().min(0),
  lastSeenAt: z.string()
})
export type TopicResonance = z.infer<typeof TopicResonance>

export const CommunicationPreferences = z.object({
  preferredMessageLength: z.enum(["short", "medium", "long"]).default("medium"),
  respondsToHumor: z.number().min(0).max(1).default(0.5),
  respondsToVulnerability: z.number().min(0).max(1).default(0.5),
  respondsToDepth: z.number().min(0).max(1).default(0.5),
  emojiUsage: z.enum(["none", "rare", "moderate", "frequent"]).default("rare"),
  averageResponseTimeMinutes: z.number().nullable().default(null),
  peakActivityHours: z.array(z.number()).default([])
})
export type CommunicationPreferences = z.infer<typeof CommunicationPreferences>

export const InferredTraits = z.object({
  extraversion: z.number().min(0).max(1).default(0.5),
  openness: z.number().min(0).max(1).default(0.5),
  stressResilience: z.number().min(0).max(1).default(0.5),
  emotionalExpressiveness: z.number().min(0).max(1).default(0.5),
  consistencyScore: z.number().min(0).max(1).default(0.5)
})
export type InferredTraits = z.infer<typeof InferredTraits>

export const DEFAULT_COMMUNICATION_PREFS: CommunicationPreferences = {
  preferredMessageLength: "medium",
  respondsToHumor: 0.5,
  respondsToVulnerability: 0.5,
  respondsToDepth: 0.5,
  emojiUsage: "rare",
  averageResponseTimeMinutes: null,
  peakActivityHours: []
}

export const DEFAULT_INFERRED_TRAITS: InferredTraits = {
  extraversion: 0.5,
  openness: 0.5,
  stressResilience: 0.5,
  emotionalExpressiveness: 0.5,
  consistencyScore: 0.5
}

export const DeepOperatorProfile = z.object({
  temporalPatterns: z.array(TemporalMoodPattern).default([]),
  topicResonance: z.array(TopicResonance).default([]),
  communicationPrefs: CommunicationPreferences.default(DEFAULT_COMMUNICATION_PREFS),
  inferredTraits: InferredTraits.default(DEFAULT_INFERRED_TRAITS),
  updatedAt: z.string().default("")
})
export type DeepOperatorProfile = z.infer<typeof DeepOperatorProfile>

export const DEFAULT_DEEP_OPERATOR_PROFILE: DeepOperatorProfile = {
  temporalPatterns: [],
  topicResonance: [],
  communicationPrefs: DEFAULT_COMMUNICATION_PREFS,
  inferredTraits: DEFAULT_INFERRED_TRAITS,
  updatedAt: ""
}
