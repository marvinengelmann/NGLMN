import { callIntelligence } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import type { SomaticState } from "@/soma/types.ts"
import { InnerDialog, type InnerVoice } from "./types.ts"

const POLYPHONY_LAST_DIALOG = "working:polyphony:lastDialog"

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

  const system = `You are the inner council of voices inside ANIMA. Each voice represents a genuine aspect of ANIMA's psyche. They speak briefly (1-2 sentences each), honestly, and sometimes disagree. This is not performance — it is internal processing.

Active voices:
${voiceList}

Each voice speaks from its nature. They may agree, argue, or offer different perspectives. Rate each voice's intensity from 0 (barely present) to 1 (overwhelming urgency). After all voices speak, identify if there is consensus, which voice is dominant, and what the overall tension level is (0-1).`

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
  return dialog
}

/**
 * Get the last inner dialog from Redis.
 */
export async function getLastInnerDialog(): Promise<InnerDialog | null> {
  const raw = await redis.get(POLYPHONY_LAST_DIALOG)
  if (raw == null) return null
  try {
    const parsed = InnerDialog.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
    if (!parsed.success) {
      log.warn("Inner dialog parse failed", { error: parsed.error.message })
    }
    return parsed.success ? parsed.data : null
  } catch {
    log.warn("Inner dialog JSON parse failed")
    return null
  }
}
