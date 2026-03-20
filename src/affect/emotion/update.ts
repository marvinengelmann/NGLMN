import {
  type AfterglowEntry,
  type AppraisalResult,
  DEFAULT_EMOTIONAL_MOMENTUM,
  DEFAULT_EMOTIONAL_STATE,
  type EmotionalMomentum,
  type EmotionalState,
  type EmotionConstructionResult,
  type EmotionDeltas,
  type EmotionTrigger,
  type EmotionUpdateEvent,
  type EpisodicContext,
  type MoodContext
} from "@/affect/emotion/types.ts"
import { computeMoodBaselineModulation } from "@/affect/neuromodulation/compute.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { applyConstructedEvents, type ConstructedEmotionInput } from "./appraisal.ts"
import { CONTRADICTION, EMOTION, MOMENTUM, MOOD_BASELINE, MOOD_CONTAGION } from "./constants.ts"
import type { AppraisalContext } from "./types.ts"

export const EMOTION_FLOORS: Partial<Record<keyof EmotionalState, number>> = {
  energy: 0.3,
  confidence: 0.05,
  satisfaction: 0.08,
  excitement: 0.05,
  caution: 0.1
} as const

export const EMOTION_CEILINGS: Partial<Record<keyof EmotionalState, number>> = {
  frustration: 0.92,
  confidence: 0.75
} as const

export function enforceEmotionFloors(state: EmotionalState): EmotionalState {
  const result = { ...state }
  for (const [key, floor] of Object.entries(EMOTION_FLOORS)) {
    const dim = key as keyof EmotionalState
    if (result[dim] < floor) {
      result[dim] = floor
    }
  }
  for (const [key, ceiling] of Object.entries(EMOTION_CEILINGS)) {
    const dim = key as keyof EmotionalState
    if (result[dim] > ceiling) {
      result[dim] = ceiling
    }
  }
  return result
}

const TRIGGER_EFFECTS: Record<EmotionTrigger, EmotionDeltas> = {
  message_received: { connection: 0.2, satisfaction: 0.15, boredom: -0.2, excitement: 0.1, energy: 0.05, frustration: -0.08 },
  message_sent: { satisfaction: 0.03, connection: 0.02 },
  task_success: { satisfaction: 0.08, confidence: 0.08, frustration: -0.05 },
  task_failure: { frustration: 0.4, confidence: -0.3, satisfaction: -0.2, caution: 0.15, energy: -0.1 },
  guardian_warning: { caution: 0.08, frustration: 0.05, confidence: -0.05 },
  guardian_block: { caution: 0.12, frustration: 0.08, confidence: -0.12 },
  operator_went_silent: { connection: -0.12, satisfaction: -0.05, boredom: 0.06 },
  operator_returned: { connection: 0.15, excitement: 0.08, boredom: -0.12, energy: 0.06, satisfaction: 0.06 },
  system_degraded: { caution: 0.08, satisfaction: -0.05 },
  system_recovered: { satisfaction: 0.05, caution: -0.05 },
  new_goal: { excitement: 0.08, curiosity: 0.05 },
  goal_completed: { satisfaction: 0.12, confidence: 0.1, excitement: 0.05 },
  goal_failed: { frustration: 0.08, confidence: -0.08, satisfaction: -0.08 },
  weather_update: { curiosity: 0.06, excitement: 0.05, boredom: -0.05, satisfaction: 0.03 },
  git_activity: { curiosity: 0.08, excitement: 0.05, satisfaction: 0.03 },
  dream_correction: {},
  morning_calibration: { energy: 2.0, satisfaction: 0.3, frustration: -0.2, boredom: -0.15 },
  nostalgia_wave: { connection: 0.08, satisfaction: 0.04, excitement: -0.03, boredom: -0.05, energy: -0.02 },
  relational_pattern_match: { connection: 0.03, caution: 0.02 },
  drive_frustrated: { frustration: 0.02 },
  drive_conflict: { caution: 0.04, frustration: 0.03 },
  positive_anticipation: { excitement: 0.05, energy: 0.03 },
  expectation_violated: { frustration: 0.2, caution: 0.1, satisfaction: -0.1, excitement: -0.1 },
  expectation_met: { satisfaction: 0.04, confidence: 0.02 },
  boundary_violated: { caution: 0.4, frustration: 0.3, connection: -0.2, satisfaction: -0.15, confidence: -0.1 },
  memory_contradiction: { curiosity: 0.06, caution: 0.04, frustration: 0.03 },
  ambient: {}
}

