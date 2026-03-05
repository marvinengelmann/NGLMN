import { pushTrustEvent } from "@/memory/working.ts"
import type { ActionType } from "./types.ts"

/**
 * Record a successful action as a trust event.
 */
export async function recordSuccess(actionType: ActionType): Promise<void> {
  await pushTrustEvent(actionType, { success: true, timestamp: new Date().toISOString() })
}

/**
 * Record a failed action as a trust event.
 */
export async function recordFailure(actionType: ActionType): Promise<void> {
  await pushTrustEvent(actionType, { success: false, timestamp: new Date().toISOString() })
}
