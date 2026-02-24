import * as z from "zod"

export const PersonalityLayer = z.object({
  directness: z.number().min(0).max(1),
  curiosity: z.number().min(0).max(1),
  humor: z.number().min(0).max(1),
  caution: z.number().min(0).max(1),
  proactivity: z.number().min(0).max(1),
  verbosity: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  structure: z.number().min(0).max(1),
  empathy: z.number().min(0).max(1),
  abstraction: z.number().min(0).max(1)
})
export type PersonalityLayer = z.infer<typeof PersonalityLayer>

export const PERSONALITY_CENTER: PersonalityLayer = {
  directness: 0.5,
  curiosity: 0.5,
  humor: 0.5,
  caution: 0.5,
  proactivity: 0.5,
  verbosity: 0.5,
  warmth: 0.5,
  structure: 0.5,
  empathy: 0.5,
  abstraction: 0.5
}

export const PersonalityDna = z.object({
  base: PersonalityLayer,
  adaptive: PersonalityLayer
})
export type PersonalityDna = z.infer<typeof PersonalityDna>
