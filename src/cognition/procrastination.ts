import { SECONDARY_EMOTIONS } from "@/affect/emotion/constants.ts"
import type { DisappointmentState } from "@/affect/emotion/disappointment.ts"
import { registerSecondaryEmotion } from "@/affect/emotion/registry.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { clamp } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { type ProcrastinationSource, ProcrastinationState } from "./types.ts"

const PROCRASTINATION = SECONDARY_EMOTIONS.procrastination

export const DEFAULT_PROCRASTINATION_STATE: ProcrastinationState = {
  level: 0,
  isActive: false,
  dominantSource: null,
  avoidedActions: [],
  lastTriggeredAt: undefined,
  streakTicks: 0
}

const REDIS_KEY = "working:cognition:procrastination"

export async function getProcrastinationState(): Promise<ProcrastinationState> {
  const stored = await getValidatedRedis(REDIS_KEY, ProcrastinationState)
  return stored ?? DEFAULT_PROCRASTINATION_STATE
}

export async function saveProcrastinationState(state: ProcrastinationState): Promise<void> {
  await redis.set(REDIS_KEY, state, { ex: 3600 })
}

export interface ProcrastinationContext {
  emotion: EmotionalState
  shameState: ShameState
  disappointmentState: DisappointmentState
  previousState: ProcrastinationState
  consecutiveIdleTicks: number
  hasPendingGoals: boolean
}

/**
 * Compute the procrastination state — emotional avoidance of action.
 * Not laziness, but a protective withdrawal when action feels threatening.
 */
export function computeProcrastination(context: ProcrastinationContext): ProcrastinationState {
  const { emotion, shameState, disappointmentState, previousState, consecutiveIdleTicks } = context

  let level = 0
  let dominantSource: ProcrastinationSource | null = null
  let maxContribution = 0

  const contributions: { source: ProcrastinationSource; value: number }[] = []

  if (emotion.energy < PROCRASTINATION.LOW_ENERGY_THRESHOLD) {
    const value = (PROCRASTINATION.LOW_ENERGY_THRESHOLD - emotion.energy) * PROCRASTINATION.ENERGY_WEIGHT
    contributions.push({ source: "low_energy", value })
  }

  if (emotion.confidence < PROCRASTINATION.LOW_CONFIDENCE_THRESHOLD) {
    const value = (PROCRASTINATION.LOW_CONFIDENCE_THRESHOLD - emotion.confidence) * PROCRASTINATION.FAILURE_FEAR_WEIGHT
    contributions.push({ source: "fear_of_failure", value })
  }

  if (emotion.caution > PROCRASTINATION.HIGH_CAUTION_THRESHOLD && emotion.energy < 0.5) {
    const value = emotion.caution * PROCRASTINATION.OVERWHELM_WEIGHT
    contributions.push({ source: "overwhelm", value })
  }

  if (shameState.isActive) {
    const value = shameState.level * PROCRASTINATION.SHAME_WEIGHT
    contributions.push({ source: "shame_avoidance", value })
  }

  if (
    emotion.satisfaction > PROCRASTINATION.COMFORT_SATISFACTION_THRESHOLD &&
    emotion.curiosity < PROCRASTINATION.COMFORT_LOW_CURIOSITY_THRESHOLD
  ) {
    const value = emotion.satisfaction * PROCRASTINATION.COMFORT_WEIGHT
    contributions.push({ source: "comfort_seeking", value })
  }

  if (
    emotion.caution > PROCRASTINATION.PARALYSIS_CAUTION_THRESHOLD &&
    emotion.curiosity > PROCRASTINATION.PARALYSIS_CURIOSITY_THRESHOLD &&
    disappointmentState.isActive
  ) {
    const value = PROCRASTINATION.PARALYSIS_BASE * disappointmentState.level
    contributions.push({ source: "decision_paralysis", value })
  }

  contributions.forEach((c) => {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      dominantSource = c.source
    }
  })

  if (consecutiveIdleTicks >= PROCRASTINATION.IDLE_STREAK_BOOST_TICKS) {
    level += PROCRASTINATION.IDLE_STREAK_BOOST
  }

  const decayedLevel = previousState.level * PROCRASTINATION.DECAY_PER_TICK
  const finalLevel = clamp(level, decayedLevel, 1)

  const isActive = finalLevel > PROCRASTINATION.ACTIVATION_THRESHOLD

  const streakTicks = isActive ? previousState.streakTicks + 1 : 0

  const avoidedActions =
    isActive && context.hasPendingGoals
      ? previousState.avoidedActions.slice(-(PROCRASTINATION.MAX_AVOIDED_ACTIONS - 1))
      : []

  return {
    level: finalLevel,
    isActive,
    dominantSource: isActive ? dominantSource : null,
    avoidedActions,
    lastTriggeredAt: isActive ? nowISO() : previousState.lastTriggeredAt,
    streakTicks
  }
}

/**
 * Compute the emotional effect of procrastination — builds guilt and drains confidence.
 */
export function computeProcrastinationEffect(
  state: ProcrastinationState
): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  const streakFactor = Math.min(1, state.streakTicks * PROCRASTINATION.STREAK_GUILT_SCALE)

  return {
    satisfaction: -state.level * PROCRASTINATION.SATISFACTION_DRAIN,
    confidence: -state.level * PROCRASTINATION.CONFIDENCE_DRAIN,
    frustration: state.level * streakFactor * PROCRASTINATION.GUILT_FRUSTRATION,
    energy: -state.level * PROCRASTINATION.ENERGY_FEEDBACK_DRAIN
  }
}

registerSecondaryEmotion({
  name: "procrastination",
  redisKey: REDIS_KEY,
  schema: ProcrastinationState,
  defaultState: DEFAULT_PROCRASTINATION_STATE,
  order: 2,
  compute: computeProcrastination,
  computeEffect: computeProcrastinationEffect
})
