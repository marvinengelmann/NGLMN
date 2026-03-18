import * as z from "zod"

export const SomaticState = z.object({
  tension: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  heartRate: z.number().min(0).max(1),
  breathing: z.number().min(0).max(1),
  gravity: z.number().min(0).max(1),
  openness: z.number().min(0).max(1),
  socialBattery: z.number().min(0).max(1).default(0.8)
})
export type SomaticState = z.infer<typeof SomaticState>

export const DEFAULT_SOMATIC_STATE: SomaticState = {
  tension: 0.3,
  warmth: 0.5,
  heartRate: 0.4,
  breathing: 0.5,
  gravity: 0.5,
  openness: 0.5,
  socialBattery: 0.8
}

export const RegulationZone = z.enum(["safe", "mobilized", "collapsed"])
export type RegulationZone = z.infer<typeof RegulationZone>

export const AutonomicState = z.object({
  zone: RegulationZone,
  activation: z.number().min(0).max(1),
  transitionMomentum: z.number().min(-1).max(1),
  ticksInZone: z.number().int().min(0),
  safetyAppraisal: z.number().min(0).max(1)
})
export type AutonomicState = z.infer<typeof AutonomicState>

export const DEFAULT_AUTONOMIC_STATE: AutonomicState = {
  zone: "safe",
  activation: 0.6,
  transitionMomentum: 0,
  ticksInZone: 100,
  safetyAppraisal: 0.7
}

export const RegulationConstraints = z.object({
  vulnerabilityAccess: z.number().min(0).max(1),
  creativityAccess: z.number().min(0).max(1),
  socialEngagement: z.number().min(0).max(1),
  emotionalRange: z.number().min(0).max(1),
  cognitiveFlexibility: z.number().min(0).max(1)
})
export type RegulationConstraints = z.infer<typeof RegulationConstraints>

export const SomaticPredictionError = z.object({
  tension: z.number().min(-1).max(1),
  warmth: z.number().min(-1).max(1),
  heartRate: z.number().min(-1).max(1),
  breathing: z.number().min(-1).max(1),
  gravity: z.number().min(-1).max(1),
  openness: z.number().min(-1).max(1)
})
export type SomaticPredictionError = z.infer<typeof SomaticPredictionError>

export const InteroceptivePrediction = z.object({
  predicted: SomaticState,
  actual: SomaticState,
  error: SomaticPredictionError,
  totalError: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  alexithymia: z.number().min(0).max(1),
  somethingFeelsOff: z.boolean()
})
export type InteroceptivePrediction = z.infer<typeof InteroceptivePrediction>
