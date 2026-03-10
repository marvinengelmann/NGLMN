import { SECONDARY_EMOTIONS } from "@/affect/emotion/constants.ts"
import { registerSecondaryEmotion } from "@/affect/emotion/registry.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { ExpectationViolation } from "@/perception/anticipation/types.ts"
import { computeSurprise } from "./compute.ts"
import { DEFAULT_SURPRISE_STATE, SurpriseState } from "./types.ts"

const SURPRISE = SECONDARY_EMOTIONS.surprise

interface SurpriseContext {
  emotion: EmotionalState
  previousState: SurpriseState
  noveltyLevel: number
  anticipatoryViolations: ExpectationViolation[]
}

function computeSurpriseFromContext(context: SurpriseContext): SurpriseState {
  return computeSurprise(context.anticipatoryViolations ?? [], context.noveltyLevel ?? 0, context.previousState)
}

function computeSurpriseEffect(state: SurpriseState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    excitement: state.level * SURPRISE.EXCITEMENT_BOOST,
    curiosity: state.level * SURPRISE.CURIOSITY_BOOST,
    boredom: -state.level * SURPRISE.BOREDOM_REDUCTION
  }
}

registerSecondaryEmotion({
  name: "surprise",
  redisKey: "working:novelty:surprise",
  schema: SurpriseState,
  defaultState: DEFAULT_SURPRISE_STATE,
  order: 19,
  compute: computeSurpriseFromContext,
  computeEffect: computeSurpriseEffect
})
