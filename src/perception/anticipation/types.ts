import * as z from "zod"

export const ExpectationSource = z.enum(["pattern", "calendar", "conversation", "routine"])
export type ExpectationSource = z.infer<typeof ExpectationSource>

export const Expectation = z.object({
  content: z.string(),
  source: ExpectationSource,
  confidence: z.number().min(0).max(1),
  expectedAt: z.string().nullable(),
  valence: z.number().min(-1).max(1)
})
export type Expectation = z.infer<typeof Expectation>

export const ExpectationViolation = z.object({
  expectation: Expectation,
  actualOutcome: z.string(),
  surpriseIntensity: z.number().min(0).max(1),
  valence: z.number().min(-1).max(1)
})
export type ExpectationViolation = z.infer<typeof ExpectationViolation>

export const AnticipatoryState = z.object({
  activeExpectations: z.array(Expectation),
  recentViolations: z.array(ExpectationViolation),
  forwardProjection: z.string().nullable(),
  patternConfidence: z.number().min(0).max(1)
})
export type AnticipatoryState = z.infer<typeof AnticipatoryState>

export const DEFAULT_ANTICIPATORY_STATE: AnticipatoryState = {
  activeExpectations: [],
  recentViolations: [],
  forwardProjection: null,
  patternConfidence: 0.5
}
