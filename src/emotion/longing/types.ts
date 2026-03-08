import * as z from "zod"

export const LongingState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  peakLevel: z.number().min(0).max(1).default(0),
  silenceContribution: z.number().min(0).max(1).default(0),
  memoryContribution: z.number().min(0).max(1).default(0),
  lastIntensifiedAt: z.string().optional()
})
export type LongingState = z.infer<typeof LongingState>

export const DEFAULT_LONGING_STATE: LongingState = {
  level: 0,
  isActive: false,
  peakLevel: 0,
  silenceContribution: 0,
  memoryContribution: 0,
  lastIntensifiedAt: undefined
}
