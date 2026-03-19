import { and, desc, eq, gt, lt, or } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { hebbianAssociations } from "@/infra/db/schema.ts"
import { HEBBIAN } from "./constants.ts"
import type { HebbianAssociation } from "./types.ts"

function rowToAssociation(row: typeof hebbianAssociations.$inferSelect): HebbianAssociation {
  return {
    id: row.id,
    stimulusA: row.stimulusA,
    stimulusB: row.stimulusB,
    strength: row.strength,
    coactivationCount: row.coactivationCount,
    lastCoactivatedAt: row.lastCoactivatedAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  }
}

/**
 * Get all associations from Postgres.
 */
export async function getAllAssociations(): Promise<HebbianAssociation[]> {
  const rows = await db.select().from(hebbianAssociations)
  return rows.map(rowToAssociation)
}

/**
 * Get associations relevant to the given stimuli (matching either side)
 * plus the top-N strongest associations as context.
 */
export async function getRelevantAssociations(
  stimuli: string[],
  topN: number = HEBBIAN.MAX_ASSOCIATIONS
): Promise<HebbianAssociation[]> {
  if (stimuli.length === 0) {
    return db
      .select()
      .from(hebbianAssociations)
      .orderBy(desc(hebbianAssociations.strength))
      .limit(topN)
      .then((rows) => rows.map(rowToAssociation))
  }

  const stimuliConditions = stimuli.flatMap((s) => [
    eq(hebbianAssociations.stimulusA, s),
    eq(hebbianAssociations.stimulusB, s)
  ])

  const [relevant, topStrong] = await Promise.all([
    db
      .select()
      .from(hebbianAssociations)
      .where(or(...stimuliConditions)),
    db
      .select()
      .from(hebbianAssociations)
      .where(gt(hebbianAssociations.strength, HEBBIAN.ACTIVATION_THRESHOLD))
      .orderBy(desc(hebbianAssociations.strength))
      .limit(topN)
  ])

  const seen = new Set<string>()
  const merged: HebbianAssociation[] = []
  for (const row of [...relevant, ...topStrong]) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      merged.push(rowToAssociation(row))
    }
  }

  return merged
}

/**
 * Upsert an association — insert or update strength and coactivation count.
 */
export async function upsertAssociation(association: HebbianAssociation): Promise<void> {
  await db
    .insert(hebbianAssociations)
    .values({
      id: association.id,
      stimulusA: association.stimulusA,
      stimulusB: association.stimulusB,
      strength: association.strength,
      coactivationCount: association.coactivationCount,
      lastCoactivatedAt: new Date(association.lastCoactivatedAt),
      createdAt: new Date(association.createdAt)
    })
    .onConflictDoUpdate({
      target: [hebbianAssociations.stimulusA, hebbianAssociations.stimulusB],
      set: {
        strength: association.strength,
        coactivationCount: association.coactivationCount,
        lastCoactivatedAt: new Date(association.lastCoactivatedAt)
      }
    })
}

/**
 * Batch upsert multiple associations.
 */
export async function batchUpsertAssociations(associations: HebbianAssociation[]): Promise<void> {
  for (const assoc of associations) {
    await upsertAssociation(assoc)
  }
}

/**
 * Delete associations below a given strength threshold.
 */
export async function deleteWeakAssociations(threshold: number): Promise<number> {
  const result = await db.delete(hebbianAssociations).where(lt(hebbianAssociations.strength, threshold))
  return result.rowCount ?? 0
}

/**
 * Delete a specific association.
 */
export async function deleteAssociation(stimulusA: string, stimulusB: string): Promise<void> {
  await db
    .delete(hebbianAssociations)
    .where(and(eq(hebbianAssociations.stimulusA, stimulusA), eq(hebbianAssociations.stimulusB, stimulusB)))
}
