import { CONTRADICTION, EMOTION, MOOD_BASELINE } from "@/config/constants.ts"
import {
  DEFAULT_EMOTIONAL_STATE,
  type EmotionalState,
  type EmotionTrigger,
  type EmotionUpdateEvent,
  type MoodContext
} from "@/emotion/types.ts"
import { clamp01 } from "@/lib/math.ts"

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

  return clampState(base)
}

/**
 * Apply time-based drift towards the dynamic baseline using dimension-specific half-lives.
 * Formula: newValue = baseline + (current - baseline) * 2^(-elapsed / halfLife)
 */
export function applyDrift(state: EmotionalState, baseline: EmotionalState, elapsedMinutes: number): EmotionalState {
  const result = { ...state }
  for (const dimension of Object.keys(EMOTION.HALF_LIVES) as (keyof typeof EMOTION.HALF_LIVES)[]) {
    const halfLife = EMOTION.HALF_LIVES[dimension]
    const decay = 2 ** (-elapsedMinutes / halfLife)
    result[dimension] = baseline[dimension] + (state[dimension] - baseline[dimension]) * decay
  }
  return result
}

/**
 * Scale a trigger's base delta by time since last similar trigger (novelty).
 * First message after 48h → ~2.2x, after 5min → ~1.05x.
 */
export function scaleByNovelty(baseDelta: number, minutesSinceLastSimilar: number): number {
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
  const result = { ...state }

  for (const [key, baseDelta] of Object.entries(effects)) {
    const dimension = key as keyof EmotionalState
    let scaledDelta = baseDelta * event.intensity
    if (minutesSinceLastSimilar != null) {
      scaledDelta = scaleByNovelty(scaledDelta, minutesSinceLastSimilar)
    }
    const clampedDelta = Math.max(-EMOTION.MAX_DELTA, Math.min(EMOTION.MAX_DELTA, scaledDelta))
    result[dimension] = result[dimension] + clampedDelta
  }

  return clampState(result)
}

/**
 * Post-processing valence rules for emotional consistency.
 */
export function applyCrossCoupling(state: EmotionalState): EmotionalState {
  const result = { ...state }

  if (result.boredom > 0.7) {
    result.satisfaction *= 0.85
  }
  if (result.frustration > 0.7) {
    result.satisfaction *= 0.85
    result.confidence *= 0.9
  }
  if (result.connection > 0.7) {
    result.boredom *= 0.85
  }
  if (result.excitement > 0.7) {
    result.boredom *= 0.85
  }
  if (result.energy < 0.3) {
    result.excitement *= 0.85
  }
  if (result.confidence < 0.3) {
    result.satisfaction *= 0.85
  }
  if (result.confidence > 0.8) {
    result.caution *= 0.9
  }

  if (result.curiosity > 0.7 && result.energy > 0.6) {
    result.excitement *= 1.15
  }
  if (result.satisfaction > 0.7) {
    result.confidence *= 1.1
  }
  if (result.connection > 0.7 && result.excitement > 0.6) {
    result.satisfaction *= 1.15
  }
  if (result.energy > 0.7) {
    result.curiosity *= 1.1
  }

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
  for (const dimension of positives) {
    if (result[dimension] < CONTRADICTION.HIGH_EMOTION_THRESHOLD) continue
    const rules = SHADOW_PAIRINGS[dimension]
    if (!rules || rules.length === 0) continue

    const chosen = rules[Math.floor(Math.random() * rules.length)]
    if (!chosen) continue

    const shadowMin =
      CONTRADICTION.MIN_SHADOW_EMOTION +
      Math.random() * (CONTRADICTION.MAX_SHADOW_EMOTION - CONTRADICTION.MIN_SHADOW_EMOTION)
    if (result[chosen.shadow] < shadowMin) {
      result[chosen.shadow] = shadowMin
    }
  }

  if (intensity > CONTRADICTION.HIGH_INTENSITY_THRESHOLD) {
    const negatives: (keyof EmotionalState)[] = ["frustration", "boredom", "caution"]
    const activeNegatives = negatives.filter((d) => result[d] > CONTRADICTION.MIN_SHADOW_EMOTION)
    if (activeNegatives.length < 2) {
      const inactive = negatives.filter((d) => result[d] <= CONTRADICTION.MIN_SHADOW_EMOTION)
      const toActivate = inactive.slice(0, 2 - activeNegatives.length)
      for (const dimension of toActivate) {
        result[dimension] =
          CONTRADICTION.MIN_SHADOW_EMOTION +
          Math.random() * (CONTRADICTION.MAX_SHADOW_EMOTION - CONTRADICTION.MIN_SHADOW_EMOTION)
      }
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

/**
 * Compute emotional intensity as max deviation from neutral (0.5) across all dimensions.
 */
export function computeEmotionalIntensity(emotion: EmotionalState): number {
  return Math.max(...Object.values(emotion).map((v) => Math.abs(v - 0.5))) * 2
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
 * Compute per-dimension deltas between two emotional states, filtered by threshold.
 */
export function computeEmotionDeltas(current: EmotionalState, previous: EmotionalState, threshold = 0.03): string {
  const changes = (Object.keys(current) as (keyof EmotionalState)[])
    .map((dimension) => ({ dimension, diff: current[dimension] - previous[dimension] }))
    .filter(({ diff }) => Math.abs(diff) > threshold)
    .map(({ dimension, diff }) => `${dimension} ${diff > 0 ? "+" : ""}${diff.toFixed(2)}`)

  return changes.length > 0 ? changes.join(", ") : "stable"
}

/**
 * Compute a new emotional state from current state, events, context, and timing.
 * 1. Compute dynamic mood baseline from context
 * 2. Apply time-based drift towards baseline
 * 3. Apply each event with novelty scaling
 * 4. Apply cross-coupling consistency rules
 * 5. Clamp to [0,1]
 */
export function computeEmotionalUpdate(
  current: EmotionalState,
  events: EmotionUpdateEvent[],
  moodContext?: MoodContext,
  elapsedMinutes?: number,
  triggerTimestamps?: Record<string, number>
): EmotionalState {
  const context = moodContext ?? {
    operatorSilenceMinutes: 0,
    inConversation: false,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: false,
    isDreaming: false
  }
  const elapsed = elapsedMinutes ?? 1

  const baseline = computeMoodBaseline(context)
  let state = applyDrift(current, baseline, elapsed)

  for (const event of events) {
    const lastSimilar = triggerTimestamps?.[event.trigger]
    state = applyEvent(state, event, lastSimilar)
  }

  state = applyCrossCoupling(state)
  state = applyContradictionBudget(state)

  return clampState(state)
}
