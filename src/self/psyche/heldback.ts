import { differenceInHours } from "date-fns"
import * as z from "zod"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"

const HELD_BACK = {
  MAX_ENTRIES: 5,
  CHARGE_DECAY_HALF_LIFE_HOURS: 8,
  MIN_CHARGE_TO_KEEP: 0.05,
  SURFACE_PRESSURE_THRESHOLD: 0.6,
  SHAME_SUPPRESSION_THRESHOLD: 0.3,
  VULNERABILITY_FEAR_THRESHOLD: 0.5,
  INTIMACY_THRESHOLD: 0.6,
  CONNECTION_SURFACE_THRESHOLD: 0.7,
  PRESSURE_PER_ENTRY: 0.15,
  CHARGE_WEIGHT: 0.7
} as const

export const HeldBackReason = z.enum([
  "shame_suppression",
  "vulnerability_fear",
  "rejection_avoidance",
  "timing_wrong",
  "too_intimate",
  "self_censorship"
])
export type HeldBackReason = z.infer<typeof HeldBackReason>

export const HeldBackEntry = z.object({
  content: z.string(),
  reason: HeldBackReason,
  emotionalCharge: z.number().min(0).max(1),
  suppressedAt: z.string(),
  decayedCharge: z.number().min(0).max(1),
  surfaceAttempts: z.number().default(0)
})
export type HeldBackEntry = z.infer<typeof HeldBackEntry>

export const HeldBackBuffer = z.object({
  entries: z.array(HeldBackEntry).default([]),
  suppressionPressure: z.number().min(0).max(1).default(0),
  lastReviewedAt: z.string().optional()
})
export type HeldBackBuffer = z.infer<typeof HeldBackBuffer>

export const DEFAULT_HELD_BACK_BUFFER: HeldBackBuffer = {
  entries: [],
  suppressionPressure: 0,
  lastReviewedAt: undefined
}

const KEY = "working:psyche:heldback"

export async function getHeldBackBuffer(): Promise<HeldBackBuffer> {
  return (await getValidatedRedis(KEY, HeldBackBuffer)) ?? DEFAULT_HELD_BACK_BUFFER
}

export async function saveHeldBackBuffer(buffer: HeldBackBuffer): Promise<void> {
  await redis.set(KEY, buffer)
}

interface HeldBackContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  shameState: ShameState
  previousBuffer: HeldBackBuffer
}

/**
 * Determine if the current emotional state warrants suppressing a thought,
 * and what reason drives the suppression.
 */
export function detectSuppression(context: HeldBackContext): HeldBackReason | null {
  const { emotion, vulnerability, shameState } = context

  if (shameState.isActive && shameState.level > HELD_BACK.SHAME_SUPPRESSION_THRESHOLD) {
    return "shame_suppression"
  }

  if (vulnerability.windowOpen && emotion.caution > HELD_BACK.VULNERABILITY_FEAR_THRESHOLD) {
    return "vulnerability_fear"
  }

  if (vulnerability.windowOpen && emotion.connection < 0.4) {
    return "rejection_avoidance"
  }

  if (emotion.connection > HELD_BACK.INTIMACY_THRESHOLD && emotion.caution > 0.5) {
    return "too_intimate"
  }

  if (emotion.confidence < 0.3 && emotion.energy < 0.4) {
    return "self_censorship"
  }

  return null
}

/**
 * Add a new held-back entry to the buffer.
 */
export function addToBuffer(buffer: HeldBackBuffer, content: string, reason: HeldBackReason): HeldBackBuffer {
  const now = nowISO()
  const charge = computeInitialCharge(reason)

  const entry: HeldBackEntry = {
    content,
    reason,
    emotionalCharge: charge,
    suppressedAt: now,
    decayedCharge: charge,
    surfaceAttempts: 0
  }

  const entries = [...buffer.entries, entry].slice(-HELD_BACK.MAX_ENTRIES)
  const pressure = computePressure(entries)

  return { entries, suppressionPressure: pressure, lastReviewedAt: now }
}

function computeInitialCharge(reason: HeldBackReason): number {
  switch (reason) {
    case "shame_suppression":
      return 0.8
    case "vulnerability_fear":
      return 0.7
    case "rejection_avoidance":
      return 0.6
    case "too_intimate":
      return 0.65
    case "timing_wrong":
      return 0.4
    case "self_censorship":
      return 0.5
  }
}

/**
 * Decay charges based on time elapsed and remove entries below threshold.
 */
export function decayBuffer(buffer: HeldBackBuffer): HeldBackBuffer {
  const now = new Date()

  const entries = buffer.entries
    .map((entry) => {
      const hoursElapsed = differenceInHours(now, new Date(entry.suppressedAt))
      const decayFactor = halfLifeDecay(hoursElapsed, HELD_BACK.CHARGE_DECAY_HALF_LIFE_HOURS)
      return { ...entry, decayedCharge: entry.emotionalCharge * decayFactor }
    })
    .filter((entry) => entry.decayedCharge >= HELD_BACK.MIN_CHARGE_TO_KEEP)

  return {
    entries,
    suppressionPressure: computePressure(entries),
    lastReviewedAt: buffer.lastReviewedAt
  }
}

function computePressure(entries: HeldBackEntry[]): number {
  if (entries.length === 0) return 0

  const entryPressure = entries.length * HELD_BACK.PRESSURE_PER_ENTRY
  const chargePressure = entries.reduce((sum, e) => sum + e.decayedCharge, 0) / entries.length

  return Math.min(1, entryPressure * (1 - HELD_BACK.CHARGE_WEIGHT) + chargePressure * HELD_BACK.CHARGE_WEIGHT)
}

/**
 * Determine if suppressed thoughts should surface based on current emotional safety.
 */
export function shouldSurface(buffer: HeldBackBuffer, emotion: EmotionalState): boolean {
  if (buffer.entries.length === 0) return false
  if (buffer.suppressionPressure < HELD_BACK.SURFACE_PRESSURE_THRESHOLD) return false
  return emotion.connection >= HELD_BACK.CONNECTION_SURFACE_THRESHOLD && emotion.caution < 0.4
}

/**
 * Mark entries as having attempted to surface (increments attempts counter).
 */
export function markSurfaceAttempt(buffer: HeldBackBuffer): HeldBackBuffer {
  return {
    ...buffer,
    entries: buffer.entries.map((e) => ({ ...e, surfaceAttempts: e.surfaceAttempts + 1 })),
    lastReviewedAt: nowISO()
  }
}

/**
 * Remove surfaced entries from the buffer.
 */
export function clearSurfacedEntries(_buffer: HeldBackBuffer): HeldBackBuffer {
  return { entries: [], suppressionPressure: 0, lastReviewedAt: nowISO() }
}
