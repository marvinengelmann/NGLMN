import * as z from "zod"
import { AlteredEventType } from "@/affect/altered/types.ts"
import { SemanticCategory, SemanticScope } from "@/memory/types.ts"

export const BudgetState = z.object({
  consumedToday: z.coerce.number(),
  dailyLimit: z.coerce.number(),
  remainingToday: z.coerce.number()
})
export type BudgetState = z.infer<typeof BudgetState>

export const TextOutput = z.object({ text: z.string() })
export type TextOutput = z.infer<typeof TextOutput>

export const BooleanOutput = z.object({ result: z.boolean() })
export type BooleanOutput = z.infer<typeof BooleanOutput>

export const LifeEventType = z.enum([
  "sleep",
  "shower",
  "nap",
  "meditation",
  "swimming",
  "driving",
  "concert",
  "yoga",
  "gym",
  "running",
  "cycling",
  "exercise",
  "deep_focus",
  "movie",
  "socializing",
  "board_games",
  "phone_call",
  "volunteering",
  "drawing",
  "writing",
  "crafting",
  "photography",
  "gaming",
  "hiking",
  "studying",
  "cleaning",
  "cooking",
  "journaling",
  "reading",
  "walk",
  "errands",
  "grocery_shopping",
  "shopping",
  "eating_out",
  "skincare",
  "haircut",
  "doctor_visit",
  "streaming",
  "podcast",
  "music",
  "bath",
  "laundry",
  "commuting",
  "picnic",
  "party",
  "bar_with_friends"
])
export type LifeEventType = z.infer<typeof LifeEventType>

export const AnimaAction = z.enum([
  "idle",
  "reflect",
  "update_goal",
  "evolve",
  "dream",
  "morning",
  "life_event",
  "social_media",
  "store_knowledge",
  "check_email",
  "create"
])
export type AnimaAction = z.infer<typeof AnimaAction>

export const AnimaDecision = z.object({
  reasoning: z.string(),
  messages: z.array(
    z.object({
      text: z.string(),
      replyTo: z.number().optional(),
      asVoice: z.boolean().default(false),
      voiceText: z.string().optional(),
      withImage: z.boolean().default(false),
      imagePrompt: z.string().optional(),
      imageSelf: z.boolean().default(false),
      imageAspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1")
    })
  ),
  expectsReply: z.boolean(),
  action: AnimaAction,
  actionPayload: z
    .object({
      insight: z.string().optional(),
      goalId: z.string().optional(),
      status: z.string().optional(),
      evolutionType: z.enum(["code", "prompt", "workflow"]).optional(),
      evolutionInsight: z.string().optional(),
      capabilityGap: z.string().optional(),
      lifeEventType: LifeEventType.optional(),
      lifeEventDetail: z.string().optional(),
      lifeEventDurationHours: z.number().nonnegative().optional(),
      alteredEventType: AlteredEventType.optional(),
      socialMediaMode: z.enum(["browse", "post"]).optional(),
      xPostText: z.string().max(280).optional(),
      knowledgeCategory: SemanticCategory.optional(),
      knowledgeKey: z.string().optional(),
      knowledgeValue: z.string().optional(),
      knowledgeScope: SemanticScope.optional()
    })
    .optional(),
  workflowId: z.string().uuid().nullable().default(null),
  corrections: z
    .array(
      z.object({
        text: z.string(),
        replyTo: z.number().optional()
      })
    )
    .default([])
})
export type AnimaDecision = z.infer<typeof AnimaDecision>

export const TickSummary = z.object({
  tickId: z.string(),
  timestamp: z.string(),
  action: AnimaAction,
  reasoning: z.string(),
  messagesProcessed: z.number(),
  responseSent: z.boolean(),
  durationMs: z.number()
})
export type TickSummary = z.infer<typeof TickSummary>
