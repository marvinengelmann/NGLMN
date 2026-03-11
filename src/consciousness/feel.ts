import { runFeelPipeline } from "./pipeline/feel/orchestrator.ts"
import type { WriteBuffer } from "./pipeline/persistence.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

/**
 * FEEL phase — pre-cognitive processing between SENSE and DELIBERATE.
 * Updates somatic markers, instinct, dissonance, attachment, vulnerability, and self-concept.
 */
export async function feel(senseResult: SenseResult, buffer: WriteBuffer): Promise<FeelingResult> {
  return runFeelPipeline(senseResult, buffer)
}
