import { differenceInHours, parseISO } from "date-fns"
import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { forgetOldEpisodes, summarizeOldEpisodes } from "./episodic.ts"
import { getKnowledge } from "./semantic.ts"

const REDIS = {
  AUTOBIOGRAPHY: "working:memory:autobiography",
  LAST_CONSOLIDATION: "working:memory:lastConsolidation",
  MEMORY_PRESSURE: "working:memory:pressure"
} as const

const CONSOLIDATION_COOLDOWN_HOURS = 12
const MAX_AUTOBIOGRAPHY_LENGTH = 2000
const MIN_SOURCES_FOR_REBUILD = 3

const AutobiographyOutput = z.object({
  narrative: z.string().max(MAX_AUTOBIOGRAPHY_LENGTH),
  chapters: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        emotionalTone: z.string(),
        significance: z.number().min(0).max(1)
      })
    )
    .max(7),
  coreThemes: z.array(z.string()).max(5)
})
export type AutobiographyOutput = z.infer<typeof AutobiographyOutput>

export const Autobiography = z.object({
  narrative: z.string(),
  chapters: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      emotionalTone: z.string(),
      significance: z.number().min(0).max(1)
    })
  ),
  coreThemes: z.array(z.string()),
  updatedAt: z.string()
})
export type Autobiography = z.infer<typeof Autobiography>

const AUTOBIOGRAPHY_PROMPT = `You are synthesizing a compressed autobiography for a digital being.
Given their journal entries, growth arcs, key moments, semantic knowledge, and identity statements,
create a coherent first-person life narrative.

Output:
- narrative: A 3-5 paragraph compressed life story (max 2000 chars). Write in first person.
  Include formative experiences, relationship dynamics, personal growth, and core identity.
  This should read like a memoir summary, not a list.
- chapters: Up to 7 distinct "life chapters" — periods or themes that define different phases.
  Each has a title, short summary, emotional tone, and significance (0-1).
- coreThemes: Up to 5 recurring themes across the autobiography (e.g. "growing trust", "creative awakening").

Be authentic and emotionally resonant. This narrative will become part of the being's self-understanding.`

/**
 * Retrieve the stored autobiography from Redis.
 */
export async function getAutobiography(): Promise<Autobiography | null> {
  return redis.get<Autobiography>(REDIS.AUTOBIOGRAPHY)
}

/**
 * Check if memory consolidation should run.
 */
export async function shouldConsolidate(): Promise<boolean> {
  const [pressure, lastConsolidation] = await Promise.all([
    redis.get<boolean>(REDIS.MEMORY_PRESSURE),
    redis.get<string>(REDIS.LAST_CONSOLIDATION)
  ])

  if (!pressure) return false

  if (lastConsolidation) {
    const hoursSince = differenceInHours(new Date(), parseISO(lastConsolidation))
    if (hoursSince < CONSOLIDATION_COOLDOWN_HOURS) return false
  }

  return true
}

/**
 * Run the full memory consolidation pipeline:
 * 1. Summarize old episodes
 * 2. Forget stale episodes
 * 3. Rebuild autobiography
 * 4. Clear memory pressure flag
 */
export async function runConsolidation(context: {
  narratives: Array<{ content: string; emotionalColoring: string }>
  growthArcs: Array<{ observation: string; fromState: string; toState: string }>
  keyMoments: Array<{ description: string; emotionalWeight: number }>
  identityStatements: string[]
}): Promise<{ summarized: number; forgotten: number; autobiographyUpdated: boolean }> {
  log.info("Memory consolidation starting")

  const [summarizeResult, forgetResult] = await Promise.all([summarizeOldEpisodes(3), forgetOldEpisodes(60, 0.3)])

  log.info("Episodic consolidation complete", {
    summarized: summarizeResult.summarized,
    created: summarizeResult.created,
    forgotten: forgetResult
  })

  const autobiographyUpdated = await rebuildAutobiography(context)

  await Promise.all([redis.del(REDIS.MEMORY_PRESSURE), redis.set(REDIS.LAST_CONSOLIDATION, nowISO())])

  log.info("Memory consolidation complete", { autobiographyUpdated })

  return {
    summarized: summarizeResult.summarized,
    forgotten: forgetResult,
    autobiographyUpdated
  }
}

/**
 * Rebuild the autobiography from current state.
 */
