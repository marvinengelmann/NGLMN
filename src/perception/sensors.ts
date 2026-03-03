import { differenceInHours, differenceInSeconds, parseISO } from "date-fns"
import { getBudgetState } from "@/core/budget.ts"
import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import type { OverallStatus } from "@/health/types.ts"
import { listCommits } from "@/integrations/github.ts"
import { resolveOperatorLocation } from "@/integrations/location.ts"
import { getCachedOrFetchWeather } from "@/integrations/openweather.ts"
import type { WeatherData } from "@/integrations/types.ts"
import { log } from "@/lib/logger.ts"
import { getHealthCheck, getLastTickSummary, getOperatorLastActivity } from "@/memory/working.ts"

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
  const lastActivity = await getOperatorLastActivity()

  const lastMessageAge = lastActivity ? differenceInSeconds(new Date(), parseISO(lastActivity)) : -1
  const operatorActive = lastMessageAge >= 0 && lastMessageAge < 600

  const triggers: EmotionUpdateEvent[] = []

  if (!operatorActive && lastMessageAge > 3600) {
    triggers.push({
      trigger: "operator_silence",
      intensity: Math.min(1, lastMessageAge / 7200),
      detail: `No operator activity for ${Math.floor(lastMessageAge / 60)} minutes`
    })
  }

  return { pendingCount: 0, lastMessageAge, operatorActive, triggers }
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
      triggers.push({ trigger: "weather_update", intensity: 0.4, detail: "Freezing conditions" })
    } else if (weatherData.temperature > 35) {
      triggers.push({ trigger: "weather_update", intensity: 0.4, detail: "Extreme heat" })
    } else if (STORM_CONDITIONS.includes(weatherData.condition) || RAIN_CONDITIONS.includes(weatherData.condition)) {
      triggers.push({ trigger: "weather_update", intensity: 0.3, detail: `Weather: ${weatherData.description}` })
    } else if (weatherData.condition === "Clear" && weatherData.temperature >= 15 && weatherData.temperature <= 28) {
      triggers.push({ trigger: "weather_update", intensity: 0.3, detail: "Beautiful weather" })
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
