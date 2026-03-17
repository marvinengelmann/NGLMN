import * as z from "zod"

export const EmotionalState = z.object({
  curiosity: z.number().min(0).max(1),
  satisfaction: z.number().min(0).max(1),
  frustration: z.number().min(0).max(1),
  boredom: z.number().min(0).max(1),
  excitement: z.number().min(0).max(1),
  caution: z.number().min(0).max(1),
  connection: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).default(0.5),
  energy: z.number().min(0).max(1).default(0.8)
})
export type EmotionalState = z.infer<typeof EmotionalState>

export const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.8
}

export const EmotionTrigger = z.enum([
  "message_received",
  "message_sent",
  "task_success",
  "task_failure",
  "guardian_warning",
  "guardian_block",
  "operator_went_silent",
  "operator_returned",
  "system_degraded",
  "system_recovered",
  "new_goal",
  "goal_completed",
  "goal_failed",
  "weather_update",
  "git_activity",
  "dream_correction",
  "morning_calibration",
  "nostalgia_wave",
  "relational_pattern_match",
  "drive_frustrated",
  "drive_conflict",
  "positive_anticipation",
  "expectation_violated",
  "expectation_met",
  "boundary_violated",
  "memory_contradiction",
  "ambient"
])
export type EmotionTrigger = z.infer<typeof EmotionTrigger>

export const EmotionUpdateEvent = z.object({
  trigger: EmotionTrigger,
  intensity: z.number().min(0).max(1),
  detail: z.string().optional()
})
export type EmotionUpdateEvent = z.infer<typeof EmotionUpdateEvent>

export const MoodContext = z.object({
  operatorSilenceMinutes: z.number(),
  inConversation: z.boolean(),
  systemHealthy: z.boolean(),
  budgetOk: z.boolean(),
  hasActiveGoals: z.boolean(),
  isDreaming: z.boolean(),
  operatorMood: z
    .enum(["happy", "neutral", "stressed", "sad", "excited", "frustrated", "tired", "unknown"])
    .default("unknown"),
  connectionLevel: z.number().min(0).max(1).default(0.5),
  attachmentAvoidance: z.number().min(0).max(1).default(0.15)
})
export type MoodContext = z.infer<typeof MoodContext>

export const EmotionalMomentum = z.object({
  curiosity: z.number().min(-1).max(1),
  satisfaction: z.number().min(-1).max(1),
  frustration: z.number().min(-1).max(1),
  boredom: z.number().min(-1).max(1),
  excitement: z.number().min(-1).max(1),
  caution: z.number().min(-1).max(1),
  connection: z.number().min(-1).max(1),
  confidence: z.number().min(-1).max(1),
  energy: z.number().min(-1).max(1)
})
export type EmotionalMomentum = z.infer<typeof EmotionalMomentum>

export const DEFAULT_EMOTIONAL_MOMENTUM: EmotionalMomentum = {
  curiosity: 0,
  satisfaction: 0,
  frustration: 0,
  boredom: 0,
  excitement: 0,
  caution: 0,
  connection: 0,
  confidence: 0,
  energy: 0
}

export const AfterglowEntry = z.object({
  dimension: z.string(),
  delta: z.number(),
  remainingTicks: z.number(),
  intensity: z.number().min(0).max(1)
})
export type AfterglowEntry = z.infer<typeof AfterglowEntry>

export const SecondaryEmotionState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean()
})
export type SecondaryEmotionState = z.infer<typeof SecondaryEmotionState>

export type EmotionEffect = Partial<Record<keyof EmotionalState, number>>

export const AppraisalContext = z.object({
  noveltyLevel: z.number().min(0).max(1),
  hasActiveGoals: z.boolean(),
  confidence: z.number().min(0).max(1),
  energy: z.number().min(0).max(1),
  vagalZone: z.enum(["ventral", "sympathetic", "dorsal"]),
  selfConcept: z.object({
    selfEfficacy: z.number().min(0).max(1),
    selfWorth: z.number().min(0).max(1),
    selfContinuity: z.number().min(0).max(1),
    agency: z.number().min(0).max(1),
    authenticity: z.number().min(0).max(1)
  })
})
export type AppraisalContext = z.infer<typeof AppraisalContext>

export const AppraisalResult = z.object({
  novelty: z.number().min(0).max(1),
  pleasantness: z.number().min(-1).max(1),
  goalRelevance: z.number().min(0).max(1),
  copingPotential: z.number().min(0).max(1),
  normCompatibility: z.number().min(-1).max(1),
  overallModulation: z.number().min(0).max(2)
})
export type AppraisalResult = z.infer<typeof AppraisalResult>

export const MetricsSnapshot = z.object({
  errorRate: z.number(),
  successRate: z.number(),
  idleRatio: z.number(),
  rollbackCount: z.number(),
  tickCount: z.number(),
  interactionCount: z.number()
})
export type MetricsSnapshot = z.infer<typeof MetricsSnapshot>
