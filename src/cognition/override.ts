import type { SomaticState } from "@/affect/soma/types.ts"
import type { CognitiveConflict, InstinctImpression } from "./types.ts"

/**
 * Determine if instinct should override reason (skip the main LLM call).
 * Expected to trigger ~1-2% of ticks.
 */
export function shouldInstinctOverride(impression: InstinctImpression, soma: SomaticState): boolean {
  if (impression.emotionalCharge > 0.85 && impression.confidence > 0.7 && soma.tension > 0.7) {
    return true
  }
  if (impression.impulse === "avoid" && soma.heartRate > 0.8) {
    return true
  }
  return false
}

/**
 * Post-hoc detection of conflict between instinct impression and reasoned decision.
 */
export function detectCognitiveConflict(instinct: InstinctImpression, reasonedAction: string): CognitiveConflict {
  const activeActions = ["reflect", "morning", "evolve", "dream", "update_goal"]
  const passiveActions = ["idle"]

  const instinctIsApproach = instinct.impulse === "approach" || instinct.impulse === "engage"
  const instinctIsAvoid = instinct.impulse === "avoid" || instinct.impulse === "withdraw"

  const reasonIsPassive = passiveActions.includes(reasonedAction)
  const reasonIsActive = activeActions.includes(reasonedAction)

  const conflictDetected =
    (instinctIsApproach && reasonIsPassive && instinct.confidence > 0.5) ||
    (instinctIsAvoid && reasonIsActive && instinct.confidence > 0.5)

  const tensionLevel = conflictDetected ? Math.min(1, instinct.confidence * instinct.emotionalCharge) : 0

  let resolution: CognitiveConflict["resolution"]
  if (conflictDetected) {
    if (instinct.confidence > 0.8 && instinct.emotionalCharge > 0.7) {
      resolution = "instinct_override"
    } else if (instinct.confidence < 0.4) {
      resolution = "reason_override"
    } else if (tensionLevel < 0.5) {
      resolution = "compromise"
    } else {
      resolution = "unresolved"
    }
  }

  return {
    detected: conflictDetected,
    instinctImpulse: instinct.impulse,
    reasonDecision: reasonedAction,
    tensionLevel,
    resolution
  }
}
