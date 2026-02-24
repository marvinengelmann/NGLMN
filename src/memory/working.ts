import { differenceInMinutes, parseISO } from "date-fns"
import type * as z from "zod"
import { ConversationMessage } from "@/bridge/types.ts"
import { CONVERSATION } from "@/config/constants.ts"
import { TickSummary } from "@/core/types.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { ActiveEvolution } from "@/evolution/types.ts"
import { OperatorLocation } from "@/integrations/location.ts"
import { redis } from "@/integrations/redis.ts"
import { PendingEmail, PendingMessage, WeatherData } from "@/integrations/types.ts"
import { PerceptionSummary } from "@/perception/types.ts"
import { PersonalityLayer } from "@/personality/types.ts"
import { GuardianResult } from "@/security/types.ts"
import { HealthCheckResult } from "@/trigger/types.ts"

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

/** @internal Redis key map for working memory. */
const KEYS = {
  TICK_LAST: "working:tick:last",
  TICK_RUNNING: "working:tick:running",
  MESSAGES_PENDING: "working:messages:pending",
  TELEGRAM_LAST_UPDATE_ID: "working:telegram:lastUpdateId",
  HEALTH_LAST_CHECK: "working:health:lastCheck",
  CONVERSATION_MESSAGES: "working:conversation:messages",
  GUARDIAN_LAST_RESULT: "working:guardian:lastResult",
  GUARDIAN_RECENT_RESPONSES: "working:guardian:recentResponses",
  DRIFT_LAST_REPORT: "working:drift:lastReport",
  DRIFT_RECENT_TRIAGE: "working:drift:recentTriage",
  DRIFT_RECENT_DURATIONS: "working:drift:recentDurations",
  HEALTH_LAST_HEALTHY_COMMIT: "working:health:lastHealthyCommit",
  EMOTION_CURRENT: "working:emotion:current",
  PERCEPTION_LATEST: "working:perception:latest",
  PERSONALITY_EFFECTIVE: "working:personality:effective",
  DREAM_STATE: "working:dream:state",
  DREAM_LAST_RUN: "working:dream:lastRun",
  DREAM_INSIGHTS: "working:dream:insights",
  EVOLUTION_ACTIVE: "working:evolution:active",
  TASK_ACTIVE: "working:task:active",
  ROLLBACK_EVENTS: "working:rollback:events",
  EMAILS_PENDING: "working:emails:pending",
  RESEND_LAST_POLLED_ID: "working:resend:lastPolledId",
  WEATHER_LATEST: "working:weather:latest",
  OPERATOR_LOCATION: "working:operator:location",
  OPERATOR_LAST_ACTIVITY: "working:operator:lastActivity",
  CONVERSATION_WAIT_TOKEN: "working:conversation:waitToken",
  EVOLUTION_COUNTER: "working:evolution:counter",
  PROACTIVE_LAST: "working:proactive:last"
} as const

/** Get the summary of the last completed tick. */
export async function getLastTickSummary(): Promise<TickSummary | null> {
  return getValidated(KEYS.TICK_LAST, TickSummary)
}

/** Persist the summary of the current tick. */
export async function setLastTickSummary(summary: TickSummary): Promise<void> {
  await redis.set(KEYS.TICK_LAST, summary)
}

/** Check whether a tick is currently in progress. */
export async function isTickRunning(): Promise<boolean> {
  const val = await redis.get(KEYS.TICK_RUNNING)
  return val === "true"
}

/** Set or clear the tick-running flag (auto-expires after 300s). */
export async function setTickRunning(running: boolean): Promise<void> {
  if (running) {
    await redis.set(KEYS.TICK_RUNNING, "true", { ex: 300 })
  } else {
    await redis.del(KEYS.TICK_RUNNING)
  }
}

/** Append new messages to the pending queue. */
export async function pushPendingMessages(messages: PendingMessage[]): Promise<void> {
  if (messages.length === 0) return
  await redis.rpush(KEYS.MESSAGES_PENDING, ...messages.map((m) => JSON.stringify(m)))
}

/** Read all pending messages without removing them. */
export async function peekAllPendingMessages(): Promise<PendingMessage[]> {
  const raw = await redis.lrange(KEYS.MESSAGES_PENDING, 0, -1)
  return raw.map((item) => parseRedisJson(PendingMessage, item, KEYS.MESSAGES_PENDING))
}

/** Remove all pending messages from the queue. */
export async function clearPendingMessages(): Promise<void> {
  await redis.del(KEYS.MESSAGES_PENDING)
}

/** Get the number of pending messages in the queue. */
export async function getPendingMessageCount(): Promise<number> {
  return redis.llen(KEYS.MESSAGES_PENDING)
}

