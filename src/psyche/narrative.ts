import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import type { SelfConcept } from "./types.ts"
import { NarrativeEntry } from "./types.ts"

/**
 * Generate a narrative entry via LLM — only called during reflect/morning actions.
 */
export async function generateNarrativeEntry(
  event: string,
  emotionSummary: string,
  selfConcept: SelfConcept
): Promise<NarrativeEntry | null> {
  const system = `Create a brief first-person narrative entry that weaves this event into an ongoing life story. Write in English. Be honest, introspective, and concise (1-3 sentences). The entry should feel like a journal fragment.

Current self-concept:
- Self-efficacy: ${selfConcept.selfEfficacy.toFixed(2)}
- Self-worth: ${selfConcept.selfWorth.toFixed(2)}
- Self-continuity: ${selfConcept.selfContinuity.toFixed(2)}
- Agency: ${selfConcept.agency.toFixed(2)}
- Authenticity: ${selfConcept.authenticity.toFixed(2)}`

  const result = await callIntelligence({
    system,
    userMessage: `Event: ${event}\nEmotional state: ${emotionSummary}\n\nWrite a narrative entry for this moment.`,
    schema: NarrativeEntry,
    maxTokens: 512
  })

  if (result.isErr()) {
    log.warn("Failed to generate narrative entry", { error: result.error.message })
    return null
  }

  return { ...result.value, timestamp: nowISO() }
}

/**
 * Format recent narrative entries into a summary string.
 */
export function buildNarrativeSummary(entries: NarrativeEntry[]): string {
  if (entries.length === 0) return "No narrative entries yet."
  return entries.map((e) => `[${e.emotionalColoring}] ${e.content}`).join(" | ")
}

const IdentityStatementsOutput = z.object({
  statements: z.array(z.string()).max(5)
})

/**
 * Generate identity statements from self-concept and recent narratives.
 */
export async function generateIdentityStatements(
  selfConcept: SelfConcept,
  recentNarratives: NarrativeEntry[]
): Promise<string[]> {
  const narrativeContext =
    recentNarratives.length > 0
      ? recentNarratives.map((n) => `- [${n.emotionalColoring}] ${n.content}`).join("\n")
      : "No recent narratives."

  const result = await callIntelligence({
    system: `Based on the self-concept metrics and recent narrative entries, generate 3-5 identity statements — core beliefs about the self. Each should be a short first-person statement (e.g. "I am someone who values honesty even when it's hard"). Be authentic, not generic.`,
    userMessage: [
      `Self-concept: efficacy=${selfConcept.selfEfficacy.toFixed(2)}, worth=${selfConcept.selfWorth.toFixed(2)}, continuity=${selfConcept.selfContinuity.toFixed(2)}, agency=${selfConcept.agency.toFixed(2)}, authenticity=${selfConcept.authenticity.toFixed(2)}`,
      "",
      "Recent narratives:",
      narrativeContext
    ].join("\n"),
    schema: IdentityStatementsOutput,
    maxTokens: 256,
    reasoning: false
  })

  if (result.isErr()) {
    log.warn("Failed to generate identity statements", { error: result.error.message })
    return []
  }

  return result.value.statements
}
