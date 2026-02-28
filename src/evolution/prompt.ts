import { desc, eq } from "drizzle-orm"
import * as z from "zod"
import { callIntelligence, REASONING } from "@/core/intelligence.ts"
import { db } from "@/db/client.ts"
import { promptVersions } from "@/db/schema.ts"
import type { MetricsSnapshot } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { PROMPT_EVOLUTION_SYSTEM_PROMPT } from "@/prompts/evolution.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"

export const PromptProposalOutput = z.object({
  shouldChange: z.boolean(),
  newPrompt: z.string().nullable(),
  changelog: z.string(),
  reasoning: z.string()
})
export type PromptProposalOutput = z.infer<typeof PromptProposalOutput>

export interface PromptProposal extends PromptProposalOutput {
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

  const responseResult = await callIntelligence({
    model: REASONING,
    system: PROMPT_EVOLUTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify({
      promptId,
      currentContent,
      metrics,
      recentOutputs: recentOutputs.slice(0, 5)
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

export async function applyPromptChange(promptId: string, newContent: string, changelog: string): Promise<number> {
  const current = await getCurrentPromptVersion(promptId)
  const newVersion = (current?.version ?? 0) + 1

  await db.insert(promptVersions).values({
    promptId,
    version: newVersion,
    content: newContent,
    changelog
  })

  const changelogResult = await writeChangelogEntry("prompt", `${promptId}: ${changelog}`, "success")
  if (changelogResult.isErr()) logAndCaptureError(changelogResult.error)

  const successResult = await recordSuccess("prompt_modification")
  if (successResult.isErr()) {
    logAndCaptureError(successResult.error)
  }

  return newVersion
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