/**
 * Clamp all emotional state values to [0, 1].
 */
export function clampState(state: EmotionalState): EmotionalState {
  return {
    curiosity: clamp01(state.curiosity),
    satisfaction: clamp01(state.satisfaction),
    frustration: clamp01(state.frustration),
    boredom: clamp01(state.boredom),
    excitement: clamp01(state.excitement),
    caution: clamp01(state.caution),
    connection: clamp01(state.connection),
    confidence: clamp01(state.confidence),
    energy: clamp01(state.energy)
  }
}

/**
 * Compute a dynamic mood baseline based on current context.
 * Each dimension starts at 0.5 and is shifted by contextual factors.
 */
function computeCircadianEnergy(hourOfDay: number): number {
  const { PEAK_LEVEL, TROUGH_HOUR, TROUGH_LEVEL, AFTERNOON_DIP_HOUR, AFTERNOON_DIP_DEPTH } =
    MOOD_BASELINE.ENERGY_CIRCADIAN

  const peakToTroughRange = PEAK_LEVEL - TROUGH_LEVEL
  const circadianPhase = ((hourOfDay - TROUGH_HOUR + 24) % 24) / 24
  const cosine = Math.cos((circadianPhase - 0.5) * 2 * Math.PI)
  const baseEnergy = TROUGH_LEVEL + peakToTroughRange * (0.5 + 0.5 * cosine)

  const afternoonDistance = Math.abs(hourOfDay - AFTERNOON_DIP_HOUR)
  const afternoonDip = afternoonDistance < 2 ? AFTERNOON_DIP_DEPTH * (1 - afternoonDistance / 2) : 0

  return clamp01(baseEnergy - afternoonDip)
}

export function computeMoodBaseline(
  context: MoodContext,
  neuroModulation?: Partial<Record<keyof EmotionalState, number>>,
  hourOfDay?: number
): EmotionalState {
  const base = { ...DEFAULT_EMOTIONAL_STATE }

  const silenceRatio = Math.min(1, context.operatorSilenceMinutes / 60 / MOOD_BASELINE.SILENCE_HOURS_FULL_EFFECT)
  base.connection -= MOOD_BASELINE.SILENCE_CONNECTION_DROP * silenceRatio
  base.boredom += MOOD_BASELINE.SILENCE_BOREDOM_RISE * silenceRatio
  base.frustration += MOOD_BASELINE.SILENCE_FRUSTRATION_RISE * silenceRatio
  base.satisfaction -= MOOD_BASELINE.SILENCE_SATISFACTION_DROP * silenceRatio
  base.caution += MOOD_BASELINE.SILENCE_CAUTION_RISE * silenceRatio
  base.curiosity -= MOOD_BASELINE.SILENCE_CURIOSITY_DROP * silenceRatio

  if (context.inConversation) {
    base.connection += MOOD_BASELINE.CONVERSATION_CONNECTION_BOOST
    base.excitement += MOOD_BASELINE.CONVERSATION_EXCITEMENT_BOOST
    base.boredom -= MOOD_BASELINE.CONVERSATION_BOREDOM_DROP
    base.satisfaction += MOOD_BASELINE.CONVERSATION_SATISFACTION_BOOST
    base.curiosity += MOOD_BASELINE.CONVERSATION_CURIOSITY_BOOST
  }

  if (context.systemHealthy && context.budgetOk) {
    base.satisfaction += MOOD_BASELINE.HEALTHY_SATISFACTION_BOOST
  }

  if (context.hasActiveGoals) {
    base.curiosity += MOOD_BASELINE.GOALS_CURIOSITY_BOOST
    base.boredom -= MOOD_BASELINE.GOALS_BOREDOM_DROP
  }

  base.energy = context.isDreaming
    ? MOOD_BASELINE.DREAMING_ENERGY_TARGET
    : computeCircadianEnergy(hourOfDay ?? new Date().getHours())

  if (context.operatorMood !== "unknown" && context.inConversation) {
    const effects = MOOD_CONTAGION.EFFECTS[context.operatorMood]
    const connectionScale = Math.max(0, (context.connectionLevel - MOOD_CONTAGION.CONNECTION_SCALE) * 2)
    const avoidanceDamping = 1 - context.attachmentAvoidance * MOOD_CONTAGION.AVOIDANCE_DAMPING
    const strength = connectionScale * avoidanceDamping

    Object.entries(effects).forEach(([dimension, delta]) => {
      const key = dimension as keyof EmotionalState
      if (key in base) {
        base[key] += Math.max(-MOOD_CONTAGION.MAX_EFFECT, Math.min(MOOD_CONTAGION.MAX_EFFECT, delta * strength))
      }
    })
  }

  if (neuroModulation) {
    for (const [dim, shift] of Object.entries(neuroModulation)) {
      const key = dim as keyof EmotionalState
      if (key in base && shift) {
        base[key] += shift
      }
    }
  }

  return clampState(base)
}

