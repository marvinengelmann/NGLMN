/**
 * Seed script for baseline system data.
 *
 * Seeds only operational necessities: trust levels, initial emotion state, boot tick.
 * ANIMA starts with zero knowledge — she learns everything organically.
 *
 * Automatically runs on worker start via init.ts (ensureSeeded).
 * Can also be run manually: bun run db:seed
 */

import "dotenv/config"
import { count } from "drizzle-orm"
import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import { setLastTickSummary } from "@/memory/working.ts"
import { db } from "./client.ts"
import { emotionHistory, trustLevels } from "./schema.ts"

const ACTION_TYPE_DEFAULTS: Array<{ actionType: string }> = [
  { actionType: "add_goal" },
  { actionType: "git_commit" },
  { actionType: "prompt_modification" },
  { actionType: "workflow_creation" },
  { actionType: "deployment" },
  { actionType: "code_modification" }
]

async function seed() {
  console.log("Seeding baseline data...")

  console.log("\nSeeding Trust Level baselines...")
  for (const entry of ACTION_TYPE_DEFAULTS) {
    await db.insert(trustLevels).values({
      actionType: entry.actionType,
      totalAttempts: 0,
      successfulAttempts: 0
    })
    console.log(`  + trust/${entry.actionType}`)
  }

  console.log("\nSeeding initial emotional state...")
  await db.insert(emotionHistory).values({
    state: DEFAULT_EMOTIONAL_STATE,
    trigger: "morning_calibration"
  })
  console.log("  + Initial emotional state")

  console.log("\nSeeding boot tick...")
  await setLastTickSummary({
    tickId: `tick-boot-${Date.now()}`,
    timestamp: nowISO(),
    action: "idle",
    reasoning: "System boot — initial seed completed.",
    messagesProcessed: 0,
    responseSent: false,
    durationMs: 0
  })
  console.log("  + Boot tick summary")

  console.log(`\nDone! Seeded: ${ACTION_TYPE_DEFAULTS.length} trust levels, 1 emotion state, 1 boot tick.`)
}

/**
 * Idempotent seed guard — checks if baseline data exists in required tables.
 * Called automatically from init.ts on every worker cold start.
 */
export async function ensureSeeded(): Promise<void> {
  const [[tlRow], [ehRow]] = await Promise.all([
    db.select({ n: count() }).from(trustLevels),
    db.select({ n: count() }).from(emotionHistory)
  ])

  if (tlRow && tlRow.n > 0 && ehRow && ehRow.n > 0) return

  console.log("[ensureSeeded] Missing baseline data — running seed...")
  await seed()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSeeded().catch(console.error)
}
