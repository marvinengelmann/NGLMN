import { parseISO } from "date-fns"
import * as z from "zod"
import { type ConversationMessage, ConversationSlot } from "@/communication/types.ts"
import { CONVERSATION, HEARTBEAT } from "@/config/constants.ts"
import { TickSummary } from "@/consciousness/types.ts"
import { DreamState } from "@/dream/types.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { ActiveEvolution, CodeProposal, EvolutionCycleResult } from "@/evolution/types.ts"
import { HealthCheckResult } from "@/health/types.ts"
import { redis } from "@/integrations/redis.ts"
import { OperatorLocation, WeatherData } from "@/integrations/types.ts"
import { nowISO } from "@/lib/time.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { GuardianResult } from "@/security/types.ts"
import type { ActionType, TrustEvent } from "@/trust/types.ts"
import { TrustEventLog } from "@/trust/types.ts"

function parseRedisJson<T>(schema: z.ZodType<T>, raw: unknown, key: string): T {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    return schema.parse(parsed)
  } catch (e) {
    throw new Error(`Failed to parse Redis key "${key}": ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function getValidated<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  const raw = await redis.get(key)
  if (raw == null) return null
  return parseRedisJson(schema, raw, key)
}

const KEYS = {
  TICK_LAST: "working:tick:last",
  BUSY: "working:busy",
  TELEGRAM_LAST_UPDATE_ID: "working:telegram:lastUpdateId",
  HEALTH_LAST_CHECK: "working:health:lastCheck",
  CONVERSATION_BUFFER: "working:conversation:buffer",
  GUARDIAN_LAST_RESULT: "working:guardian:lastResult",
  GUARDIAN_RECENT_RESPONSES: "working:guardian:recentResponses",
  DRIFT_LAST_REPORT: "working:drift:lastReport",
  DRIFT_RECENT_ACTIONS: "working:drift:recentActions",
  DRIFT_RECENT_DURATIONS: "working:drift:recentDurations",
  HEALTH_LAST_HEALTHY_COMMIT: "working:health:lastHealthyCommit",
  EMOTION_CURRENT: "working:emotion:current",
  PERCEPTION_LATEST: "working:perception:latest",
  DREAM_STATE: "working:dream:state",
  DREAM_LAST_RUN: "working:dream:lastRun",
  DREAM_INSIGHTS: "working:dream:insights",
  EVOLUTION_ACTIVE: "working:evolution:active",
  TASK_ACTIVE: "working:task:active",
  ROLLBACK_EVENTS: "working:rollback:events",
  WEATHER_LATEST: "working:weather:latest",
  OPERATOR_LOCATION: "working:operator:location",
  OPERATOR_LAST_ACTIVITY: "working:operator:lastActivity",
  EVOLUTION_COUNTER: "working:evolution:counter",
  EVOLUTION_PENDING_PROPOSAL: "working:evolution:pendingProposal",
  EVOLUTION_OUTCOME: "working:evolution:outcome",
  REFLECTION_LAST_AT: "working:reflection:lastAt",
  CONVERSATION_WAITING_SINCE: "working:conversation:waitingSince",
  EMOTION_TRIGGER_TIMESTAMPS: "working:emotion:triggerTimestamps",
  EMOTION_OPERATOR_SILENT_FIRED: "working:emotion:operatorSilentFired",
  EMOTION_LAST_SYSTEM_STATUS: "working:emotion:lastSystemStatus",
  EMOTION_LAST_TIMESTAMP: "working:emotion:lastTimestamp",
  CONSECUTIVE_IDLE_TICKS: "working:cognition:consecutiveIdleTicks",
  RELATIONSHIP_CONFLICT_COUNT: "working:relationship:conflictCount",
  RELATIONSHIP_FIRST_INTERACTION_AT: "working:relationship:firstInteractionAt",
  RELATIONSHIP_TOTAL_INTERACTIONS: "working:relationship:totalInteractions",
  DREAM_NARRATIVE: "working:dream:narrative",
  DRIFT_THROTTLE: "working:drift:throttle",
  trustLevel: (actionType: string) => `working:trust:${actionType}` as const
} as const

export async function getLastTickSummary(): Promise<TickSummary | null> {
  return getValidated(KEYS.TICK_LAST, TickSummary)
}

export async function setLastTickSummary(summary: TickSummary): Promise<void> {
  await redis.set(KEYS.TICK_LAST, summary)
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

export async function clearBusy(tickId: string): Promise<void> {
  const current = await redis.get(KEYS.BUSY)
  if (current === tickId) {
    await redis.del(KEYS.BUSY)
  }
}

export async function getLastUpdateId(): Promise<number | null> {
  return redis.get<number>(KEYS.TELEGRAM_LAST_UPDATE_ID)
}

export async function setLastUpdateId(updateId: number): Promise<void> {
  await redis.set(KEYS.TELEGRAM_LAST_UPDATE_ID, updateId)
}

export async function setHealthCheck(result: HealthCheckResult): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_CHECK, result)
}

export async function getHealthCheck(): Promise<HealthCheckResult | null> {
  return getValidated(KEYS.HEALTH_LAST_CHECK, HealthCheckResult)
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping()
    return result === "PONG"
  } catch {
    return false
  }
}

export async function getConversationBuffer(): Promise<ConversationSlot[]> {
  const raw = await redis.get(KEYS.CONVERSATION_BUFFER)
  if (raw == null) return []
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    return z.array(ConversationSlot).parse(parsed)
  } catch {
    return []
  }
}

export async function setConversationBuffer(slots: ConversationSlot[]): Promise<void> {
  await redis.set(KEYS.CONVERSATION_BUFFER, JSON.stringify(slots))
}

export async function getActiveConversation(): Promise<ConversationSlot | null> {
  const buffer = await getConversationBuffer()
  return buffer.length > 0 ? (buffer[buffer.length - 1] ?? null) : null
}

export async function pushToActiveConversation(messages: ConversationMessage[]): Promise<void> {
  if (messages.length === 0) return
  const buffer = await getConversationBuffer()
  if (buffer.length === 0) {
    const now = nowISO()
    buffer.push({ id: crypto.randomUUID(), messages: [], startedAt: now, lastActivityAt: now })
  }
  const active = buffer[buffer.length - 1]
  if (!active) return
  messages.forEach((message) => {
    active.messages.push(message)
    active.lastActivityAt = message.timestamp
  })
  await setConversationBuffer(buffer)
}

export async function startNewConversation(): Promise<ConversationSlot | null> {
  const buffer = await getConversationBuffer()
  let evicted: ConversationSlot | null = null
  if (buffer.length >= CONVERSATION.MAX_BUFFER_SLOTS) {
    evicted = buffer.shift() ?? null
  }
  const now = nowISO()
  buffer.push({ id: crypto.randomUUID(), messages: [], startedAt: now, lastActivityAt: now })
  await setConversationBuffer(buffer)
  return evicted
}

export async function getAllConversationMessages(): Promise<ConversationMessage[]> {
  const buffer = await getConversationBuffer()
  return buffer.flatMap((slot) => slot.messages)
}

export async function clearConversationBuffer(): Promise<void> {
  await redis.del(KEYS.CONVERSATION_BUFFER)
}

export async function setGuardianResult(result: GuardianResult): Promise<void> {
  await redis.set(KEYS.GUARDIAN_LAST_RESULT, result)
}

export async function getGuardianResult(): Promise<GuardianResult | null> {
  return getValidated(KEYS.GUARDIAN_LAST_RESULT, GuardianResult)
}

export async function pushRecentResponse(text: string): Promise<void> {
  await redis.lpush(KEYS.GUARDIAN_RECENT_RESPONSES, text)
  await redis.ltrim(KEYS.GUARDIAN_RECENT_RESPONSES, 0, 9)
}

export async function getRecentResponses(): Promise<string[]> {
  const raw = await redis.lrange(KEYS.GUARDIAN_RECENT_RESPONSES, 0, -1)
  return raw.map(String)
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

export async function setLastHealthyCommit(sha: string): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_HEALTHY_COMMIT, sha)
}

export async function getLastHealthyCommit(): Promise<string | null> {
  return redis.get<string>(KEYS.HEALTH_LAST_HEALTHY_COMMIT)
}

export async function getCurrentEmotion(): Promise<EmotionalState | null> {
  return getValidated(KEYS.EMOTION_CURRENT, EmotionalState)
}

export async function setCurrentEmotion(state: EmotionalState): Promise<void> {
  await redis.set(KEYS.EMOTION_CURRENT, state)
}

export async function getPerceptionSummary(): Promise<PerceptionSummary | null> {
  return getValidated(KEYS.PERCEPTION_LATEST, PerceptionSummary)
}

export async function setPerceptionSummary(summary: PerceptionSummary): Promise<void> {
  await redis.set(KEYS.PERCEPTION_LATEST, summary)
}

export async function getDreamState(): Promise<DreamState> {
  const value = await redis.get<string>(KEYS.DREAM_STATE)
  const parsed = DreamState.safeParse(value)
  return parsed.success ? parsed.data : "idle"
}

export async function setDreamState(state: DreamState): Promise<void> {
  await redis.set(KEYS.DREAM_STATE, state)
}

export async function getDreamLastRun(): Promise<string | null> {
  return redis.get<string>(KEYS.DREAM_LAST_RUN)
}

export async function setDreamLastRun(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.DREAM_LAST_RUN, isoTimestamp)
}

export async function getDreamInsights(): Promise<string[] | null> {
  return redis.get<string[]>(KEYS.DREAM_INSIGHTS)
}

export async function setDreamInsights(insights: string[]): Promise<void> {
  await redis.set(KEYS.DREAM_INSIGHTS, insights)
}

export async function clearDreamInsights(): Promise<void> {
  await redis.del(KEYS.DREAM_INSIGHTS)
}

export async function getActiveEvolution(): Promise<ActiveEvolution | null> {
  return getValidated(KEYS.EVOLUTION_ACTIVE, ActiveEvolution)
}

export async function setActiveEvolution(evolution: ActiveEvolution): Promise<void> {
  await redis.set(KEYS.EVOLUTION_ACTIVE, evolution)
}

export async function clearActiveEvolution(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_ACTIVE)
}

export async function getPendingEvolutionProposal(): Promise<CodeProposal | null> {
  return getValidated(KEYS.EVOLUTION_PENDING_PROPOSAL, CodeProposal)
}

export async function setPendingEvolutionProposal(proposal: CodeProposal): Promise<void> {
  await redis.set(KEYS.EVOLUTION_PENDING_PROPOSAL, proposal, { ex: 86400 })
}

export async function clearPendingEvolutionProposal(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_PENDING_PROPOSAL)
}

export async function getEvolutionCycleResult(): Promise<EvolutionCycleResult | null> {
  return getValidated(KEYS.EVOLUTION_OUTCOME, EvolutionCycleResult)
}

export async function setEvolutionCycleResult(outcome: EvolutionCycleResult): Promise<void> {
  await redis.set(KEYS.EVOLUTION_OUTCOME, outcome, { ex: 3600 })
}

export async function clearEvolutionCycleResult(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_OUTCOME)
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

const WEATHER_TTL_SECONDS = 1800

export async function getWeatherData(): Promise<WeatherData | null> {
  return getValidated(KEYS.WEATHER_LATEST, WeatherData)
}

export async function setWeatherData(data: WeatherData): Promise<void> {
  await redis.set(KEYS.WEATHER_LATEST, data, { ex: WEATHER_TTL_SECONDS })
}

export async function clearWeatherData(): Promise<void> {
  await redis.del(KEYS.WEATHER_LATEST)
}

const OPERATOR_LOCATION_TTL_SECONDS = 3600

export async function getOperatorLocation(): Promise<OperatorLocation | null> {
  return getValidated(KEYS.OPERATOR_LOCATION, OperatorLocation)
}

export async function setOperatorLocation(
  location: OperatorLocation,
  ttlSeconds: number = OPERATOR_LOCATION_TTL_SECONDS
): Promise<void> {
  await redis.set(KEYS.OPERATOR_LOCATION, location, { ex: ttlSeconds })
}

export async function getNextEvolutionNumber(): Promise<number> {
  return redis.incr(KEYS.EVOLUTION_COUNTER)
}

export async function setOperatorLastActivity(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.OPERATOR_LAST_ACTIVITY, isoTimestamp)
}

export async function getOperatorLastActivity(): Promise<string | null> {
  return redis.get<string>(KEYS.OPERATOR_LAST_ACTIVITY)
}

export async function getReflectionLastAt(): Promise<string | null> {
  return redis.get<string>(KEYS.REFLECTION_LAST_AT)
}

export async function setReflectionLastAt(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.REFLECTION_LAST_AT, isoTimestamp)
}

export async function getConversationWaitingSince(): Promise<string | null> {
  return redis.get<string>(KEYS.CONVERSATION_WAITING_SINCE)
}

export async function setConversationWaitingSince(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.CONVERSATION_WAITING_SINCE, isoTimestamp, { ex: HEARTBEAT.MAX_CONVERSATION_WAIT + 60 })
}

export async function clearConversationWaitingSince(): Promise<void> {
  await redis.del(KEYS.CONVERSATION_WAITING_SINCE)
}

export async function getTriggerTimestamps(): Promise<Record<string, number>> {
  const raw = await redis.get<Record<string, string>>(KEYS.EMOTION_TRIGGER_TIMESTAMPS)
  if (!raw) return {}
  return Object.fromEntries(
    Object.entries(raw).map(([trigger, isoTimestamp]) => [
      trigger,
      (Date.now() - parseISO(isoTimestamp).getTime()) / 60000
    ])
  )
}

export async function setTriggerTimestamp(trigger: string, isoTimestamp: string): Promise<void> {
  const raw = await redis.get<Record<string, string>>(KEYS.EMOTION_TRIGGER_TIMESTAMPS)
  const timestamps = raw ?? {}
  timestamps[trigger] = isoTimestamp
  await redis.set(KEYS.EMOTION_TRIGGER_TIMESTAMPS, timestamps)
}

export async function getOperatorSilentFlag(): Promise<boolean> {
  const value = await redis.get(KEYS.EMOTION_OPERATOR_SILENT_FIRED)
  return value === "true"
}

export async function setOperatorSilentFlag(): Promise<void> {
  await redis.set(KEYS.EMOTION_OPERATOR_SILENT_FIRED, "true")
}

export async function clearOperatorSilentFlag(): Promise<void> {
  await redis.del(KEYS.EMOTION_OPERATOR_SILENT_FIRED)
}

export async function getLastSystemStatus(): Promise<string | null> {
  return redis.get<string>(KEYS.EMOTION_LAST_SYSTEM_STATUS)
}

export async function setLastSystemStatus(status: string): Promise<void> {
  await redis.set(KEYS.EMOTION_LAST_SYSTEM_STATUS, status)
}

export async function getLastEmotionTimestamp(): Promise<string | null> {
  return redis.get<string>(KEYS.EMOTION_LAST_TIMESTAMP)
}

export async function setLastEmotionTimestamp(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.EMOTION_LAST_TIMESTAMP, isoTimestamp)
}

export async function getConsecutiveIdleTicks(): Promise<number> {
  const raw = await redis.get<number>(KEYS.CONSECUTIVE_IDLE_TICKS)
  return raw ?? 0
}

export async function incrementConsecutiveIdleTicks(): Promise<void> {
  await redis.incr(KEYS.CONSECUTIVE_IDLE_TICKS)
}

export async function resetConsecutiveIdleTicks(): Promise<void> {
  await redis.set(KEYS.CONSECUTIVE_IDLE_TICKS, 0)
}

interface LegacyTrustLevelData {
  totalAttempts: number
  successfulAttempts: number
}

export async function getTrustEventLog(actionType: ActionType): Promise<TrustEvent[]> {
  const raw = await redis.get(KEYS.trustLevel(actionType))
  if (raw == null) return []

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    const logResult = TrustEventLog.safeParse(parsed)
    if (logResult.success) return logResult.data

    const legacy = parsed as LegacyTrustLevelData
    if (typeof legacy.totalAttempts === "number") {
      const now = new Date().toISOString()
      const events: TrustEvent[] = [
        ...Array.from({ length: legacy.successfulAttempts }, () => ({ success: true, timestamp: now }) as TrustEvent),
        ...Array.from(
          { length: legacy.totalAttempts - legacy.successfulAttempts },
          () =>
            ({
              success: false,
              timestamp: now
            }) as TrustEvent
        )
      ]
      await setTrustEventLog(actionType, events)
      return events
    }

    return []
  } catch {
    return []
  }
}

export async function setTrustEventLog(actionType: ActionType, events: TrustEvent[]): Promise<void> {
  const capped = events.slice(-100)
  await redis.set(KEYS.trustLevel(actionType), capped)
}

export async function pushTrustEvent(actionType: ActionType, event: TrustEvent): Promise<void> {
  const events = await getTrustEventLog(actionType)
  events.push(event)
  await setTrustEventLog(actionType, events)
}

export async function getConflictCount(): Promise<number> {
  const raw = await redis.get<number>(KEYS.RELATIONSHIP_CONFLICT_COUNT)
  return raw ?? 0
}

export async function incrementConflictCount(): Promise<void> {
  await redis.incr(KEYS.RELATIONSHIP_CONFLICT_COUNT)
}

export async function getFirstInteractionAt(): Promise<string | null> {
  return redis.get<string>(KEYS.RELATIONSHIP_FIRST_INTERACTION_AT)
}

export async function setFirstInteractionAt(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.RELATIONSHIP_FIRST_INTERACTION_AT, isoTimestamp)
}

export async function getTotalInteractions(): Promise<number> {
  const raw = await redis.get<number>(KEYS.RELATIONSHIP_TOTAL_INTERACTIONS)
  return raw ?? 0
}

export async function incrementTotalInteractions(): Promise<void> {
  await redis.incr(KEYS.RELATIONSHIP_TOTAL_INTERACTIONS)
}

export async function getDreamNarrative(): Promise<string | null> {
  return redis.get<string>(KEYS.DREAM_NARRATIVE)
}

export async function setDreamNarrative(narrative: string): Promise<void> {
  await redis.set(KEYS.DREAM_NARRATIVE, narrative)
}

export async function clearDreamNarrative(): Promise<void> {
  await redis.del(KEYS.DREAM_NARRATIVE)
}

export async function setDriftThrottle(severity: string, ttlSeconds: number): Promise<void> {
  await redis.set(KEYS.DRIFT_THROTTLE, severity, { ex: ttlSeconds })
}

export async function getDriftThrottle(): Promise<string | null> {
  return redis.get<string>(KEYS.DRIFT_THROTTLE)
}
