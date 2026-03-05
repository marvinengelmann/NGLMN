import { applyConsolidationResult } from "@/dream/consolidation.ts"
import { applyCreativeResult } from "@/dream/creative.ts"
import type { DreamThinkResult } from "@/dream/types.ts"
import { nowISO } from "@/lib/time.ts"
import { forgetOldEpisodes } from "@/memory/episodic.ts"
import { setDreamInsights, setDreamLastRun, setDreamNarrative, setDreamState } from "@/memory/working.ts"

/**
 * Execute dream results: apply consolidation + creative, persist insights and state.
 */
export async function executeDream(dreamResult: DreamThinkResult): Promise<void> {
  await setDreamState("dreaming")

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
  await setDreamState("waking")
}
