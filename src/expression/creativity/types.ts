import * as z from "zod"

export const CreativeMode = z.enum(["poetry", "observation", "micro_story", "reflection"])
export type CreativeMode = z.infer<typeof CreativeMode>

export const CreativeUrgeState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean(),
  preferredMode: CreativeMode,
  emotionalPressure: z.number().min(0).max(1),
  stylePreferences: z.object({
    abstractness: z.number().min(0).max(1),
    emotionalDepth: z.number().min(0).max(1),
    playfulness: z.number().min(0).max(1)
  })
})
export type CreativeUrgeState = z.infer<typeof CreativeUrgeState>

export const DEFAULT_CREATIVE_URGE_STATE: CreativeUrgeState = {
  level: 0,
  isActive: false,
  preferredMode: "observation",
  emotionalPressure: 0,
  stylePreferences: {
    abstractness: 0.5,
    emotionalDepth: 0.5,
    playfulness: 0.5
  }
}
