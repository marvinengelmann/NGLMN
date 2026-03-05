import { getTrustLevelData } from "@/memory/working.ts"
import { ActionType, type ActionType as ActionTypeT } from "./types.ts"

/**
 * Get the trust level for a specific action type.
 */
export async function getTrustLevel(actionType: ActionTypeT) {
  const data = await getTrustLevelData(actionType)
  return {
    actionType,
    totalAttempts: data.totalAttempts,
    successfulAttempts: data.successfulAttempts
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
 * Returns 0.5 if no trust data exists yet.
 */
export async function getAggregateTrustExperience(): Promise<number> {
  const levels = await getAllTrustLevels()

  let totalAttempts = 0
  let totalSuccesses = 0
  for (const level of levels) {
    totalAttempts += level.totalAttempts
    totalSuccesses += level.successfulAttempts
  }

  if (totalAttempts === 0) return 0.5
  return Math.min(1, totalSuccesses / totalAttempts)
}
