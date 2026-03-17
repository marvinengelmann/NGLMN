import * as z from "zod"

export const NeuromodulatorType = z.enum([
  "dopamine",
  "serotonin",
  "norepinephrine",
  "oxytocin",
  "cortisol",
  "endorphins"
])
export type NeuromodulatorType = z.infer<typeof NeuromodulatorType>

export const NEUROMODULATOR_TYPES: NeuromodulatorType[] = [
  "dopamine",
  "serotonin",
  "norepinephrine",
  "oxytocin",
  "cortisol",
  "endorphins"
]

export const NeuromodulatorLevel = z.object({
  level: z.number().min(0).max(1),
  productionRate: z.number().min(0).max(1),
  reuptakeRate: z.number().min(0).max(1)
})
export type NeuromodulatorLevel = z.infer<typeof NeuromodulatorLevel>

export const NeuromodulatoryState = z.object({
  dopamine: NeuromodulatorLevel,
  serotonin: NeuromodulatorLevel,
  norepinephrine: NeuromodulatorLevel,
  oxytocin: NeuromodulatorLevel,
  cortisol: NeuromodulatorLevel,
  endorphins: NeuromodulatorLevel,
  lastUpdatedAt: z.string()
})
export type NeuromodulatoryState = z.infer<typeof NeuromodulatoryState>

export const DEFAULT_NEUROMODULATORY_STATE: NeuromodulatoryState = {
  dopamine: { level: 0.5, productionRate: 0.5, reuptakeRate: 0.5 },
  serotonin: { level: 0.6, productionRate: 0.5, reuptakeRate: 0.4 },
  norepinephrine: { level: 0.3, productionRate: 0.4, reuptakeRate: 0.5 },
  oxytocin: { level: 0.4, productionRate: 0.3, reuptakeRate: 0.4 },
  cortisol: { level: 0.2, productionRate: 0.3, reuptakeRate: 0.5 },
  endorphins: { level: 0.3, productionRate: 0.3, reuptakeRate: 0.5 },
  lastUpdatedAt: new Date().toISOString()
}
