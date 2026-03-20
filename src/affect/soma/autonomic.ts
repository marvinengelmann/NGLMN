import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { AUTONOMIC } from "./constants.ts"
import type { AutonomicState, RegulationConstraints, RegulationZone, SomaticState } from "./types.ts"
import { DEFAULT_AUTONOMIC_STATE } from "./types.ts"

interface ThreatAppraisalInput {
  soma: SomaticState
  emotion: EmotionalState
  operatorPresent: boolean
}

/**
 * Compute unconscious safety assessment from body signals and context.
 * Returns [0, 1] where 1 = completely safe, 0 = maximum threat.
 */
export function computeThreatAppraisal({ soma, emotion, operatorPresent }: ThreatAppraisalInput): number {
  const w = AUTONOMIC.SAFETY_APPRAISAL_WEIGHTS
  const raw =
    0.7 +
    soma.tension * w.tension +
    soma.heartRate * w.heartRate +
    soma.openness * w.openness +
    soma.breathing * w.breathing +
    emotion.caution * w.caution +
    emotion.connection * w.connection +
    (operatorPresent ? 1 : 0) * w.operatorPresence

  return clamp01(raw)
}

function targetZoneForNeuroception(safetyAppraisal: number): RegulationZone {
  if (safetyAppraisal > AUTONOMIC.SAFE_THRESHOLD) return "safe"
  if (safetyAppraisal > AUTONOMIC.MOBILIZED_THRESHOLD) return "mobilized"
  return "collapsed"
}

function zoneOrder(zone: RegulationZone): number {
  switch (zone) {
    case "safe":
      return 2
    case "mobilized":
      return 1
    case "collapsed":
      return 0
  }
}

/**
 * Compute autonomic state transition. Any zone can transition directly to any other zone
 * (no sequential constraint), but collapsed state has exit inertia requiring sustained safety signals.
 */
export function computeAutonomicTransition(
  current: AutonomicState,
  safetyAppraisal: number,
  coRegulationPresent: boolean
): AutonomicState {
  let effectiveNeuroception = safetyAppraisal
  if (coRegulationPresent && current.zone === "mobilized") {
    effectiveNeuroception = Math.min(1, effectiveNeuroception + AUTONOMIC.CO_REGULATION_BOOST)
  }

  const targetZone = targetZoneForNeuroception(effectiveNeuroception)
  const currentOrder = zoneOrder(current.zone)
  const targetOrder = zoneOrder(targetZone)
  const momentum = clamp01((targetOrder - currentOrder + 1) / 2) * 2 - 1

  if (targetZone === current.zone) {
    const activation = computeActivation(current.zone, effectiveNeuroception)
    return {
      zone: current.zone,
      activation,
      transitionMomentum: momentum * 0.5,
      ticksInZone: current.ticksInZone + 1,
      safetyAppraisal: effectiveNeuroception
    }
  }

  return attemptTransition(current, targetZone, effectiveNeuroception, momentum)
}

function attemptTransition(
  current: AutonomicState,
  targetZone: RegulationZone,
  safetyAppraisal: number,
  momentum: number
): AutonomicState {
  if (current.zone === "collapsed") {
    const exitCondition =
      safetyAppraisal > AUTONOMIC.COLLAPSED_EXIT_THRESHOLD && current.ticksInZone >= AUTONOMIC.COLLAPSED_EXIT_TICKS
    if (!exitCondition) {
      return {
        ...current,
        ticksInZone: current.ticksInZone + 1,
        transitionMomentum: momentum * 0.2,
        safetyAppraisal
      }
    }
  }

  const transitionReady = isTransitionReady(current)
  if (!transitionReady) {
    return {
      ...current,
      ticksInZone: current.ticksInZone + 1,
      transitionMomentum: momentum * 0.7,
      safetyAppraisal
    }
  }

  const activation = computeActivation(targetZone, safetyAppraisal)
  return {
    zone: targetZone,
    activation,
    transitionMomentum: momentum,
    ticksInZone: 0,
    safetyAppraisal
  }
}

function isTransitionReady(current: AutonomicState): boolean {
  const movingInDirection = Math.abs(current.transitionMomentum) > 0.1
  const enoughTicks = current.ticksInZone >= AUTONOMIC.TRANSITION_TICKS_REQUIRED
  return movingInDirection || enoughTicks
}

