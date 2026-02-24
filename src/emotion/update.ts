import { EMOTION } from "@/config/constants.ts"
import type { EmotionalState, EmotionTrigger, EmotionUpdateEvent } from "@/emotion/types.ts"
import { clamp01 } from "@/lib/math.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"

type EmotionDeltas = Partial<Record<keyof EmotionalState, number>>

const TRIGGER_EFFECTS: Record<EmotionTrigger, EmotionDeltas> = {
  message_received: { connection: 0.1, boredom: -0.1, excitement: 0.05 },
  message_sent: { satisfaction: 0.03, connection: 0.02 },
  task_success: { satisfaction: 0.1, frustration: -0.05 },
  task_failure: { frustration: 0.1, caution: 0.05 },
  idle_tick: { boredom: 0.02, curiosity: 0.01 },
  guardian_warning: { caution: 0.1, frustration: 0.05 },
  guardian_block: { caution: 0.15, frustration: 0.1 },
  operator_silence: { connection: -0.03, boredom: 0.02 },
  new_goal: { excitement: 0.1, curiosity: 0.05 },
  goal_completed: { satisfaction: 0.15, excitement: 0.05 },
  goal_failed: { frustration: 0.1, satisfaction: -0.1 },
  perception_positive: { satisfaction: 0.05, excitement: 0.03 },
  perception_negative: { caution: 0.05, frustration: 0.03 },
  tick_start: {},
  email_received: { curiosity: 0.08, excitement: 0.05, boredom: -0.05 },
  email_sent: { satisfaction: 0.03 },
  weather_update: { curiosity: 0.03, excitement: 0.04, boredom: -0.03 },
  git_activity: { curiosity: 0.05, excitement: 0.03 }
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
    connection: clamp01(state.connection)
  }
}

/**
 * Apply natural decay towards the baseline emotional state.
 */
export function applyDecay(state: EmotionalState): EmotionalState {
  const baseline = getEmotionBaseline()
  return {
    curiosity: state.curiosity + (baseline.curiosity - state.curiosity) * EMOTION.DECAY_RATE,
    satisfaction: state.satisfaction + (baseline.satisfaction - state.satisfaction) * EMOTION.DECAY_RATE,
    frustration: state.frustration + (baseline.frustration - state.frustration) * EMOTION.DECAY_RATE,
    boredom: state.boredom + (baseline.boredom - state.boredom) * EMOTION.DECAY_RATE,
    excitement: state.excitement + (baseline.excitement - state.excitement) * EMOTION.DECAY_RATE,
    caution: state.caution + (baseline.caution - state.caution) * EMOTION.DECAY_RATE,
    connection: state.connection + (baseline.connection - state.connection) * EMOTION.DECAY_RATE
  }
}

/**
 * Apply a single emotion update event to the current state.
 */
export function applyEvent(state: EmotionalState, event: EmotionUpdateEvent): EmotionalState {
  const effects = TRIGGER_EFFECTS[event.trigger]
  const result = { ...state }

  for (const [key, baseDelta] of Object.entries(effects)) {
    const dimension = key as keyof EmotionalState
    const scaledDelta = baseDelta * event.intensity
    const clampedDelta = Math.max(-EMOTION.MAX_DELTA, Math.min(EMOTION.MAX_DELTA, scaledDelta))
    result[dimension] = result[dimension] + clampedDelta
  }

  return clampState(result)
}

/**
 * Compute a new emotional state from the current state and a list of events.
 * Applies decay first, then each event in order.
 */
export function computeEmotionalUpdate(current: EmotionalState, events: EmotionUpdateEvent[]): EmotionalState {
  let state = applyDecay(current)

  for (const event of events) {
    state = applyEvent(state, event)
  }

  return state
}
