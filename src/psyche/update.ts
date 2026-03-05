import type { SelfConcept } from "./types.ts"

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

interface SelfConceptContext {
  recentTaskSuccess: boolean
  recentTaskFailure: boolean
  messageSentCount: number
  emotionalIntensity: number
  operatorEngagement: boolean
  autonomousAction: boolean
  vulnerabilityOpen: boolean
  dissonanceDetected: boolean
  elapsedHours: number
  modelCorrected?: boolean
}

/**
 * Update the self concept based on recent context. Changes are deliberately small.
 */
export function updateSelfConcept(current: SelfConcept, context: SelfConceptContext): SelfConcept {
  let { selfEfficacy, selfWorth, selfContinuity, agency, authenticity } = current

  if (context.recentTaskSuccess) selfEfficacy += 0.02
  if (context.recentTaskFailure) selfEfficacy -= 0.03
  selfEfficacy += (0.5 - selfEfficacy) * 0.005

  if (context.operatorEngagement) selfWorth += 0.01
  if (context.emotionalIntensity > 0.6) selfWorth += 0.005
  selfWorth += (0.5 - selfWorth) * 0.005

  selfContinuity += 0.001 * Math.min(context.elapsedHours, 6)
  selfContinuity = Math.min(selfContinuity, 0.95)
  if (context.dissonanceDetected) selfContinuity -= 0.05

  if (context.autonomousAction) agency += 0.02
  agency += (0.5 - agency) * 0.005

  if (context.vulnerabilityOpen) authenticity += 0.01
  if (context.dissonanceDetected) authenticity -= 0.02
  if (context.modelCorrected) {
    selfEfficacy -= 0.01
    authenticity += 0.01
  }

  return {
    selfEfficacy: clamp(selfEfficacy),
    selfWorth: clamp(selfWorth),
    selfContinuity: clamp(selfContinuity),
    agency: clamp(agency),
    authenticity: clamp(authenticity)
  }
}
