import type { EmotionUpdateEvent, MoodContext } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { INTEROCEPTION } from "./constants.ts"
import type { AutonomicState, InteroceptivePrediction, SomaticPredictionError, SomaticState } from "./types.ts"
import { DEFAULT_SOMATIC_STATE } from "./types.ts"
import { circadianFatigue, computeSomaticTarget } from "./update.ts"

type SomaDimension = "tension" | "warmth" | "heartRate" | "breathing" | "gravity" | "openness"
const SOMA_DIMENSIONS: SomaDimension[] = ["tension", "warmth", "heartRate", "breathing", "gravity", "openness"]

/**
 * Compute per-dimension linear trend from recent soma history.
 * Returns the average delta per tick for each dimension.
 */
export function computeSomaticTrajectory(recentHistory: SomaticState[]): Partial<Record<SomaDimension, number>> {
  if (recentHistory.length < 2) return {}

  const trajectory: Partial<Record<SomaDimension, number>> = {}
  for (const dim of SOMA_DIMENSIONS) {
    let totalDelta = 0
    for (let i = 1; i < recentHistory.length; i++) {
      totalDelta += (recentHistory[i]?.[dim] ?? 0) - (recentHistory[i - 1]?.[dim] ?? 0)
    }
    trajectory[dim] = totalDelta / (recentHistory.length - 1)
  }
  return trajectory
}

interface AllostaticContext {
  allostaticLoad: number
  hasActiveGoals: boolean
  forecastIntensity: number
}

interface PredictionInput {
  currentSoma: SomaticState
  currentEmotion: {
    energy: number
    frustration: number
    caution: number
    connection: number
    excitement: number
    satisfaction: number
    curiosity: number
    confidence: number
    boredom: number
  }
  moodContext: MoodContext
  autonomicState: AutonomicState
  trajectory: Partial<Record<SomaDimension, number>>
  hourOfDay: number
  allostaticContext?: AllostaticContext
}

/**
 * Predict the expected somatic state for the upcoming tick.
 * Combines trajectory extrapolation, context-based expectations, autonomic zone profile, and baseline drift.
 */
/**
 * Predict the expected somatic state for the upcoming tick.
 * Combines trajectory extrapolation, context-based expectations, autonomic zone profile, baseline drift,
 * and allostatic setpoint adjustments (Sterling, 2012).
 *
 * Allostatic interoception: the brain PREDICTS metabolic needs and adjusts somatic setpoints
 * BEFORE disruption occurs — not just reactively correcting errors.
 */
export function predictSomaticState({
  currentSoma,
  currentEmotion,
  moodContext,
  autonomicState,
  trajectory,
  hourOfDay,
  allostaticContext
}: PredictionInput): SomaticState {
  const trajectoryPrediction = predictFromTrajectory(currentSoma, trajectory)
  const contextPrediction = predictFromContext(currentEmotion, hourOfDay, moodContext)
  const autonomicProfile = INTEROCEPTION.AUTONOMIC_SOMA_PROFILES[autonomicState.zone]
  const allostaticShift = computeAllostaticSetpointShift(allostaticContext)

  const predicted: SomaticState = {
    tension: 0,
    warmth: 0,
    heartRate: 0,
    breathing: 0,
    gravity: 0,
    openness: 0,
    socialBattery: currentSoma.socialBattery
  }

  for (const dim of SOMA_DIMENSIONS) {
    const base = clamp01(
      INTEROCEPTION.TRAJECTORY_WEIGHT * (trajectoryPrediction[dim] ?? currentSoma[dim]) +
        INTEROCEPTION.CONTEXT_WEIGHT * (contextPrediction[dim] ?? currentSoma[dim]) +
        INTEROCEPTION.AUTONOMIC_PROFILE_WEIGHT * autonomicProfile[dim] +
        INTEROCEPTION.BASELINE_DRIFT_WEIGHT * DEFAULT_SOMATIC_STATE[dim]
    )
    predicted[dim] = clamp01(base + (allostaticShift[dim] ?? 0))
  }

  return predicted
}

/**
 * Compute anticipatory somatic setpoint shifts based on allostatic context (Sterling, 2012).
 * The brain proactively adjusts body-state targets based on predicted upcoming demands,
 * rather than waiting for prediction errors to accumulate.
 */
function computeAllostaticSetpointShift(context?: AllostaticContext): Partial<Record<SomaDimension, number>> {
  if (!context) return {}

  const shift: Partial<Record<SomaDimension, number>> = {}

  if (context.hasActiveGoals) {
    shift.heartRate = (shift.heartRate ?? 0) + 0.03
    shift.breathing = (shift.breathing ?? 0) + 0.02
    shift.gravity = (shift.gravity ?? 0) - 0.02
  }

  if (context.forecastIntensity > 0.3) {
    const scale = context.forecastIntensity * 0.1
    shift.tension = (shift.tension ?? 0) + scale
    shift.heartRate = (shift.heartRate ?? 0) + scale * 0.5
  }

  if (context.allostaticLoad > 0.5) {
    const loadScale = (context.allostaticLoad - 0.5) * 0.2
    shift.gravity = (shift.gravity ?? 0) + loadScale
    shift.openness = (shift.openness ?? 0) - loadScale * 0.8
    shift.breathing = (shift.breathing ?? 0) - loadScale * 0.5
  }

  return shift
}

