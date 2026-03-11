import type { HealthCheckResult } from "@/governance/health/types.ts"
import { getRef, listCommits, updateRef } from "@/infra/integrations/github.ts"
import { extractErrorMessage } from "@/infra/lib/result.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { pushRollbackEvent } from "@/memory/working.ts"
import type { RollbackResult, RollbackTier } from "./types.ts"

const SOFT_ROLLBACK_THRESHOLD = 20
const HARD_ROLLBACK_THRESHOLD = 40
const MAX_ROLLBACKS_PER_DAY = 1

/**
 * Check if health issues are infrastructure-related (not budget or process).
 */
function hasCoreServiceFailure(health: HealthCheckResult): boolean {
  return health.services.redis === "error" || health.services.postgres === "error"
}

/**
 * Determine if a rollback should be triggered based on consecutive critical ticks.
 * Only triggers for core service failures (Redis/Postgres), not budget or process issues.
 */
export function shouldTriggerRollback(
  consecutiveCritical: number,
  recentRollbackCount: number,
  health: HealthCheckResult
): { tier: RollbackTier } | null {
  if (health.overall !== "critical") return null
  if (!hasCoreServiceFailure(health)) return null
  if (recentRollbackCount >= MAX_ROLLBACKS_PER_DAY) return null

  if (consecutiveCritical >= HARD_ROLLBACK_THRESHOLD) return { tier: "hard" }
  if (consecutiveCritical >= SOFT_ROLLBACK_THRESHOLD) return { tier: "soft" }

  return null
}

/**
 * Perform a rollback at the specified tier.
 *
 * - soft: GitHub HEAD → previous commit (Trigger.dev auto-deploys)
 * - hard: GitHub HEAD → last-stable tag
 */
export async function performRollback(tier: RollbackTier): Promise<RollbackResult> {
  const actions: string[] = []
  const errors: string[] = []

  try {
    if (tier === "soft") {
      await executeSoftRollback(actions, errors)
    }

    if (tier === "hard") {
      await executeHardRollback(actions, errors)
    }
  } catch (e) {
    errors.push(`Rollback ${tier} failed: ${extractErrorMessage(e)}`)
  }

  await pushRollbackEvent(tier)

  return {
    tier,
    success: errors.length === 0,
    actions,
    errors,
    timestamp: nowISO()
  }
}

async function executeSoftRollback(actions: string[], errors: string[]): Promise<void> {
  try {
    const commits = await listCommits("master", 5)
    if (commits.length < 2) {
      errors.push("Not enough commits for soft rollback")
      return
    }

    const previousCommit = commits[1]
    if (!previousCommit) {
      errors.push("Not enough commits for soft rollback")
      return
    }
    await updateRef("heads/master", previousCommit.sha, true)
    actions.push(`GitHub HEAD → ${previousCommit.sha.slice(0, 8)} (${previousCommit.message.split("\n")[0]})`)
  } catch (e) {
    errors.push(`Soft rollback GitHub: ${extractErrorMessage(e)}`)
  }
}

async function executeHardRollback(actions: string[], errors: string[]): Promise<void> {
  try {
    const lastStableRef = await getRef("tags/last-stable")
    await updateRef("heads/master", lastStableRef.sha, true)
    actions.push(`GitHub HEAD → last-stable tag (${lastStableRef.sha.slice(0, 8)})`)
  } catch (e) {
    errors.push(`Hard rollback GitHub: ${extractErrorMessage(e)}`)
  }
}
