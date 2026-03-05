import { callIntelligence } from "@/core/intelligence.ts"
import { gatherConsolidationData } from "@/dream/consolidation.ts"
import { gatherCreativeData } from "@/dream/creative.ts"
import {
  ConsolidationOutput,
  CreativeConnectionsOutput,
  DreamNarrativeOutput,
  type DreamThinkResult
} from "@/dream/types.ts"
import { log } from "@/lib/logger.ts"
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  CREATIVE_CONNECTIONS_SYSTEM_PROMPT,
  DREAM_NARRATIVE_SYSTEM_PROMPT
} from "@/prompts/dream.ts"

/**
 * Run dream-specific thinking: consolidation + creative LLM calls.
 */
export async function thinkDream(): Promise<DreamThinkResult> {
  let consolidation: DreamThinkResult["consolidation"] = null
  let creative: DreamThinkResult["creative"] = null
  const allInsights: string[] = []

  const consolidationData = await gatherConsolidationData()
  if (consolidationData !== "[]") {
    const consolidationResult = await callIntelligence({
      system: CONSOLIDATION_SYSTEM_PROMPT,
      userMessage: consolidationData,
      schema: ConsolidationOutput,
      maxTokens: 2048
    })

    if (consolidationResult.isOk()) {
      consolidation = consolidationResult.value
      allInsights.push(
        ...consolidation.semanticEntries.map((e) => e.value),
        ...consolidation.connections.map((c) => c.description)
      )
    } else {
      log.warn("thinkDream: consolidation LLM failed", { error: consolidationResult.error.message })
    }
  }

  const creativeData = await gatherCreativeData()
  if (creativeData !== "{}") {
    const creativeResult = await callIntelligence({
      system: CREATIVE_CONNECTIONS_SYSTEM_PROMPT,
      userMessage: creativeData,
      schema: CreativeConnectionsOutput,
      maxTokens: 2048
    })

    if (creativeResult.isOk()) {
      creative = creativeResult.value
      allInsights.push(...creative.connections.filter((c) => c.confidence >= 0.5).map((c) => c.insight))
    } else {
      log.warn("thinkDream: creative LLM failed", { error: creativeResult.error.message })
    }
  }

  let narrative: string | null = null
  if (allInsights.length > 0) {
    const narrativeResult = await callIntelligence({
      system: DREAM_NARRATIVE_SYSTEM_PROMPT,
      userMessage: `Dream insights:\n${allInsights.join("\n")}`,
      schema: DreamNarrativeOutput,
      maxTokens: 256
    })
    if (narrativeResult.isOk()) {
      narrative = narrativeResult.value.narrative
    } else {
      log.warn("thinkDream: narrative LLM failed", { error: narrativeResult.error.message })
    }
  }

  log.info("thinkDream complete", {
    consolidation: consolidation != null,
    creative: creative != null,
    insights: allInsights.length,
    hasNarrative: narrative != null
  })

  return { consolidation, creative, insights: allInsights, narrative }
}
