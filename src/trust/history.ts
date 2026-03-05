import { getTrustLevelData, setTrustLevelData } from "@/memory/working.ts"
import type { ActionType } from "./types.ts"

/**
 * Record a successful action — increments totalAttempts and successfulAttempts.
 */
export async function recordSuccess(actionType: ActionType): Promise<void> {
  const current = await getTrustLevelData(actionType)
  await setTrustLevelData(actionType, {
    totalAttempts: current.totalAttempts + 1,
    successfulAttempts: current.successfulAttempts + 1
  })
}

/**
 * Record a failed action — increments only totalAttempts.
 */
export async function recordFailure(actionType: ActionType): Promise<void> {
  const current = await getTrustLevelData(actionType)
  await setTrustLevelData(actionType, {
    totalAttempts: current.totalAttempts + 1,
    successfulAttempts: current.successfulAttempts
  })
}
