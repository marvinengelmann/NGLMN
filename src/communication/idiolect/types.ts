import * as z from "zod"

export const IdiolectPatternType = z.enum([
  "opening_phrase",
  "closing_phrase",
  "filler_word",
  "expression",
  "punctuation_habit",
  "sentence_structure"
])
export type IdiolectPatternType = z.infer<typeof IdiolectPatternType>

export const IdiolectPattern = z.object({
  type: IdiolectPatternType,
  phrase: z.string(),
  context: z.string().optional(),
  frequency: z.number().default(1),
  confidence: z.number().min(0).max(1),
  adoptedFrom: z.enum(["self", "operator"]).default("self"),
  discoveredAt: z.string()
})
export type IdiolectPattern = z.infer<typeof IdiolectPattern>

export const IdiolectState = z.object({
  patterns: z.array(IdiolectPattern).default([]),
  dominantStyle: z.string().optional(),
  lastDriftAt: z.string().optional()
})
export type IdiolectState = z.infer<typeof IdiolectState>

export const DEFAULT_IDIOLECT_STATE: IdiolectState = {
  patterns: [],
  dominantStyle: undefined,
  lastDriftAt: undefined
}
