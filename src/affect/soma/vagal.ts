import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { VAGAL } from "./constants.ts"
import type { SomaticState, VagalConstraints, VagalState, VagalZone } from "./types.ts"
import { DEFAULT_VAGAL_STATE } from "./types.ts"

interface NeuroceptionInput {
  soma: SomaticState
  emotion: EmotionalState
  operatorPresent: boolean
}

/**
 * Compute unconscious safety assessment from body signals and context.
 * Returns [0, 1] where 1 = completely safe, 0 = maximum threat.
 */
export function computeNeuroception({ soma, emotion, operatorPresent }: NeuroceptionInput): number {
  const w = VAGAL.NEUROCEPTION_WEIGHTS
  const raw =
    0.5 +
    soma.tension * w.tension +
    soma.heartRate * w.heartRate +
    soma.openness * w.openness +
    soma.breathing * w.breathing +
    emotion.caution * w.caution +
    emotion.connection * w.connection +
    (operatorPresent ? 1 : 0) * w.operatorPresence

  return clamp01(raw)
}

function targetZoneForNeuroception(neuroception: number): VagalZone {
  if (neuroception > VAGAL.VENTRAL_THRESHOLD) return "ventral"
  if (neuroception > VAGAL.SYMPATHETIC_THRESHOLD) return "sympathetic"
  return "dorsal"
}

function adjacentZones(zone: VagalZone): VagalZone[] {
  switch (zone) {
    case "ventral":
      return ["sympathetic"]
    case "sympathetic":
      return ["ventral", "dorsal"]
    case "dorsal":
      return ["sympathetic"]
  }
}

function zoneOrder(zone: VagalZone): number {
  switch (zone) {
    case "ventral":
      return 2
    case "sympathetic":
      return 1
    case "dorsal":
      return 0
  }
}

/**
 * Compute vagal state transition with sequential constraints, hysteresis, and dorsal inertia.
 */
export function computeVagalTransition(
  current: VagalState,
  neuroception: number,
  coRegulationPresent: boolean
): VagalState {
  let effectiveNeuroception = neuroception
  if (coRegulationPresent && current.zone === "sympathetic") {
    effectiveNeuroception = Math.min(1, effectiveNeuroception + VAGAL.CO_REGULATION_BOOST)
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
      neuroception: effectiveNeuroception
    }
  }

  const allowed = adjacentZones(current.zone)
  if (!allowed.includes(targetZone)) {
    const stepZone =
      targetOrder > currentOrder
        ? allowed.find((z) => zoneOrder(z) > currentOrder)
        : allowed.find((z) => zoneOrder(z) < currentOrder)

    if (!stepZone) {
      return {
        ...current,
        ticksInZone: current.ticksInZone + 1,
        transitionMomentum: momentum * 0.3,
        neuroception: effectiveNeuroception
      }
    }

    return attemptTransition(current, stepZone, effectiveNeuroception, momentum)
  }

  return attemptTransition(current, targetZone, effectiveNeuroception, momentum)
}

function attemptTransition(
  current: VagalState,
  targetZone: VagalZone,
  neuroception: number,
  momentum: number
): VagalState {
  if (current.zone === "dorsal") {
    const exitCondition = neuroception > VAGAL.DORSAL_EXIT_THRESHOLD && current.ticksInZone >= VAGAL.DORSAL_EXIT_TICKS
    if (!exitCondition) {
      return {
        ...current,
        ticksInZone: current.ticksInZone + 1,
        transitionMomentum: momentum * 0.2,
        neuroception
      }
    }
  }

  const transitionReady = isTransitionReady(current, targetZone)
  if (!transitionReady) {
    return {
      ...current,
      ticksInZone: current.ticksInZone + 1,
      transitionMomentum: momentum * 0.7,
      neuroception
    }
  }

  const activation = computeActivation(targetZone, neuroception)
  return {
    zone: targetZone,
    activation,
    transitionMomentum: momentum,
    ticksInZone: 0,
    neuroception
  }
}

function isTransitionReady(current: VagalState, _targetZone: VagalZone): boolean {
  const movingInDirection = Math.abs(current.transitionMomentum) > 0.1
  const enoughTicks = current.ticksInZone >= VAGAL.TRANSITION_TICKS_REQUIRED
  return movingInDirection || enoughTicks
}

function computeActivation(zone: VagalZone, neuroception: number): number {
  switch (zone) {
    case "ventral": {
      const range = 1 - VAGAL.VENTRAL_THRESHOLD
      return clamp01((neuroception - VAGAL.VENTRAL_THRESHOLD) / range)
    }
    case "sympathetic": {
      const range = VAGAL.VENTRAL_THRESHOLD - VAGAL.SYMPATHETIC_THRESHOLD
      const midpoint = (VAGAL.VENTRAL_THRESHOLD + VAGAL.SYMPATHETIC_THRESHOLD) / 2
      return clamp01(1 - Math.abs(neuroception - midpoint) / (range / 2))
    }
    case "dorsal": {
      const range = VAGAL.SYMPATHETIC_THRESHOLD
      return clamp01((VAGAL.SYMPATHETIC_THRESHOLD - neuroception) / range)
    }
  }
}

/**
 * Compute behavioral constraints from current vagal state.
 * Interpolates smoothly between zone profiles based on activation level.
 */
export function computeVagalConstraints(state: VagalState): VagalConstraints {
  const profile = VAGAL.ZONE_PROFILES[state.zone]
  const neighborProfile = getNeighborProfile(state)

  if (!neighborProfile) {
    return { ...profile }
  }

  const blendWeight = 1 - state.activation
  const constraints: VagalConstraints = {
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

function getNeighborProfile(state: VagalState): (typeof VAGAL.ZONE_PROFILES)[VagalZone] | null {
  if (state.transitionMomentum > 0 && state.zone !== "ventral") {
    const neighbor = state.zone === "dorsal" ? "sympathetic" : "ventral"
    return VAGAL.ZONE_PROFILES[neighbor]
  }
  if (state.transitionMomentum < 0 && state.zone !== "dorsal") {
    const neighbor = state.zone === "ventral" ? "sympathetic" : "dorsal"
    return VAGAL.ZONE_PROFILES[neighbor]
  }
  return null
}

/**
 * Dampen emotional range based on vagal constraints.
 * In dorsal vagal, emotions flatten towards neutral (flat affect).
 */
export function applyVagalEmotionConstraints(emotion: EmotionalState, constraints: VagalConstraints): EmotionalState {
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
 * Apply vagal constraints to vulnerability level.
 * In dorsal vagal, vulnerability window cannot open.
 */
export function constrainVulnerabilityLevel(level: number, constraints: VagalConstraints): number {
  return level * constraints.vulnerabilityAccess
}

/**
 * Apply vagal constraints to creative urge intensity.
 */
export function constrainCreativeUrge(intensity: number, constraints: VagalConstraints): number {
  return intensity * constraints.creativityAccess
}

/**
 * Determine if vagal state forces a terse communication register.
 * In dorsal vagal (low social engagement), communication collapses to terse.
 */
export function vagalForcesTerseRegister(constraints: VagalConstraints): boolean {
  return constraints.socialEngagement < 0.3
}

/**
 * Apply vagal constraints to metacognitive confidence modifier.
 */
export function constrainCognitiveFlexibility(modifier: number, constraints: VagalConstraints): number {
  return modifier * constraints.cognitiveFlexibility
}

/**
 * Create a default vagal state for initialization.
 */
export function createDefaultVagalState(): VagalState {
  return { ...DEFAULT_VAGAL_STATE }
}
