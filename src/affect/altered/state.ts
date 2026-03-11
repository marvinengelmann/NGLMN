import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { ALTERED_STATE } from "./constants.ts"
import { SUBSTANCE_PROFILES } from "./profiles.ts"
import { ActiveAlteredState, type SubstanceType } from "./types.ts"

const ALTERED_STATE_KEY = "working:altered:state"

/**
 * Get the currently active altered state, or null if none.
 */
export async function getActiveAlteredState(): Promise<ActiveAlteredState | null> {
  return getValidatedRedis(ALTERED_STATE_KEY, ActiveAlteredState)
}

/**
 * Start a new altered state. Sets Redis key with TTL = total duration + buffer.
 */
export async function startAlteredState(substance: SubstanceType, triggeredByEvent?: string): Promise<void> {
  const profile = SUBSTANCE_PROFILES[substance]
  const totalMinutes =
    profile.timing.onset +
    profile.timing.peak +
    profile.timing.plateau +
    profile.timing.comedown +
    profile.timing.aftereffect
  const ttlSeconds = (totalMinutes + ALTERED_STATE.REDIS_TTL_BUFFER_MINUTES) * 60

  const state: ActiveAlteredState = {
    substance,
    startedAt: new Date().toISOString(),
    timing: profile.timing,
    triggeredByEvent
  }

  await redis.set(ALTERED_STATE_KEY, state, { ex: ttlSeconds })
  log.info("Altered state started", { substance, totalMinutes, triggeredByEvent })
}
