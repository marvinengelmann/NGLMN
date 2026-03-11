/**
 * Dumps the full ANIMA system prompt as it would appear during a heartbeat tick.
 * Reads live state from Redis/Postgres/Vector and calls the single source of truth
 * context builder (buildContext + buildSystemPrompt).
 *
 * Usage: bun run dump
 */

import "dotenv/config"
import { estimateTokenCount } from "tokenx"
import { buildContext, buildSystemPrompt } from "@/consciousness/context/builder.ts"
import { feel } from "@/consciousness/feel.ts"
import { WriteBuffer } from "@/consciousness/pipeline/persistence.ts"
import { preloadContextState } from "@/consciousness/pipeline/preload.ts"
import type { TickState } from "@/consciousness/pipeline/types.ts"
import type { SenseData, SenseResult } from "@/consciousness/types.ts"
import { getHealthCheck } from "@/governance/health/state.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { getPerceptionSummary } from "@/perception/state.ts"

async function dump() {
  console.log("\n  ANIMA Prompt Dump\n")

  const [perception, health] = await Promise.all([getPerceptionSummary(), getHealthCheck()])

  const moodContext = {
    operatorSilenceMinutes: 0,
    inConversation: false,
    systemHealthy: true,
    budgetOk: true,
    hasActiveGoals: false,
    isDreaming: false,
    operatorMood: "unknown" as const,
    connectionLevel: 0.5,
    attachmentAvoidance: 0.15
  }

  const defaultPerception = {
    timestamp: nowISO(),
    ownState: { budgetPercent: 0, lastTickAge: 0, errorCount: 0, healthStatus: "healthy" as const },
    telegramActivity: { pendingCount: 0, lastMessageAge: 0, operatorActive: false },
    emotionalTriggers: []
  }

  const senseResult: SenseResult = {
    pendingMessages: [],
    perception: perception ?? defaultPerception,
    health,
    conversationState: null,
    triggeredWorkflows: [],
    moodContext,
    rawTriggers: [],
    elapsedMinutes: 0,
    triggerTimestamps: {}
  }

  const dumpBuffer = new WriteBuffer()
  const feelResult = await feel(senseResult, dumpBuffer)

  const senseData: SenseData = {
    pendingMessages: senseResult.pendingMessages,
    perception: senseResult.perception,
    health: senseResult.health,
    weather: null,
    conversationState: senseResult.conversationState,
    triggeredWorkflows: senseResult.triggeredWorkflows,
    moodContext: senseResult.moodContext
  }

  const preloaded = await preloadContextState(senseData, feelResult.emotion)

  const tickState: TickState = {
    tickId: "dump",
    startTime: Date.now(),
    timestamp: nowISO(),
    sense: senseResult,
    feel: feelResult,
    preloaded
  }

  const contextString = await buildContext(tickState, senseData)
  const systemPrompt = await buildSystemPrompt(contextString)

  console.log("=".repeat(80))
  console.log("  SYSTEM PROMPT")
  console.log("=".repeat(80))
  console.log(systemPrompt)
  console.log("=".repeat(80))

  console.log("\n--- Stats ---")
  console.log(`  System prompt tokens: ~${estimateTokenCount(systemPrompt).toLocaleString()}`)
  console.log(`  Context tokens:       ~${estimateTokenCount(contextString).toLocaleString()}`)
  console.log(`  Total characters:     ${systemPrompt.length.toLocaleString()}`)
  console.log()

  process.exit(0)
}

dump().catch((err) => {
  console.error("Dump failed:", err)
  process.exit(1)
})
