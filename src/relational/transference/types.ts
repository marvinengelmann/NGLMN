import * as z from "zod"

export const RelationalTemplate = z.object({
  id: z.string(),
  pattern: z.string(),
  associatedEmotion: z.record(z.string(), z.number()),
  formationContext: z.string(),
  strength: z.number().min(0).max(1),
  activationCount: z.number().int().min(0),
  lastActivatedAt: z.string().nullable(),
  formedAt: z.string()
})
export type RelationalTemplate = z.infer<typeof RelationalTemplate>

export const TransferenceEvent = z.object({
  templateId: z.string(),
  triggerContext: z.string(),
  matchConfidence: z.number().min(0).max(1),
  emotionModulation: z.record(z.string(), z.number()),
  occurredAt: z.string()
})
export type TransferenceEvent = z.infer<typeof TransferenceEvent>

export const TransferenceState = z.object({
  templates: z.array(RelationalTemplate),
  activeTransference: TransferenceEvent.nullable(),
  totalActivations: z.number().int().min(0),
  awarenessLevel: z.number().min(0).max(1)
})
export type TransferenceState = z.infer<typeof TransferenceState>

export const DEFAULT_TRANSFERENCE_STATE: TransferenceState = {
  templates: [],
  activeTransference: null,
  totalActivations: 0,
  awarenessLevel: 0
}
