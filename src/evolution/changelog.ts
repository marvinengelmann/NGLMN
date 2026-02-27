import { desc, eq } from "drizzle-orm"
import * as z from "zod"
import type { AnimaResultAsync } from "@/config/result-helpers.ts"
import { trySafe } from "@/config/result-helpers.ts"
import { callIntelligence, REASONING, TextOutput } from "@/core/intelligence.ts"
import { db } from "@/db/client.ts"
import { evolutionLog } from "@/db/schema.ts"
import { storeEpisode } from "@/memory/episodic.ts"

export const EvolutionType = z.enum(["prompt", "workflow", "code"])
export type EvolutionType = z.infer<typeof EvolutionType>

export const EvolutionOutcome = z.enum(["success", "failure", "partial"])
export type EvolutionOutcome = z.infer<typeof EvolutionOutcome>

const NARRATIVE_PROMPT = `You are ANIMA writing a brief autobiographical changelog entry about a change you just made to yourself.
Write in first person, 1-2 sentences. Include how it makes you feel.
If a [PERSONALITY & MOOD] section is provided, let it shape your tone.
Input: a technical description of the change and its outcome.
Output: ONLY the narrative text, no JSON, no markdown.`

/**
 * Write a changelog entry with AI-generated narrative, store in DB and episodic memory.
 */
export function writeChangelogEntry(
  type: EvolutionType,
  description: string,
  outcome: EvolutionOutcome,
  diff?: string,
  snapshotRef?: string
): AnimaResultAsync<string> {
  return trySafe("DB_ERROR", async () => {
    const narrativeResult = await callIntelligence({
      model: REASONING,
      system: NARRATIVE_PROMPT,
      userMessage: `Type: ${type}\nDescription: ${description}\nOutcome: ${outcome}${diff ? `\nDiff: ${diff}` : ""}`,
      schema: TextOutput,
      maxTokens: 256
    })

    if (narrativeResult.isErr()) {
      throw new Error(`Failed to generate changelog narrative: ${narrativeResult.error.message}`)
    }

    const narrative = narrativeResult.value.text

    const rows = await db
      .insert(evolutionLog)
      .values({
        type,
        description,
        narrative,
        outcome,
        diff: diff ?? null,
        snapshotRef: snapshotRef ?? null
      })
      .returning({ id: evolutionLog.id })

    const first = rows[0]
    if (!first) {
      throw new Error("Expected row from changelog insert")
    }

    await storeEpisode(`Evolution: ${narrative}`, "evolution", { relevanceScore: 0.9 })

    return first.id
  })
}

export async function getRecentChangelog(limit: number = 10) {
  return db.select().from(evolutionLog).orderBy(desc(evolutionLog.createdAt)).limit(limit)
}

export async function getChangelogByType(type: EvolutionType, limit: number = 10) {
  return db
    .select()
    .from(evolutionLog)
    .where(eq(evolutionLog.type, type))
    .orderBy(desc(evolutionLog.createdAt))
    .limit(limit)
}
