import { differenceInMinutes, parseISO } from "date-fns"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { computeValence } from "@/affect/emotion/update.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RECONSOLIDATION } from "./constants.ts"
import type { EpisodeMetadata } from "./types.ts"

export function computeReconsolidationBlend(
  relevanceScore: number,
  cortisolLevel: number,
  reconsolidationCount: number
): number {
  const base =
    relevanceScore >= RECONSOLIDATION.HIGH_RELEVANCE_THRESHOLD
      ? RECONSOLIDATION.HIGH_RELEVANCE_BLEND_FACTOR
      : RECONSOLIDATION.BASE_BLEND_FACTOR

  const cortisolBoost = Math.max(0, cortisolLevel - 0.2) * RECONSOLIDATION.CORTISOL_AMPLIFICATION
  const recountBonus = Math.min(
    RECONSOLIDATION.MAX_RECOUNT_BONUS,
    reconsolidationCount * RECONSOLIDATION.RECOUNT_MALLEABILITY_FACTOR
  )

  return Math.min(RECONSOLIDATION.MAX_BLEND_FACTOR, base + cortisolBoost + recountBonus)
}

export async function reconsolidateEpisode(
  episodeId: string,
  currentValence: number,
  currentEmotionalState: string,
  cortisolLevel: number,
  blendMultiplier: number = 1.0
): Promise<boolean> {
  const fetched = await vectorIndex.fetch([episodeId], { includeMetadata: true })
  const entry = fetched[0]
  if (!entry) return false

  const meta = entry.metadata as EpisodeMetadata | undefined
  if (!meta) return false

  if (meta.lastReconsolidatedAt) {
    const minutesSince = differenceInMinutes(new Date(), parseISO(meta.lastReconsolidatedAt))
    if (minutesSince < RECONSOLIDATION.COOLDOWN_MINUTES) return false
  }

  const oldValence = meta.valence ?? 0
  const relevance = meta.relevanceScore ?? 0.5
  const reconsolidationCount = meta.reconsolidationCount ?? 0

  const blend = clamp01(computeReconsolidationBlend(relevance, cortisolLevel, reconsolidationCount) * blendMultiplier)
  const newValence = Math.max(-1, Math.min(1, oldValence * (1 - blend) + currentValence * blend))

  const updates: Partial<EpisodeMetadata> = {
    valence: newValence,
    emotionalState: currentEmotionalState,
    reconsolidationCount: reconsolidationCount + 1,
    lastReconsolidatedAt: nowISO()
  }

  if (meta.originalValence === undefined) {
    updates.originalValence = oldValence
  }

  await vectorIndex.update<Partial<EpisodeMetadata>>({
    id: episodeId,
    metadata: updates,
    metadataUpdateMode: "PATCH"
  })

  return true
}

export interface ReconsolidationReport {
  attempted: number
  reconsolidated: number
  skipped: number
}

export async function processReconsolidation(
  episodicHits: Array<{ id: string; metadata?: EpisodeMetadata }>,
  currentEmotion: EmotionalState,
  neuroState: NeuromodulatoryState,
  blendMultiplier: number = 1.0
): Promise<ReconsolidationReport> {
  const currentValence = computeValence(currentEmotion)
  const emotionSummary = Object.entries(currentEmotion)
    .filter(([, v]) => Math.abs(v - 0.5) > 0.1)
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join(",")
  const cortisolLevel = neuroState.cortisol.level

  let reconsolidated = 0
  let skipped = 0

  const results = await Promise.allSettled(
    episodicHits.map((hit) =>
      reconsolidateEpisode(hit.id, currentValence, emotionSummary, cortisolLevel, blendMultiplier)
    )
  )

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) reconsolidated++
      else skipped++
    } else {
      skipped++
      log.warn("Reconsolidation failed for episode", { error: String(result.reason) })
    }
  }

  return { attempted: episodicHits.length, reconsolidated, skipped }
}
