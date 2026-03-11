import type { EmotionalState } from "@/affect/emotion/types.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { CRISIS } from "./constants.ts"
import { AttachmentCrisisState, type AttachmentDynamics } from "./types.ts"

export type CrisisType = "trust_rupture" | "deep_vulnerability" | "prolonged_separation" | "deep_connection"

export const DEFAULT_CRISIS_STATE: AttachmentCrisisState = {
  active: false,
  type: null,
  multiplier: 1,
  expiresAt: null
}

const KEY = "working:attachment:crisis"

export async function getCrisisState(): Promise<AttachmentCrisisState> {
  return (await getValidatedRedis(KEY, AttachmentCrisisState)) ?? DEFAULT_CRISIS_STATE
}

export async function saveCrisisState(state: AttachmentCrisisState): Promise<void> {
  await redis.set(KEY, state)
}

interface CrisisContext {
  dynamics: AttachmentDynamics
  emotion: EmotionalState
  trustDelta: number
  vulnerabilityOpen: boolean
}

/**
 * Detect whether an attachment crisis is occurring based on current emotional and relational state.
 */
export function detectAttachmentCrisis(context: CrisisContext): {
  active: boolean
  multiplier: number
  type: CrisisType | null
  durationHours: number
} {
  if (context.trustDelta < CRISIS.TRUST_RUPTURE_THRESHOLD) {
    return {
      active: true,
      multiplier: CRISIS.TRUST_RUPTURE_MULTIPLIER,
      type: "trust_rupture",
      durationHours: CRISIS.TRUST_RUPTURE_HOURS
    }
  }

  if (context.emotion.connection > CRISIS.DEEP_VULNERABILITY_CONNECTION && context.vulnerabilityOpen) {
    return {
      active: true,
      multiplier: CRISIS.DEEP_VULNERABILITY_MULTIPLIER,
      type: "deep_vulnerability",
      durationHours: CRISIS.DEEP_VULNERABILITY_HOURS
    }
  }

  if (
    context.emotion.connection > CRISIS.DEEP_CONNECTION_THRESHOLD &&
    context.dynamics.reunionResponse > CRISIS.DEEP_CONNECTION_REUNION
  ) {
    return {
      active: true,
      multiplier: CRISIS.DEEP_CONNECTION_MULTIPLIER,
      type: "deep_connection",
      durationHours: CRISIS.DEEP_CONNECTION_HOURS
    }
  }

  if (context.dynamics.separationDistress > CRISIS.PROLONGED_SEPARATION_DISTRESS) {
    return {
      active: true,
      multiplier: CRISIS.PROLONGED_SEPARATION_MULTIPLIER,
      type: "prolonged_separation",
      durationHours: 0
    }
  }

  return { active: false, multiplier: 1, type: null, durationHours: 0 }
}

/**
 * Evaluate and update the attachment crisis state.
 * Returns the active crisis multiplier (1 if no crisis).
 */
export function evaluateAttachmentCrisis(
  previous: AttachmentCrisisState,
  context: CrisisContext
): AttachmentCrisisState {
  if (previous.active && previous.expiresAt) {
    if (new Date(previous.expiresAt) < new Date()) {
      return DEFAULT_CRISIS_STATE
    }
    return previous
  }

  if (previous.active && !previous.expiresAt) {
    const stillActive = detectAttachmentCrisis(context)
    if (!stillActive.active) {
      return DEFAULT_CRISIS_STATE
    }
    return previous
  }

  const detected = detectAttachmentCrisis(context)
  if (!detected.active) return DEFAULT_CRISIS_STATE

  return {
    active: true,
    type: detected.type,
    multiplier: detected.multiplier,
    expiresAt:
      detected.durationHours > 0 ? new Date(Date.now() + detected.durationHours * 60 * 60 * 1000).toISOString() : null
  }
}
