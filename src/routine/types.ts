import * as z from "zod"

export const ReflectionInput = z.object({
  successRate: z.number(),
  errorRate: z.number(),
  costToday: z.number(),
  tickCount: z.number(),
  operatorInteractions: z.number(),
  operatorSentiment: z.number().optional(),
  emotionalHistory: z.array(
    z.object({
      state: z.object({
        curiosity: z.number().min(0).max(1),
        satisfaction: z.number().min(0).max(1),
        frustration: z.number().min(0).max(1),
        boredom: z.number().min(0).max(1),
        excitement: z.number().min(0).max(1),
        caution: z.number().min(0).max(1),
        connection: z.number().min(0).max(1)
      }),
      trigger: z.string().nullable(),
      createdAt: z.string()
    })
  ),
  personalityChanges: z.array(
    z.object({
      version: z.number(),
      changelog: z.string().nullable(),
      createdAt: z.string()
    })
  ),
  unresolvedGoals: z.array(
    z.object({
      title: z.string(),
      priority: z.number(),
      source: z.string()
    })
  ),
  failedExperiments: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      outcome: z.string().nullable()
    })
  )
})
export type ReflectionInput = z.infer<typeof ReflectionInput>

export const ReflectionOutput = z.object({
  insights: z.array(z.string()),
  selfInsights: z.array(z.string()).nullish(),
  personalityDeltas: z.record(z.string(), z.number()).nullish(),
  newGoals: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number()
      })
    )
    .nullish(),
  morningMessageDraft: z.string().nullish(),
  emotionalCorrections: z.record(z.string(), z.number()).nullish()
})
export type ReflectionOutput = z.infer<typeof ReflectionOutput>

export interface ReflectionResult {
  reason: string
  output: ReflectionOutput
}
