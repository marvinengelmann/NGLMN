import { TRUST } from "@/config/constants.ts"
import { getCurrentEmotion } from "@/memory/working.ts"
import { getTrustLevel } from "./levels.ts"
import type { ActionType, AutonomyLevel, TrustAssessment } from "./types.ts"

/**
 * Determine the autonomy level based on confidence, fear, and experience.
 */
export function getAutonomyLevel(
  confidence: number,
  _fear: number,
  experience: number,
  canAct: boolean
): AutonomyLevel {
  if (confidence < 0.15) return "locked"
  if (!canAct) return "approval_required"
  if (experience < 0.7) return "supervised"
  return "independent"
}

/**
 * Assess whether ANIMA can act autonomously for a given action type.
 */
export async function canActAutonomously(actionType: ActionType): Promise<TrustAssessment> {
  const trust = await getTrustLevel(actionType)

  const totalAttempts = trust.totalAttempts ?? 0
  const successfulAttempts = trust.successfulAttempts ?? 0
  const fear = trust.fear ?? 0.8
  const confidence = trust.confidence ?? 0.1

  const experienceFactor = totalAttempts > 0 ? Math.min(1, successfulAttempts / Math.max(1, totalAttempts)) : 0

  const riskLevel = TRUST.RISK_LEVELS[actionType]
  const confidenceForAction = confidence * (0.5 + experienceFactor * 0.5)
  let fearForAction = fear * riskLevel

  const emotion = await getCurrentEmotion()
  if (emotion) {
    if (emotion.caution > 0.5) {
      fearForAction += 0.1 * (emotion.caution - 0.5)
    }
    if (emotion.excitement > 0.5) {
      fearForAction -= 0.05 * (emotion.excitement - 0.5)
    }
    fearForAction = Math.max(0, fearForAction)
  }

  const canAct = confidenceForAction > fearForAction + TRUST.BASE_THRESHOLD

  const reason = canAct
    ? `Confidence (${confidenceForAction.toFixed(2)}) exceeds fear+threshold (${(fearForAction + TRUST.BASE_THRESHOLD).toFixed(2)})`
    : `Confidence (${confidenceForAction.toFixed(2)}) below fear+threshold (${(fearForAction + TRUST.BASE_THRESHOLD).toFixed(2)})`

  const autonomyLevel = getAutonomyLevel(confidence, fear, experienceFactor, canAct)

  return {
    canAct,
    requiresApproval: !canAct,
    fearLevel: fear,
    confidenceLevel: confidence,
    experienceFactor,
    reason,
    autonomyLevel
  }
}