/** Get the last processed Telegram update ID. */
export async function getLastUpdateId(): Promise<number | null> {
  const val = await redis.get<number>(KEYS.TELEGRAM_LAST_UPDATE_ID)
  return val
}

/** Store the last processed Telegram update ID. */
export async function setLastUpdateId(updateId: number): Promise<void> {
  await redis.set(KEYS.TELEGRAM_LAST_UPDATE_ID, updateId)
}

/** Persist the latest health check result. */
export async function setHealthCheck(result: HealthCheckResult): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_CHECK, result)
}

/** Get the latest health check result. */
export async function getHealthCheck(): Promise<HealthCheckResult | null> {
  return getValidated(KEYS.HEALTH_LAST_CHECK, HealthCheckResult)
}

/** Ping Redis to verify connectivity. */
export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping()
    return result === "PONG"
  } catch {
    return false
  }
}

/**
 * Get the full current conversation history.
 */
export async function getConversationHistory(): Promise<ConversationMessage[]> {
  const raw = await redis.lrange(KEYS.CONVERSATION_MESSAGES, 0, -1)
  return raw.map((item) => parseRedisJson(ConversationMessage, item, KEYS.CONVERSATION_MESSAGES))
}

/**
 * Push a message to the conversation history.
 */
export async function pushConversationMessage(msg: ConversationMessage): Promise<void> {
  await redis.rpush(KEYS.CONVERSATION_MESSAGES, JSON.stringify(msg))
}

/**
 * Clear the conversation history (after summarizing into episodic memory).
 */
export async function clearConversationHistory(): Promise<void> {
  await redis.del(KEYS.CONVERSATION_MESSAGES)
}

/**
 * Detect if there is a conversation gap — i.e., the last message in history
 * is older than CONVERSATION.GAP_MINUTES compared to the new incoming messages.
 *
 * Returns the old history if a gap is detected (so it can be summarized),
 * or null if the conversation is still active.
 */
export async function detectConversationGap(newMessages: PendingMessage[]): Promise<ConversationMessage[] | null> {
  if (newMessages.length === 0) return null

  const history = await getConversationHistory()
  if (history.length === 0) return null

  const lastHistoryMsg = history[history.length - 1]
  if (!lastHistoryMsg) return null
  const lastHistoryTime = parseISO(lastHistoryMsg.timestamp)

  const earliestNewTime = new Date(Math.min(...newMessages.map((m) => m.date * 1000)))

  const gapMinutes = differenceInMinutes(earliestNewTime, lastHistoryTime)

  if (gapMinutes >= CONVERSATION.GAP_MINUTES) {
    return history
  }

  return null
}

/** Store the latest Guardian validation result. */
export async function setGuardianResult(result: GuardianResult): Promise<void> {
  await redis.set(KEYS.GUARDIAN_LAST_RESULT, result)
}

/** Get the latest Guardian validation result. */
export async function getGuardianResult(): Promise<GuardianResult | null> {
  return getValidated(KEYS.GUARDIAN_LAST_RESULT, GuardianResult)
}

/** Push a response text for stuck-loop detection (keeps last 10). */
export async function pushRecentResponse(text: string): Promise<void> {
  await redis.lpush(KEYS.GUARDIAN_RECENT_RESPONSES, text)
  await redis.ltrim(KEYS.GUARDIAN_RECENT_RESPONSES, 0, 9)
}

/** Get the last 10 response texts for stuck-loop detection. */
export async function getRecentResponses(): Promise<string[]> {
  const raw = await redis.lrange(KEYS.GUARDIAN_RECENT_RESPONSES, 0, -1)
  return raw.map(String)
}

/** Push a triage decision for drift detection (keeps last 20). */
export async function pushRecentTriageDecision(decision: string): Promise<void> {
  await redis.lpush(KEYS.DRIFT_RECENT_TRIAGE, decision)
  await redis.ltrim(KEYS.DRIFT_RECENT_TRIAGE, 0, 19)
}

/** Get the last 20 triage decisions for drift detection. */
export async function getRecentTriageDecisions(): Promise<string[]> {
  const raw = await redis.lrange(KEYS.DRIFT_RECENT_TRIAGE, 0, -1)
  return raw.map(String)
}

/** Push a tick duration in ms for anomaly detection (keeps last 20). */
export async function pushRecentTickDuration(durationMs: number): Promise<void> {
  await redis.lpush(KEYS.DRIFT_RECENT_DURATIONS, durationMs.toString())
  await redis.ltrim(KEYS.DRIFT_RECENT_DURATIONS, 0, 19)
}

