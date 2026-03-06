import { desc, eq } from "drizzle-orm"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import { db } from "@/db/client.ts"
import { evolutionLog } from "@/db/schema.ts"
import type { EvolutionOutcome, EvolutionType } from "@/evolution/types.ts"
import { log } from "@/lib/logger.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { CHANGELOG_NARRATIVE_SYSTEM_PROMPT } from "@/prompts/evolution.ts"

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
    log.info("Writing changelog entry", { type, description, outcome })

    const narrativeResult = await callIntelligence({
      system: CHANGELOG_NARRATIVE_SYSTEM_PROMPT,
      userMessage: `Type: ${type}\nDescription: ${description}\nOutcome: ${outcome}${diff ? `\nDiff: ${diff}` : ""}`,
      schema: TextOutput,
      maxTokens: 256,
      reasoning: false
    })

    if (narrativeResult.isErr()) {
      throw new Error(`Failed to generate changelog narrative: ${narrativeResult.error.message}`)
    }

    const narrative = narrativeResult.value.text
    log.debug("Changelog narrative generated", { type, narrativeLength: narrative.length })

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

    log.info("Changelog entry written", { id: first.id, type, outcome })
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
