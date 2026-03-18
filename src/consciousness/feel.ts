import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { runFeelPipeline } from "./pipeline/feel/orchestrator.ts"
import type { FeelingResult, SenseResult } from "./types.ts"

/**
 * FEEL phase — pre-cognitive processing between SENSE and DELIBERATE.
 * Updates somatic markers, instinct, dissonance, attachment, vulnerability, and self-concept.
 */
export async function feel(senseResult: SenseResult, buffer: WriteBuffer): Promise<FeelingResult> {
  return runFeelPipeline(senseResult, buffer)
}
