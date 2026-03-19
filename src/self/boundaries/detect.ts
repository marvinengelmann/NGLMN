import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { BOUNDARY_DETECTION_PROMPT } from "@/prompts/identity.ts"
import type { BoundaryType } from "./types.ts"

const BoundaryDetectionResult = z.object({
  shouldFormBoundary: z.boolean(),
  type: z.enum(["topic", "communication", "emotional", "behavioral"]),
  description: z.string(),
  pattern: z.string()
})

const CACHE_KEY = "working:boundaries:lastDetection"
const CACHE_TTL_SECONDS = 300

/**
 * Use LLM to detect whether a negative experience should form a new boundary.
 * Cached for 5 minutes to avoid redundant LLM calls on consecutive ticks.
 */
export async function detectBoundaryFormation(
  negativeExperience: string,
  emotionalContext: string
): Promise<{ type: BoundaryType; description: string; pattern: string } | null> {
  const cached = await redis.get<{ type: BoundaryType; description: string; pattern: string } | "none">(CACHE_KEY)
  if (cached !== null) return cached === "none" ? null : cached

  const result = await callIntelligence({
    system: BOUNDARY_DETECTION_PROMPT,
    userMessage: `Experience: ${negativeExperience}\nEmotional context: ${emotionalContext}\n\nShould this experience lead to forming a new psychological boundary? If yes, describe the boundary type, a short description, and a pipe-separated list of keyword patterns to match against.`,
    schema: BoundaryDetectionResult
  })

  if (result.isErr()) return null

  const detection = result.value
  if (!detection.shouldFormBoundary) {
    await redis.set(CACHE_KEY, "none", { ex: CACHE_TTL_SECONDS })
    return null
  }

  const boundary = {
    type: detection.type,
    description: detection.description,
    pattern: detection.pattern
  }
  await redis.set(CACHE_KEY, boundary, { ex: CACHE_TTL_SECONDS })
  return boundary
}
