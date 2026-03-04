import type { EmotionalState } from "@/emotion/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { CommunicationRegister } from "./types.ts"

/**
 * Compute the current communication register based on emotional, somatic, and vulnerability state.
 * Priority order: raw > playful > terse > elaborate > casual.
 */
export function computeCommunicationRegister(
  emotion: EmotionalState,
  soma: SomaticState,
  vulnerability: VulnerabilityState | null
): CommunicationRegister {
  if (vulnerability?.windowOpen && emotion.connection > 0.6) return "raw"
  if (emotion.excitement > 0.65 && emotion.connection > 0.5) return "playful"
  if (emotion.energy < 0.3 || soma.gravity > 0.7) return "terse"
  if (emotion.curiosity > 0.6 && emotion.energy > 0.5) return "elaborate"
  return "casual"
}
