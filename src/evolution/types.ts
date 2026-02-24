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
