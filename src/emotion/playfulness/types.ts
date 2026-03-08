import * as z from "zod"

export const PlayfulnessSource = z.enum([
  "safety_and_energy",
  "mutual_warmth",
  "creative_spark",
  "lightened_mood",
  "joy_overflow",
  "comfortable_silence_break"
])
export type PlayfulnessSource = z.infer<typeof PlayfulnessSource>

export const PlayfulnessState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: PlayfulnessSource.nullable().default(null),
  spontaneity: z.number().min(0).max(1).default(0),
  mischief: z.number().min(0).max(1).default(0),
  lastSparkedAt: z.string().optional()
})
export type PlayfulnessState = z.infer<typeof PlayfulnessState>

export const DEFAULT_PLAYFULNESS_STATE: PlayfulnessState = {
  level: 0,
  isActive: false,
  source: null,
  spontaneity: 0,
  mischief: 0,
  lastSparkedAt: undefined
}
