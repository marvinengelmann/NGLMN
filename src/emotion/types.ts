import * as z from "zod"

export const EmotionalState = z.object({
  curiosity: z.number().min(0).max(1),
  satisfaction: z.number().min(0).max(1),
  frustration: z.number().min(0).max(1),
  boredom: z.number().min(0).max(1),
  excitement: z.number().min(0).max(1),
  caution: z.number().min(0).max(1),
  connection: z.number().min(0).max(1)
})
export type EmotionalState = z.infer<typeof EmotionalState>

export const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5
}

export const EmotionTrigger = z.enum([
  "message_received",
  "message_sent",
  "task_success",
  "task_failure",
  "idle_tick",
  "guardian_warning",
  "guardian_block",
  "operator_silence",
  "new_goal",
  "goal_completed",
  "goal_failed",
  "perception_positive",
  "perception_negative",
  "tick_start",
  "email_received",
  "email_sent",
  "weather_update",
  "git_activity",
  "mention_received",
  "tweet_sent",
  "dream_correction",
  "morning_calibration"
])
export type EmotionTrigger = z.infer<typeof EmotionTrigger>

export const EmotionUpdateEvent = z.object({
  trigger: EmotionTrigger,
  intensity: z.number().min(0).max(1),
  detail: z.string().optional()
})
export type EmotionUpdateEvent = z.infer<typeof EmotionUpdateEvent>

export const MetricsSnapshot = z.object({
  errorRate: z.number(),
  successRate: z.number(),
  idleRatio: z.number(),
  rollbackCount: z.number(),
  tickCount: z.number(),
  interactionCount: z.number()
})
export type MetricsSnapshot = z.infer<typeof MetricsSnapshot>
