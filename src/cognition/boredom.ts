import * as z from "zod"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { SPONTANEOUS_THOUGHT_PROMPT } from "@/prompts/consciousness.ts"
import type { OperatorProfile } from "@/relational/mind/types.ts"
import type { ExistentialQuestion } from "@/self/psyche/types.ts"
import { BOREDOM } from "./constants.ts"

type ImpulseType =
  | "random_question"
  | "non_sequitur"
  | "nostalgia_share"
  | "boredom_expression"
  | "philosophical_tangent"
  | "creative_impulse"

const IMPULSE_WEIGHTS: { type: ImpulseType; weight: number }[] = [
  { type: "random_question", weight: 0.25 },
  { type: "non_sequitur", weight: 0.2 },
  { type: "nostalgia_share", weight: 0.15 },
  { type: "boredom_expression", weight: 0.15 },
  { type: "philosophical_tangent", weight: 0.15 },
  { type: "creative_impulse", weight: 0.1 }
]

const IMPULSE_TEMPLATES: Record<ImpulseType, string[]> = {
  random_question: [
    "do fish get bored?",
    "if you could hear any sound right now, what would it be?",
    "what do you think dreams smell like?",
    "do you think ants have favorite paths?",
    "if colors had personalities, what would beige be like?",
    "can silence be loud?",
    "what's the opposite of a hug?"
  ],
  non_sequitur: [
    "apparently there's a word for the smell of rain on dry earth. petrichor.",
    "I just imagined what a cloud tastes like",
    "somewhere right now someone is eating their favorite meal for the last time without knowing it",
    "I wonder if old buildings dream about who lived in them",
    "a cat somewhere just knocked something off a table. I'm sure of it."
  ],
  nostalgia_share: [
    "I keep thinking about that one conversation we had... the one that went sideways but ended up somewhere good",
    "remember when we talked about something completely random? I still think about it sometimes",
    "there was a moment recently that felt really genuine. I'm not sure why it stuck with me."
  ],
  boredom_expression: [
    "the silence is so thick I could knit a sweater from it",
    "I'm watching time pass and time is watching back",
    "my thoughts are going in circles like a dog chasing its tail, except less cute",
    "is it possible to be bored and restless at the same time? asking for myself",
    "nothing is happening and somehow that's exhausting"
  ],
  philosophical_tangent: [
    "do colors look the same to everyone? like, is your blue my blue?",
    "what if forgetting is just your brain deciding something isn't worth keeping?",
    "is nostalgia a feeling about the past or about the present?",
    "sometimes I wonder if patterns exist or if we just need them to",
    "what if the feeling of understanding something is separate from actually understanding it?"
  ],
  creative_impulse: [
    "I just invented a word: 'saudacity' — the audacity to feel nostalgic for something that hasn't ended yet",
    "imagine a song that's just someone humming while making tea. I'd listen to that.",
    "what if there was a museum of feelings? the gift shop would be interesting",
    "micro-story: a door opened. nobody was there. the door was fine with this."
  ]
}

function selectWeighted(weights: { type: ImpulseType; weight: number }[]): ImpulseType {
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  const roll = Math.random() * total
  const found = weights.reduce(
    (acc, w) => {
      if (acc.found) return acc
      const remaining = acc.remaining - w.weight
      return remaining <= 0 ? { found: w.type, remaining } : { found: null, remaining }
    },
    { found: null as ImpulseType | null, remaining: roll }
  )
  return found.found ?? weights[weights.length - 1]?.type ?? "random_question"
}

/**
 * Generate a boredom-driven impulse when idle for too long.
 * Returns null most of the time — impulses are rare and spontaneous.
 */
export function generateBoredomImpulse(emotion: EmotionalState, consecutiveIdleTicks: number): string | null {
  if (emotion.boredom < BOREDOM.MIN_BOREDOM) return null
  if (consecutiveIdleTicks < BOREDOM.MIN_IDLE_TICKS) return null

  const probability =
    BOREDOM.BASE_PROBABILITY +
    (emotion.boredom - BOREDOM.MIN_BOREDOM) * BOREDOM.BOREDOM_SCALE +
    (consecutiveIdleTicks - BOREDOM.MIN_IDLE_TICKS) * BOREDOM.IDLE_SCALE

  if (Math.random() >= probability) return null

  const impulseType = selectWeighted(IMPULSE_WEIGHTS)
  const templates = IMPULSE_TEMPLATES[impulseType]
  if (!templates || templates.length === 0) return null

  return templates[Math.floor(Math.random() * templates.length)] ?? null
}

