import { DREAM_AFTERGLOW } from "@/config/constants.ts"
import { applyConsolidationResult } from "@/dream/consolidation.ts"
import { applyCreativeResult } from "@/dream/creative.ts"
import type { DreamAfterglow, DreamThinkResult } from "@/dream/types.ts"
import { redis } from "@/integrations/redis.ts"
import { nowISO } from "@/lib/time.ts"
import { forgetOldEpisodes } from "@/memory/episodic.ts"
import { setDreamInsights, setDreamLastRun, setDreamNarrative, setDreamState } from "@/memory/working.ts"

const AFTERGLOW_KEY = "working:dream:afterglow"

/**
 * Execute dream results: apply consolidation + creative, persist insights and state.
 */
export async function executeDream(dreamResult: DreamThinkResult): Promise<void> {
  await setDreamState("dreaming")

  try {
    if (dreamResult.consolidation) {
      await applyConsolidationResult(dreamResult.consolidation)
    }
    if (dreamResult.creative) {
      await applyCreativeResult(dreamResult.creative)
    }

    if (dreamResult.insights.length > 0) {
      await setDreamInsights(dreamResult.insights)
    }
    if (dreamResult.narrative) {
      await setDreamNarrative(dreamResult.narrative)
    }
    await setDreamLastRun(nowISO())
    await forgetOldEpisodes()
    const afterglow = buildDreamAfterglow(dreamResult)
    if (afterglow) {
      await redis.set(AFTERGLOW_KEY, afterglow, { ex: DREAM_AFTERGLOW.TTL_SECONDS })
    }
  } finally {
    await setDreamState("waking")
  }
}

function extractThemesFromNarrative(narrative: string): string[] {
  const words = narrative.toLowerCase().split(/\s+/)
  const thematic = words.filter((w) => w.length > 5).slice(0, 5)
  return [...new Set(thematic)]
}

function buildDreamAfterglow(dreamResult: DreamThinkResult): DreamAfterglow | null {
  if (!dreamResult.narrative && dreamResult.insights.length === 0) return null

  const themes = dreamResult.narrative
    ? extractThemesFromNarrative(dreamResult.narrative)
    : dreamResult.insights.slice(0, 3)

  const emotionalResidue: Record<string, number> = {}
  if (dreamResult.narrative) {
    const text = dreamResult.narrative.toLowerCase()
    if (text.includes("fear") || text.includes("threat")) emotionalResidue.caution = 0.1
    if (text.includes("joy") || text.includes("happy")) emotionalResidue.satisfaction = 0.1
    if (text.includes("connect") || text.includes("together")) emotionalResidue.connection = 0.1
    if (text.includes("curious") || text.includes("discover")) emotionalResidue.curiosity = 0.1
    if (text.includes("loss") || text.includes("alone")) emotionalResidue.frustration = 0.05
  }

  return {
    themes,
    emotionalResidue,
    intensity: 0.6,
    createdAt: nowISO()
  }
}
