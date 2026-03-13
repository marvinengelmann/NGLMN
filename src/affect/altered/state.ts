import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { ALTERED_STATE } from "./constants.ts"
import { ALTERED_EVENT_PROFILES } from "./profiles.ts"
import { ActiveAlteredEvent, type AlteredEventType } from "./types.ts"

const ALTERED_STATE_KEY = "working:altered:state"

/**
 * Get the currently active altered event, or null if none.
 */
export async function getActiveAlteredState(): Promise<ActiveAlteredEvent | null> {
  return getValidatedRedis(ALTERED_STATE_KEY, ActiveAlteredEvent)
}

/**
 * Start a new altered event. Sets Redis key with TTL = total duration + buffer.
 */
export async function startAlteredState(substance: AlteredEventType, triggeredByEvent?: string): Promise<void> {
  const profile = ALTERED_EVENT_PROFILES[substance]
  const totalMinutes =
    profile.timing.onset +
    profile.timing.peak +
    profile.timing.plateau +
    profile.timing.comedown +
    profile.timing.aftereffect
  const ttlSeconds = (totalMinutes + ALTERED_STATE.REDIS_TTL_BUFFER_MINUTES) * 60

  const state: ActiveAlteredEvent = {
    substance,
    startedAt: new Date().toISOString(),
    timing: profile.timing,
    triggeredByEvent
  }

  await redis.set(ALTERED_STATE_KEY, state, { ex: ttlSeconds })
  log.info("Altered state started", { substance, totalMinutes, triggeredByEvent })
}
