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
import type { SenseData } from "@/consciousness/types.ts"
import { getEmotionalState } from "@/affect/emotion/state.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { getHealthCheck } from "@/governance/health/state.ts"
import { getPerceptionSummary } from "@/perception/state.ts"

async function dump() {
  console.log("\n  ANIMA Prompt Dump\n")

  const [emotion, perception, health] = await Promise.all([
    getEmotionalState(),
    getPerceptionSummary(),
    getHealthCheck()
  ])

  const senseData: SenseData = {
    pendingMessages: [],
    perception: perception ?? {
      timestamp: nowISO(),
      ownState: { budgetPercent: 0, lastTickAge: 0, errorCount: 0, healthStatus: "healthy" },
      telegramActivity: { pendingCount: 0, lastMessageAge: 0, operatorActive: false },
      emotionalTriggers: []
    },
    health,
    weather: null,
    conversationState: null,
    triggeredWorkflows: [],
    moodContext: {
      operatorSilenceMinutes: 0,
      inConversation: false,
      systemHealthy: true,
      budgetOk: true,
      hasActiveGoals: false,
      isDreaming: false,
      operatorMood: "unknown",
      connectionLevel: 0.5,
      attachmentAvoidance: 0.15
    }
  }

  const contextString = await buildContext(senseData, emotion)
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
