import { parseISO } from "date-fns"
import { getTrustEventLog } from "@/memory/working.ts"
import { ActionType, type ActionType as ActionTypeT, type TrustEvent } from "./types.ts"

const HALF_LIFE_DAYS = 30

function computeWeight(event: TrustEvent, now: Date): number {
  const eventDate = parseISO(event.timestamp)
  const daysSince = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
  return 2 ** (-daysSince / HALF_LIFE_DAYS)
}

function computeWeightedExperience(events: TrustEvent[]): number {
  if (events.length === 0) return 0
  const now = new Date()
  let weightedSuccess = 0
  let totalWeight = 0
  for (const event of events) {
    const weight = computeWeight(event, now)
    totalWeight += weight
    if (event.success) weightedSuccess += weight
  }
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
  let totalWeight = 0
  let totalWeighted = 0
  for (const level of levels) {
    if (level.totalAttempts > 0) {
      totalWeight += level.totalAttempts
      totalWeighted += level.weightedExperience * level.totalAttempts
    }
  }

  if (totalWeight === 0) return 0.5
  return Math.min(1, totalWeighted / totalWeight)
}
