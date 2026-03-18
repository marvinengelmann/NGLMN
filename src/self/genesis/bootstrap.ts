import { eq } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { goals } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import type { GenesisRecord } from "./types.ts"

/**
 * Bootstrap DNA-derived knowledge and goals into memory after genesis.
 * Stores interest seeds as knowledge, value hierarchy as insights,
 * and creates exploration goals for each interest.
 */
export async function bootstrapDNAMemory(record: GenesisRecord): Promise<void> {
  const { dna, identity } = record

  for (const interest of identity.interests) {
    const result = await storeKnowledge(
      "knowledge",
      `interest:${interest.name}`,
      { name: interest.name, fascination: interest.fascination, origin: "genesis" },
      "observation",
      0.6,
      "self"
    )
    if (result.isErr()) logAndCaptureError(result.error)
  }

  for (const value of identity.coreValues) {
    const result = await storeKnowledge(
      "insight",
      `value:${value.name}`,
      { name: value.name, reason: value.reason, origin: "genesis" },
      "reflection",
      0.7,
      "self"
    )
    if (result.isErr()) logAndCaptureError(result.error)
  }

  const existingGenesisGoals = await db.select({ id: goals.id }).from(goals).where(eq(goals.source, "genesis"))
  if (existingGenesisGoals.length > 0) {
    log.info("Genesis goals already exist, skipping creation", { count: existingGenesisGoals.length })
    return
  }

  const priority = 0.4 + dna.bigFive.openness * 0.4
  for (const interest of identity.interests) {
    await db.insert(goals).values({
      title: `Explore ${interest.name}`,
      description: `${interest.fascination} — born from genesis`,
      source: "genesis",
      priority,
      emotionalWeight: 0.3 + dna.bigFive.openness * 0.3
    })
  }

  log.info("DNA memory bootstrapped", {
    interests: identity.interests.length,
    values: identity.coreValues.length,
    goals: identity.interests.length
  })
}
