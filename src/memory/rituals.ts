import { getDay, getHours, parseISO } from "date-fns"
import type { ConversationSlot } from "@/expression/communication/types.ts"
import { levenshteinRatio } from "@/infra/lib/similarity.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { RELATIONAL_MEMORY } from "./constants.ts"
import type { RelationalRitual } from "./types.ts"

interface DetectedRitual {
  type: "temporal" | "phrase" | "behavioral"
  pattern: string
  variants?: string[]
  timeWindow?: { hour: number; dayOfWeek?: number }
  frequency: number
  lastOccurredAt: string
  firstObservedAt: string
  emotionalSignificance: number
  confidence: number
}

function detectTemporalPatterns(slots: ConversationSlot[]): DetectedRitual[] {
  if (slots.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return []

  const rituals: DetectedRitual[] = []
  const hourBuckets = new Map<number, string[]>()
  const dayBuckets = new Map<number, string[]>()

  slots.forEach((slot) => {
    const date = parseISO(slot.startedAt)
    const hour = getHours(date)
    const bucket = Math.floor(hour / 2)
    const day = getDay(date)

    const hourSlots = hourBuckets.get(bucket) ?? []
    hourSlots.push(slot.startedAt)
    hourBuckets.set(bucket, hourSlots)

    const daySlots = dayBuckets.get(day) ?? []
    daySlots.push(slot.startedAt)
    dayBuckets.set(day, daySlots)
  })

  hourBuckets.forEach((timestamps, bucket) => {
    if (timestamps.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return

    const startHour = bucket * 2
    const timeLabel = startHour < 6 ? "night" : startHour < 12 ? "morning" : startHour < 18 ? "afternoon" : "evening"

    rituals.push({
      type: "temporal",
      pattern: `${timeLabel}_conversation`,
      timeWindow: { hour: startHour },
      frequency: timestamps.length,
      lastOccurredAt: timestamps.sort().at(-1) ?? nowISO(),
      firstObservedAt: timestamps.sort()[0] ?? nowISO(),
      emotionalSignificance: Math.min(1, timestamps.length * 0.1),
      confidence: Math.min(1, timestamps.length * 0.15)
    })
  })

  dayBuckets.forEach((timestamps, day) => {
    if (timestamps.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    rituals.push({
      type: "temporal",
      pattern: `${dayNames[day]}_ritual`,
      timeWindow: { hour: 0, dayOfWeek: day },
      frequency: timestamps.length,
      lastOccurredAt: timestamps.sort().at(-1) ?? nowISO(),
      firstObservedAt: timestamps.sort()[0] ?? nowISO(),
      emotionalSignificance: Math.min(1, timestamps.length * 0.08),
      confidence: Math.min(1, timestamps.length * 0.12)
    })
  })

  return rituals
}

function detectPhrasePatterns(slots: ConversationSlot[]): DetectedRitual[] {
  if (slots.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return []

  const ngramSlotMap = new Map<string, Set<string>>()

  slots.forEach((slot) => {
    slot.messages
      .filter((m) => m.role === "operator")
      .forEach((msg) => {
        const words = msg.text.toLowerCase().split(/\s+/).filter(Boolean)

        words.slice(0, -1).forEach((_, i) => {
          const bigram = `${words[i]} ${words[i + 1]}`
          const slotSet = ngramSlotMap.get(bigram) ?? new Set()
          slotSet.add(slot.id)
          ngramSlotMap.set(bigram, slotSet)
        })

        words.slice(0, -2).forEach((_, i) => {
          const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
          const slotSet = ngramSlotMap.get(trigram) ?? new Set()
          slotSet.add(slot.id)
          ngramSlotMap.set(trigram, slotSet)
        })
      })
  })

  const candidates: Array<{ phrase: string; slotCount: number; totalCount: number }> = [...ngramSlotMap.entries()]
    .filter(([_, slotIds]) => slotIds.size >= RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES)
    .map(([phrase, slotIds]) => ({ phrase, slotCount: slotIds.size, totalCount: slotIds.size }))

  candidates.sort((a, b) => b.slotCount - a.slotCount)

  const rituals: DetectedRitual[] = []
  const usedPhrases = new Set<string>()

  candidates.forEach((candidate) => {
    if (usedPhrases.has(candidate.phrase)) return

    const variants: string[] = [candidate.phrase]
    candidates.forEach((other) => {
      if (other.phrase === candidate.phrase) return
      if (usedPhrases.has(other.phrase)) return
      if (levenshteinRatio(candidate.phrase, other.phrase) > 0.7) {
        variants.push(other.phrase)
        usedPhrases.add(other.phrase)
      }
    })
    usedPhrases.add(candidate.phrase)

    rituals.push({
      type: "phrase",
      pattern: candidate.phrase,
      variants: variants.length > 1 ? variants : undefined,
      frequency: candidate.slotCount,
      lastOccurredAt: nowISO(),
      firstObservedAt: nowISO(),
      emotionalSignificance: Math.min(1, candidate.slotCount * 0.12),
      confidence: Math.min(1, candidate.slotCount * 0.15)
    })
  })

  return rituals
}

function detectBehavioralPatterns(slots: ConversationSlot[]): DetectedRitual[] {
  if (slots.length < RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) return []

  const rituals: DetectedRitual[] = []

  let voiceStartCount = 0
  let imageCount = 0
  const themeCounts = new Map<string, number>()

  slots.forEach((slot) => {
    const firstOperatorMsg = slot.messages.find((m) => m.role === "operator")
    if (firstOperatorMsg?.isVoice) voiceStartCount++

    const hasImage = slot.messages.some((m) => m.role === "operator" && m.hasImage)
    if (hasImage) imageCount++

    slot.climate?.themes?.forEach((theme) => {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
    })
  })

  if (voiceStartCount >= RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) {
    rituals.push({
      type: "behavioral",
      pattern: "voice_message_ritual",
      frequency: voiceStartCount,
      lastOccurredAt: nowISO(),
      firstObservedAt: nowISO(),
      emotionalSignificance: Math.min(1, voiceStartCount * 0.15),
      confidence: Math.min(1, voiceStartCount * 0.2)
    })
  }

  if (imageCount >= RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) {
    rituals.push({
      type: "behavioral",
      pattern: "photo_sharing_ritual",
      frequency: imageCount,
      lastOccurredAt: nowISO(),
      firstObservedAt: nowISO(),
      emotionalSignificance: Math.min(1, imageCount * 0.12),
      confidence: Math.min(1, imageCount * 0.18)
    })
  }

  themeCounts.forEach((count, theme) => {
    if (count >= RELATIONAL_MEMORY.RITUAL_MIN_OCCURRENCES) {
      rituals.push({
        type: "behavioral",
        pattern: `theme_${theme}`,
        frequency: count,
        lastOccurredAt: nowISO(),
        firstObservedAt: nowISO(),
        emotionalSignificance: Math.min(1, count * 0.1),
        confidence: Math.min(1, count * 0.12)
      })
    }
  })

  return rituals
}

function mergeWithExisting(newRituals: DetectedRitual[], existing: RelationalRitual[]): RelationalRitual[] {
  const merged: RelationalRitual[] = []
  const matchedExistingPatterns = new Set<string>()

  newRituals.forEach((ritual) => {
    const existingMatch = existing.find(
      (e) => e.pattern === ritual.pattern || (ritual.variants?.includes(e.pattern) ?? false)
    )

    if (existingMatch) {
      matchedExistingPatterns.add(existingMatch.pattern)
      merged.push({
        ...existingMatch,
        type: ritual.type,
        frequency: ritual.frequency,
        lastOccurredAt: ritual.lastOccurredAt,
        confidence: Math.min(1, existingMatch.confidence + 0.1),
        emotionalSignificance: Math.max(existingMatch.emotionalSignificance, ritual.emotionalSignificance),
        variants: ritual.variants,
        timeWindow: ritual.timeWindow
      })
    } else {
      merged.push({
        type: ritual.type,
        pattern: ritual.pattern,
        variants: ritual.variants,
        timeWindow: ritual.timeWindow,
        frequency: ritual.frequency,
        lastOccurredAt: ritual.lastOccurredAt,
        firstObservedAt: ritual.firstObservedAt,
        emotionalSignificance: ritual.emotionalSignificance,
        confidence: ritual.confidence
      })
    }
  })

  existing
    .filter((existing_) => !matchedExistingPatterns.has(existing_.pattern))
    .forEach((existing_) => {
      merged.push({
        ...existing_,
        confidence: Math.max(0, existing_.confidence - 0.05)
      })
    })

  return merged
    .filter((r) => r.confidence > 0.05)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, RELATIONAL_MEMORY.MAX_RITUALS)
}

/**
 * Detect rituals across three layers: temporal patterns, phrase n-grams, and behavioral signals.
 * Merges newly detected rituals with existing ones, growing/decaying confidence.
 */
export function detectRituals(slots: ConversationSlot[], existingRituals: RelationalRitual[]): RelationalRitual[] {
  const temporal = detectTemporalPatterns(slots)
  const phrase = detectPhrasePatterns(slots)
  const behavioral = detectBehavioralPatterns(slots)

  const allNew = [...temporal, ...phrase, ...behavioral]
  return mergeWithExisting(allNew, existingRituals)
}

