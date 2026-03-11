import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { BOUNDARY_DETECTION_PROMPT } from "@/prompts/identity.ts"
import type { BoundaryType } from "./types.ts"

const BoundaryDetectionResult = z.object({
  shouldFormBoundary: z.boolean(),
  type: z.enum(["topic", "communication", "emotional", "behavioral"]),
  description: z.string(),
  pattern: z.string()
})

/**
 * Use LLM to detect whether a negative experience should form a new boundary.
 */
export async function detectBoundaryFormation(
  negativeExperience: string,
  emotionalContext: string
): Promise<{ type: BoundaryType; description: string; pattern: string } | null> {
  const result = await callIntelligence({
    system: BOUNDARY_DETECTION_PROMPT,
    userMessage: `Experience: ${negativeExperience}\nEmotional context: ${emotionalContext}\n\nShould this experience lead to forming a new psychological boundary? If yes, describe the boundary type, a short description, and a pipe-separated list of keyword patterns to match against.`,
    schema: BoundaryDetectionResult
  })

  if (result.isErr()) return null

  const detection = result.value
  if (!detection.shouldFormBoundary) return null

  return {
    type: detection.type,
    description: detection.description,
    pattern: detection.pattern
  }
}
