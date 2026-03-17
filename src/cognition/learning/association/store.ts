import { and, eq, lt } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { hebbianAssociations } from "@/infra/db/schema.ts"
import type { HebbianAssociation } from "./types.ts"

/**
 * Get all associations from Postgres.
 */
export async function getAllAssociations(): Promise<HebbianAssociation[]> {
  const rows = await db.select().from(hebbianAssociations)
  return rows.map((row) => ({
    id: row.id,
    stimulusA: row.stimulusA,
    stimulusB: row.stimulusB,
    strength: row.strength,
    coactivationCount: row.coactivationCount,
    lastCoactivatedAt: row.lastCoactivatedAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  }))
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
