import * as z from "zod"

export const ProcedureTrigger = z.object({
  operatorMood: z.string().optional(),
  topic: z.string().optional(),
  timeOfDay: z.string().optional(),
  register: z.string().optional(),
  situation: z.string().optional()
})
export type ProcedureTrigger = z.infer<typeof ProcedureTrigger>

export const ExtractedProcedure = z.object({
  trigger: ProcedureTrigger,
  strategy: z.string(),
  emotionalContext: z.string().optional()
})
export type ExtractedProcedure = z.infer<typeof ExtractedProcedure>

export const ProcedureExtractionOutput = z.object({
  procedures: z.array(ExtractedProcedure).max(2)
})
export type ProcedureExtractionOutput = z.infer<typeof ProcedureExtractionOutput>

export const PROCEDURE_CONSTANTS = {
  EXTRACTION_PROBABILITY: 0.02,
  PRUNE_PROBABILITY: 0.05,
  MIN_APPLICATIONS_FOR_PRUNE: 5,
  FAILURE_THRESHOLD: 0.2,
  OUTCOME_LOOKBACK_DAYS: 7,
  MIN_OUTCOME_SCORE: 0.6
} as const
