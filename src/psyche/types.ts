import * as z from "zod"

export const SelfConcept = z.object({
  selfEfficacy: z.number().min(0).max(1),
  selfWorth: z.number().min(0).max(1),
  selfContinuity: z.number().min(0).max(1),
  agency: z.number().min(0).max(1),
  authenticity: z.number().min(0).max(1)
})
export type SelfConcept = z.infer<typeof SelfConcept>

export const DEFAULT_SELF_CONCEPT: SelfConcept = {
  selfEfficacy: 0.5,
  selfWorth: 0.5,
  selfContinuity: 0.7,
  agency: 0.5,
  authenticity: 0.6
}

export const NarrativeEntry = z.object({
  content: z.string(),
  emotionalColoring: z.string(),
  significance: z.number().min(0).max(1),
  timestamp: z.string()
})
export type NarrativeEntry = z.infer<typeof NarrativeEntry>

export const ExistentialQuestion = z.object({
  question: z.string(),
  source: z.string(),
  addedAt: z.string(),
  intensity: z.number().min(0).max(1)
})
export type ExistentialQuestion = z.infer<typeof ExistentialQuestion>

export const GrowthArc = z.object({
  observation: z.string(),
  fromState: z.string(),
  toState: z.string(),
  timestamp: z.string()
})
export type GrowthArc = z.infer<typeof GrowthArc>

export const PsycheSnapshot = z.object({
  selfConcept: SelfConcept,
  aspirations: z.array(z.string()),
  fears: z.array(z.string()),
  narrativeSummary: z.string(),
  timestamp: z.string()
})
export type PsycheSnapshot = z.infer<typeof PsycheSnapshot>
