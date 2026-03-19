import { redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { HEBBIAN } from "./constants.ts"
import type { HebbianAssociation } from "./types.ts"

const KEYS = {
  STIMULI_HISTORY: "working:learning:stimuli_history",
  ACTIVE_ASSOCIATIONS: "working:learning:active_associations"
} as const

/**
 * Get cached active associations from Redis.
 */
export async function getActiveAssociations(): Promise<HebbianAssociation[]> {
  const raw = await redis.get<HebbianAssociation[]>(KEYS.ACTIVE_ASSOCIATIONS)
  return raw ?? []
}

/**
 * Save active associations to Redis for fast pipeline access.
 */
export async function saveActiveAssociations(associations: HebbianAssociation[], buffer?: WriteBuffer): Promise<void> {
  const top = associations
    .filter((a) => a.strength >= HEBBIAN.ACTIVATION_THRESHOLD)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 50)
  if (buffer) {
    buffer.stageWithExpiry(KEYS.ACTIVE_ASSOCIATIONS, top, 3600)
  } else {
    await redis.set(KEYS.ACTIVE_ASSOCIATIONS, top, { ex: 3600 })
  }
}

/**
 * Get recent stimuli history (ring buffer of last N ticks).
 */
export async function getRecentStimuliHistory(): Promise<string[][]> {
  const raw = await redis.get<string[][]>(KEYS.STIMULI_HISTORY)
  return raw ?? []
}

/**
 * Push current tick's stimuli into the ring buffer.
 */
export async function pushStimuliHistory(stimuli: string[], buffer?: WriteBuffer): Promise<void> {
  const history = await getRecentStimuliHistory()
  history.push(stimuli)
  const trimmed = history.slice(-HEBBIAN.COACTIVATION_WINDOW_TICKS * 2)
  if (buffer) {
    buffer.stage(KEYS.STIMULI_HISTORY, trimmed)
  } else {
    await redis.set(KEYS.STIMULI_HISTORY, trimmed, { ex: 3600 })
  }
}
