import { differenceInHours, differenceInSeconds, parseISO } from "date-fns"
import { hasXConfig } from "@/config/env.ts"
import { getBudgetState } from "@/core/budget.ts"
import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { listCommits } from "@/integrations/github.ts"
import { resolveOperatorLocation } from "@/integrations/location.ts"
import { getCachedOrFetchWeather } from "@/integrations/openweather.ts"
import type { WeatherData } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import {
  getHealthCheck,
  getLastTickSummary,
  getOperatorLastActivity,
  getPendingEmailCount,
  getPendingMentionCount,
  getPendingMessageCount,
  peekAllPendingEmails,
  peekAllPendingMentions,
  peekAllPendingMessages
} from "@/memory/working.ts"
import type { OverallStatus } from "@/trigger/types.ts"

/**
 * Read ANIMA's own state and generate emotional triggers from it.
 */
export async function readOwnState(): Promise<{
  budgetPercent: number
  lastTickAge: number
  errorCount: number
  healthStatus: OverallStatus
  triggers: EmotionUpdateEvent[]
}> {
  const [budget, lastTick, health] = await Promise.all([getBudgetState(), getLastTickSummary(), getHealthCheck()])

  const budgetPercent = (budget.consumedToday / budget.dailyLimit) * 100
  const lastTickAge = lastTick ? differenceInSeconds(new Date(), parseISO(lastTick.timestamp)) : -1
  const healthStatus = health?.overall ?? "healthy"
  const errorCount = health?.errors.length ?? 0

  const triggers: EmotionUpdateEvent[] = []

  if (budgetPercent > 80) {
    triggers.push({
      trigger: "perception_negative",
      intensity: Math.min(1, budgetPercent / 100),
      detail: `Budget at ${budgetPercent.toFixed(0)}%`
    })
  }

  if (healthStatus === "critical") {
    triggers.push({
      trigger: "perception_negative",
      intensity: 0.8,
      detail: "Health status is critical"
    })
  } else if (healthStatus === "degraded") {
    triggers.push({
      trigger: "perception_negative",
      intensity: 0.4,
      detail: "Health status is degraded"
    })
  }

  if (healthStatus === "healthy" && budgetPercent < 50) {
    triggers.push({
      trigger: "perception_positive",
      intensity: 0.3,
      detail: "Systems healthy, budget comfortable"
    })
  }

  return { budgetPercent, lastTickAge, errorCount, healthStatus, triggers }
}

/**
 * Read Telegram activity and generate emotional triggers from it.
 */
export async function readTelegramActivity(): Promise<{
  pendingCount: number
  lastMessageAge: number
  operatorActive: boolean
  triggers: EmotionUpdateEvent[]
}> {
  const [pendingCount, messages, lastActivity] = await Promise.all([
    getPendingMessageCount(),
    peekAllPendingMessages(),
    getOperatorLastActivity()
  ])

  let lastMessageAge: number
  if (lastActivity) {
    lastMessageAge = differenceInSeconds(new Date(), parseISO(lastActivity))
  } else if (messages.length > 0) {
    lastMessageAge = differenceInSeconds(new Date(), new Date(Math.max(...messages.map((m) => m.date * 1000))))
  } else {
    lastMessageAge = -1
  }

  const operatorActive = lastMessageAge >= 0 && lastMessageAge < 600

  const triggers: EmotionUpdateEvent[] = []

  if (pendingCount > 0) {
    triggers.push({
      trigger: "message_received",
      intensity: Math.min(1, pendingCount * 0.3),
      detail: `${pendingCount} pending message(s)`
    })
  }

  if (!operatorActive && lastMessageAge > 3600) {
    triggers.push({
      trigger: "operator_silence",
      intensity: Math.min(1, lastMessageAge / 7200),
      detail: `No operator activity for ${Math.floor(lastMessageAge / 60)} minutes`
    })
  }

  return { pendingCount, lastMessageAge, operatorActive, triggers }
}

/**
 * Read email activity and generate emotional triggers from it.
 */
export async function readEmailActivity(): Promise<{
  pendingCount: number
  lastEmailAge: number
  hasNewEmail: boolean
  triggers: EmotionUpdateEvent[]
}> {
  const [pendingCount, emails] = await Promise.all([getPendingEmailCount(), peekAllPendingEmails()])

  const lastEmail = emails[emails.length - 1]
  const lastEmailAge = lastEmail ? differenceInSeconds(new Date(), new Date(lastEmail.receivedAt)) : -1

  const hasNewEmail = pendingCount > 0

  const triggers: EmotionUpdateEvent[] = []

  if (pendingCount > 0) {
    triggers.push({
      trigger: "email_received",
      intensity: Math.min(1, pendingCount * 0.4),
      detail: `${pendingCount} pending email(s)`
    })
  }

  return { pendingCount, lastEmailAge, hasNewEmail, triggers }
}