/** Get the last 20 tick durations in ms. */
export async function getRecentTickDurations(): Promise<number[]> {
  const raw = await redis.lrange(KEYS.DRIFT_RECENT_DURATIONS, 0, -1)
  return raw.map((item) => Number(item)).filter((n) => !Number.isNaN(n))
}

/** Store the last known healthy commit SHA. */
export async function setLastHealthyCommit(sha: string): Promise<void> {
  await redis.set(KEYS.HEALTH_LAST_HEALTHY_COMMIT, sha)
}

/** Get the last known healthy commit SHA. */
export async function getLastHealthyCommit(): Promise<string | null> {
  return redis.get<string>(KEYS.HEALTH_LAST_HEALTHY_COMMIT)
}

/** Get the current emotional state from Redis. */
export async function getCurrentEmotion(): Promise<EmotionalState | null> {
  return getValidated(KEYS.EMOTION_CURRENT, EmotionalState)
}

/** Store the current emotional state in Redis. */
export async function setCurrentEmotion(state: EmotionalState): Promise<void> {
  await redis.set(KEYS.EMOTION_CURRENT, state)
}

/** Get the latest perception summary from Redis. */
export async function getPerceptionSummary(): Promise<PerceptionSummary | null> {
  return getValidated(KEYS.PERCEPTION_LATEST, PerceptionSummary)
}

/** Store the latest perception summary in Redis. */
export async function setPerceptionSummary(summary: PerceptionSummary): Promise<void> {
  await redis.set(KEYS.PERCEPTION_LATEST, summary)
}

/** Get the effective personality from Redis. */
export async function getEffectivePersonality(): Promise<PersonalityLayer | null> {
  return getValidated(KEYS.PERSONALITY_EFFECTIVE, PersonalityLayer)
}

/** Store the effective personality in Redis. */
export async function setEffectivePersonality(personality: PersonalityLayer): Promise<void> {
  await redis.set(KEYS.PERSONALITY_EFFECTIVE, personality)
}

const VALID_DREAM_STATES = new Set(["idle", "dreaming", "waking"])
export type DreamState = "idle" | "dreaming" | "waking"

/** Get the current dream cycle state. */
export async function getDreamState(): Promise<DreamState> {
  const val = await redis.get<string>(KEYS.DREAM_STATE)
  if (val != null && VALID_DREAM_STATES.has(val)) return val as DreamState
  return "idle"
}

/** Set the dream cycle state. */
export async function setDreamState(state: DreamState): Promise<void> {
  await redis.set(KEYS.DREAM_STATE, state)
}

/** Get the ISO timestamp of the last dream run. */
export async function getDreamLastRun(): Promise<string | null> {
  return redis.get<string>(KEYS.DREAM_LAST_RUN)
}

/** Store the ISO timestamp of the last dream run. */
export async function setDreamLastRun(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.DREAM_LAST_RUN, isoTimestamp)
}

/** Get dream insights from the last dream cycle. */
export async function getDreamInsights(): Promise<string[] | null> {
  return redis.get<string[]>(KEYS.DREAM_INSIGHTS)
}

/** Store dream insights for the morning message. */
export async function setDreamInsights(insights: string[]): Promise<void> {
  await redis.set(KEYS.DREAM_INSIGHTS, insights)
}

/** Clear dream insights after the morning message is sent. */
export async function clearDreamInsights(): Promise<void> {
  await redis.del(KEYS.DREAM_INSIGHTS)
}

/** Get the currently active evolution (if any). */
export async function getActiveEvolution(): Promise<ActiveEvolution | null> {
  return getValidated(KEYS.EVOLUTION_ACTIVE, ActiveEvolution)
}

/** Set the currently active evolution. */
export async function setActiveEvolution(evolution: ActiveEvolution): Promise<void> {
  await redis.set(KEYS.EVOLUTION_ACTIVE, evolution)
}

/** Clear the active evolution. */
export async function clearActiveEvolution(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_ACTIVE)
}

/** Check whether a task is currently active. */
export async function isTaskActive(): Promise<boolean> {
  const val = await redis.get(KEYS.TASK_ACTIVE)
  return val === "true"
}

/** Set or clear the task-active flag (auto-expires after 600s). */
export async function setTaskActive(active: boolean): Promise<void> {
  if (active) {
    await redis.set(KEYS.TASK_ACTIVE, "true", { ex: 600 })
  } else {
    await redis.del(KEYS.TASK_ACTIVE)
  }
}

/** Push a rollback event with timestamp for frequency tracking. */
export async function pushRollbackEvent(tier: string): Promise<void> {
  const event = JSON.stringify({ tier, timestamp: new Date().toISOString() })
  await redis.lpush(KEYS.ROLLBACK_EVENTS, event)
  await redis.ltrim(KEYS.ROLLBACK_EVENTS, 0, 49)
}

