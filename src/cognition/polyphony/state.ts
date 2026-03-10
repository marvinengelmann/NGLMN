import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { InnerDialog, InnerVoice } from "./types.ts"

const POLYPHONY_LAST_DIALOG = "working:polyphony:lastDialog"
const DOMINANCE_HISTORY_KEY = "working:polyphony:voiceDominanceHistory"
const MAX_DOMINANCE_HISTORY = 50

/**
 * Get the last inner dialog from Redis, validated against the InnerDialog schema.
 */
export async function getLastInnerDialog(): Promise<InnerDialog | null> {
  return getValidatedRedis(POLYPHONY_LAST_DIALOG, InnerDialog)
}

/**
 * Save an inner dialog to Redis and update the voice dominance history.
 */
export async function saveInnerDialog(dialog: InnerDialog): Promise<void> {
  await redis.set(POLYPHONY_LAST_DIALOG, dialog, { ex: 3600 })

  if (dialog.dominantVoice) {
    await redis.lpush(DOMINANCE_HISTORY_KEY, dialog.dominantVoice)
    await redis.ltrim(DOMINANCE_HISTORY_KEY, 0, MAX_DOMINANCE_HISTORY - 1)
  }
}

/**
 * Get the voice dominance history from Redis as validated InnerVoice values.
 */
export async function getDominanceHistory(): Promise<InnerVoice[]> {
  const raw = await redis.lrange(DOMINANCE_HISTORY_KEY, 0, -1)
  return raw
    .map((v) => InnerVoice.safeParse(v))
    .filter((r) => r.success)
    .map((r) => r.data)
}
