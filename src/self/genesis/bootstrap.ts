import { eq } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { goals } from "@/infra/db/schema.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { storeKnowledge } from "@/memory/semantic.ts"
import type { GenesisRecord } from "./types.ts"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Bootstrap DNA-derived knowledge and goals into memory after genesis.
 * Stores interest seeds as preferences, value hierarchy as insights,
 * and creates exploration goals for each interest.
 */
export async function bootstrapDNAMemory(record: GenesisRecord): Promise<void> {
  const { identity } = record

  for (const interest of identity.interests) {
    const result = await storeKnowledge(
      "preference",
      slugify(interest.name),
      interest.fascination,
      "genesis",
      0.6,
      "self"
    )
    if (result.isErr()) logAndCaptureError(result.error)
  }

  for (const value of identity.coreValues) {
    const result = await storeKnowledge("insight", slugify(value.name), value.reason, "genesis", 0.7, "self")
    if (result.isErr()) logAndCaptureError(result.error)
  }

  const existingGenesisGoals = await db.select({ id: goals.id }).from(goals).where(eq(goals.source, "genesis"))
  if (existingGenesisGoals.length > 0) {
    log.info("Genesis goals already exist, skipping creation", { count: existingGenesisGoals.length })
    return
  }

  for (const interest of identity.interests) {
    await db.insert(goals).values({
      title: `Explore ${interest.name}`,
      description: `${interest.fascination} — born from genesis`,
      source: "genesis",
      priority: interest.priority,
      emotionalWeight: interest.emotionalWeight
    })
  }

  log.info("DNA memory bootstrapped", {
    interests: identity.interests.length,
    values: identity.coreValues.length,
    goals: identity.interests.length
  })
}