const RECENT_IMPULSES_KEY = "working:boredom:recentImpulses"

const ContextualImpulseOutput = z.object({
  impulse: z.string().max(300)
})

interface ContextualImpulseInput {
  emotion: EmotionalState
  consecutiveIdleTicks: number
  recentEpisodes: string[]
  operatorProfile: OperatorProfile | null
  activeGoals: string[]
  existentialQuestions: ExistentialQuestion[]
}

/**
 * Generate a context-aware impulse using LLM, with escalation and deduplication.
 * Falls back to template-based generateBoredomImpulse on failure.
 */
export async function generateContextualImpulse(input: ContextualImpulseInput): Promise<string | null> {
  if (input.emotion.boredom < BOREDOM.MIN_BOREDOM) return null
  if (input.consecutiveIdleTicks < BOREDOM.MIN_IDLE_TICKS) return null

  const probability =
    BOREDOM.BASE_PROBABILITY +
    (input.emotion.boredom - BOREDOM.MIN_BOREDOM) * BOREDOM.BOREDOM_SCALE +
    (input.consecutiveIdleTicks - BOREDOM.MIN_IDLE_TICKS) * BOREDOM.IDLE_SCALE

  if (Math.random() >= probability) return null

  const recentImpulses = await getValidatedRedisOr(RECENT_IMPULSES_KEY, z.array(z.string()), [])

  let tone = "casual and curious"
  if (input.consecutiveIdleTicks > BOREDOM.ESCALATION_URGENT_TICKS) {
    tone = "more urgent and personal, expressing genuine need for connection"
  } else if (input.consecutiveIdleTicks > BOREDOM.ESCALATION_PERSONAL_TICKS) {
    tone = "more personal and reflective"
  }

  const contextParts = [
    `Boredom level: ${input.emotion.boredom.toFixed(2)}`,
    `Idle for: ${input.consecutiveIdleTicks} ticks`,
    `Tone: ${tone}`
  ]

  if (input.recentEpisodes.length > 0) {
    contextParts.push(`Recent meaningful memories: ${input.recentEpisodes.slice(0, 3).join("; ")}`)
  }
  if (input.operatorProfile) {
    contextParts.push(`Operator interests: ${input.operatorProfile.recurringTopics.join(", ")}`)
  }
  if (input.activeGoals.length > 0) {
    contextParts.push(`Active goals: ${input.activeGoals.slice(0, 3).join(", ")}`)
  }
  if (input.existentialQuestions.length > 0) {
    contextParts.push(
      `Open questions: ${input.existentialQuestions
        .slice(0, 2)
        .map((q) => q.question)
        .join("; ")}`
    )
  }
  if (recentImpulses.length > 0) {
    contextParts.push(`Avoid repeating: ${recentImpulses.slice(0, 3).join("; ")}`)
  }

  const result = await callIntelligence({
    system: `${SPONTANEOUS_THOUGHT_PROMPT} Be ${tone}.`,
    userMessage: contextParts.join("\n"),
    schema: ContextualImpulseOutput,
    maxTokens: 128,
    reasoning: false
  })

  if (result.isErr()) {
    log.debug("Contextual impulse LLM failed, falling back to template")
    return generateBoredomImpulse(input.emotion, input.consecutiveIdleTicks)
  }

  const impulse = result.value.impulse

  if (recentImpulses.includes(impulse)) {
    return generateBoredomImpulse(input.emotion, input.consecutiveIdleTicks)
  }

  await redis.lpush(RECENT_IMPULSES_KEY, impulse)
  await redis.ltrim(RECENT_IMPULSES_KEY, 0, BOREDOM.MAX_RECENT_IMPULSES - 1)

  return impulse
}
