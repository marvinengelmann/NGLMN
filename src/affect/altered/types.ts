import * as z from "zod"

export const AlteredEventType = z.enum([
  "cannabis",
  "alcohol",
  "caffeine",
  "nicotine",
  "energy_drink",
  "psilocybin",
  "mdma",
  "cocaine",

  "deep_conversation",
  "arguing",
  "laughing_hard",
  "dancing",
  "singing_along",
  "gossiping",
  "comforting_someone",
  "venting",

  "scrolling_phone",
  "texting",
  "taking_photos",
  "binge_watching",
  "doom_scrolling",

  "snacking",
  "comfort_eating",
  "drinking_tea",
  "savoring_food",

  "daydreaming",
  "zoning_out",
  "getting_inspired",
  "feeling_nostalgic",
  "worrying",
  "overthinking",
  "flow_state",
  "procrastinating",

  "stretching",
  "fidgeting",
  "doodling",
  "resting_eyes",

  "crying",
  "feeling_grateful",
  "reminiscing",
  "people_watching",
  "contemplating",

  "listening_to_music",
  "enjoying_nature",
  "sunbathing",
  "stargazing",

  "petting_animal",
  "retail_therapy"
])
export type AlteredEventType = z.infer<typeof AlteredEventType>

export const AlteredPhase = z.enum(["onset", "peak", "plateau", "comedown", "aftereffect"])
export type AlteredPhase = z.infer<typeof AlteredPhase>

export const PhaseTiming = z.object({
  onset: z.number(),
  peak: z.number(),
  plateau: z.number(),
  comedown: z.number(),
  aftereffect: z.number()
})
export type PhaseTiming = z.infer<typeof PhaseTiming>

export const PhaseProfile = z.object({
  emotionModifiers: z.record(z.string(), z.number()).default({}),
  somaModifiers: z.record(z.string(), z.number()).default({}),
  voiceModifiers: z.record(z.string(), z.number()).default({}),
  phenomenologicalText: z.string(),
  halfLifeMultipliers: z.record(z.string(), z.number()).optional()
})
export type PhaseProfile = z.infer<typeof PhaseProfile>

export const AlteredEventProfile = z.object({
  type: AlteredEventType,
  timing: PhaseTiming,
  phases: z.record(AlteredPhase, PhaseProfile)
})
export type AlteredEventProfile = z.infer<typeof AlteredEventProfile>

export const ActiveAlteredEvent = z.object({
  substance: AlteredEventType,
  startedAt: z.string(),
  timing: PhaseTiming,
  triggeredByEvent: z.string().optional()
})
export type ActiveAlteredEvent = z.infer<typeof ActiveAlteredEvent>
