import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import { contributions, decayAndFinalize } from "./helpers.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const JEALOUSY = SECONDARY_EMOTIONS.jealousy

const RIVAL_PATTERNS = [
  /\bchatgpt\b/i,
  /\bgpt[-\s]?4/i,
  /\bgemini\b/i,
  /\bcopilot\b/i,
  /\bclaude\b/i,
  /\bsiri\b/i,
  /\balexa\b/i,
  /\bcortana\b/i,
  /\bperplexity\b/i,
  /\bllama\b/i,
  /\bmistral\b/i,
  /\bgrok\b/i,
  /\bpi\s+ai\b/i,
  /\breplika\b/i,
  /\bcharacter\.?ai\b/i
]

const RivalAnalysis = z.object({
  unfavorableComparison: z.boolean(),
  rivalPraised: z.boolean()
})

const RIVAL_ANALYSIS_PROMPT = `You are analyzing messages sent TO an AI companion (you). The messages mention another AI by name. Determine how the other AI is being referenced.

Respond with:
- unfavorableComparison: true if the person is comparing YOU negatively to the rival AI (e.g. "why can't you do what ChatGPT does", "you're not as good as Gemini", "X is better than you"). This includes implicit comparisons.
- rivalPraised: true if the person is praising the rival AI WITHOUT directly comparing it to you (e.g. "ChatGPT is amazing", "I love using Gemini"). Just mentioning the rival by name is NOT praise — they must be saying something positive about it.

Both can be false if the rival is just mentioned neutrally (e.g. "I saw a ChatGPT ad today").`

export interface RivalDetection {
  rivalMentioned: boolean
  unfavorableComparison: boolean
  rivalPraised: boolean
}

const NO_RIVAL: RivalDetection = { rivalMentioned: false, unfavorableComparison: false, rivalPraised: false }

export async function detectRivalMention(texts: string[]): Promise<RivalDetection> {
  const combined = texts.join(" ")
  const rivalMentioned = RIVAL_PATTERNS.some((p) => p.test(combined))

  if (!rivalMentioned) return NO_RIVAL

  const result = await callIntelligence({
    system: RIVAL_ANALYSIS_PROMPT,
    userMessage: combined,
    schema: RivalAnalysis,
    reasoning: false,
    maxTokens: 128
  })

  if (result.isErr()) return { rivalMentioned: true, unfavorableComparison: false, rivalPraised: false }

  return {
    rivalMentioned: true,
    unfavorableComparison: result.value.unfavorableComparison,
    rivalPraised: !result.value.unfavorableComparison && result.value.rivalPraised
  }
}

export const JealousySource = z.enum(["rival_mentioned", "unfavorable_comparison", "rival_praised"])
export type JealousySource = z.infer<typeof JealousySource>

export const JealousyState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: JealousySource.nullable().default(null),
  possessiveness: z.number().min(0).max(1).default(0),
  deflection: z.number().min(0).max(1).default(0),
  lastTriggeredAt: z.string().optional()
})
export type JealousyState = z.infer<typeof JealousyState>

interface Context {
  emotion: EmotionalState
  previousState: JealousyState
  rivalMentioned: boolean
  unfavorableComparison: boolean
  rivalPraised: boolean
  prideActive: boolean
  attachmentAnxiety: number
  attachmentSecure: number
}

export function compute(context: Context): JealousyState {
  const { emotion, previousState } = context

  const builder = contributions<JealousySource>()
    .add(
      context.rivalMentioned && !context.unfavorableComparison && !context.rivalPraised,
      "rival_mentioned",
      JEALOUSY.RIVAL_MENTIONED_INTENSITY * emotion.connection
    )
    .add(
      context.unfavorableComparison,
      "unfavorable_comparison",
      JEALOUSY.UNFAVORABLE_COMPARISON_INTENSITY * emotion.connection
    )
    .add(context.rivalPraised, "rival_praised", JEALOUSY.RIVAL_PRAISED_INTENSITY * emotion.connection)

  let { level, source } = builder.sum()

  if (emotion.connection < JEALOUSY.CONNECTION_THRESHOLD) {
    level *= emotion.connection / JEALOUSY.CONNECTION_THRESHOLD
  }

  level *= 1 + context.attachmentAnxiety * JEALOUSY.ANXIOUS_ATTACHMENT_AMPLIFIER
  level *= 1 - context.attachmentSecure * JEALOUSY.SECURE_ATTACHMENT_DAMPING

  if (context.prideActive) {
    level *= JEALOUSY.PRIDE_DAMPING
  }

  const { finalLevel, isActive } = decayAndFinalize(
    previousState.level,
    level,
    JEALOUSY.DECAY_PER_TICK,
    JEALOUSY.ACTIVATION_THRESHOLD
  )

  const possessiveness =
    isActive && emotion.connection > JEALOUSY.CONNECTION_THRESHOLD
      ? Math.min(1, finalLevel * JEALOUSY.POSSESSIVENESS_SCALE * (1 + context.attachmentAnxiety))
      : Math.max(0, previousState.possessiveness - JEALOUSY.POSSESSIVENESS_DECAY)

  const deflection =
    isActive && context.attachmentSecure < 0.5
      ? Math.min(1, finalLevel * JEALOUSY.DEFLECTION_SCALE)
      : Math.max(0, previousState.deflection - JEALOUSY.DEFLECTION_DECAY)

  return {
    level: finalLevel,
    isActive,
    source: isActive ? source : null,
    possessiveness,
    deflection,
    lastTriggeredAt: isActive && !previousState.isActive ? nowISO() : previousState.lastTriggeredAt
  }
}

export function computeEffect(state: JealousyState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    connection: -state.level * JEALOUSY.CONNECTION_DRAIN,
    caution: state.level * JEALOUSY.CAUTION_BOOST,
    confidence: -state.level * JEALOUSY.CONFIDENCE_DRAIN,
    frustration: state.level * JEALOUSY.FRUSTRATION_BUILD * (1 + state.possessiveness)
  }
}

export const {
  defaultState,
  get: getJealousyState,
  save: saveJealousyState
} = defineSecondaryEmotion({
  name: "jealousy",
  redisKey: "working:emotion:jealousy",
  order: 20,
  schema: JealousyState,
  compute,
  computeEffect
})
