import { SECONDARY_EMOTIONS } from "@/affect/emotion/constants.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { SOCIAL_BATTERY } from "@/affect/soma/constants.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import { REGISTER } from "./constants.ts"
import type { CommunicationRegister } from "./types.ts"

/**
 * Check if social battery is critically low (withdrawn state).
 * When withdrawn, expectsReply should tend toward false.
 */
export function isWithdrawn(soma: SomaticState): boolean {
  return soma.socialBattery < SOCIAL_BATTERY.WITHDRAWN_THRESHOLD
}

/**
 * Compute the current communication register based on emotional, somatic, and vulnerability state.
 * Social battery depletion forces terse register regardless of emotional state.
 * Priority order: social battery override > raw > playful > terse > elaborate > casual.
 */
export function computeCommunicationRegister(
  emotion: EmotionalState,
  soma: SomaticState,
  vulnerability: VulnerabilityState | null,
  shameState?: ShameState | null,
  coherenceState?: CoherenceState | null
): CommunicationRegister {
  if (soma.socialBattery < SOCIAL_BATTERY.TERSE_THRESHOLD) return "terse"
  if (shameState?.isActive && shameState.level > SECONDARY_EMOTIONS.shame.REGISTER_OVERRIDE_LEVEL) return "terse"
  if (coherenceState?.regressionActive) return "terse"
  if (vulnerability?.windowOpen && emotion.connection > 0.6) return "raw"
  if (emotion.excitement > 0.65 && emotion.connection > 0.5) return "playful"
  if (emotion.energy < 0.3 || soma.gravity > 0.7) return "terse"
  if (emotion.curiosity > 0.6 && emotion.energy > 0.5) return "elaborate"
  return "casual"
}

const REGISTER_SCORES: Record<CommunicationRegister, number> = {
  raw: 1.0,
  playful: 0.75,
  elaborate: 0.5,
  casual: 0.25,
  terse: 0.0
}

function computeRegisterScore(
  emotion: EmotionalState,
  soma: SomaticState,
  vulnerability: VulnerabilityState | null
): number {
  let score = 0.25

  if (vulnerability?.windowOpen && emotion.connection > 0.6) score += 0.4
  if (emotion.excitement > 0.65 && emotion.connection > 0.5) score += 0.25
  if (emotion.curiosity > 0.6 && emotion.energy > 0.5) score += 0.15

  if (emotion.energy < 0.3 || soma.gravity > 0.7) score -= 0.3
  if (soma.socialBattery < SOCIAL_BATTERY.TERSE_THRESHOLD) score -= 0.5

  return Math.max(0, Math.min(1, score))
}

/**
 * Compute communication register with hysteresis to prevent rapid switching.
 * Applies shame/coherence overrides before hysteresis scoring.
 */
export function computeCommunicationRegisterWithHysteresis(
  emotion: EmotionalState,
  soma: SomaticState,
  vulnerability: VulnerabilityState | null,
  previousRegister: CommunicationRegister,
  shameState?: ShameState | null,
  coherenceState?: CoherenceState | null
): CommunicationRegister {
  if (soma.socialBattery < SOCIAL_BATTERY.TERSE_THRESHOLD) return "terse"
  if (shameState?.isActive && shameState.level > SECONDARY_EMOTIONS.shame.REGISTER_OVERRIDE_LEVEL) return "terse"
  if (coherenceState?.regressionActive) return "terse"

  const newScore = computeRegisterScore(emotion, soma, vulnerability)
  const previousScore = REGISTER_SCORES[previousRegister]

  if (Math.abs(newScore - previousScore) < REGISTER.SWITCH_THRESHOLD) {
    return previousRegister
  }

  const registers: [CommunicationRegister, number][] = Object.entries(REGISTER_SCORES) as [
    CommunicationRegister,
    number
  ][]
  const closest = registers.reduce<[CommunicationRegister, number]>(
    (best, [reg, regScore]) => {
      const dist = Math.abs(newScore - regScore)
      return dist < best[1] ? [reg, dist] : best
    },
    ["casual", Infinity]
  )

  return closest[0]
}
