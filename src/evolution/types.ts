import * as z from "zod"

const EvolutionType = z.enum(["prompt", "workflow", "code"])

export const ActiveEvolution = z.object({
  type: EvolutionType,
  promptId: z.string().optional(),
  insight: z.string().optional(),
  capabilityGap: z.string().optional(),
  startedAt: z.string()
})
export type ActiveEvolution = z.infer<typeof ActiveEvolution>

export const EvolutionCycleResult = z.object({
  action: z.enum(["applied", "pending", "denied", "failed", "error"]),
  commitSubject: z.string().optional(),
  insight: z.string().optional(),
  capabilityGap: z.string().optional(),
  reasoning: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().optional()
})
export type EvolutionCycleResult = z.infer<typeof EvolutionCycleResult>

export const CodeProposal = z.object({
  shouldEvolve: z.boolean(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      description: z.string()
    })
  ),
  commitSubject: z.string(),
  commitBody: z.string(),
  testExpectations: z.array(z.string()),
  reasoning: z.string(),
  autonomous: z.boolean(),
  failed: z.boolean().optional()
})
export type CodeProposal = z.infer<typeof CodeProposal>

export const PreviousAttempt = z.object({
  error: z.string(),
  sandboxStderr: z.string()
})
export type PreviousAttempt = z.infer<typeof PreviousAttempt>
