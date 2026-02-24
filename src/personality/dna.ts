import { desc, eq } from "drizzle-orm"
import { PERSONALITY } from "@/config/constants.ts"
import { db } from "@/db/client.ts"
import { personalityDna } from "@/db/schema.ts"
import { setEffectivePersonality } from "@/memory/working.ts"
import { getMbtiType, mbtiToPersonality } from "./mbti.ts"
import type { PersonalityDna } from "./types.ts"
import { PersonalityLayer } from "./types.ts"

/**
 * Compute the effective personality by blending base and adaptive layers.
 */
export function computeEffective(base: PersonalityLayer, adaptive: PersonalityLayer): PersonalityLayer {
  const result = {} as PersonalityLayer
  for (const key of Object.keys(base) as (keyof PersonalityLayer)[]) {
    result[key] = base[key] * PERSONALITY.BASE_WEIGHT + adaptive[key] * PERSONALITY.ADAPTIVE_WEIGHT
  }
  return result
}

/**
 * Load the latest PersonalityDna with its version from the database.
 */
export async function loadPersonalityDna(): Promise<(PersonalityDna & { version: number }) | null> {
  const rows = await db.select().from(personalityDna).orderBy(desc(personalityDna.version)).limit(1)

  if (rows.length === 0) return null

  const row = rows[0]
  if (!row) return null

  const base = PersonalityLayer.parse(row.baseLayer)
  const adaptive = PersonalityLayer.parse(row.adaptiveLayer)

  return { base, adaptive, version: row.version }
}

/**
 * Load personality DNA, compute effective layer, and cache in Redis.
 */
export async function getEffectivePersonality(): Promise<PersonalityLayer> {
  const dna = await loadPersonalityDna()
  const base = mbtiToPersonality(getMbtiType())

  if (!dna) {
    await setEffectivePersonality(base)
    return base
  }

  const effective = computeEffective(base, dna.adaptive)
  await setEffectivePersonality(effective)
  return effective
}

/**
 * Get the current personality DNA version number.
 */
export async function getCurrentVersion(): Promise<number> {
  const dna = await loadPersonalityDna()
  return dna?.version ?? 0
}

/**
 * Get version history of personality DNA.
 */
export async function getVersionHistory(
  limit: number = 10
): Promise<Array<{ version: number; changelog: string | null; createdAt: Date | null }>> {
  return db
    .select({
      version: personalityDna.version,
      changelog: personalityDna.changelog,
      createdAt: personalityDna.createdAt
    })
    .from(personalityDna)
    .orderBy(desc(personalityDna.version))
    .limit(limit)
}

/**
 * Revert personality to a specific version by loading it and creating a new version.
 */
export async function revertToVersion(targetVersion: number): Promise<PersonalityLayer> {
  const rows = await db.select().from(personalityDna).where(eq(personalityDna.version, targetVersion)).limit(1)

  const target = rows[0]
  if (!target) {
    throw new Error(`Personality version ${targetVersion} not found`)
  }
  const base = PersonalityLayer.parse(target.baseLayer)
  const adaptive = PersonalityLayer.parse(target.adaptiveLayer)

  const currentVersion = await getCurrentVersion()

  await db.insert(personalityDna).values({
    version: currentVersion + 1,
    baseLayer: base,
    adaptiveLayer: adaptive,
    changelog: `Reverted to version ${targetVersion}`
  })

  const effective = computeEffective(base, adaptive)
  await setEffectivePersonality(effective)

  return effective
}
