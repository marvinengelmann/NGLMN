import { and, desc, eq, gt, lt, sql } from "drizzle-orm"
import { callIntelligence } from "@/core/intelligence.ts"
import { db } from "@/infra/db/client.ts"
import type { ProcedureSelect } from "@/infra/db/schema.ts"
import { interactionOutcomes, procedures } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { PROCEDURE_CONSTANTS, ProcedureExtractionOutput, type ProcedureTrigger } from "./types.ts"

/**
 * Find procedures matching the current interaction context, ranked by relevance and success rate.
 */
export function getMatchingProcedures(
  context: ProcedureTrigger,
  limit: number = 5
): AnimaResultAsync<ProcedureSelect[]> {
  return trySafe("PROCEDURE_ERROR", async () => {
    const all = await db
      .select()
      .from(procedures)
      .where(gt(procedures.successRate, 0.3))
      .orderBy(desc(procedures.successRate))
      .limit(50)

    const scored = all.map((proc) => {
      const trigger = proc.trigger as ProcedureTrigger
      let matchScore = 0
      let fields = 0

      if (context.operatorMood && trigger.operatorMood) {
        fields++
        if (trigger.operatorMood === context.operatorMood) matchScore++
      }
      if (context.topic && trigger.topic) {
        fields++
        if (context.topic.toLowerCase().includes(trigger.topic.toLowerCase())) matchScore++
      }
      if (context.timeOfDay && trigger.timeOfDay) {
        fields++
        if (trigger.timeOfDay === context.timeOfDay) matchScore++
      }
      if (context.register && trigger.register) {
        fields++
        if (trigger.register === context.register) matchScore++
      }
      if (context.situation && trigger.situation) {
        fields++
        if (trigger.situation === context.situation) matchScore++
      }

      const triggerMatch = fields > 0 ? matchScore / fields : 0
      return { proc, score: triggerMatch * proc.successRate }
    })

    scored.sort((a, b) => b.score - a.score || b.proc.timesApplied - a.proc.timesApplied)
    return scored
      .filter((s) => s.score > 0)
      .slice(0, limit)
      .map((s) => s.proc)
  })
}

/**
 * Insert a new procedure or strengthen an existing one if the strategy is similar.
 */
export function upsertProcedure(
  trigger: ProcedureTrigger,
  strategy: string,
  source: string = "interaction"
): AnimaResultAsync<string> {
  return trySafe("PROCEDURE_ERROR", async () => {
    const prefix = strategy.slice(0, 60).toLowerCase()
    const existing = await db.select().from(procedures)

    const match = existing.find((p) => p.strategy.slice(0, 60).toLowerCase() === prefix)

    if (match) {
      await db
        .update(procedures)
        .set({
          timesApplied: sql`${procedures.timesApplied} + 1`,
          lastAppliedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(procedures.id, match.id))
      return match.id
    }

    const rows = await db.insert(procedures).values({ trigger, strategy, source }).returning({ id: procedures.id })

    const first = rows[0]
    if (!first) throw new Error("Expected row from procedure insert")
    return first.id
  })
}

/**
 * Update a procedure's outcome tracking after it was applied.
 */
export function updateProcedureOutcome(procedureId: string, succeeded: boolean): AnimaResultAsync<void> {
  return trySafe("PROCEDURE_ERROR", async () => {
    const rows = await db.select().from(procedures).where(eq(procedures.id, procedureId)).limit(1)
    const proc = rows[0]
    if (!proc) return

    const newApplied = proc.timesApplied + 1
    const newSucceeded = proc.timesSucceeded + (succeeded ? 1 : 0)
    const newRate = newSucceeded / newApplied

    await db
      .update(procedures)
      .set({
        timesApplied: newApplied,
        timesSucceeded: newSucceeded,
        successRate: newRate,
        lastAppliedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(procedures.id, procedureId))
  })
}

/**
 * Extract new procedures from recent successful interaction outcomes using LLM analysis.
 */
export function extractProceduresFromOutcomes(): AnimaResultAsync<number> {
  return trySafe("PROCEDURE_ERROR", async () => {
    const cutoff = new Date(Date.now() - PROCEDURE_CONSTANTS.OUTCOME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    const recentOutcomes = await db
      .select()
      .from(interactionOutcomes)
      .where(
        and(
          gt(interactionOutcomes.outcomeScore, PROCEDURE_CONSTANTS.MIN_OUTCOME_SCORE),
          gt(interactionOutcomes.resolvedAt, cutoff)
        )
      )
      .orderBy(desc(interactionOutcomes.outcomeScore))
      .limit(10)

    if (recentOutcomes.length < 3) return 0

    const outcomeSummaries = recentOutcomes.map((o) => {
      const strategy = o.strategy as Record<string, unknown>
      return `Strategy: register=${strategy.register}, topic=${strategy.topicHint}, emotion=${strategy.emotionSummary} → Score: ${o.outcomeScore?.toFixed(2)}`
    })

    const result = await callIntelligence({
      system: `You analyze successful interaction patterns and extract reusable strategies.
Given a list of successful interaction outcomes, identify 1-2 generalizable procedures.
Each procedure should have a trigger (when to apply it) and a strategy (what to do).
Focus on patterns that appeared multiple times across outcomes.`,
      userMessage: `Recent successful interactions:\n${outcomeSummaries.join("\n")}\n\nExtract reusable procedures from these patterns.`,
      schema: ProcedureExtractionOutput,
      reasoning: false,
      temperature: 0.2
    })

    if (result.isErr()) return 0

    let created = 0
    for (const proc of result.value.procedures) {
      const upsertResult = await upsertProcedure(proc.trigger, proc.strategy, "interaction")
      if (upsertResult.isOk()) created++
    }

    if (created > 0) {
      log.debug("Procedures extracted from outcomes", { count: created })
    }

    return created
  })
}

/**
 * Remove procedures that have been tried enough times and have proven to fail.
 */
export function pruneProcedures(): AnimaResultAsync<number> {
  return trySafe("PROCEDURE_ERROR", async () => {
    const pruned = await db
      .delete(procedures)
      .where(
        and(
          gt(procedures.timesApplied, PROCEDURE_CONSTANTS.MIN_APPLICATIONS_FOR_PRUNE),
          lt(procedures.successRate, PROCEDURE_CONSTANTS.FAILURE_THRESHOLD)
        )
      )
      .returning({ id: procedures.id })

    if (pruned.length > 0) {
      log.debug("Procedures pruned", { count: pruned.length })
    }

    return pruned.length
  })
}
