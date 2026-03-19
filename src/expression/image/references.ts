import { and, eq, inArray, sql } from "drizzle-orm"
import { callImaging } from "@/core/imaging.ts"
import { db } from "@/infra/db/client.ts"
import { visualReferences } from "@/infra/db/schema.ts"
import { deleteVisualReference, uploadVisualReference } from "@/infra/integrations/blob.ts"
import { IMAGE } from "@/infra/integrations/constants.ts"
import { log } from "@/infra/lib/logger.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { logAndCaptureError, trySafe } from "@/infra/lib/result.ts"
import { getReferencePrompt } from "@/prompts/image.ts"
import type { VisualReferenceCategory } from "./types.ts"

const PERSON_DEPENDENT_CATEGORIES: VisualReferenceCategory[] = [
  "full_body",
  "casual_outfit",
  "formal_outfit",
  "sleepwear",
  "workout_outfit"
]

/**
 * Get active visual reference URLs for the given categories.
 * Updates usage tracking (count + timestamp) as a side effect.
 */
export function getActiveReferences(
  categories: VisualReferenceCategory[]
): AnimaResultAsync<Map<VisualReferenceCategory, string>> {
  return trySafe("DB_ERROR", async () => {
    if (categories.length === 0) return new Map()

    const rows = await db
      .select({ category: visualReferences.category, blobUrl: visualReferences.blobUrl, id: visualReferences.id })
      .from(visualReferences)
      .where(and(inArray(visualReferences.category, categories), eq(visualReferences.active, true)))

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      await db
        .update(visualReferences)
        .set({
          usageCount: sql`${visualReferences.usageCount} + 1`,
          lastUsedAt: new Date()
        })
        .where(inArray(visualReferences.id, ids))
    }

    const result = new Map<VisualReferenceCategory, string>()
    for (const row of rows) {
      result.set(row.category as VisualReferenceCategory, row.blobUrl)
    }
    return result
  })
}

/**
 * Ensure all requested reference categories exist, generating missing ones on-the-fly.
 * Returns blob URLs for all categories (existing + newly generated), capped at MAX_REFERENCES.
 */
export function ensureReferences(categories: VisualReferenceCategory[]): AnimaResultAsync<string[]> {
  return trySafe("IMAGE_ERROR", async () => {
    if (categories.length === 0) return []

    const existingResult = await getActiveReferences(categories)
    if (existingResult.isErr()) {
      logAndCaptureError(existingResult.error, { phase: "visual_reference_lookup" })
      return []
    }

    const existing = existingResult.value
    const missing = categories.filter((c) => !existing.has(c))

    if (missing.length > 0) {
      ensurePortraitFirst(missing, existing)

      for (const category of missing) {
        const genResult = await generateReference(category, existing)
        if (genResult.isOk()) {
          existing.set(category, genResult.value)
          log.info("Generated visual reference", { category })
        } else {
          logAndCaptureError(genResult.error, { phase: "visual_reference_generation", category })
        }
      }
    }

    const urls = categories.flatMap((c) => {
      const url = existing.get(c)
      return url ? [url] : []
    })

    return urls.slice(0, IMAGE.MAX_REFERENCES)
  })
}

/**
 * Reorder missing categories so portrait is generated first when needed by dependent categories.
 */
function ensurePortraitFirst(missing: VisualReferenceCategory[], existing: Map<VisualReferenceCategory, string>): void {
  const needsPortrait = missing.some((c) => PERSON_DEPENDENT_CATEGORIES.includes(c))
  const portraitIdx = missing.indexOf("portrait")

  if (needsPortrait && !existing.has("portrait") && portraitIdx === -1) {
    missing.unshift("portrait")
  } else if (portraitIdx > 0) {
    missing.splice(portraitIdx, 1)
    missing.unshift("portrait")
  }
}

/**
 * Generate a new visual reference for a category.
 * Uploads to Blob Store, replaces old reference in DB, and cleans up stale blobs.
 */
function generateReference(
  category: VisualReferenceCategory,
  existingRefs: Map<VisualReferenceCategory, string>
): AnimaResultAsync<string> {
  return trySafe("IMAGE_ERROR", async () => {
    const prompt = await getReferencePrompt(category)
    const referenceImages: string[] = []

    if (PERSON_DEPENDENT_CATEGORIES.includes(category)) {
      const portraitUrl = existingRefs.get("portrait")
      if (portraitUrl) referenceImages.push(portraitUrl)
    }

    const imageResult = await callImaging({ prompt, referenceImages })
    if (imageResult.isErr()) throw imageResult.error.cause ?? new Error(imageResult.error.message)

    const blobUrl = await uploadVisualReference(category, imageResult.value)

    const oldRefs = await db
      .select({ id: visualReferences.id, blobUrl: visualReferences.blobUrl })
      .from(visualReferences)
      .where(and(eq(visualReferences.category, category), eq(visualReferences.active, true)))

    await db
      .update(visualReferences)
      .set({ active: false })
      .where(and(eq(visualReferences.category, category), eq(visualReferences.active, true)))

    await db.insert(visualReferences).values({
      category,
      blobUrl,
      promptUsed: prompt,
      generationCost: 0,
      active: true
    })

    for (const oldRef of oldRefs) {
      deleteVisualReference(oldRef.blobUrl).catch((e) => {
        log.warn("Failed to delete old visual reference blob", { blobUrl: oldRef.blobUrl, error: String(e) })
      })
    }

    return blobUrl
  })
}

/**
 * Regenerate the portrait reference and return the raw image buffer.
 * Invalidates old portrait + all person-dependent references (outfits, full_body)
 * so they get regenerated with the new face on next use.
 */
export async function refreshPortraitReference(): Promise<Buffer | null> {
  const prompt = await getReferencePrompt("portrait")

  const imageResult = await callImaging({ prompt })
  if (imageResult.isErr()) {
    logAndCaptureError(imageResult.error, { phase: "portrait_refresh" })
    return null
  }

  const buffer = imageResult.value
  const blobUrl = await uploadVisualReference("portrait", buffer)

  const categoriesToInvalidate: VisualReferenceCategory[] = ["portrait", ...PERSON_DEPENDENT_CATEGORIES]
  const oldRefs = await db
    .select({ id: visualReferences.id, blobUrl: visualReferences.blobUrl })
    .from(visualReferences)
    .where(and(inArray(visualReferences.category, categoriesToInvalidate), eq(visualReferences.active, true)))

  await db
    .update(visualReferences)
    .set({ active: false })
    .where(and(inArray(visualReferences.category, categoriesToInvalidate), eq(visualReferences.active, true)))

  await db.insert(visualReferences).values({
    category: "portrait",
    blobUrl,
    promptUsed: prompt,
    generationCost: 0,
    active: true
  })

  for (const oldRef of oldRefs) {
    deleteVisualReference(oldRef.blobUrl).catch((e) => {
      log.warn("Failed to delete old reference blob", { blobUrl: oldRef.blobUrl, error: String(e) })
    })
  }

  log.info("Portrait reference refreshed, person-dependent references invalidated")
  return buffer
}
