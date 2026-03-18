import { differenceInMinutes, parseISO } from "date-fns"
import { ULTRADIAN } from "./constants.ts"
import type { BRACPhase, UltradianModulation, UltradianState } from "./types.ts"
import { NEUTRAL_MODULATION } from "./types.ts"

export function computeCyclePosition(cycleStartedAt: string, now: Date, varianceSeed: number): number {
  const elapsed = differenceInMinutes(now, parseISO(cycleStartedAt))
  const variance = (varianceSeed - 0.5) * 2 * ULTRADIAN.NATURAL_VARIANCE_MINUTES
  const effectiveDuration = ULTRADIAN.CYCLE_DURATION_MINUTES + variance
  if (effectiveDuration <= 0) return 1
  return Math.min(1, Math.max(0, elapsed / effectiveDuration))
}

export function determineBRACPhase(position: number): BRACPhase {
  if (position < ULTRADIAN.ACTIVE_END) return "active"
  if (position < ULTRADIAN.TRANSITION_DOWN_END) return "transitioning_down"
  if (position < ULTRADIAN.REST_END) return "rest"
  return "transitioning_up"
}

export function computeRestDepth(position: number, phase: BRACPhase): number {
  if (phase !== "rest") return 0
  const restStart = ULTRADIAN.TRANSITION_DOWN_END
  const restEnd = ULTRADIAN.REST_END
  const restProgress = (position - restStart) / (restEnd - restStart)
  return Math.sin(restProgress * Math.PI)
}

export function computeUltradianModulation(phase: BRACPhase, restDepth: number): UltradianModulation {
  switch (phase) {
    case "active":
      return {
        attentionModifier: ULTRADIAN.ACTIVE_ATTENTION_BOOST,
        energyModifier: ULTRADIAN.ACTIVE_ENERGY_BOOST,
        creativityBoost: 0,
        mindWanderingProbability: 0,
        emotionBaselineShift: {}
      }

    case "rest":
      return {
        attentionModifier: ULTRADIAN.REST_ATTENTION_DIP * restDepth,
        energyModifier: ULTRADIAN.REST_ENERGY_DIP * restDepth,
        creativityBoost: ULTRADIAN.REST_CREATIVITY_BOOST * restDepth,
        mindWanderingProbability: ULTRADIAN.REST_MIND_WANDERING * restDepth,
        emotionBaselineShift: Object.fromEntries(
          Object.entries(ULTRADIAN.EMOTION_REST_SHIFTS).map(([k, v]) => [k, v * restDepth])
        )
      }

    case "transitioning_down":
      return {
        attentionModifier: ULTRADIAN.REST_ATTENTION_DIP * 0.3,
        energyModifier: ULTRADIAN.REST_ENERGY_DIP * 0.3,
        creativityBoost: ULTRADIAN.REST_CREATIVITY_BOOST * 0.2,
        mindWanderingProbability: ULTRADIAN.REST_MIND_WANDERING * 0.2,
        emotionBaselineShift: {}
      }

    case "transitioning_up":
      return {
        attentionModifier: ULTRADIAN.ACTIVE_ATTENTION_BOOST * 0.5,
        energyModifier: ULTRADIAN.ACTIVE_ENERGY_BOOST * 0.5,
        creativityBoost: ULTRADIAN.REST_CREATIVITY_BOOST * 0.1,
        mindWanderingProbability: ULTRADIAN.REST_MIND_WANDERING * 0.1,
        emotionBaselineShift: {}
      }

    default:
      return NEUTRAL_MODULATION
  }
}

export function updateUltradianState(previous: UltradianState, now: Date): UltradianState {
  const varianceSeed = seededRandom(previous.cycleCount)
  const position = computeCyclePosition(previous.cycleStartedAt, now, varianceSeed)

  if (position >= 1) {
    const newCycleCount = previous.cycleCount + 1
    return {
      phase: "active",
      cyclePosition: 0,
      cycleStartedAt: now.toISOString(),
      cycleCount: newCycleCount,
      restDepth: 0
    }
  }

  const phase = determineBRACPhase(position)
  const restDepth = computeRestDepth(position, phase)

  return {
    ...previous,
    phase,
    cyclePosition: position,
    restDepth
  }
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}
