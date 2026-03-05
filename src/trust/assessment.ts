import { TRUST } from "@/config/constants.ts"
import { getCurrentEmotion } from "@/memory/working.ts"
import { getTrustLevel } from "./levels.ts"
import type { ActionType, AutonomyLevel, TrustAssessment } from "./types.ts"

/**
 * Determine the autonomy level based on experience and canAct.
 */
export function getAutonomyLevel(experience: number, canAct: boolean): AutonomyLevel {
  if (experience === 0) return "locked"
  if (!canAct) return "approval_required"
  if (experience < 0.7) return "supervised"
  return "independent"
}

/**
 * Assess whether ANIMA can act autonomously for a given action type.
 * Uses emotion system's confidence/caution instead of per-action fear/confidence.
 */
export async function canActAutonomously(actionType: ActionType): Promise<TrustAssessment> {
  const trust = await getTrustLevel(actionType)

  const experience = trust.weightedExperience

  const riskLevel = TRUST.RISK_LEVELS[actionType]

  const emotion = await getCurrentEmotion()
  const emotionConfidence = emotion?.confidence ?? 0.5
  const emotionCaution = emotion?.caution ?? 0.5

  const effectiveConfidence = experience * 0.5 + emotionConfidence * 0.5
  const effectiveCaution = riskLevel * (emotionCaution * 0.5 + 0.25)

  const canAct = experience > 0 && effectiveConfidence > effectiveCaution

  const reason = canAct
    ? `Effective confidence (${effectiveConfidence.toFixed(2)}) exceeds effective caution (${effectiveCaution.toFixed(2)})`
    : `Effective confidence (${effectiveConfidence.toFixed(2)}) below effective caution (${effectiveCaution.toFixed(2)})`

  const autonomyLevel = getAutonomyLevel(experience, canAct)

  return {
    canAct,
    requiresApproval: !canAct,
    experienceFactor: experience,
    reason,
    autonomyLevel
  }
}
