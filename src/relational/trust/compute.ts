import { parseISO } from "date-fns"
import { getCurrentEmotion } from "@/affect/emotion/state.ts"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { getTrustEventLog, pushTrustEvent } from "@/relational/trust/state.ts"
import { TRUST } from "./constants.ts"
import { ActionType, type ActionType as ActionTypeT, type TrustEvent } from "./types.ts"

const HALF_LIFE_DAYS = 30

function computeWeight(event: TrustEvent, now: Date): number {
  const eventDate = parseISO(event.timestamp)
  const daysSince = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
  return halfLifeDecay(daysSince, HALF_LIFE_DAYS)
}

function computeWeightedExperience(events: TrustEvent[]): number {
  if (events.length === 0) return 0
  const now = new Date()
  const { weightedSuccess, totalWeight } = events.reduce(
    (acc, event) => {
      const weight = computeWeight(event, now)
      acc.totalWeight += weight
      if (event.success) acc.weightedSuccess += weight
      return acc
    },
    { weightedSuccess: 0, totalWeight: 0 }
  )
  return totalWeight > 0 ? weightedSuccess / totalWeight : 0
}

/**
 * Get the trust level for a specific action type with time-weighted experience.
 */
export async function getTrustLevel(actionType: ActionTypeT) {
  const events = await getTrustEventLog(actionType)
  return {
    actionType,
    totalAttempts: events.length,
    successfulAttempts: events.filter((e) => e.success).length,
    weightedExperience: computeWeightedExperience(events)
  }
}

/**
 * Get all trust level entries.
 */
export async function getAllTrustLevels() {
  return Promise.all(ActionType.options.map((actionType) => getTrustLevel(actionType)))
}

/**
 * Compute aggregate trust experience (0-1) across all action types.
 * Uses time-weighted decay. Returns 0.5 if no trust data exists yet.
 */
export async function getAggregateTrustExperience(): Promise<number> {
  const levels = await getAllTrustLevels()
  const { totalWeight, totalWeighted } = levels.reduce(
    (acc, level) => {
      if (level.totalAttempts > 0) {
        acc.totalWeight += level.totalAttempts
        acc.totalWeighted += level.weightedExperience * level.totalAttempts
      }
      return acc
    },
    { totalWeight: 0, totalWeighted: 0 }
  )

  if (totalWeight === 0) return 0.5
  return Math.min(1, totalWeighted / totalWeight)
}

/**
 * Determine the autonomy level based on experience and canAct.
 */
export function getAutonomyLevel(experience: number, canAct: boolean): AutonomyLevel {
  if (experience === 0) return "locked"
  if (!canAct) return "approval_required"
  if (experience < 0.7) return "supervised"
  return "independent"
}

type AutonomyLevel = "locked" | "approval_required" | "supervised" | "independent"

/**
 * Assess whether ANIMA can act autonomously for a given action type.
 * Uses emotion system's confidence/caution instead of per-action fear/confidence.
 */
export async function canActAutonomously(actionType: ActionTypeT): Promise<TrustAssessment> {
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

/**
 * Record a successful action as a trust event.
 */
export async function recordSuccess(actionType: ActionTypeT): Promise<void> {
  await pushTrustEvent(actionType, { success: true, timestamp: new Date().toISOString() })
}

/**
 * Record a failed action as a trust event.
 */
export async function recordFailure(actionType: ActionTypeT): Promise<void> {
  await pushTrustEvent(actionType, { success: false, timestamp: new Date().toISOString() })
}

type TrustAssessment = {
  canAct: boolean
  requiresApproval: boolean
  experienceFactor: number
  reason: string
  autonomyLevel?: AutonomyLevel
}
