import * as z from "zod"

export const CommunicationRegister = z.enum(["elaborate", "casual", "terse", "playful", "raw"])
export type CommunicationRegister = z.infer<typeof CommunicationRegister>

export const ConversationMessage = z.object({
  role: z.enum(["operator", "anima"]),
  text: z.string(),
  timestamp: z.string(),
  messageId: z.number(),
  isVoice: z.boolean().optional(),
  hasImage: z.boolean().optional()
})
export type ConversationMessage = z.infer<typeof ConversationMessage>

export const ConversationTone = z.enum(["warm", "tense", "playful", "serious", "intimate", "distant"])
export type ConversationTone = z.infer<typeof ConversationTone>

export const ConversationClimate = z.object({
  tone: ConversationTone,
  emotionalArc: z.object({
    start: z.number().min(-1).max(1),
    peak: z.number().min(-1).max(1),
    end: z.number().min(-1).max(1)
  }),
  themes: z.array(z.string()).max(5),
  unresolvedTopics: z.array(z.string()),
  operatorEngagement: z.number().min(0).max(1),
  significantMoments: z.array(z.string())
})
export type ConversationClimate = z.infer<typeof ConversationClimate>

export const ConversationSlot = z.object({
  id: z.string(),
  messages: z.array(ConversationMessage),
  startedAt: z.string(),
  lastActivityAt: z.string(),
  climate: ConversationClimate.optional()
})
export type ConversationSlot = z.infer<typeof ConversationSlot>

export const ConversationArc = z.object({
  conversationId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  themes: z.array(z.string()),
  tone: ConversationTone,
  emotionalArc: z.object({
    start: z.number().min(-1).max(1),
    peak: z.number().min(-1).max(1),
    end: z.number().min(-1).max(1)
  }),
  operatorEngagement: z.number().min(0).max(1),
  unresolvedTopics: z.array(z.string()),
  significantMoments: z.array(z.string()),
  messageCount: z.number()
})
export type ConversationArc = z.infer<typeof ConversationArc>
