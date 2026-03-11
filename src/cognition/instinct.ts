import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { PendingMessage } from "@/infra/integrations/types.ts"
import { queryRelated } from "@/memory/episodic.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"
import type { InstinctImpression } from "./types.ts"

/**
 * Compute an instinctive (fast, pre-cognitive) impression — NO LLM call.
 * Draws on episodic memory, emotional state, and somatic markers.
 */
export async function computeInstinctImpression(
  messages: PendingMessage[],
  emotion: EmotionalState,
  soma: SomaticState
): Promise<InstinctImpression> {
  if (messages.length === 0 && maxDeviation(emotion) < 0.2) {
    return {
      impulse: "neutral",
      confidence: 0.3,
      basis: "no stimulus, low emotional activation",
      episodicMatches: 0,
      emotionalCharge: maxDeviation(emotion)
    }
  }

  const contextText = messages.length > 0 ? messages.map((m) => m.text).join(" ") : "quiet moment, internal state"
  const episodes = await queryRelated(contextText, 5)

  let approachScore = 0
  let avoidScore = 0

  episodes.forEach((ep) => {
    const valence = (ep.metadata as EpisodeMetadata | undefined)?.valence
    if (ep.score > 0.7) {
      if (valence != null && valence < -0.2) avoidScore += 0.25
      else if (valence != null && valence > 0.2) approachScore += 0.25
      else approachScore += 0.1
    } else if (ep.score > 0.4) {
      approachScore += 0.05
    }
  })

  const emotionalCharge = maxDeviation(emotion)

  if (emotionalCharge > 0.7 && soma.tension > 0.6) {
    avoidScore += 0.3
  }
  if (emotion.connection > 0.7 && messages.length > 0) {
    approachScore += 0.3
  }
  if (emotion.boredom > 0.7 && messages.length === 0) {
    return {
      impulse: "withdraw",
      confidence: computeConfidence(episodes.length),
      basis: "high boredom, no external stimulus",
      episodicMatches: episodes.length,
      emotionalCharge
    }
  }

  let impulse: InstinctImpression["impulse"]
  let basis: string

  if (approachScore > avoidScore + 0.1) {
    impulse = messages.length > 0 ? "engage" : "approach"
    basis = `positive episodic matches (${episodes.length}), approach bias`
  } else if (avoidScore > approachScore + 0.1) {
    impulse = "avoid"
    basis = `negative episodic associations, high tension (${soma.tension.toFixed(2)})`
  } else {
    impulse = "neutral"
    basis = "balanced episodic associations"
  }

  return {
    impulse,
    confidence: computeConfidence(episodes.length),
    basis,
    episodicMatches: episodes.length,
    emotionalCharge
  }
}

function maxDeviation(emotion: EmotionalState): number {
  return Math.max(...Object.values(emotion).map((v) => Math.abs(v - 0.5)))
}

function computeConfidence(matchCount: number): number {
  if (matchCount === 0) return 0.2
  if (matchCount >= 5) return 0.8
  return 0.2 + (matchCount / 5) * 0.6
}
