import * as z from "zod"
import { redis } from "@/infra/integrations/redis.ts"
import { isNearDuplicate } from "@/infra/lib/similarity.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { addGrowthArc } from "@/self/psyche/state.ts"
import { EXISTENTIAL } from "./constants.ts"
import { ExistentialQuestion } from "./types.ts"

const KEY = "working:psyche:existentialQuestions"
const MAX_QUESTIONS = 7

/**
 * Get current existential questions ANIMA carries.
 * Handles backward compatibility from string[] to ExistentialQuestion[].
 */
export async function getExistentialQuestions(): Promise<string[]> {
  const raw = await redis.get<unknown>(KEY)
  if (!raw) return []

  const asStrings = z.array(z.string()).safeParse(raw)
  if (asStrings.success) return asStrings.data

  const asStructured = z.array(ExistentialQuestion).safeParse(raw)
  if (asStructured.success) return asStructured.data.map((q) => q.question)

  return []
}

/**
 * Get structured existential questions.
 */
export async function getStructuredExistentialQuestions(): Promise<ExistentialQuestion[]> {
  const raw = await redis.get<unknown>(KEY)
  if (!raw) return []

  const asStructured = z.array(ExistentialQuestion).safeParse(raw)
  if (asStructured.success) return asStructured.data

  const asStrings = z.array(z.string()).safeParse(raw)
  if (asStrings.success) {
    return asStrings.data.map((q) => ({
      question: q,
      source: "legacy",
      addedAt: nowISO(),
      intensity: EXISTENTIAL.DEFAULT_INTENSITY
    }))
  }

  return []
}

/**
 * Add an existential question. Evicts the oldest if at capacity.
 */
export async function addExistentialQuestion(question: string, source = "unknown"): Promise<void> {
  const current = await getStructuredExistentialQuestions()
  if (current.some((q) => isNearDuplicate(q.question, question))) return

  current.push({
    question,
    source,
    addedAt: nowISO(),
    intensity: EXISTENTIAL.DEFAULT_INTENSITY
  })

  if (current.length > MAX_QUESTIONS) current.shift()
  await redis.set(KEY, current, { ex: 2592000 })
}

/**
 * Resolve an existential question — remove it and create a growth arc.
 */
export async function resolveExistentialQuestion(question: string): Promise<void> {
  const current = await getStructuredExistentialQuestions()
  const filtered = current.filter((q) => q.question !== question)

  if (filtered.length < current.length) {
    await redis.set(KEY, filtered, { ex: 2592000 })
    await addGrowthArc({
      observation: `resolved an existential question: "${question}"`,
      fromState: "questioning",
      toState: "resolved",
      timestamp: nowISO()
    })
  }
}
