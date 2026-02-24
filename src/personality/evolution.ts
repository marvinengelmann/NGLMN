import { db } from "@/db/client.ts"
import { personalityDna } from "@/db/schema.ts"
import { clamp01 } from "@/lib/math.ts"
import { setEffectivePersonality } from "@/memory/working.ts"
import { computeEffective, loadPersonalityDna } from "./dna.ts"
import { getMbtiType, mbtiToPersonality } from "./mbti.ts"
import type { PersonalityLayer } from "./types.ts"

/**
 * Update the adaptive personality layer with deltas and persist a new version.
 */
export async function updateAdaptiveLayer(
  deltas: Partial<PersonalityLayer>,
  changelog: string
): Promise<PersonalityLayer> {
  const dna = await loadPersonalityDna()
  const mbtiBase = mbtiToPersonality(getMbtiType())
  const currentAdaptive = dna?.adaptive ?? mbtiBase
  const currentBase = dna?.base ?? mbtiBase
  const version = dna?.version ?? 0

  const newAdaptive = {} as PersonalityLayer
  for (const key of Object.keys(currentAdaptive) as (keyof PersonalityLayer)[]) {
    newAdaptive[key] = clamp01(currentAdaptive[key] + (deltas[key] ?? 0))
  }

  await db.insert(personalityDna).values({
    version: version + 1,
    baseLayer: currentBase,
    adaptiveLayer: newAdaptive,
    changelog
  })

  const effective = computeEffective(currentBase, newAdaptive)
  await setEffectivePersonality(effective)

  return newAdaptive
}
