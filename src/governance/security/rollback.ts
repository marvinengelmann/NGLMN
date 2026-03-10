import { getRef, listCommits, updateRef } from "@/infra/integrations/github.ts"
import { extractErrorMessage } from "@/infra/lib/result.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { pushRollbackEvent } from "@/memory/working.ts"
import type { RollbackResult, RollbackTier } from "./types.ts"

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
