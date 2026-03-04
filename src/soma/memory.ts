import { SOMA } from "@/config/constants.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getSomaticStatesNear } from "./state.ts"
import type { SomaticState } from "./types.ts"

/**
 * Query somatic memories from similar past situations.
 * Finds episodic matches, then retrieves somatic states recorded near those episodes.
 */
export async function querySomaticMemories(
  contextText: string,
  topK: number = SOMA.MEMORY_QUERY_TOP_K
): Promise<SomaticState[]> {
  const episodes = await queryRelated(contextText, topK)
  if (episodes.length === 0) return []

  const episodeTimestamps = episodes.map((e) => e.metadata?.timestamp).filter((t): t is string => t != null)

  if (episodeTimestamps.length === 0) return []

  return getSomaticStatesNear(episodeTimestamps, topK)
}
