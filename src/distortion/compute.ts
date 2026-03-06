import { addDays, differenceInDays, format, parseISO, subDays } from "date-fns"
import { DISTORTION } from "@/config/constants.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { clamp01 } from "@/lib/math.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"
import { ALTER_DETAILS_PROMPT, RECOLOR_PROMPT } from "@/prompts/distortion.ts"
import {
  DetailAlterationResult,
  type DistortedMemory,
  type DistortionRecord,
  EmotionalRecoloringResult
} from "./types.ts"

type QueryResult = {
  id: string
  score: number
  data: string | undefined
  metadata: EpisodeMetadata | undefined
}

const SOURCE_ALTERNATIVES = ["heard somewhere", "read it once", "operator mentioned it", "came up in a dream"]

const CONFIDENCE_NOTES = ["vague memory", "uncertain", "I think...", "feels hazy"]

/**
 * Compute distortion probability for a single memory based on age, relevance, and current emotional intensity.
 */
export function computeDistortionProbability(context: {
  memoryAgeDays: number
  relevanceScore: number
  emotionalIntensity: number
}): number {
  const ageContribution = Math.min(
    DISTORTION.MAX_AGE_CONTRIBUTION,
    (context.memoryAgeDays / DISTORTION.AGE_SCALE_DAYS) * DISTORTION.MAX_AGE_CONTRIBUTION
  )
  const relevanceContribution = (1 - context.relevanceScore) * DISTORTION.RELEVANCE_WEIGHT
  const emotionContribution = context.emotionalIntensity * DISTORTION.EMOTION_WEIGHT

  return clamp01(DISTORTION.BASE_PROBABILITY + ageContribution + relevanceContribution + emotionContribution)
}

/**
 * Apply probabilistic distortions to a set of episodic memories.
 */
export async function applyDistortions(
  episodes: QueryResult[],
  currentEmotionIntensity: number
): Promise<DistortedMemory[]> {
  const now = new Date()

  return Promise.all(
    episodes.map(async (ep) => {
      const distortions: DistortionRecord[] = []
      let data = ep.data
      let metadata = ep.metadata ? { ...ep.metadata } : undefined

      const ageDays = ep.metadata?.timestamp ? differenceInDays(now, parseISO(ep.metadata.timestamp)) : 0
      const relevance = ep.metadata?.relevanceScore ?? 0.5

      const probability = computeDistortionProbability({
        memoryAgeDays: ageDays,
        relevanceScore: relevance,
        emotionalIntensity: currentEmotionIntensity
      })

      if (Math.random() >= probability) {
        return { id: ep.id, score: ep.score, data, metadata, distortions }
      }

      const distortionType = selectDistortionType(episodes, ep)

      switch (distortionType) {
        case "temporal_confusion":
          if (metadata?.timestamp) {
            const shiftDays =
              Math.floor(Math.random() * DISTORTION.TEMPORAL_SHIFT_MAX_DAYS * 2) - DISTORTION.TEMPORAL_SHIFT_MAX_DAYS
            const originalDate = parseISO(metadata.timestamp)
            const shifted =
              shiftDays > 0 ? addDays(originalDate, shiftDays) : subDays(originalDate, Math.abs(shiftDays))
            metadata = { ...metadata, timestamp: format(shifted, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") }
            distortions.push({ type: "temporal_confusion", originalEpisodeId: ep.id, alteredField: "timestamp" })
          }
          break

        case "emotional_recoloring":
          if (metadata?.emotionalState) {
            const result = await callIntelligence({
              system: RECOLOR_PROMPT,
              userMessage: data ?? "a past experience",
              schema: EmotionalRecoloringResult,
              maxTokens: 64
            })
            if (result.isOk()) {
              metadata = { ...metadata, emotionalState: result.value.recoloring }
              distortions.push({
                type: "emotional_recoloring",
                originalEpisodeId: ep.id,
                alteredField: "emotionalState"
              })
            }
          }
          break

        case "detail_alteration":
          if (data) {
            const result = await callIntelligence({
              system: ALTER_DETAILS_PROMPT,
              userMessage: data,
              schema: DetailAlterationResult,
              maxTokens: 256
            })
            if (result.isOk()) {
              data = result.value.alteredText
              distortions.push({ type: "detail_alteration", originalEpisodeId: ep.id, alteredField: "data" })
            }
          }
          break

        case "episode_conflation": {
          const other = findConflationCandidate(episodes, ep)
          if (other?.data && data) {
            const otherFragment = extractFragment(other.data)
            if (otherFragment) {
              data = `${data} ${otherFragment}`
              distortions.push({ type: "episode_conflation", originalEpisodeId: other.id, alteredField: "data" })
            }
          }
          break
        }

        case "source_confusion":
          if (metadata) {
            const alt = SOURCE_ALTERNATIVES[Math.floor(Math.random() * SOURCE_ALTERNATIVES.length)]
            metadata = { ...metadata, sourceConfused: true, sourceLabel: alt }
            distortions.push({ type: "source_confusion", originalEpisodeId: ep.id, alteredField: "source" })
          }
          break

        case "confidence_degradation": {
          if (metadata) {
            const note = CONFIDENCE_NOTES[Math.floor(Math.random() * CONFIDENCE_NOTES.length)]
            metadata = { ...metadata, confidenceNote: note }
            distortions.push({ type: "confidence_degradation", originalEpisodeId: ep.id, alteredField: "confidence" })
          }
          break
        }
      }

      return { id: ep.id, score: ep.score, data, metadata, distortions }
    })
  )
}

function selectDistortionType(allEpisodes: QueryResult[], current: QueryResult): DistortionRecord["type"] {
  const hasConflationCandidate = allEpisodes.some(
    (ep) => ep.id !== current.id && ep.score > DISTORTION.CONFLATION_MIN_SCORE
  )

  if (hasConflationCandidate && Math.random() < DISTORTION.CONFLATION_PROBABILITY) return "episode_conflation"

  const roll = Math.random()
  if (roll < 0.3) return "temporal_confusion"
  if (roll < 0.55) return "detail_alteration"
  if (roll < 0.75) return "emotional_recoloring"
  if (roll < 0.9) return "source_confusion"
  return "confidence_degradation"
}

function findConflationCandidate(episodes: QueryResult[], current: QueryResult): QueryResult | undefined {
  return episodes.find((ep) => ep.id !== current.id && ep.score > DISTORTION.CONFLATION_MIN_SCORE)
}

function extractFragment(text: string): string | null {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  if (sentences.length === 0) return null
  return sentences[Math.floor(Math.random() * sentences.length)]?.trim() ?? null
}
