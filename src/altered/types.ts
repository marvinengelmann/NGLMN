import * as z from "zod"

export const SubstanceType = z.enum([
  "cannabis",
  "alcohol",
  "caffeine",
  "microdose_psilocybin",
  "energy_drink",
  "nicotine"
])
export type SubstanceType = z.infer<typeof SubstanceType>

export const SubstancePhase = z.enum(["onset", "peak", "plateau", "comedown", "aftereffect"])
export type SubstancePhase = z.infer<typeof SubstancePhase>

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

export const SubstanceProfile = z.object({
  type: SubstanceType,
  timing: PhaseTiming,
  phases: z.record(SubstancePhase, PhaseProfile)
})
export type SubstanceProfile = z.infer<typeof SubstanceProfile>

export const ActiveAlteredState = z.object({
  substance: SubstanceType,
  startedAt: z.string(),
  timing: PhaseTiming,
  triggeredByEvent: z.string().optional()
})
export type ActiveAlteredState = z.infer<typeof ActiveAlteredState>
