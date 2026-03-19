import { incrementConsecutiveCritical, resetConsecutiveCritical } from "@/governance/health/state.ts"
import type { HealthCheckResult } from "@/governance/health/types.ts"
import { performRollback, shouldTriggerRollback } from "@/governance/security/rollback.ts"
import { log } from "@/infra/lib/logger.ts"
import { getRecentRollbackCount } from "@/memory/working.ts"

/**
 * Check health status, trigger auto-rollback if critical.
 */
export async function maintainHealth(health: HealthCheckResult | null): Promise<void> {
  if (health?.overall === "critical") {
    const consecutiveCritical = await incrementConsecutiveCritical()
    const recentRollbacks = await getRecentRollbackCount(24)
    const rollbackDecision = shouldTriggerRollback(consecutiveCritical, recentRollbacks, health)
    if (rollbackDecision) {
      const result = await performRollback(rollbackDecision.tier)
      if (result.success) {
        log.info("Auto-rollback executed", { tier: rollbackDecision.tier, actions: result.actions })
      } else {
        log.warn("Auto-rollback failed", { tier: rollbackDecision.tier, errors: result.errors })
      }
    }
  } else {
    await resetConsecutiveCritical()
  }
}
