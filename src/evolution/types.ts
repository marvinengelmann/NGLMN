import * as z from "zod"
import { WorkflowOutputAction, WorkflowTrigger } from "@/workflow/types.ts"

export const EvolutionType = z.enum(["prompt", "workflow", "code"])
export type EvolutionType = z.infer<typeof EvolutionType>

export const EvolutionOutcome = z.enum(["success", "failure", "partial"])
export type EvolutionOutcome = z.infer<typeof EvolutionOutcome>

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

export const InterestsOutput = z.object({
  interests: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
      priority: z.number().min(0).max(1)
    })
  )
})
export type InterestsOutput = z.infer<typeof InterestsOutput>

export const PromptProposalOutput = z.object({
  shouldChange: z.boolean(),
  newPrompt: z.string().nullable(),
  changelog: z.string(),
  reasoning: z.string()
})
export type PromptProposalOutput = z.infer<typeof PromptProposalOutput>

export const WorkflowProposalOutput = z.object({
  shouldCreate: z.boolean(),
  reasoning: z.string(),
  name: z.string(),
  description: z.string(),
  trigger: WorkflowTrigger,
  instruction: z.string(),
  outputAction: WorkflowOutputAction
})
export type WorkflowProposalOutput = z.infer<typeof WorkflowProposalOutput>

export const FileSelectionOutput = z.object({
  paths: z.array(z.string()).max(15)
})
export type FileSelectionOutput = z.infer<typeof FileSelectionOutput>

export const CodeProposalOutput = z.object({
  type: z.literal("proposal").default("proposal"),
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
  reasoning: z.string()
})
export type CodeProposalOutput = z.infer<typeof CodeProposalOutput>

export const FileRequestOutput = z.object({
  type: z.literal("request_files"),
  paths: z.array(z.string()).max(10),
  reason: z.string()
})
export type FileRequestOutput = z.infer<typeof FileRequestOutput>

export const CodeProposalOrFileRequest = z.object({
  type: z.enum(["proposal", "request_files"]),
  shouldEvolve: z.boolean().optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        description: z.string()
      })
    )
    .optional(),
  commitSubject: z.string().optional(),
  commitBody: z.string().optional(),
  testExpectations: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  paths: z.array(z.string()).max(10).optional(),
  reason: z.string().optional(),
  failed: z.boolean().optional()
})
export type CodeProposalOrFileRequest = z.infer<typeof CodeProposalOrFileRequest>
