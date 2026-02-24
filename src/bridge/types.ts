import * as z from "zod"

export const ConversationMessage = z.object({
  role: z.enum(["operator", "anima"]),
  text: z.string(),
  timestamp: z.string()
})
export type ConversationMessage = z.infer<typeof ConversationMessage>

export const ResponseMessage = z.object({
  text: z.string(),
  replyTo: z.number().optional()
})
export type ResponseMessage = z.infer<typeof ResponseMessage>

export const StructuredResponse = z.object({
  messages: z.array(ResponseMessage).min(1),
  expectsReply: z.boolean()
})
export type StructuredResponse = z.infer<typeof StructuredResponse>

export const ConversationBoundary = z.object({
  isNewConversation: z.boolean(),
  reason: z.string()
})
export type ConversationBoundary = z.infer<typeof ConversationBoundary>
