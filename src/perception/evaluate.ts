import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import { setPerceptionSummary } from "@/perception/state.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "./sensors.ts"

/**
 * Evaluate all perception sensors, collect triggers, build summary, and cache in Redis.
 */
export async function evaluatePerception(): Promise<PerceptionSummary> {
  const [ownState, telegram, weather, git] = await Promise.all([
    readOwnState(),
    readTelegramActivity(),
    readWeatherData(),
    readGitActivity()
  ])

  const emotionalTriggers: EmotionUpdateEvent[] = [
    ...ownState.triggers,
    ...telegram.triggers,
    ...weather.triggers,
    ...git.triggers
  ]

  const summary: PerceptionSummary = {
    timestamp: nowISO(),
    ownState: {
      budgetPercent: ownState.budgetPercent,
      lastTickAge: ownState.lastTickAge,
      errorCount: ownState.errorCount,
      healthStatus: ownState.healthStatus
    },
    telegramActivity: {
      pendingCount: 0,
      lastMessageAge: telegram.lastMessageAge,
      operatorActive: telegram.operatorActive
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