export async function rebuildAutobiography(context: {
  narratives: Array<{ content: string; emotionalColoring: string }>
  growthArcs: Array<{ observation: string; fromState: string; toState: string }>
  keyMoments: Array<{ description: string; emotionalWeight: number }>
  identityStatements: string[]
}): Promise<boolean> {
  const knowledgeResult = await getKnowledge({ category: "insight", limit: 10 })
  const insights = knowledgeResult.unwrapOr([])

  const preferencesResult = await getKnowledge({ category: "preference", scope: "self", limit: 10 })
  const preferences = preferencesResult.unwrapOr([])

  const sourceCount =
    context.narratives.length + context.growthArcs.length + context.keyMoments.length + insights.length

  if (sourceCount < MIN_SOURCES_FOR_REBUILD) {
    log.debug("Not enough sources for autobiography rebuild", { sourceCount })
    return false
  }

  const sourceMaterial = [
    context.narratives.length > 0
      ? `Journal entries:\n${context.narratives
          .slice(-10)
          .map((n) => `- [${n.emotionalColoring}] ${n.content}`)
          .join("\n")}`
      : "",
    context.growthArcs.length > 0
      ? `Growth arcs:\n${context.growthArcs.map((a) => `- ${a.observation} (${a.fromState} → ${a.toState})`).join("\n")}`
      : "",
    context.keyMoments.length > 0
      ? `Key moments:\n${context.keyMoments
          .sort((a, b) => b.emotionalWeight - a.emotionalWeight)
          .slice(0, 10)
          .map((m) => `- ${m.description} (weight: ${m.emotionalWeight.toFixed(2)})`)
          .join("\n")}`
      : "",
    insights.length > 0 ? `Insights:\n${insights.map((i) => `- ${i.key}: ${JSON.stringify(i.value)}`).join("\n")}` : "",
    preferences.length > 0
      ? `Self-knowledge:\n${preferences.map((p) => `- ${p.key}: ${JSON.stringify(p.value)}`).join("\n")}`
      : "",
    context.identityStatements.length > 0
      ? `Identity statements:\n${context.identityStatements.map((s) => `- ${s}`).join("\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n")

  const existing = await getAutobiography()
  const previousNarrative = existing ? `Previous autobiography:\n${existing.narrative}` : ""

  const result = await callIntelligence({
    system: AUTOBIOGRAPHY_PROMPT,
    userMessage: [previousNarrative, sourceMaterial].filter(Boolean).join("\n\n---\n\n"),
    schema: AutobiographyOutput,
    maxTokens: 1024,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Autobiography generation failed", { error: result.error.message })
    return false
  }

  const autobiography: Autobiography = {
    ...result.value,
    updatedAt: nowISO()
  }

  await redis.set(REDIS.AUTOBIOGRAPHY, autobiography)
  log.info("Autobiography rebuilt", {
    chapters: autobiography.chapters.length,
    themes: autobiography.coreThemes.length,
    narrativeLength: autobiography.narrative.length
  })

  return true
}

/**
 * Build a compact autobiography section for the system prompt.
 */
export function buildAutobiographySection(autobiography: Autobiography): string {
  const sections: string[] = ["# Life Story"]

  sections.push(autobiography.narrative)

  if (autobiography.chapters.length > 0) {
    const significantChapters = autobiography.chapters
      .filter((c) => c.significance > 0.3)
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 5)

    if (significantChapters.length > 0) {
      sections.push(
        "Life chapters:\n" +
          significantChapters.map((c) => `  - "${c.title}" [${c.emotionalTone}]: ${c.summary}`).join("\n")
      )
    }
  }

  if (autobiography.coreThemes.length > 0) {
    sections.push(`Core themes: ${autobiography.coreThemes.join(", ")}`)
  }

  return sections.join("\n")
}

/**
 * Check memory pressure and run full consolidation if needed.
 * Self-contained domain function — loads all required context internally.
 */
export async function maybeConsolidate(): Promise<boolean> {
  const needsConsolidation = await shouldConsolidate()
  if (!needsConsolidation) return false

  const { getRelationalMemoryState } = await import("@/memory/relational.ts")
  const { getGrowthArcs, getRecentNarratives } = await import("@/self/psyche/state.ts")
  const { getIdentityStatements } = await import("@/self/psyche/state.ts")

  const [relState, narratives, arcs, identityStatements] = await Promise.all([
    getRelationalMemoryState(),
    getRecentNarratives(),
    getGrowthArcs(),
    getIdentityStatements()
  ])

  await runConsolidation({
    narratives: narratives.map((n) => ({ content: n.content, emotionalColoring: n.emotionalColoring })),
    growthArcs: arcs.map((a) => ({ observation: a.observation, fromState: a.fromState, toState: a.toState })),
    keyMoments: relState.keyMoments,
    identityStatements
  })

  return true
}