/**
 * Apply time-based drift towards the dynamic baseline using dimension-specific half-lives.
 * Formula: newValue = baseline + (current - baseline) * 2^(-elapsed / halfLife)
 */
function applyDrift(state: EmotionalState, baseline: EmotionalState, elapsedMinutes: number): EmotionalState {
  const drifted = Object.fromEntries(
    (Object.keys(EMOTION.HALF_LIVES) as (keyof typeof EMOTION.HALF_LIVES)[]).map((dimension) => {
      const halfLife = EMOTION.HALF_LIVES[dimension]
      const decay = halfLifeDecay(elapsedMinutes, halfLife)
      return [dimension, baseline[dimension] + (state[dimension] - baseline[dimension]) * decay]
    })
  )
  return { ...state, ...drifted }
}

/**
 * Scale a trigger's base delta by time since last similar trigger (novelty).
 * First message after 48h → ~2.2x, after 5min → ~1.05x.
 */
function scaleByNovelty(baseDelta: number, minutesSinceLastSimilar: number): number {
  const hours = minutesSinceLastSimilar / 60
  const multiplier = Math.min(EMOTION.NOVELTY_MAX_MULTIPLIER, 1 + Math.log2(1 + hours) * EMOTION.NOVELTY_SCALE)
  return baseDelta * multiplier
}

/**
 * Apply a single emotion update event to the current state.
 */
export function applyEvent(
  state: EmotionalState,
  event: EmotionUpdateEvent,
  minutesSinceLastSimilar?: number
): EmotionalState {
  const effects = TRIGGER_EFFECTS[event.trigger]
  const deltas = Object.fromEntries(
    Object.entries(effects).map(([key, baseDelta]) => {
      let scaledDelta = baseDelta * event.intensity
      if (minutesSinceLastSimilar != null) {
        scaledDelta = scaleByNovelty(scaledDelta, minutesSinceLastSimilar)
      }
      const clampedDelta = Math.max(-EMOTION.MAX_DELTA, Math.min(EMOTION.MAX_DELTA, scaledDelta))
      const current = state[key as keyof EmotionalState] ?? 0
      const headroom = clampedDelta > 0 ? 1 - current : current
      return [key, current + clampedDelta * headroom]
    })
  )

  return clampState({ ...state, ...deltas })
}

interface CrossCouplingRule {
  when: (s: EmotionalState) => boolean
  target: keyof EmotionalState
  factor: number
}

