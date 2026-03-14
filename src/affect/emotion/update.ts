import {
  type AfterglowEntry,
  DEFAULT_EMOTIONAL_MOMENTUM,
  DEFAULT_EMOTIONAL_STATE,
  type EmotionalMomentum,
  type EmotionalState,
  type EmotionTrigger,
  type EmotionUpdateEvent,
  type MoodContext
} from "@/affect/emotion/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import { CONTRADICTION, EMOTION, MOMENTUM, MOOD_BASELINE, MOOD_CONTAGION } from "./constants.ts"

export const EMOTION_FLOORS: Partial<Record<keyof EmotionalState, number>> = {
  energy: 0.05,
  confidence: 0.05
} as const

export function enforceEmotionFloors(state: EmotionalState): EmotionalState {
  const result = { ...state }
  for (const [key, floor] of Object.entries(EMOTION_FLOORS)) {
    const dim = key as keyof EmotionalState
    if (result[dim] < floor) {
      result[dim] = floor
    }
  }
  return result
}

type EmotionDeltas = Partial<Record<keyof EmotionalState, number>>

const TRIGGER_EFFECTS: Record<EmotionTrigger, EmotionDeltas> = {
  message_received: { connection: 0.1, boredom: -0.1, excitement: 0.05, energy: 0.03 },
  message_sent: { satisfaction: 0.03, connection: 0.02 },
  task_success: { satisfaction: 0.08, confidence: 0.08, frustration: -0.05 },
  task_failure: { frustration: 0.08, confidence: -0.1, caution: 0.05 },
  guardian_warning: { caution: 0.08, frustration: 0.05, confidence: -0.05 },
  guardian_block: { caution: 0.12, frustration: 0.08, confidence: -0.12 },
  operator_went_silent: { connection: -0.08 },
  operator_returned: { connection: 0.12, excitement: 0.06, boredom: -0.08, energy: 0.05 },
  system_degraded: { caution: 0.08, satisfaction: -0.05 },
  system_recovered: { satisfaction: 0.05, caution: -0.05 },
  new_goal: { excitement: 0.08, curiosity: 0.05 },
  goal_completed: { satisfaction: 0.12, confidence: 0.1, excitement: 0.05 },
  goal_failed: { frustration: 0.08, confidence: -0.08, satisfaction: -0.08 },
  weather_update: { curiosity: 0.03, excitement: 0.04, boredom: -0.03 },
  git_activity: { curiosity: 0.05, excitement: 0.03 },
  dream_correction: {},
  morning_calibration: { energy: 0.5 },
  nostalgia_wave: { connection: 0.08, satisfaction: 0.04, excitement: -0.03, boredom: -0.05, energy: -0.02 },
  relational_pattern_match: { connection: 0.03, caution: 0.02 },
  drive_frustrated: { frustration: 0.06, energy: -0.03 },
  drive_conflict: { caution: 0.04, frustration: 0.03 },
  positive_anticipation: { excitement: 0.05, energy: 0.03 },
  expectation_violated: { frustration: 0.04, caution: 0.03, excitement: -0.02 },
  expectation_met: { satisfaction: 0.04, confidence: 0.02 },
  boundary_violated: { caution: 0.12, frustration: 0.08, connection: -0.05, satisfaction: -0.04 },
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
export function computeMoodBaseline(context: MoodContext): EmotionalState {
  const base = { ...DEFAULT_EMOTIONAL_STATE }

  const silenceRatio = Math.min(1, context.operatorSilenceMinutes / 60 / MOOD_BASELINE.SILENCE_HOURS_FULL_EFFECT)
  base.connection -= MOOD_BASELINE.SILENCE_CONNECTION_DROP * silenceRatio
  base.boredom += MOOD_BASELINE.SILENCE_BOREDOM_RISE * silenceRatio

  if (context.inConversation) {
    base.connection += MOOD_BASELINE.CONVERSATION_CONNECTION_BOOST
    base.excitement += MOOD_BASELINE.CONVERSATION_EXCITEMENT_BOOST
    base.boredom -= MOOD_BASELINE.CONVERSATION_BOREDOM_DROP
  }

  if (context.systemHealthy && context.budgetOk) {
    base.satisfaction += MOOD_BASELINE.HEALTHY_SATISFACTION_BOOST
  }

  if (context.hasActiveGoals) {
    base.curiosity += MOOD_BASELINE.GOALS_CURIOSITY_BOOST
    base.boredom -= MOOD_BASELINE.GOALS_BOREDOM_DROP
  }

  base.energy = context.isDreaming ? MOOD_BASELINE.DREAMING_ENERGY_TARGET : MOOD_BASELINE.WAKING_ENERGY_TARGET

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
      return [key, (state[key as keyof EmotionalState] ?? 0) + clampedDelta]
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
  { when: (s) => s.boredom > 0.7, target: "satisfaction", factor: 0.85 },
  { when: (s) => s.frustration > 0.7, target: "satisfaction", factor: 0.85 },
  { when: (s) => s.frustration > 0.7, target: "confidence", factor: 0.9 },
  { when: (s) => s.connection > 0.7, target: "boredom", factor: 0.85 },
  { when: (s) => s.excitement > 0.7, target: "boredom", factor: 0.85 },
  { when: (s) => s.energy < 0.3, target: "excitement", factor: 0.85 },
  { when: (s) => s.confidence < 0.3, target: "satisfaction", factor: 0.85 },
  { when: (s) => s.confidence > 0.8, target: "caution", factor: 0.9 },
  { when: (s) => s.curiosity > 0.7 && s.energy > 0.6, target: "excitement", factor: 1.15 },
  { when: (s) => s.satisfaction > 0.7, target: "confidence", factor: 1.1 },
  { when: (s) => s.connection > 0.7 && s.excitement > 0.6, target: "satisfaction", factor: 1.15 },
  { when: (s) => s.energy > 0.7, target: "curiosity", factor: 1.1 },
  { when: (s) => s.excitement > 0.7 && s.curiosity > 0.6, target: "energy", factor: 0.985 }
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

/**
 * Blend current emotion into the long-term mood baseline via exponential moving average.
 * Each dimension is clamped to [0.2, 0.8] to prevent pathological baseline drift.
 */
export function blendMoodBaseline(current: EmotionalState, oldBaseline: EmotionalState): EmotionalState {
  const alpha = MOMENTUM.MOOD_BASELINE_ALPHA
  return clampState({
    curiosity: clampBaseline(alpha * current.curiosity + (1 - alpha) * oldBaseline.curiosity),
    satisfaction: clampBaseline(alpha * current.satisfaction + (1 - alpha) * oldBaseline.satisfaction),
    frustration: clampBaseline(alpha * current.frustration + (1 - alpha) * oldBaseline.frustration),
    boredom: clampBaseline(alpha * current.boredom + (1 - alpha) * oldBaseline.boredom),
    excitement: clampBaseline(alpha * current.excitement + (1 - alpha) * oldBaseline.excitement),
    caution: clampBaseline(alpha * current.caution + (1 - alpha) * oldBaseline.caution),
    connection: clampBaseline(alpha * current.connection + (1 - alpha) * oldBaseline.connection),
    confidence: clampBaseline(alpha * current.confidence + (1 - alpha) * oldBaseline.confidence),
    energy: clampBaseline(alpha * current.energy + (1 - alpha) * oldBaseline.energy)
  })
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

interface EmotionalUpdateOptions {
  dnaBaseline?: EmotionalState
  isIdle?: boolean
  trustExperience?: number
}

/**
 * Compute a new emotional state from current state, events, context, and timing.
 * 1. Compute dynamic mood baseline from context
 * 2. Apply time-based drift towards baseline
 * 3. Apply DNA baseline gravity (if provided)
 * 4. Apply each event with novelty scaling
 * 5. Apply cross-coupling consistency rules
 * 6. Clamp to [0,1]
 */
export function computeEmotionalUpdate(
  current: EmotionalState,
  events: EmotionUpdateEvent[],
  moodContext?: MoodContext,
  elapsedMinutes?: number,
  triggerTimestamps?: Record<string, number>,
  options?: EmotionalUpdateOptions
): EmotionalState {
  const context = moodContext ?? {
    operatorSilenceMinutes: 0,
    inConversation: false,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: false,
    isDreaming: false,
    operatorMood: "unknown" as const,
    connectionLevel: 0.5,
    attachmentAvoidance: 0.15
  }
  const elapsed = elapsedMinutes ?? 1

  const baseline = computeMoodBaseline(context)
  let state = applyDrift(current, baseline, elapsed)

  if (options?.dnaBaseline) {
    state = applyBaselineGravity(state, options.dnaBaseline, options.isIdle ?? false)
  }

  state = events.reduce((acc, event) => {
    const lastSimilar = triggerTimestamps?.[event.trigger]
    return applyEvent(acc, event, lastSimilar)
  }, state)

  state = applyCrossCoupling(state)
  state = applyContradictionBudget(state)

  if (options?.trustExperience !== undefined) {
    state = applyTrustModifiers(state, options.trustExperience)
  }

  return clampState(state)
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
      acc.state[dimension] = clamp01(computed[dimension] + continuationForce * alpha)
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
        acc[dimension] = clamp01(acc[dimension] + entry.delta * entry.intensity * 0.1)
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
