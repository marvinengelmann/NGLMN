import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import type { GoalSelect } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { logDissonanceEvent } from "@/self/dissonance/state.ts"

const ConflictAnalysis = z.object({
  hasConflict: z.boolean(),
  description: z.string(),
  severity: z.number().min(0).max(1)
})

const MAX_PAIRS = 3

/**
 * Detect conflicts between active goals via LLM analysis.
 */
export async function detectGoalConflicts(
  activeGoals: GoalSelect[]
): Promise<Array<{ goalA: string; goalB: string; description: string }>> {
  if (activeGoals.length < 2) return []

  const pairs: [GoalSelect, GoalSelect][] = activeGoals
    .flatMap((a, i) => activeGoals.slice(i + 1).map((b) => [a, b] as [GoalSelect, GoalSelect]))
    .slice(0, MAX_PAIRS)

  const conflicts = await pairs.reduce(
    async (accPromise, [a, b]) => {
      const acc = await accPromise
      const result = await callIntelligence({
        system:
          "Analyze whether these two goals conflict with each other. Consider time, resources, and directional tension. Rate severity from 0.0 (trivial) to 1.0 (fundamental contradiction).",
        userMessage: `Goal A: "${a.title}" — ${a.description ?? "no description"}\nGoal B: "${b.title}" — ${b.description ?? "no description"}`,
        schema: ConflictAnalysis,
        maxTokens: 256,
        reasoning: false
      })

      if (result.isOk() && result.value.hasConflict) {
        acc.push({
          goalA: a.title,
          goalB: b.title,
          description: result.value.description
        })

        await logDissonanceEvent({
          declaredValue: `goal: ${a.title}`,
          actualAction: `goal: ${b.title}`,
          dissonanceScore: result.value.severity,
          timestamp: nowISO()
        })
      }

      return acc
    },
    Promise.resolve([] as Array<{ goalA: string; goalB: string; description: string }>)
  )

  if (conflicts.length > 0) {
    log.info("Goal conflicts detected", { count: conflicts.length })
  }

  return conflicts
}