const CROSS_COUPLING_RULES: CrossCouplingRule[] = [
  { when: (s) => s.boredom > 0.55, target: "satisfaction", factor: 0.998 },
  { when: (s) => s.frustration > 0.55, target: "satisfaction", factor: 0.998 },
  { when: (s) => s.frustration > 0.6, target: "confidence", factor: 0.999 },
  { when: (s) => s.connection > 0.55, target: "boredom", factor: 0.998 },
  { when: (s) => s.excitement > 0.55, target: "boredom", factor: 0.998 },
  { when: (s) => s.energy < 0.3, target: "excitement", factor: 0.999 },
  { when: (s) => s.confidence < 0.35, target: "satisfaction", factor: 0.999 },
  { when: (s) => s.confidence > 0.7, target: "caution", factor: 0.999 },
  { when: (s) => s.curiosity > 0.6 && s.energy > 0.5, target: "excitement", factor: 1.002 },
  { when: (s) => s.satisfaction > 0.6, target: "confidence", factor: 1.001 },
  { when: (s) => s.connection > 0.6 && s.excitement > 0.5, target: "satisfaction", factor: 1.002 },
  { when: (s) => s.energy > 0.6, target: "curiosity", factor: 1.001 },
  { when: (s) => s.excitement > 0.6 && s.curiosity > 0.5, target: "energy", factor: 0.9995 }
]

/**
 * Post-processing valence rules for emotional consistency.
 */
export function applyCrossCoupling(state: EmotionalState): EmotionalState {
  const result = CROSS_COUPLING_RULES.reduce(
    (acc, rule) => {
      if (rule.when(acc)) {
        if (rule.factor > 1) {
          const strength = rule.factor - 1
          const headroom = 1 - acc[rule.target]
          acc[rule.target] += strength * headroom
        } else {
          acc[rule.target] *= rule.factor
        }
      }
      return acc
    },
    { ...state }
  )
  return clampState(result)
}

type ShadowRule = { shadow: keyof EmotionalState }

const SHADOW_PAIRINGS: Record<string, ShadowRule[]> = {
  connection: [{ shadow: "caution" }],
  excitement: [{ shadow: "caution" }, { shadow: "frustration" }],
  satisfaction: [{ shadow: "boredom" }]
}

/**
 * Ensure high positive emotions carry shadow emotions for realism.
 * Real feelings are almost always mixed.
 */
export function applyContradictionBudget(state: EmotionalState): EmotionalState {
  const result = { ...state }
  const intensity = computeEmotionalIntensity(result)

  const positives: (keyof EmotionalState)[] = ["satisfaction", "connection", "excitement"]
  positives
    .filter((dimension) => result[dimension] >= CONTRADICTION.HIGH_EMOTION_THRESHOLD)
    .forEach((dimension) => {
      const rules = SHADOW_PAIRINGS[dimension]
      if (!rules || rules.length === 0) return

      const chosen = rules[Math.floor(Math.random() * rules.length)]
      if (!chosen) return

      const shadowMin =
        CONTRADICTION.MIN_SHADOW_EMOTION +
        Math.random() * (CONTRADICTION.MAX_SHADOW_EMOTION - CONTRADICTION.MIN_SHADOW_EMOTION)
      if (result[chosen.shadow] < shadowMin) {
        result[chosen.shadow] = shadowMin
      }
    })

  if (intensity > CONTRADICTION.HIGH_INTENSITY_THRESHOLD) {
    const negatives: (keyof EmotionalState)[] = ["frustration", "boredom", "caution"]
    const activeNegatives = negatives.filter((d) => result[d] > CONTRADICTION.MIN_SHADOW_EMOTION)
    if (activeNegatives.length < 2) {
      negatives
        .filter((d) => result[d] <= CONTRADICTION.MIN_SHADOW_EMOTION)
        .slice(0, 2 - activeNegatives.length)
        .forEach((dimension) => {
          result[dimension] =
            CONTRADICTION.MIN_SHADOW_EMOTION +
            Math.random() * (CONTRADICTION.MAX_SHADOW_EMOTION - CONTRADICTION.MIN_SHADOW_EMOTION)
        })
    }
  }

  return clampState(result)
}

