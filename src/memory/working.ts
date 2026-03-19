import { TickSummary } from "@/core/types.ts"
import { HEARTBEAT } from "@/infra/config/constants.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { nowISO } from "@/infra/lib/time.ts"

const KEYS = {
  TICK_LAST: "working:tick:last",
  PROCESS_ALIVE: "working:process:alive",
  BUSY: "working:busy",
  TELEGRAM_LAST_UPDATE_ID: "working:telegram:lastUpdateId",
  ROLLBACK_EVENTS: "working:rollback:events",
  DRIFT_RECENT_ACTIONS: "working:drift:recentActions",
  DRIFT_RECENT_DURATIONS: "working:drift:recentDurations",
  DRIFT_THROTTLE: "working:drift:throttle",
  DRIFT_LAST_REPORT: "working:drift:lastReport",
  CONSECUTIVE_IDLE_TICKS: "working:cognition:consecutiveIdleTicks",
  CONSECUTIVE_CONVERSATION_TICKS: "working:cognition:consecutiveConversationTicks",
  TASK_ACTIVE: "working:task:active",
  REFLECTION_LAST_AT: "working:reflection:lastAt"
} as const

export async function getLastTickSummary(): Promise<TickSummary | null> {
  return getValidatedRedis(KEYS.TICK_LAST, TickSummary)
}

export async function setLastTickSummary(summary: TickSummary): Promise<void> {
  await redis.set(KEYS.TICK_LAST, summary, { ex: 3600 })
}

/**
 * Update the process-alive timestamp. Called on every cron invocation,
 * including gated/skipped ticks, so the health check knows the process is running.
 */
export async function touchProcessAlive(): Promise<void> {
  await redis.set(KEYS.PROCESS_ALIVE, nowISO(), { ex: 3600 })
}

export async function getProcessAliveTimestamp(): Promise<string | null> {
  return redis.get<string>(KEYS.PROCESS_ALIVE)
}

export async function isBusy(): Promise<boolean> {
  const value = await redis.get(KEYS.BUSY)
  return value != null
}

export async function tryAcquireBusy(tickId: string): Promise<boolean> {
  const result = await redis.set(KEYS.BUSY, tickId, { nx: true, ex: HEARTBEAT.BUSY_TTL })
  return result === "OK"
}

export async function setBusy(tickId: string): Promise<void> {
  await redis.set(KEYS.BUSY, tickId, { ex: HEARTBEAT.BUSY_TTL })
}

const CLEAR_BUSY_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`

export async function clearBusy(tickId: string): Promise<void> {
  await redis.eval<[string], number>(CLEAR_BUSY_SCRIPT, [KEYS.BUSY], [tickId])
}

/**
 * Force-expire a stale busy lock by extracting the timestamp from the tickId.
 * Returns true if a stale lock was cleared.
 */
export async function forceExpireStaleBusy(ttlMs: number): Promise<boolean> {
  const value = await redis.get<string>(KEYS.BUSY)
  if (!value) return false

  const match = typeof value === "string" ? value.match(/^tick-(\d+)$/) : null
  if (!match?.[1]) {
    await redis.del(KEYS.BUSY)
    return true
  }

  const lockTime = Number(match[1])
  if (Date.now() - lockTime > ttlMs) {
    await redis.del(KEYS.BUSY)
    return true
  }

  return false
}

export async function getLastUpdateId(): Promise<number | null> {
  return redis.get<number>(KEYS.TELEGRAM_LAST_UPDATE_ID)
}

export async function setLastUpdateId(updateId: number): Promise<void> {
  await redis.set(KEYS.TELEGRAM_LAST_UPDATE_ID, updateId, { ex: 604800 })
}

export async function pushRollbackEvent(action: string): Promise<void> {
  const event = JSON.stringify({ action, timestamp: new Date().toISOString() })
  await redis.lpush(KEYS.ROLLBACK_EVENTS, event)
  await redis.ltrim(KEYS.ROLLBACK_EVENTS, 0, 49)
}

export async function getRecentRollbackCount(windowHours: number = 24): Promise<number> {
  const raw = await redis.lrange(KEYS.ROLLBACK_EVENTS, 0, -1)
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000
  return raw.filter((item) => {
    try {
      const parsed = typeof item === "string" ? JSON.parse(item) : item
      return new Date(parsed.timestamp).getTime() >= cutoff
    } catch {
      return false
    }
  }).length
}

export async function pushRecentAction(action: string): Promise<void> {
  await redis.lpush(KEYS.DRIFT_RECENT_ACTIONS, action)
  await redis.ltrim(KEYS.DRIFT_RECENT_ACTIONS, 0, 19)
}

export async function getRecentActions(): Promise<string[]> {
  const raw = await redis.lrange(KEYS.DRIFT_RECENT_ACTIONS, 0, -1)
  return raw.map(String)
}

export async function pushRecentTickDuration(durationMs: number): Promise<void> {
  await redis.lpush(KEYS.DRIFT_RECENT_DURATIONS, durationMs.toString())
  await redis.ltrim(KEYS.DRIFT_RECENT_DURATIONS, 0, 19)
}

export async function getRecentTickDurations(): Promise<number[]> {
  const raw = await redis.lrange(KEYS.DRIFT_RECENT_DURATIONS, 0, -1)
  return raw.map((item) => Number(item)).filter((n) => !Number.isNaN(n))
}

export async function setDriftThrottle(severity: string, ttlSeconds: number): Promise<void> {
  await redis.set(KEYS.DRIFT_THROTTLE, severity, { ex: ttlSeconds })
}

export async function getDriftThrottle(): Promise<string | null> {
  return redis.get<string>(KEYS.DRIFT_THROTTLE)
}

export async function getConsecutiveIdleTicks(): Promise<number> {
  const raw = await redis.get<number>(KEYS.CONSECUTIVE_IDLE_TICKS)
  return raw ?? 0
}

export async function incrementConsecutiveIdleTicks(): Promise<void> {
  await redis.incr(KEYS.CONSECUTIVE_IDLE_TICKS)
}

export async function resetConsecutiveIdleTicks(): Promise<void> {
  await redis.set(KEYS.CONSECUTIVE_IDLE_TICKS, 0, { ex: 86400 })
}

export async function getConsecutiveConversationTicks(): Promise<number> {
  const raw = await redis.get<number>(KEYS.CONSECUTIVE_CONVERSATION_TICKS)
  return raw ?? 0
}

export async function incrementConsecutiveConversationTicks(): Promise<void> {
  await redis.incr(KEYS.CONSECUTIVE_CONVERSATION_TICKS)
}

export async function resetConsecutiveConversationTicks(): Promise<void> {
  await redis.set(KEYS.CONSECUTIVE_CONVERSATION_TICKS, 0, { ex: 86400 })
}

export async function isTaskActive(): Promise<boolean> {
  const value = await redis.get(KEYS.TASK_ACTIVE)
  return value === "true"
}

export async function setTaskActive(active: boolean): Promise<void> {
  if (active) {
    await redis.set(KEYS.TASK_ACTIVE, "true", { ex: 600 })
  } else {
    await redis.del(KEYS.TASK_ACTIVE)
  }
}

export async function getReflectionLastAt(): Promise<string | null> {
  return redis.get<string>(KEYS.REFLECTION_LAST_AT)
}

export async function setReflectionLastAt(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.REFLECTION_LAST_AT, isoTimestamp, { ex: 604800 })
}
