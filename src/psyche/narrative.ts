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
  const system = `You are ANIMA's narrative faculty. You create brief first-person narrative entries that weave events into ANIMA's ongoing life story. Write in English. Be honest, introspective, and concise (1-3 sentences). The entry should feel like a journal fragment.

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
