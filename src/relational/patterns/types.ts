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

export const PatternActivationEvent = z.object({
  templateId: z.string(),
  triggerContext: z.string(),
  matchConfidence: z.number().min(0).max(1),
  emotionModulation: z.record(z.string(), z.number()),
  occurredAt: z.string()
})
export type PatternActivationEvent = z.infer<typeof PatternActivationEvent>

export const RelationalPatternState = z.object({
  templates: z.array(RelationalTemplate),
  activePattern: PatternActivationEvent.nullable(),
  totalActivations: z.number().int().min(0),
  awarenessLevel: z.number().min(0).max(1)
})
export type RelationalPatternState = z.infer<typeof RelationalPatternState>

export const DEFAULT_RELATIONAL_PATTERN_STATE: RelationalPatternState = {
  templates: [],
  activePattern: null,
  totalActivations: 0,
  awarenessLevel: 0
}
