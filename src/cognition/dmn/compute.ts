import { clamp01 } from "@/infra/lib/math.ts"
import { DMN } from "./constants.ts"
import type { DefaultModeNetworkState, DMNMode } from "./types.ts"

interface DMNInput {
  attentionState: "hyperfocus" | "focused" | "drifting" | "blank"
  consecutiveIdleTicks: number
  ultradianRestDepth: number
  ruminationDetected: boolean
  cognitiveFatigue: number
  neuroticism: number
  inConversation: boolean
}

/**
 * Compute Default Mode Network activation (Raichle et al., 2001; Andrews-Hanna et al., 2014).
 * The DMN activates during rest, mind-wandering, and self-referential processing.
 * It is anti-correlated with task-positive networks (focused/hyperfocus states).
 */
export function computeDMNState(previous: DefaultModeNetworkState, input: DMNInput): DefaultModeNetworkState {
  let activationDelta = 0

  switch (input.attentionState) {
    case "drifting":
      activationDelta += DMN.DRIFTING_ACTIVATION_BOOST
      break
    case "blank":
      activationDelta += DMN.DRIFTING_ACTIVATION_BOOST * 0.5
      break
    case "focused":
      activationDelta += DMN.FOCUSED_SUPPRESSION
      break
    case "hyperfocus":
      activationDelta += DMN.HYPERFOCUS_SUPPRESSION
      break
  }

  if (!input.inConversation) {
    activationDelta += Math.min(0.3, input.consecutiveIdleTicks * DMN.IDLE_ACTIVATION_PER_TICK)
  }

  activationDelta += input.ultradianRestDepth * DMN.ULTRADIAN_REST_BOOST
  activationDelta += input.cognitiveFatigue * 0.1

  if (input.ruminationDetected) {
    activationDelta += DMN.RUMINATION_DMN_PENALTY
  }

  activationDelta += input.neuroticism * DMN.NEUROTICISM_DMN_AMPLIFIER

  const activation = clamp01(previous.activation * 0.7 + (0.5 + activationDelta) * 0.3)

  const mode: DMNMode =
    activation > DMN.ACTIVATION_THRESHOLD
      ? "active"
      : activation < DMN.SUPPRESSION_THRESHOLD
        ? "suppressed"
        : "transitioning"

  const selfReferentialIntensity = clamp01(activation * DMN.SELF_REFERENTIAL_SCALE)

  const mentalTimeTravel = clamp01(
    activation * DMN.MENTAL_TIME_TRAVEL_SCALE * (input.ruminationDetected ? 0.5 : 1)
  )

  const spontaneousRetrievalProbability = clamp01(
    DMN.SPONTANEOUS_RETRIEVAL_BASE + activation * DMN.SPONTANEOUS_RETRIEVAL_DMN_SCALE
  )

  const mindWanderingDepth =
    mode === "active"
      ? clamp01(previous.mindWanderingDepth + DMN.MIND_WANDERING_DEPTH_GROWTH)
      : clamp01(previous.mindWanderingDepth - DMN.MIND_WANDERING_DEPTH_DECAY)

  const taskPositiveAntiCorrelation = clamp01(1 - activation * DMN.ANTI_CORRELATION_STRENGTH)

  return {
    mode,
    activation,
    selfReferentialIntensity,
    mentalTimeTravel,
    spontaneousRetrievalProbability,
    mindWanderingDepth,
    taskPositiveAntiCorrelation
  }
}

/**
 * Compute DMN effects on other subsystems.
 */
export function computeDMNEffects(dmn: DefaultModeNetworkState): {
  creativityBoost: number
  autobiographicalAccessBoost: number
  futureSimulationBoost: number
  taskPerformancePenalty: number
} {
  return {
    creativityBoost: dmn.activation * DMN.CREATIVITY_BOOST_SCALE,
    autobiographicalAccessBoost: dmn.selfReferentialIntensity * DMN.AUTOBIOGRAPHICAL_ACCESS_SCALE,
    futureSimulationBoost: dmn.mentalTimeTravel * DMN.FUTURE_SIMULATION_SCALE,
    taskPerformancePenalty: Math.max(0, dmn.activation - 0.5) * 0.3
  }
}