/**
 * Read X (Twitter) activity and generate emotional triggers from it.
 */
export async function readXActivity(): Promise<{
  pendingCount: number
  lastMentionAge: number
  hasNewMention: boolean
  triggers: EmotionUpdateEvent[]
}> {
  if (!hasXConfig()) {
    return { pendingCount: 0, lastMentionAge: -1, hasNewMention: false, triggers: [] }
  }

  const [pendingCount, mentions] = await Promise.all([getPendingMentionCount(), peekAllPendingMentions()])

  const lastMention = mentions[mentions.length - 1]
  const lastMentionAge = lastMention ? differenceInSeconds(new Date(), new Date(lastMention.createdAt)) : -1

  const hasNewMention = pendingCount > 0

  const triggers: EmotionUpdateEvent[] = []

  if (pendingCount > 0) {
    triggers.push({
      trigger: "mention_received",
      intensity: Math.min(1, pendingCount * 0.3),
      detail: `${pendingCount} pending X mention(s)`
    })
  }

  return { pendingCount, lastMentionAge, hasNewMention, triggers }
}

const STORM_CONDITIONS = ["Thunderstorm", "Squall", "Tornado"]
const RAIN_CONDITIONS = ["Rain", "Drizzle"]

/**
 * Read current weather data and generate emotional triggers from it.
 */
export async function readWeatherData(): Promise<{
  weatherData: WeatherData | null
  triggers: EmotionUpdateEvent[]
}> {
  try {
    const location = await resolveOperatorLocation()
    if (!location) return { weatherData: null, triggers: [] }

    const weatherData = await getCachedOrFetchWeather(location.latitude, location.longitude)
    if (!weatherData) return { weatherData: null, triggers: [] }

    const triggers: EmotionUpdateEvent[] = []

    if (weatherData.temperature < 0) {
      triggers.push({
        trigger: "weather_update",
        intensity: 0.4,
        detail: "Freezing conditions"
      })
    } else if (weatherData.temperature > 35) {
      triggers.push({
        trigger: "weather_update",
        intensity: 0.4,
        detail: "Extreme heat"
      })
    } else if (STORM_CONDITIONS.includes(weatherData.condition) || RAIN_CONDITIONS.includes(weatherData.condition)) {
      triggers.push({
        trigger: "weather_update",
        intensity: 0.3,
        detail: `Weather: ${weatherData.description}`
      })
    } else if (weatherData.condition === "Clear" && weatherData.temperature >= 15 && weatherData.temperature <= 28) {
      triggers.push({
        trigger: "weather_update",
        intensity: 0.3,
        detail: "Beautiful weather"
      })
    }

    return { weatherData, triggers }
  } catch (e) {
    log.warn("Weather sensor failed", { error: String(e) })
    return { weatherData: null, triggers: [] }
  }
}

/**
 * Read recent Git activity on ANIMA's own repo and generate emotional triggers from it.
 */
export async function readGitActivity(): Promise<{
  recentCommits: Array<{ sha: string; message: string; date: string; isSelfAuthored: boolean }>
  selfCommitCount: number
  externalCommitCount: number
  triggers: EmotionUpdateEvent[]
}> {
  try {
    const commits = await listCommits("master", 10)

    const now = new Date()
    const recentCommits = commits.map((c) => ({
      ...c,
      isSelfAuthored: c.message.startsWith("Evolution #")
    }))

    const last24h = recentCommits.filter((c) => differenceInHours(now, parseISO(c.date)) < 24)
    const selfCommitCount = last24h.filter((c) => c.isSelfAuthored).length
    const externalCommitCount = last24h.filter((c) => !c.isSelfAuthored).length

    const triggers: EmotionUpdateEvent[] = []

    if (externalCommitCount > 0) {
      triggers.push({
        trigger: "git_activity",
        intensity: Math.min(1, externalCommitCount * 0.2),
        detail: `${externalCommitCount} external commit(s) in last 24h`
      })
    }

    if (selfCommitCount > 0) {
      triggers.push({
        trigger: "perception_positive",
        intensity: Math.min(1, selfCommitCount * 0.15),
        detail: `${selfCommitCount} self-evolution commit(s) in last 24h`
      })
    }

    return { recentCommits, selfCommitCount, externalCommitCount, triggers }
  } catch (e) {
    log.warn("Git sensor failed", { error: String(e) })
    return { recentCommits: [], selfCommitCount: 0, externalCommitCount: 0, triggers: [] }
  }
}
