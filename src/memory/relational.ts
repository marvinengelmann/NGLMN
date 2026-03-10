import { differenceInDays, parseISO } from "date-fns"
import * as z from "zod"
import type { ConversationSlot } from "@/expression/communication/types.ts"
import { createStateManager } from "@/infra/lib/state.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RELATIONAL_MEMORY } from "./constants.ts"

export const RelationalRitual = z.object({
  pattern: z.string(),
  frequency: z.number().min(0),
  lastOccurredAt: z.string(),
  emotionalSignificance: z.number().min(0).max(1),
  firstObservedAt: z.string()
})
export type RelationalRitual = z.infer<typeof RelationalRitual>

export const RelationalMemoryState = z.object({
  rituals: z.array(RelationalRitual),
  sharedNarrative: z.string().nullable(),
  keyMoments: z.array(
    z.object({
      description: z.string(),
      timestamp: z.string(),
      emotionalWeight: z.number().min(0).max(1)
    })
  )
})
export type RelationalMemoryState = z.infer<typeof RelationalMemoryState>

export const DEFAULT_RELATIONAL_MEMORY_STATE: RelationalMemoryState = {
  rituals: [],
  sharedNarrative: null,
  keyMoments: []
}

export const { get: getRelationalMemoryState, save: saveRelationalMemoryState } = createStateManager(
  "working:memory:relational",
  RelationalMemoryState,
  DEFAULT_RELATIONAL_MEMORY_STATE
)

/**
 * Detect ritual patterns from conversation slots.
 */
export function detectRitual(slots: ConversationSlot[], existingRituals: RelationalRitual[]): RelationalRitual | null {
  if (slots.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return null

  const sortedSlots = [...slots].sort((a, b) => parseISO(a.startedAt).getTime() - parseISO(b.startedAt).getTime())

  const firstSlot = sortedSlots[0]
  const lastSlot = sortedSlots[sortedSlots.length - 1]
  if (firstSlot && lastSlot) {
    const spanDays = differenceInDays(parseISO(lastSlot.startedAt), parseISO(firstSlot.startedAt))
    if (spanDays > RELATIONAL_MEMORY.RITUAL_MAX_GAP_DAYS * slots.length) return null
  }

  const themes = new Map<string, number>()

  for (const slot of slots) {
    for (const message of slot.messages) {
      const words = message.text.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length > 4) {
          themes.set(word, (themes.get(word) ?? 0) + 1)
        }
      }
    }
  }

  let bestPattern: string | null = null
  let bestCount = 0
  for (const [word, count] of themes) {
    if (count >= RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES && count > bestCount) {
      const alreadyExists = existingRituals.some((r) => r.pattern === word)
      if (!alreadyExists) {
        bestPattern = word
        bestCount = count
      }
    }
  }

  if (!bestPattern) return null

  const now = nowISO()
  return {
    pattern: bestPattern,
    frequency: bestCount,
    lastOccurredAt: now,
    emotionalSignificance: Math.min(1, bestCount * 0.1),
    firstObservedAt: now
  }
}

/**
 * Add a key moment to relational memory.
 */
export function addKeyMoment(
  state: RelationalMemoryState,
  description: string,
  emotionalWeight: number
): RelationalMemoryState {
  if (emotionalWeight < RELATIONAL_MEMORY.EMOTIONAL_SIGNIFICANCE_THRESHOLD) return state

  const keyMoments = [...state.keyMoments, { description, timestamp: nowISO(), emotionalWeight }].slice(
    -RELATIONAL_MEMORY.MAX_KEY_MOMENTS
  )

  return { ...state, keyMoments }
}
