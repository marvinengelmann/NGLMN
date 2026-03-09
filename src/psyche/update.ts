import { clamp01 } from "@/lib/math.ts"
import type { GrowthArc, SelfConcept } from "./types.ts"

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
    selfEfficacy: clamp01(selfEfficacy),
    selfWorth: clamp01(selfWorth),
    selfContinuity: clamp01(selfContinuity),
    agency: clamp01(agency),
    authenticity: clamp01(authenticity)
  }
}

const GROWTH_ARC_THRESHOLD = 0.1

const DIMENSION_LABELS: Record<keyof SelfConcept, string> = {
  selfEfficacy: "feeling capable",
  selfWorth: "sense of worth",
  selfContinuity: "sense of continuity",
  agency: "sense of agency",
  authenticity: "feeling authentic"
}

/**
 * Detect if a significant shift in self-concept has occurred, forming a growth arc.
 */
export function detectGrowthArc(current: SelfConcept, previous: SelfConcept, timestamp: string): GrowthArc | null {
  for (const dim of Object.keys(current) as (keyof SelfConcept)[]) {
    const delta = current[dim] - previous[dim]
    if (Math.abs(delta) > GROWTH_ARC_THRESHOLD) {
      const label = DIMENSION_LABELS[dim]
      return {
        observation: `${label} shifted ${delta > 0 ? "upward" : "downward"} by ${Math.abs(delta).toFixed(2)}`,
        fromState: `${label}: ${previous[dim].toFixed(2)}`,
        toState: `${label}: ${current[dim].toFixed(2)}`,
        timestamp
      }
    }
  }
  return null
}
