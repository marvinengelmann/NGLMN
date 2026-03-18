import { and, desc, eq, gte, lt } from "drizzle-orm"
import type { MetricsSnapshot } from "@/affect/emotion/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { PromptProposalOutput } from "@/governance/evolution/types.ts"
import { db } from "@/infra/db/client.ts"
import { interactionOutcomes, promptVersions } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { PROMPT_EVOLUTION_SYSTEM_PROMPT } from "@/prompts/evolution.ts"
import { canActAutonomously, recordOutcome } from "@/relational/trust/compute.ts"
import { writeChangelogEntry } from "./changelog.ts"

interface PromptProposal extends PromptProposalOutput {
  autonomous: boolean
}

export async function loadPrompt(promptId: string, fallback: string): Promise<string> {
  const rows = await db
    .select({ content: promptVersions.content })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(1)

  if (rows.length > 0 && rows[0]?.content) {
    return rows[0].content
  }

  return fallback
}

export async function getCurrentPromptVersion(promptId: string): Promise<{ version: number; content: string } | null> {
  const rows = await db
    .select({
      version: promptVersions.version,
      content: promptVersions.content
    })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(1)

  return rows[0] ?? null
}

export async function getPromptHistory(promptId: string, limit: number = 10) {
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(limit)
}

export async function proposePromptChange(
  promptId: string,
  currentContent: string,
  metrics: MetricsSnapshot,
  recentOutputs: string[]
): Promise<PromptProposal> {
  const trust = await canActAutonomously("prompt_modification")
  const performanceNote = await getPromptVersionPerformance(promptId)

  const responseResult = await callIntelligence({
    system: PROMPT_EVOLUTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify({
      promptId,
      currentContent,
      metrics,
      recentOutputs: recentOutputs.slice(0, 5),
      ...(performanceNote ? { previousVersionPerformance: performanceNote } : {})
    }),
    schema: PromptProposalOutput,
    maxTokens: 4096
  })

  if (responseResult.isErr()) {
    log.warn("Failed to propose prompt change", { error: responseResult.error.message })
    return {
      shouldChange: false,
      newPrompt: null,
      changelog: "",
      reasoning: responseResult.error.message,
      autonomous: false
    }
  }

  return {
    ...responseResult.value,
    autonomous: trust.canAct
  }
}

export async function applyPromptChange(
  promptId: string,
  newContent: string,
  changelog: string,
  metricsAtCreation?: MetricsSnapshot
): Promise<number> {
  const current = await getCurrentPromptVersion(promptId)
  const newVersion = (current?.version ?? 0) + 1

  await db.insert(promptVersions).values({
    promptId,
    version: newVersion,
    content: newContent,
    changelog,
    metricsAtCreation: metricsAtCreation ?? null
  })

  const changelogResult = await writeChangelogEntry("prompt", `${promptId}: ${changelog}`, "success")
  if (changelogResult.isErr()) logAndCaptureError(changelogResult.error)

  await recordOutcome("prompt_modification", 1)

  return newVersion
}

/**
 * Compare outcome scores before/after a prompt version change.
 * Returns a human-readable performance summary, or null if insufficient data.
 */
export async function getPromptVersionPerformance(promptId: string): Promise<string | null> {
  const versions = await db
    .select({ version: promptVersions.version, createdAt: promptVersions.createdAt })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(2)

  if (versions.length < 2) return null

  const current = versions[0]
  const previous = versions[1]
  if (!current || !previous) return null

  const [scoresBefore, scoresAfter] = await Promise.all([
    db
      .select({ score: interactionOutcomes.outcomeScore })
      .from(interactionOutcomes)
      .where(
        and(
          gte(interactionOutcomes.createdAt, previous.createdAt),
          lt(interactionOutcomes.createdAt, current.createdAt)
        )
      )
      .limit(50),
    db
      .select({ score: interactionOutcomes.outcomeScore })
      .from(interactionOutcomes)
      .where(gte(interactionOutcomes.createdAt, current.createdAt))
      .limit(50)
  ])

  const avgBefore =
    scoresBefore.filter((s) => s.score !== null).reduce((sum, s) => sum + (s.score ?? 0), 0) /
    (scoresBefore.length || 1)
  const avgAfter =
    scoresAfter.filter((s) => s.score !== null).reduce((sum, s) => sum + (s.score ?? 0), 0) / (scoresAfter.length || 1)

  if (scoresBefore.length < 3 && scoresAfter.length < 3) return null

  const delta = avgAfter - avgBefore
  const direction = delta > 0.05 ? "improved" : delta < -0.05 ? "declined" : "stable"
  return `Version ${previous.version}→${current.version}: outcome scores ${direction} (${avgBefore.toFixed(2)}→${avgAfter.toFixed(2)}, n=${scoresBefore.length}/${scoresAfter.length})`
}

export async function rollbackPrompt(promptId: string, targetVersion: number): Promise<number> {
  const targetRows = await db
    .select({ content: promptVersions.content, version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(100)

  const targetRow = targetRows.find((r) => r.version === targetVersion)
  if (!targetRow) {
    throw new Error(`Version ${targetVersion} not found for prompt "${promptId}"`)
  }

  return applyPromptChange(promptId, targetRow.content, `Rollback to version ${targetVersion}`)
}
