import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import { setPerceptionSummary } from "@/memory/working.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import {
  readEmailActivity,
  readGitActivity,
  readOwnState,
  readTelegramActivity,
  readWeatherData,
  readXActivity
} from "./sensors.ts"

/**
 * Evaluate all perception sensors, collect triggers, build summary, and cache in Redis.
 */
export async function evaluatePerception(): Promise<PerceptionSummary> {
  const [ownState, telegram, email, xActivity, weather, git] = await Promise.all([
    readOwnState(),
    readTelegramActivity(),
    readEmailActivity(),
    readXActivity(),
    readWeatherData(),
    readGitActivity()
  ])

  const emotionalTriggers: EmotionUpdateEvent[] = [
    ...ownState.triggers,
    ...telegram.triggers,
    ...email.triggers,
    ...xActivity.triggers,
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
      pendingCount: telegram.pendingCount,
      lastMessageAge: telegram.lastMessageAge,
      operatorActive: telegram.operatorActive
    },
    emailActivity: {
      pendingCount: email.pendingCount,
      lastEmailAge: email.lastEmailAge,
      hasNewEmail: email.hasNewEmail
    },
    xActivity:
      xActivity.pendingCount > 0
        ? {
            pendingCount: xActivity.pendingCount,
            lastMentionAge: xActivity.lastMentionAge,
            hasNewMention: xActivity.hasNewMention
          }
        : undefined,
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
