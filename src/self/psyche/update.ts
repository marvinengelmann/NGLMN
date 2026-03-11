import { differenceInHours, parseISO } from "date-fns"
import { clamp01 } from "@/infra/lib/math.ts"
import type { GrowthArc, SelfConcept } from "./types.ts"

const MAX_ARCS_PER_DAY = 3
const CONTINUITY_BOOST_PER_ARC = 0.01
const DIMENSION_DRIFT_BOOST = 0.005

/**
 * Apply momentum from recent growth arcs to the self-concept.
 * Recent arcs reinforce self-continuity and nudge the changed dimension further.
 */
export function applyGrowthArcMomentum(selfConcept: SelfConcept, recentGrowthArcs: GrowthArc[]): SelfConcept {
  const now = new Date()
  const recentArcs = recentGrowthArcs
    .filter((arc) => differenceInHours(now, parseISO(arc.timestamp)) < 24)
    .slice(-MAX_ARCS_PER_DAY)

  if (recentArcs.length === 0) return selfConcept

  const result = { ...selfConcept }
  result.selfContinuity = clamp01(result.selfContinuity + CONTINUITY_BOOST_PER_ARC * recentArcs.length)

  recentArcs.forEach((arc) => {
    const dimension = detectArcDimension(arc)
    if (dimension && dimension in result) {
      const direction = arc.observation.includes("upward") ? 1 : -1
      result[dimension] = clamp01(result[dimension] + DIMENSION_DRIFT_BOOST * direction)
    }
  })

  return result
}

function detectArcDimension(arc: GrowthArc): keyof SelfConcept | null {
  const match = Object.entries(DIMENSION_LABELS).find(([, label]) => arc.observation.includes(label))
  return match ? (match[0] as keyof SelfConcept) : null
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
  const dimension = (Object.keys(current) as (keyof SelfConcept)[]).find(
    (dim) => Math.abs(current[dim] - previous[dim]) > GROWTH_ARC_THRESHOLD
  )

  if (!dimension) return null

  const delta = current[dimension] - previous[dimension]
  const label = DIMENSION_LABELS[dimension]
  return {
    observation: `${label} shifted ${delta > 0 ? "upward" : "downward"} by ${Math.abs(delta).toFixed(2)}`,
    fromState: `${label}: ${previous[dimension].toFixed(2)}`,
    toState: `${label}: ${current[dimension].toFixed(2)}`,
    timestamp
  }
}