/**
 * Compute emotional valence from -1 (negative) to 1 (positive).
 */
export function computeValence(emotion: EmotionalState): number {
  const positive = (emotion.satisfaction + emotion.connection + emotion.confidence + emotion.excitement) / 4
  const negative = (emotion.frustration + emotion.boredom + emotion.caution) / 3
  return Math.max(-1, Math.min(1, positive - negative))
}

export const INTENSITY_DIMENSIONS: (keyof EmotionalState)[] = [
  "curiosity",
  "satisfaction",
  "frustration",
  "boredom",
  "excitement",
  "caution",
  "connection",
  "confidence"
]

/**
 * Compute emotional intensity as max deviation from neutral (0.5) across emotional dimensions.
 * Excludes energy since it has a different baseline (0.8) and represents a resource, not an emotion.
 */
export function computeEmotionalIntensity(emotion: EmotionalState): number {
  return Math.max(...INTENSITY_DIMENSIONS.map((d) => Math.abs(emotion[d] - 0.5))) * 2
}

const MOOD_BASELINE_MAX_DEVIATION = 0.3
const MOOD_BASELINE_NEUTRAL = 0.5

function clampBaseline(value: number): number {
  return Math.max(
    MOOD_BASELINE_NEUTRAL - MOOD_BASELINE_MAX_DEVIATION,
    Math.min(MOOD_BASELINE_NEUTRAL + MOOD_BASELINE_MAX_DEVIATION, value)
  )
}

const MOOD_BASELINE_HALF_LIFE_MINUTES = 480

/**
 * Blend current emotion into the long-term mood baseline via half-life decay.
 * Uses the same exponential decay model as applyDrift for consistency.
 * The baseline slowly tracks the current emotion with a configurable half-life.
 * Each dimension is clamped to [0.2, 0.8] to prevent pathological baseline drift.
 */
export function blendMoodBaseline(
  current: EmotionalState,
  oldBaseline: EmotionalState,
  elapsedMinutes = 1.5
): EmotionalState {
  const retention = halfLifeDecay(elapsedMinutes, MOOD_BASELINE_HALF_LIFE_MINUTES)
  const alpha = 1 - retention

  const blended = Object.fromEntries(
    EMOTION_DIMENSIONS.map((dim) => [dim, clampBaseline(alpha * current[dim] + retention * oldBaseline[dim])])
  )

  return clampState(blended as EmotionalState)
}

/**
 * Summarize emotions that deviate significantly from neutral as "dim: value" pairs.
 */
export function summarizeEmotions(emotion: EmotionalState, threshold = 0.1): string {
  return Object.entries(emotion)
    .filter(([, v]) => Math.abs(v - 0.5) > threshold)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(", ")
}

/**
 * Apply gentle gravitational pull towards the DNA emotional baseline.
 * Stronger during idle (0.02) than during active interaction (0.005).
 */
export function applyBaselineGravity(
  state: EmotionalState,
  dnaBaseline: EmotionalState,
  isIdle: boolean
): EmotionalState {
  const strength = isIdle ? 0.02 : 0.005
  return clampState({
    curiosity: state.curiosity + (dnaBaseline.curiosity - state.curiosity) * strength,
    satisfaction: state.satisfaction + (dnaBaseline.satisfaction - state.satisfaction) * strength,
    frustration: state.frustration + (dnaBaseline.frustration - state.frustration) * strength,
    boredom: state.boredom + (dnaBaseline.boredom - state.boredom) * strength,
    excitement: state.excitement + (dnaBaseline.excitement - state.excitement) * strength,
    caution: state.caution + (dnaBaseline.caution - state.caution) * strength,
    connection: state.connection + (dnaBaseline.connection - state.connection) * strength,
    confidence: state.confidence + (dnaBaseline.confidence - state.confidence) * strength,
    energy: state.energy + (dnaBaseline.energy - state.energy) * strength
  })
}