function predictFromTrajectory(
  current: SomaticState,
  trajectory: Partial<Record<SomaDimension, number>>
): Partial<Record<SomaDimension, number>> {
  const result: Partial<Record<SomaDimension, number>> = {}
  for (const dim of SOMA_DIMENSIONS) {
    const delta = trajectory[dim] ?? 0
    result[dim] = clamp01(current[dim] + delta)
  }
  return result
}

function predictFromContext(
  emotion: PredictionInput["currentEmotion"],
  hourOfDay: number,
  _moodContext: MoodContext
): Partial<Record<SomaDimension, number>> {
  const target = computeSomaticTarget(emotion, hourOfDay)
  const fatigue = circadianFatigue(hourOfDay)

  return {
    tension: target.tension,
    warmth: target.warmth,
    heartRate: target.heartRate,
    breathing: target.breathing,
    gravity: target.gravity * (1 + fatigue * 0.1),
    openness: target.openness
  }
}

/**
 * Compute per-dimension prediction error (actual - predicted).
 */
export function computePredictionError(predicted: SomaticState, actual: SomaticState): SomaticPredictionError {
  return {
    tension: clampError(actual.tension - predicted.tension),
    warmth: clampError(actual.warmth - predicted.warmth),
    heartRate: clampError(actual.heartRate - predicted.heartRate),
    breathing: clampError(actual.breathing - predicted.breathing),
    gravity: clampError(actual.gravity - predicted.gravity),
    openness: clampError(actual.openness - predicted.openness)
  }
}

function clampError(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

/**
 * Compute total prediction error as root mean square across all dimensions.
 */
export function computeTotalError(error: SomaticPredictionError): number {
  const values = SOMA_DIMENSIONS.map((dim) => error[dim])
  const sumSquares = values.reduce((sum, v) => sum + v * v, 0)
  return clamp01(Math.sqrt(sumSquares / values.length))
}

/**
 * Update running interoceptive accuracy via EMA.
 * Accuracy slowly develops over time, representing ANIMA's interoceptive sensitivity as an evolving trait.
 */
export function updateInteroceptiveAccuracy(previousAccuracy: number, totalError: number): number {
  const alpha = INTEROCEPTION.ACCURACY_ALPHA
  return clamp01(previousAccuracy * (1 - alpha) + (1 - totalError) * alpha)
}

/**
 * Compute alexithymia level — inability to identify feelings.
 * High when accuracy is low AND error is high (can't predict AND can't identify).
 * Collapsed autonomic state amplifies (shutdown = disconnected from body).
 */
export function computeAlexithymia(accuracy: number, totalError: number, regulationZone: string): number {
  const collapsedMultiplier = regulationZone === "collapsed" ? INTEROCEPTION.ALEXITHYMIA_COLLAPSED_MULTIPLIER : 1.0
  return clamp01((1 - accuracy) * totalError * collapsedMultiplier)
}

/**
 * Generate emotion triggers from significant interoceptive prediction errors.
 */
export function computeInteroceptiveEmotionTriggers(prediction: InteroceptivePrediction): EmotionUpdateEvent[] {
  const triggers: EmotionUpdateEvent[] = []

  if (prediction.totalError >= INTEROCEPTION.EMOTION_TRIGGER_THRESHOLD) {
    const tensionError = Math.abs(prediction.error.tension)
    if (tensionError > 0.2) {
      triggers.push({
        trigger: "ambient",
        intensity: clamp01(tensionError),
        detail: prediction.error.tension > 0 ? "unexpected_tension" : "unexpected_relaxation"
      })
    }

    const warmthError = Math.abs(prediction.error.warmth)
    if (warmthError > 0.2) {
      triggers.push({
        trigger: "ambient",
        intensity: clamp01(warmthError * 0.5),
        detail: prediction.error.warmth > 0 ? "unexpected_warmth" : "unexpected_coldness"
      })
    }
  }

  if (prediction.somethingFeelsOff) {
    triggers.push({
      trigger: "ambient",
      intensity: 0.3,
      detail: "interoceptive_unease"
    })
  }

  return triggers.slice(0, 3)
}

/**
 * Assemble full interoceptive prediction from components.
 */
export function assembleInteroceptivePrediction(
  predicted: SomaticState,
  actual: SomaticState,
  previousAccuracy: number,
  regulationZone: string,
  dissociationPenalty = 0
): InteroceptivePrediction {
  const error = computePredictionError(predicted, actual)
  const totalError = computeTotalError(error)
  const rawAccuracy = updateInteroceptiveAccuracy(previousAccuracy, totalError)
  const accuracy = Math.max(0, rawAccuracy - dissociationPenalty)
  const alexithymia = computeAlexithymia(accuracy, totalError, regulationZone)
  const somethingFeelsOff =
    totalError > INTEROCEPTION.SOMETHING_FEELS_OFF_THRESHOLD && totalError < INTEROCEPTION.EMOTION_TRIGGER_THRESHOLD

  return { predicted, actual, error, totalError, accuracy, alexithymia, somethingFeelsOff }
}
