import { redis } from "@/integrations/redis.ts"

const KEY = "working:psyche:existentialQuestions"
const MAX_QUESTIONS = 7

/**
 * Get current existential questions ANIMA carries.
 */
export async function getExistentialQuestions(): Promise<string[]> {
  const raw = await redis.get<string[]>(KEY)
  return raw ?? []
}

/**
 * Add an existential question. Evicts the oldest if at capacity.
 */
export async function addExistentialQuestion(question: string): Promise<void> {
  const current = await getExistentialQuestions()
  if (current.includes(question)) return
  current.push(question)
  if (current.length > MAX_QUESTIONS) current.shift()
  await redis.set(KEY, current)
}
