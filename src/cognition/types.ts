import * as z from "zod"

export const MetacognitiveState = z.object({
  cognitiveClarity: z.number().min(0).max(1),
  ruminationDetected: z.boolean(),
  ruminationTopic: z.string().nullable(),
  ruminationTicks: z.number().min(0),
  confidenceCalibration: z.number().min(0).max(1),
  cognitiveFatigue: z.number().min(0).max(1),
  complexDecisionCount: z.number().min(0)
})
export type MetacognitiveState = z.infer<typeof MetacognitiveState>

export const DEFAULT_METACOGNITIVE_STATE: MetacognitiveState = {
  cognitiveClarity: 0.7,
  ruminationDetected: false,
  ruminationTopic: null,
  ruminationTicks: 0,
  confidenceCalibration: 0.5,
  cognitiveFatigue: 0,
  complexDecisionCount: 0
}

export const InstinctImpulse = z.enum(["approach", "avoid", "engage", "withdraw", "neutral"])
export type InstinctImpulse = z.infer<typeof InstinctImpulse>

export const InstinctImpression = z.object({
  impulse: InstinctImpulse,
  confidence: z.number().min(0).max(1),
  basis: z.string(),
  episodicMatches: z.number(),
  emotionalCharge: z.number().min(0).max(1)
})
export type InstinctImpression = z.infer<typeof InstinctImpression>

export const ConflictResolution = z.enum(["instinct_override", "reason_override", "compromise", "unresolved"])
export type ConflictResolution = z.infer<typeof ConflictResolution>

export const AttentionState = z.enum(["hyperfocus", "focused", "drifting", "blank"])
export type AttentionState = z.infer<typeof AttentionState>

export const CognitiveConflict = z.object({
  detected: z.boolean(),
  instinctImpulse: z.string(),
  reasonDecision: z.string(),
  tensionLevel: z.number().min(0).max(1),
  resolution: ConflictResolution.optional()
})
export type CognitiveConflict = z.infer<typeof CognitiveConflict>

export const HabitType = z.enum(["communication", "emotional", "behavioral", "relational"])
export type HabitType = z.infer<typeof HabitType>

export const Habit = z.object({
  id: z.string(),
  pattern: z.string(),
  type: HabitType,
  strength: z.number().min(0).max(1),
  repetitions: z.number().min(0),
  lastActivatedAt: z.string(),
  isAutomatic: z.boolean()
})
export type Habit = z.infer<typeof Habit>

export const HabitState = z.object({
  habits: z.array(Habit),
  recentActivations: z.array(
    z.object({
      habitId: z.string(),
      timestamp: z.string()
    })
  )
})
export type HabitState = z.infer<typeof HabitState>

export const DEFAULT_HABIT_STATE: HabitState = {
  habits: [],
  recentActivations: []
}
