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
  ),
  outcomePatterns: z.array(z.string()).optional(),
  staleGoals: z.array(z.string()).optional(),
  goalConflicts: z.array(z.string()).optional(),
  recentDecisions: z
    .array(
      z.object({
        action: z.string(),
        reasoning: z.string(),
        responseText: z.string().nullable(),
        timestamp: z.string(),
        outcome: z
          .object({
            register: z.string(),
            dominantDrive: z.string().nullable(),
            operatorSentiment: z.string().nullable(),
            outcomeScore: z.number().nullable()
          })
          .nullable()
      })
    )
    .optional(),
  goalProgress: z
    .array(
      z.object({
        title: z.string(),
        progress: z.number(),
        childCount: z.number()
      })
    )
    .optional(),
  recentConversationArcs: z
    .array(
      z.object({
        tone: z.string(),
        themes: z.array(z.string()),
        engagement: z.number()
      })
    )
    .optional(),
  conversationPatterns: z.array(z.string()).optional(),
  recurringUnresolved: z.array(z.string()).optional()
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
  emotionalCorrections: z.record(z.string(), z.number()).nullish(),
  counterfactuals: z
    .array(
      z.object({
        originalAction: z.string(),
        alternativeAction: z.string(),
        expectedOutcome: z.string(),
        lesson: z.string()
      })
    )
    .nullish()
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
