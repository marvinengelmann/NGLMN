import * as z from "zod"

export const NeuromodulatorType = z.enum([
  "dopamine",
  "serotonin",
  "norepinephrine",
  "oxytocin",
  "cortisol",
  "endorphins",
  "gaba"
])
export type NeuromodulatorType = z.infer<typeof NeuromodulatorType>

export const NEUROMODULATOR_TYPES: NeuromodulatorType[] = [
  "dopamine",
  "serotonin",
  "norepinephrine",
  "oxytocin",
  "cortisol",
  "endorphins",
  "gaba"
]

export const NeuromodulatorLevel = z.object({
  level: z.number().min(0).max(1),
  productionRate: z.number().min(0).max(1),
  reuptakeRate: z.number().min(0).max(1)
})
export type NeuromodulatorLevel = z.infer<typeof NeuromodulatorLevel>

export const DopamineDetail = z.object({
  tonicLevel: z.number().min(0).max(1),
  phasicLevel: z.number().min(0).max(1)
})
export type DopamineDetail = z.infer<typeof DopamineDetail>

export const NeuromodulatoryState = z.object({
  dopamine: NeuromodulatorLevel,
  serotonin: NeuromodulatorLevel,
  norepinephrine: NeuromodulatorLevel,
  oxytocin: NeuromodulatorLevel,
  /** Stress hormone (HPA axis steroid, not a neurotransmitter) */
  cortisol: NeuromodulatorLevel,
  endorphins: NeuromodulatorLevel,
  gaba: NeuromodulatorLevel,
  dopamineDetail: DopamineDetail,
  lastUpdatedAt: z.string()
})
export type NeuromodulatoryState = z.infer<typeof NeuromodulatoryState>

export const DepressivePatternResult = z.object({
  riskScore: z.number().min(0).max(1),
  factors: z.array(z.string())
})
export type DepressivePatternResult = z.infer<typeof DepressivePatternResult>

export const DEFAULT_NEUROMODULATORY_STATE: NeuromodulatoryState = {
  dopamine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  serotonin: { level: 0.6, productionRate: 0.5, reuptakeRate: 0.4 },
  norepinephrine: { level: 0.3, productionRate: 0.4, reuptakeRate: 0.5 },
  oxytocin: { level: 0.4, productionRate: 0.3, reuptakeRate: 0.4 },
  cortisol: { level: 0.2, productionRate: 0.3, reuptakeRate: 0.5 },
  endorphins: { level: 0.3, productionRate: 0.3, reuptakeRate: 0.5 },
  gaba: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  dopamineDetail: { tonicLevel: 0.45, phasicLevel: 0.05 },
  lastUpdatedAt: new Date().toISOString()
}