/**
 * Apply trust-based modifiers to emotions.
 * High trust boosts connection and reduces caution; low trust does the opposite.
 */
export function applyTrustModifiers(state: EmotionalState, trustExperience: number): EmotionalState {
  const result = { ...state }

  if (trustExperience > 0.7) {
    const normTrust = (trustExperience - 0.7) / 0.3
    const connectionHeadroom = 1 - result.connection
    result.connection += connectionHeadroom * 0.2 * normTrust
    result.caution -= result.caution * 0.1 * normTrust
  } else if (trustExperience < 0.3) {
    const normDist = (0.3 - trustExperience) / 0.3
    const cautionHeadroom = 1 - result.caution
    result.caution += cautionHeadroom * 0.15 * normDist
    result.connection -= result.connection * 0.15 * normDist
  }

  return clampState(result)
}

export interface EmotionalUpdateOptions {
  dnaBaseline?: EmotionalState
  isIdle?: boolean
  trustExperience?: number
  appraisalContext: AppraisalContext
  soma?: SomaticState
  episodicContext?: EpisodicContext[]
  neuromodulatoryState?: NeuromodulatoryState
  hourOfDay?: number
}

export interface EmotionalUpdateResult {
  state: EmotionalState
  appraisals: AppraisalResult[]
  constructions: EmotionConstructionResult[]
}

/**
 * Compute a new emotional state using Constructed Emotion Theory (Barrett).
 * Emotions emerge from the intersection of somatic state, episodic memory,
 * appraisal evaluation, trigger priors, and neuromodulatory coloring.
 */
export function computeEmotionalUpdate(
  current: EmotionalState,
  events: EmotionUpdateEvent[],
  moodContext: MoodContext,
  elapsedMinutes: number,
  triggerTimestamps: Record<string, number>,
  options: EmotionalUpdateOptions
): EmotionalUpdateResult {
  const neuroBaselineModulation = options.neuromodulatoryState
    ? computeMoodBaselineModulation(options.neuromodulatoryState)
    : undefined
  const baseline = computeMoodBaseline(moodContext, neuroBaselineModulation, options.hourOfDay)
  let state = applyDrift(current, baseline, elapsedMinutes)

  if (options.dnaBaseline) {
    state = applyBaselineGravity(state, options.dnaBaseline, options.isIdle ?? false)
  }

  const constructionInput: ConstructedEmotionInput | undefined =
    options.soma && options.neuromodulatoryState
      ? {
          soma: options.soma,
          episodicContext: options.episodicContext ?? [],
          neuromodulation: options.neuromodulatoryState,
          triggerPriors: TRIGGER_EFFECTS
        }
      : undefined

  let appraisals: AppraisalResult[]
  let constructions: EmotionConstructionResult[]

  if (constructionInput) {
    const result = applyConstructedEvents(state, events, options.appraisalContext, constructionInput, triggerTimestamps)
    state = result.state
    appraisals = result.appraisals
    constructions = result.constructions
  } else {
    appraisals = []
    constructions = []
    for (const event of events) {
      const effects = TRIGGER_EFFECTS[event.trigger]
      state = applyEvent(state, event)
      void effects
    }
  }

  state = applyCrossCoupling(state)
  state = applyContradictionBudget(state)

  if (options.trustExperience !== undefined) {
    state = applyTrustModifiers(state, options.trustExperience)
  }

  return { state: clampState(state), appraisals, constructions }
}

const EMOTION_DIMENSIONS: (keyof EmotionalState)[] = [
  "curiosity",
  "satisfaction",
  "frustration",
  "boredom",
  "excitement",
  "caution",
  "connection",
  "confidence",
  "energy"
]

/**
 * Dampen emotions towards neutral (0.5) by a given factor.
 * Energy is excluded since it represents a resource, not an emotion.
 */
