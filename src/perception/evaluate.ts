import { formatISO } from "date-fns"
import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { setPerceptionSummary } from "@/memory/working.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { readEmailActivity, readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "./sensors.ts"

/**
 * Evaluate all perception sensors, collect triggers, build summary, and cache in Redis.
 */
export async function evaluatePerception(): Promise<PerceptionSummary> {
  const [ownState, telegram, email, weather, git] = await Promise.all([
    readOwnState(),
    readTelegramActivity(),
    readEmailActivity(),
    readWeatherData(),
    readGitActivity()
  ])

  const emotionalTriggers: EmotionUpdateEvent[] = [
    ...ownState.triggers,
    ...telegram.triggers,
    ...email.triggers,
    ...weather.triggers,
    ...git.triggers
  ]

  const summary: PerceptionSummary = {
    timestamp: formatISO(new Date()),
    ownState: {
      budgetPercent: ownState.budgetPercent,
      lastTickAge: ownState.lastTickAge,
      errorCount: ownState.errorCount,
      healthStatus: ownState.healthStatus
    },
    telegramActivity: {
      pendingCount: telegram.pendingCount,
      lastMessageAge: telegram.lastMessageAge,
      operatorActive: telegram.operatorActive
    },
    emailActivity: {
      pendingCount: email.pendingCount,
      lastEmailAge: email.lastEmailAge,
      hasNewEmail: email.hasNewEmail
    },
    weatherData: weather.weatherData ?? undefined,
    gitActivity:
      git.recentCommits.length > 0
        ? {
            recentCommits: git.recentCommits,
            selfCommitCount: git.selfCommitCount,
            externalCommitCount: git.externalCommitCount
          }
        : undefined,
    emotionalTriggers
  }

  await setPerceptionSummary(summary)

  return summary
}
