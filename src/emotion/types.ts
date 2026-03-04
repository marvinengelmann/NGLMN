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
  "nostalgia_wave"
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
  isDreaming: z.boolean()
})
export type MoodContext = z.infer<typeof MoodContext>

export const MetricsSnapshot = z.object({
  errorRate: z.number(),
  successRate: z.number(),
  idleRatio: z.number(),
  rollbackCount: z.number(),
  tickCount: z.number(),
  interactionCount: z.number()
})
export type MetricsSnapshot = z.infer<typeof MetricsSnapshot>