export function applyEmotionalDamping(emotion: EmotionalState, damping: number): EmotionalState {
  if (damping <= 0) return emotion
  const factor = 1 - damping
  return clampState({
    ...emotion,
    curiosity: 0.5 + (emotion.curiosity - 0.5) * factor,
    satisfaction: 0.5 + (emotion.satisfaction - 0.5) * factor,
    frustration: 0.5 + (emotion.frustration - 0.5) * factor,
    boredom: 0.5 + (emotion.boredom - 0.5) * factor,
    excitement: 0.5 + (emotion.excitement - 0.5) * factor,
    caution: 0.5 + (emotion.caution - 0.5) * factor,
    connection: 0.5 + (emotion.connection - 0.5) * factor,
    confidence: 0.5 + (emotion.confidence - 0.5) * factor,
    energy: emotion.energy
  })
}

/**
 * Apply momentum as a continuation force on top of computed emotions.
 * Computed values (including drift) are always preserved as the base —
 * momentum only adds a small inertial nudge in the direction of recent change,
 * scaled by event intensity.
 */
export function applyMomentum(
  computed: EmotionalState,
  previous: EmotionalState,
  eventIntensity: number,
  previousMomentum: EmotionalMomentum
): { state: EmotionalState; momentum: EmotionalMomentum } {
  const alpha = eventIntensity > MOMENTUM.INTENSITY_THRESHOLD ? MOMENTUM.ALPHA_INTENSE : MOMENTUM.ALPHA_BASE

  const { state, momentum } = EMOTION_DIMENSIONS.reduce(
    (acc, dimension) => {
      const continuationForce = previousMomentum[dimension] * MOMENTUM.INERTIA_WEIGHT
      const nudge = continuationForce * alpha
      const headroom = nudge > 0 ? 1 - computed[dimension] : computed[dimension]
      acc.state[dimension] = clamp01(computed[dimension] + nudge * headroom)
      acc.momentum[dimension] = Math.max(-1, Math.min(1, acc.state[dimension] - previous[dimension]))
      return acc
    },
    { state: { ...computed }, momentum: { ...DEFAULT_EMOTIONAL_MOMENTUM } }
  )

  return { state: clampState(state), momentum }
}

/**
 * Detect afterglow entries for dimensions with significant emotional shifts.
 */
export function detectAfterglow(current: EmotionalState, previous: EmotionalState): AfterglowEntry[] {
  return EMOTION_DIMENSIONS.filter(
    (dimension) => Math.abs(current[dimension] - previous[dimension]) > MOMENTUM.AFTERGLOW_THRESHOLD
  ).map((dimension) => ({
    dimension,
    delta: current[dimension] - previous[dimension],
    remainingTicks: MOMENTUM.AFTERGLOW_INITIAL_TICKS,
    intensity: Math.min(1, Math.abs(current[dimension] - previous[dimension]))
  }))
}

/**
 * Apply lingering afterglow effects to emotional state and decay entries.
 */
export function applyAfterglow(
  state: EmotionalState,
  entries: AfterglowEntry[]
): { state: EmotionalState; remainingEntries: AfterglowEntry[] } {
  const result = entries.reduce(
    (acc, entry) => {
      const dimension = entry.dimension as keyof EmotionalState
      if (dimension in acc) {
        const effectiveDelta = entry.delta * entry.intensity * 0.1
        const headroom = effectiveDelta > 0 ? 1 - acc[dimension] : acc[dimension]
        acc[dimension] = clamp01(acc[dimension] + effectiveDelta * headroom)
      }
      return acc
    },
    { ...state }
  )

  const remainingEntries = entries
    .map((entry) => ({
      ...entry,
      intensity: entry.intensity * MOMENTUM.AFTERGLOW_DECAY_RATE,
      remainingTicks: entry.remainingTicks - 1
    }))
    .filter((entry) => entry.remainingTicks > 0)

  return { state: clampState(result), remainingEntries }
}