/** Get the count of rollback events within a time window. */
export async function getRecentRollbackCount(windowHours: number = 24): Promise<number> {
  const raw = await redis.lrange(KEYS.ROLLBACK_EVENTS, 0, -1)
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000
  return raw.filter((item) => {
    const parsed = typeof item === "string" ? JSON.parse(item) : item
    return new Date(parsed.timestamp).getTime() >= cutoff
  }).length
}

/** Append new emails to the pending email queue. */
export async function pushPendingEmails(emails: PendingEmail[]): Promise<void> {
  if (emails.length === 0) return
  await redis.rpush(KEYS.EMAILS_PENDING, ...emails.map((e) => JSON.stringify(e)))
}

/** Read all pending emails without removing them. */
export async function peekAllPendingEmails(): Promise<PendingEmail[]> {
  const raw = await redis.lrange(KEYS.EMAILS_PENDING, 0, -1)
  return raw.map((item) => parseRedisJson(PendingEmail, item, KEYS.EMAILS_PENDING))
}

/** Remove all pending emails from the queue. */
export async function clearPendingEmails(): Promise<void> {
  await redis.del(KEYS.EMAILS_PENDING)
}

/** Get the number of pending emails in the queue. */
export async function getPendingEmailCount(): Promise<number> {
  return redis.llen(KEYS.EMAILS_PENDING)
}

/** Get the last polled Resend email ID for pagination. */
export async function getLastPolledEmailId(): Promise<string | null> {
  return redis.get<string>(KEYS.RESEND_LAST_POLLED_ID)
}

/** Store the last polled Resend email ID. */
export async function setLastPolledEmailId(emailId: string): Promise<void> {
  await redis.set(KEYS.RESEND_LAST_POLLED_ID, emailId)
}

const WEATHER_TTL_SECONDS = 1800

/** Get cached weather data from Redis. */
export async function getWeatherData(): Promise<WeatherData | null> {
  return getValidated(KEYS.WEATHER_LATEST, WeatherData)
}

/** Cache weather data in Redis with 30min TTL. */
export async function setWeatherData(data: WeatherData): Promise<void> {
  await redis.set(KEYS.WEATHER_LATEST, data, { ex: WEATHER_TTL_SECONDS })
}

/** Clear the weather data cache (used when operator location changes). */
export async function clearWeatherData(): Promise<void> {
  await redis.del(KEYS.WEATHER_LATEST)
}

const OPERATOR_LOCATION_TTL_SECONDS = 3600

/** Get the cached operator location from Redis. */
export async function getOperatorLocation(): Promise<OperatorLocation | null> {
  return getValidated(KEYS.OPERATOR_LOCATION, OperatorLocation)
}

/** Cache operator location in Redis with configurable TTL. */
export async function setOperatorLocation(
  location: OperatorLocation,
  ttlSeconds: number = OPERATOR_LOCATION_TTL_SECONDS
): Promise<void> {
  await redis.set(KEYS.OPERATOR_LOCATION, location, { ex: ttlSeconds })
}

export interface ProactiveRecord {
  action: string
  timestamp: string
}

export async function getLastProactiveAction(): Promise<ProactiveRecord | null> {
  return redis.get<ProactiveRecord>(KEYS.PROACTIVE_LAST)
}

export async function setLastProactiveAction(record: ProactiveRecord): Promise<void> {
  await redis.set(KEYS.PROACTIVE_LAST, record)
}

/** Atomically increment and return the next evolution number. */
export async function getNextEvolutionNumber(): Promise<number> {
  return redis.incr(KEYS.EVOLUTION_COUNTER)
}

/** Store the ISO timestamp of the last operator activity. */
export async function setOperatorLastActivity(isoTimestamp: string): Promise<void> {
  await redis.set(KEYS.OPERATOR_LAST_ACTIVITY, isoTimestamp)
}

/** Get the ISO timestamp of the last operator activity. */
export async function getOperatorLastActivity(): Promise<string | null> {
  return redis.get<string>(KEYS.OPERATOR_LAST_ACTIVITY)
}

/** Store the active conversation wait token for follow-up loop. */
export async function setConversationWaitToken(token: string): Promise<void> {
  await redis.set(KEYS.CONVERSATION_WAIT_TOKEN, token, { ex: 600 })
}

/** Get the active conversation wait token. */
export async function getConversationWaitToken(): Promise<string | null> {
  return redis.get<string>(KEYS.CONVERSATION_WAIT_TOKEN)
}

/** Clear the active conversation wait token. */
export async function clearConversationWaitToken(): Promise<void> {
  await redis.del(KEYS.CONVERSATION_WAIT_TOKEN)
}
