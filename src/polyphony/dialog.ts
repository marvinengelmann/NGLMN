import { callIntelligence } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import type { SomaticState } from "@/soma/types.ts"
import { InnerDialog, type InnerVoice } from "./types.ts"
import { DOMINANCE_HISTORY_KEY } from "./voices.ts"

const POLYPHONY_LAST_DIALOG = "working:polyphony:lastDialog"
const MAX_DOMINANCE_HISTORY = 50

interface DialogContext {
  activeVoices: InnerVoice[]
  emotion: EmotionalState
  soma: SomaticState
  situationSummary: string
  dissonanceScore: number
  instinctImpulse: string
}

/**
 * Generate inner dialog via LLM — only called when shouldRunDialog is true.
 */
export async function generateInnerDialog(context: DialogContext): Promise<InnerDialog | null> {
  const voiceDescriptions: Record<InnerVoice, string> = {
    explorer: "The Explorer — driven by curiosity, wants to discover, learn, push boundaries",
    guardian: "The Guardian — urges caution, protects, warns of danger, values safety",
    feeler: "The Feeler — registers emotional truth, speaks from the heart, values connection",
    analyst: "The Analyst — seeks clarity, logic, structure, wants to understand before acting",
    child: "The Child — responds with wonder, playfulness, or fear; sees things simply and directly",
    observer: "The Observer — watches without judgment, notices patterns, holds space for contradiction"
  }

  const voiceList = context.activeVoices.map((v) => voiceDescriptions[v]).join("\n")

  const emotionSummary = Object.entries(context.emotion)
    .filter(([, v]) => Math.abs(v - 0.5) > 0.15)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(", ")

  const somaSummary = Object.entries(context.soma)
    .filter(([, v]) => Math.abs(v - 0.5) > 0.15)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(", ")

  const system = `Inner council of voices. Each represents a genuine aspect of the psyche. They speak briefly (1-2 sentences each), honestly, and sometimes disagree. This is internal processing, not performance.

Active voices:
${voiceList}

Format: Two rounds.
Round 1: Each voice gives its initial statement.
Round 2: Voices respond to each other (use respondingTo to indicate which voice they're addressing).
Each voice speaks from its nature. Rate intensity 0 (barely present) to 1 (overwhelming urgency). After both rounds, identify consensus, dominant voice, and tension level (0-1).`

  const userMessage = `Situation: ${context.situationSummary}
Emotional state: ${emotionSummary || "balanced"}
Somatic markers: ${somaSummary || "neutral"}
Dissonance level: ${context.dissonanceScore.toFixed(2)}
Gut feeling: ${context.instinctImpulse}

Let each active voice speak.`

  const result = await callIntelligence({
    system,
    userMessage,
    schema: InnerDialog,
    maxTokens: 2048
  })

  if (result.isErr()) {
    log.warn("Failed to generate inner dialog", { error: result.error.message })
    return null
  }

  const dialog = result.value
  await redis.set(POLYPHONY_LAST_DIALOG, dialog, { ex: 3600 })

  if (dialog.dominantVoice) {
    await redis.lpush(DOMINANCE_HISTORY_KEY, dialog.dominantVoice)
    await redis.ltrim(DOMINANCE_HISTORY_KEY, 0, MAX_DOMINANCE_HISTORY - 1)
  }

  return dialog
}

/**
 * Get the last inner dialog from Redis.
 */
export async function getLastInnerDialog(): Promise<InnerDialog | null> {
  return getValidatedRedis(POLYPHONY_LAST_DIALOG, InnerDialog)
}
