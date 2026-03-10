import * as z from "zod"

export const ConsolidationOutput = z.object({
  semanticEntries: z.array(
    z.object({
      category: z.string(),
      key: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1)
    })
  ),
  connections: z.array(
    z.object({
      sourceEntryIndex: z.number().int().min(0),
      targetEntryIndex: z.number().int().min(0),
      connectionType: z.string(),
      description: z.string()
    })
  ),
  downgradeIds: z.array(z.string())
})
export type ConsolidationOutput = z.infer<typeof ConsolidationOutput>

export const CreativeConnectionsOutput = z.object({
  connections: z.array(
    z.object({
      sources: z.array(z.string()),
      insight: z.string(),
      confidence: z.number().min(0).max(1),
      actionable: z.boolean(),
      suggestedGoal: z.string().nullable()
    })
  ),
  existentialQuestions: z.array(z.string()).default([])
})
export type CreativeConnectionsOutput = z.infer<typeof CreativeConnectionsOutput>

export const ConsolidationResult = z.object({
  episodesProcessed: z.number(),
  semanticEntriesCreated: z.number(),
  connectionsFound: z.number(),
  downgraded: z.number(),
  summarized: z.number().optional(),
  insights: z.array(z.string()).optional()
})
export type ConsolidationResult = z.infer<typeof ConsolidationResult>

export const DreamState = z.enum(["idle", "dreaming", "waking"])
export type DreamState = z.infer<typeof DreamState>

export const DreamNarrativeOutput = z.object({
  narrative: z.string().max(500)
})
export type DreamNarrativeOutput = z.infer<typeof DreamNarrativeOutput>

export const DreamAfterglow = z.object({
  themes: z.array(z.string()),
  emotionalResidue: z.record(z.string(), z.number()).default({}),
  intensity: z.number().min(0).max(1),
  createdAt: z.string()
})
export type DreamAfterglow = z.infer<typeof DreamAfterglow>

export const DreamThinkResult = z.object({
  consolidation: ConsolidationOutput.nullable(),
  creative: CreativeConnectionsOutput.nullable(),
  insights: z.array(z.string()),
  narrative: z.string().nullable()
})
export type DreamThinkResult = z.infer<typeof DreamThinkResult>
