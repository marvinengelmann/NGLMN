import * as z from "zod"
import { EmotionUpdateEvent } from "@/emotion/types.ts"
import { OverallStatus } from "@/health/types.ts"
import { WeatherData } from "@/integrations/types.ts"

export const PerceptionSummary = z.object({
  timestamp: z.string(),
  ownState: z.object({
    budgetPercent: z.number(),
    lastTickAge: z.number(),
    errorCount: z.number(),
    healthStatus: OverallStatus
  }),
  telegramActivity: z.object({
    pendingCount: z.number(),
    lastMessageAge: z.number(),
    operatorActive: z.boolean()
  }),
  emailActivity: z
    .object({
      pendingCount: z.number(),
      lastEmailAge: z.number(),
      hasNewEmail: z.boolean()
    })
    .optional(),
  xActivity: z
    .object({
      pendingCount: z.number(),
      lastMentionAge: z.number(),
      hasNewMention: z.boolean()
    })
    .optional(),
  weatherData: WeatherData.optional(),
  gitActivity: z
    .object({
      recentCommits: z.array(
        z.object({
          sha: z.string(),
          message: z.string(),
          date: z.string(),
          isSelfAuthored: z.boolean()
        })
      ),
      selfCommitCount: z.number(),
      externalCommitCount: z.number()
    })
    .optional(),
  emotionalTriggers: z.array(EmotionUpdateEvent)
})
export type PerceptionSummary = z.infer<typeof PerceptionSummary>
