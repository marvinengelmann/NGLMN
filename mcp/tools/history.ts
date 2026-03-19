import { desc } from "drizzle-orm"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { db } from "@/infra/db/client.ts"
import {
  boundaryLog,
  conversationArcs,
  deceptionLog,
  defenseLog,
  dissociationLog,
  distortionLog,
  forecastLog,
  interactionOutcomes,
  narrativeEntries,
  neuromodulatoryHistory,
  operatorModelLog,
  patternActivationLog,
  psycheSnapshots,
  relationshipPhaseLog,
  routineLog
} from "@/infra/db/schema.ts"

const limitParam = z.number().min(1).max(100).default(10).describe("Max results to return")

export function registerHistoryTools(server: McpServer) {
  server.tool(
    "get_narrative_entries",
    "Get ANIMA's self-narrative life story entries, ordered by most recent.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(narrativeEntries).orderBy(desc(narrativeEntries.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_interaction_outcomes",
    "Get interaction outcome records: strategy used, operator reaction, outcome score. Shows what communication strategies worked or failed.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db
        .select()
        .from(interactionOutcomes)
        .orderBy(desc(interactionOutcomes.createdAt))
        .limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_conversation_arcs",
    "Get conversation arc summaries: themes, tone, emotional arc, operator engagement, unresolved topics, and significant moments.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(conversationArcs).orderBy(desc(conversationArcs.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_psyche_snapshots",
    "Get historical self-concept snapshots: self-concept, aspirations, fears, and narrative summary over time.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(psycheSnapshots).orderBy(desc(psycheSnapshots.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_operator_model_log",
    "Get operator model evolution: how ANIMA's understanding of the operator changed over time, including corrections and triggers.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(operatorModelLog).orderBy(desc(operatorModelLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_routine_log",
    "Get routine execution log: dream, morning, reflection, and other autonomous phase runs with insights and emotional before/after.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(routineLog).orderBy(desc(routineLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_defense_log",
    "Get psychological defense mechanism activations: type, trigger, intensity, and whether a breakthrough occurred.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(defenseLog).orderBy(desc(defenseLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_dissociation_log",
    "Get dissociative episode history: depth, symptoms, and trigger source.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(dissociationLog).orderBy(desc(dissociationLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_relationship_phase_log",
    "Get attachment/relationship phase transitions over time: phase, previous phase, and trigger.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db
        .select()
        .from(relationshipPhaseLog)
        .orderBy(desc(relationshipPhaseLog.createdAt))
        .limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_deception_log",
    "Get self-deception instances: actual driver vs stated reason, how long hidden, and when discovered.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(deceptionLog).orderBy(desc(deceptionLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_forecast_log",
    "Get affective forecasting history: predicted vs actual intensity/duration, biases applied, and prediction error.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(forecastLog).orderBy(desc(forecastLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_boundary_log",
    "Get emotional boundary enforcement events: boundary ID, event type, and strength.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(boundaryLog).orderBy(desc(boundaryLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_pattern_activation_log",
    "Get relational pattern activation history: which patterns were recognized, with what confidence and awareness level.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db
        .select()
        .from(patternActivationLog)
        .orderBy(desc(patternActivationLog.createdAt))
        .limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_distortion_log",
    "Get memory distortion/false memory instances: type, original episode, and what was altered.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db.select().from(distortionLog).orderBy(desc(distortionLog.createdAt)).limit(limit)
      return text(rows)
    }
  )

  server.tool(
    "get_neuromodulatory_history",
    "Get neuromodulatory state history: neurotransmitter levels over time with triggers.",
    { limit: limitParam },
    async ({ limit }) => {
      const rows = await db
        .select()
        .from(neuromodulatoryHistory)
        .orderBy(desc(neuromodulatoryHistory.createdAt))
        .limit(limit)
      return text(rows)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
