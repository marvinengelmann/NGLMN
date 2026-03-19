import { TRIGGER_INTENSITY } from "@/affect/emotion/constants.ts"
import { processEmotionTrigger } from "@/affect/emotion/state.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { getKnowledge, storeKnowledge, updateConfidence } from "@/memory/semantic.ts"
import type { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"

interface SemanticEntry {
  category: SemanticCategory
  key: string
  value: unknown
  source: SemanticSource
  confidence: number
}

interface ExistingEntry {
  id: string
  category: string
  key: string
  value: unknown
  confidence: number | null
  source: string | null
}

type ContradictionType = "value_conflict" | "temporal_supersede" | "scope_mismatch"

interface ConsistencyCheck {
  newEntry: SemanticEntry
  existingEntry: ExistingEntry
  contradictionType: ContradictionType
  severity: number
}

type ConsistencyResolution =
  | { action: "update_existing"; entryId: string; newValue: unknown; newConfidence: number }
  | { action: "keep_existing"; reason: string; entryId: string; confidenceBoost: number }
  | { action: "flag_dissonance"; description: string }

interface ConsistencyResult {
  contradictions: ConsistencyCheck[]
  resolutions: ConsistencyResolution[]
}

const SOURCE_FRESHNESS: Record<string, number> = {
  operator: 4,
  observation: 3,
  reflection: 2,
  dream: 1
}

const LOW_CONFIDENCE_THRESHOLD = 0.5
const HIGH_CONFIDENCE_THRESHOLD = 0.7
const CONFIDENCE_BOOST = 0.05

function computeSeverity(newEntry: SemanticEntry, existing: ExistingEntry): number {
  const existingConfidence = existing.confidence ?? 0.5
  const confidenceDiff = Math.abs(newEntry.confidence - existingConfidence)
  const valueDiff = String(newEntry.value) === String(existing.value) ? 0 : 1
  return Math.min(1, valueDiff * 0.6 + confidenceDiff * 0.4)
}

function detectContradictionType(newEntry: SemanticEntry, existing: ExistingEntry): ContradictionType {
  const newFreshness = SOURCE_FRESHNESS[newEntry.source] ?? 1
  const existingFreshness = SOURCE_FRESHNESS[String(existing.source ?? "")] ?? 1
  if (newFreshness > existingFreshness) return "temporal_supersede"
  return "value_conflict"
}

function resolveContradiction(check: ConsistencyCheck): ConsistencyResolution {
  const existingConfidence = check.existingEntry.confidence ?? 0.5
  const newFreshness = SOURCE_FRESHNESS[check.newEntry.source] ?? 1

  if (newFreshness >= 3 && existingConfidence < LOW_CONFIDENCE_THRESHOLD) {
    return {
      action: "update_existing",
      entryId: check.existingEntry.id,
      newValue: check.newEntry.value,
      newConfidence: check.newEntry.confidence
    }
  }

  if (existingConfidence > HIGH_CONFIDENCE_THRESHOLD) {
    return {
      action: "keep_existing",
      reason: `Existing entry has high confidence (${existingConfidence.toFixed(2)})`,
      entryId: check.existingEntry.id,
      confidenceBoost: CONFIDENCE_BOOST
    }
  }

  return {
    action: "flag_dissonance",
    description:
      `Conflict on ${check.newEntry.category}/${check.newEntry.key}: ` +
      `existing="${String(check.existingEntry.value)}" vs new="${String(check.newEntry.value)}"`
  }
}

/**
 * Check a new semantic entry against existing knowledge for contradictions.
 * Returns contradictions found and their recommended resolutions.
 */
export async function checkConsistency(entry: SemanticEntry): Promise<ConsistencyResult> {
  const result: ConsistencyResult = { contradictions: [], resolutions: [] }

  const existingResult = await getKnowledge({ category: entry.category, key: entry.key })
  if (existingResult.isErr()) {
    log.warn("Consistency check failed to query knowledge", { error: existingResult.error.message })
    return result
  }

  const existing = existingResult.value
  if (existing.length === 0) return result

  existing
    .filter((row) => String(row.value) !== String(entry.value))
    .forEach((row) => {
      const existingEntry: ExistingEntry = {
        id: row.id,
        category: row.category,
        key: row.key,
        value: row.value,
        confidence: row.confidence,
        source: row.source
      }

      const check: ConsistencyCheck = {
        newEntry: entry,
        existingEntry,
        contradictionType: detectContradictionType(entry, existingEntry),
        severity: computeSeverity(entry, existingEntry)
      }

      const resolution = resolveContradiction(check)
      result.contradictions.push(check)
      result.resolutions.push(resolution)
    })

  return result
}

/**
 * Apply consistency resolutions: update existing entries or boost their confidence.
 * Returns true if a dissonance was flagged (for emotion triggering).
 */
export async function applyResolutions(result: ConsistencyResult): Promise<boolean> {
  const hasDissonance = await result.resolutions.reduce(async (accPromise, resolution, i) => {
    const acc = await accPromise
    if (!resolution) return acc
    switch (resolution.action) {
      case "update_existing": {
        const contradiction = result.contradictions[i]
        if (contradiction) {
          const updateResult = await storeKnowledge(
            contradiction.newEntry.category,
            contradiction.newEntry.key,
            resolution.newValue,
            contradiction.newEntry.source,
            resolution.newConfidence
          )
          if (updateResult.isErr()) {
            log.warn("Failed to update existing entry", { error: updateResult.error.message })
          } else {
            log.info("Consistency: updated existing entry", { entryId: resolution.entryId })
          }
        }
        break
      }
      case "keep_existing": {
        const existingConfidence = result.contradictions[i]?.existingEntry.confidence ?? 0.5
        const boostResult = await updateConfidence(
          resolution.entryId,
          Math.min(1, existingConfidence + (resolution.confidenceBoost ?? 0))
        )
        if (boostResult.isErr()) {
          log.error("Failed to boost confidence", { error: boostResult.error.message })
        }
        break
      }
      case "flag_dissonance": {
        log.info("Consistency: dissonance flagged", { description: resolution.description })
        return true
      }
    }
    return acc
  }, Promise.resolve(false))

  return hasDissonance
}

/**
 * Check consistency, apply resolutions (triggering dissonance emotion if needed),
 * and store new knowledge if not superseded by existing entries.
 * Returns the stored entry ID, or null if skipped due to existing knowledge.
 */
export async function storeWithConsistencyCheck(
  category: SemanticCategory,
  key: string,
  value: string,
  source: SemanticSource,
  confidence: number,
  scope: SemanticScope
): Promise<string | null> {
  const consistencyResult = await checkConsistency({ category, key, value, source, confidence })

  if (consistencyResult.contradictions.length > 0) {
    const hasDissonance = await applyResolutions(consistencyResult)
    if (hasDissonance) {
      await processEmotionTrigger(
        { trigger: "memory_contradiction", intensity: TRIGGER_INTENSITY.MEMORY_CONTRADICTION },
        "memory_contradiction"
      )
    }
    if (consistencyResult.resolutions.some((r) => r.action === "keep_existing")) return null
  }

  const storeResult = await storeKnowledge(category, key, value, source, confidence, scope)
  if (storeResult.isErr()) {
    logAndCaptureError(storeResult.error)
    return null
  }
  return storeResult.value
}
