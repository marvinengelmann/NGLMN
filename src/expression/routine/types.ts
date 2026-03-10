import * as z from "zod"
import { EmotionalState } from "@/affect/emotion/types.ts"

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
        connection: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1).default(0.5),
        energy: z.number().min(0).max(1).default(0.8)
      }),
      trigger: z.string().nullable(),
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
  existentialQuestions: z.array(z.string()).default([]),
  newGoals: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number()
      })
    )
    .nullish(),
  emotionalCorrections: z.record(z.string(), z.number()).nullish()
})
export type ReflectionOutput = z.infer<typeof ReflectionOutput>

export const ReflectionContext = z.object({
  emotion: EmotionalState,
  lastReflectionAt: z.string().nullable()
})
export type ReflectionContext = z.infer<typeof ReflectionContext>

export const MorningThinkResult = z.object({
  recalibratedEmotion: EmotionalState,
  reflection: ReflectionOutput,
  morningMessage: z.string()
})
export type MorningThinkResult = z.infer<typeof MorningThinkResult>