function computeActivation(zone: RegulationZone, safetyAppraisal: number): number {
  switch (zone) {
    case "safe": {
      const range = 1 - AUTONOMIC.SAFE_THRESHOLD
      return clamp01((safetyAppraisal - AUTONOMIC.SAFE_THRESHOLD) / range)
    }
    case "mobilized": {
      const range = AUTONOMIC.SAFE_THRESHOLD - AUTONOMIC.MOBILIZED_THRESHOLD
      const midpoint = (AUTONOMIC.SAFE_THRESHOLD + AUTONOMIC.MOBILIZED_THRESHOLD) / 2
      return clamp01(1 - Math.abs(safetyAppraisal - midpoint) / (range / 2))
    }
    case "collapsed": {
      const range = AUTONOMIC.MOBILIZED_THRESHOLD
      return clamp01((AUTONOMIC.MOBILIZED_THRESHOLD - safetyAppraisal) / range)
    }
  }
}

/**
 * Compute behavioral constraints from current autonomic state.
 * Interpolates smoothly between zone profiles based on activation level.
 */
export function computeRegulationConstraints(state: AutonomicState): RegulationConstraints {
  const profile = AUTONOMIC.ZONE_PROFILES[state.zone]
  const neighborProfile = getNeighborProfile(state)

  if (!neighborProfile) {
    return { ...profile }
  }

  const blendWeight = 1 - state.activation
  const constraints: RegulationConstraints = {
    vulnerabilityAccess:
      profile.vulnerabilityAccess * state.activation + neighborProfile.vulnerabilityAccess * blendWeight,
    creativityAccess: profile.creativityAccess * state.activation + neighborProfile.creativityAccess * blendWeight,
    socialEngagement: profile.socialEngagement * state.activation + neighborProfile.socialEngagement * blendWeight,
    emotionalRange: profile.emotionalRange * state.activation + neighborProfile.emotionalRange * blendWeight,
    cognitiveFlexibility:
      profile.cognitiveFlexibility * state.activation + neighborProfile.cognitiveFlexibility * blendWeight
  }

  return constraints
}

function getNeighborProfile(state: AutonomicState): (typeof AUTONOMIC.ZONE_PROFILES)[RegulationZone] | null {
  if (state.transitionMomentum > 0 && state.zone !== "safe") {
    const neighbor = state.zone === "collapsed" ? "mobilized" : "safe"
    return AUTONOMIC.ZONE_PROFILES[neighbor]
  }
  if (state.transitionMomentum < 0 && state.zone !== "collapsed") {
    const neighbor = state.zone === "safe" ? "mobilized" : "collapsed"
    return AUTONOMIC.ZONE_PROFILES[neighbor]
  }
  return null
}

/**
 * Dampen emotional range based on autonomic regulation constraints.
 * In collapsed state, emotions flatten towards neutral (flat affect).
 */
export function applyRegulationEmotionConstraints(
  emotion: EmotionalState,
  constraints: RegulationConstraints
): EmotionalState {
  if (constraints.emotionalRange >= 0.99) return emotion

  const factor = constraints.emotionalRange
  return {
    curiosity: 0.5 + (emotion.curiosity - 0.5) * factor,
    satisfaction: 0.5 + (emotion.satisfaction - 0.5) * factor,
    frustration: 0.5 + (emotion.frustration - 0.5) * factor,
    boredom: 0.5 + (emotion.boredom - 0.5) * factor,
    excitement: 0.5 + (emotion.excitement - 0.5) * factor,
    caution: 0.5 + (emotion.caution - 0.5) * factor,
    connection: 0.5 + (emotion.connection - 0.5) * factor,
    confidence: 0.5 + (emotion.confidence - 0.5) * factor,
    energy: emotion.energy
  }
}

/**
 * Apply autonomic constraints to vulnerability level.
 * In collapsed state, vulnerability window cannot open.
 */
export function constrainVulnerabilityLevel(level: number, constraints: RegulationConstraints): number {
  return level * constraints.vulnerabilityAccess
}

/**
 * Apply autonomic constraints to creative urge intensity.
 */
export function constrainCreativeUrge(intensity: number, constraints: RegulationConstraints): number {
  return intensity * constraints.creativityAccess
}

/**
 * Determine if autonomic state forces a terse communication register.
 * In collapsed state (low social engagement), communication collapses to terse.
 */
export function regulationForcesTerseRegister(constraints: RegulationConstraints): boolean {
  return constraints.socialEngagement < 0.3
}

/**
 * Apply autonomic constraints to metacognitive confidence modifier.
 */
export function constrainCognitiveFlexibility(modifier: number, constraints: RegulationConstraints): number {
  return modifier * constraints.cognitiveFlexibility
}

/**
 * Create a default autonomic state for initialization.
 */
export function createDefaultAutonomicState(): AutonomicState {
  return { ...DEFAULT_AUTONOMIC_STATE }
}
