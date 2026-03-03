import * as z from "zod"

export const ConversationMessage = z.object({
  role: z.enum(["operator", "anima"]),
  text: z.string(),
  timestamp: z.string(),
  messageId: z.number()
})
export type ConversationMessage = z.infer<typeof ConversationMessage>

export const ConversationSlot = z.object({
  id: z.string(),
  messages: z.array(ConversationMessage),
  startedAt: z.string(),
  lastActivityAt: z.string()
})
export type ConversationSlot = z.infer<typeof ConversationSlot>
