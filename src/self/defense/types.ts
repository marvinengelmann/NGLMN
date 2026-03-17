import * as z from "zod"

export const DefenseMechanismType = z.enum([
  "repression",
  "projection",
  "rationalization",
  "sublimation",
  "reaction_formation",
  "intellectualization",
  "denial",
  "displacement"
])
export type DefenseMechanismType = z.infer<typeof DefenseMechanismType>

export const RepressionTarget = z.object({
  episodeQuery: z.string(),
  suppressionFactor: z.number().min(0).max(1),
  addedAt: z.string()
})
export type RepressionTarget = z.infer<typeof RepressionTarget>

export const ActiveDefense = z.object({
  type: DefenseMechanismType,
  trigger: z.string(),
  intensity: z.number().min(0).max(1),
  activatedAt: z.string(),
  targetOverride: z.string().optional(),
  expressionModifier: z.string().optional()
})
export type ActiveDefense = z.infer<typeof ActiveDefense>

export const DefenseState = z.object({
  activeDefenses: z.array(ActiveDefense),
  repressionTargets: z.array(RepressionTarget),
  totalActivations: z.number().int().min(0),
  totalBreakthroughs: z.number().int().min(0)
})
export type DefenseState = z.infer<typeof DefenseState>

export const DEFAULT_DEFENSE_STATE: DefenseState = {
  activeDefenses: [],
  repressionTargets: [],
  totalActivations: 0,
  totalBreakthroughs: 0
}
