import { clamp01 } from "@/infra/lib/math.ts"
import type { AttachmentDynamics, AttachmentStyle } from "./types.ts"

interface ConflictContext {
  operatorMood: string
  modelConfidence: number
  dissonanceScore: number
  guardianBlocked: boolean
}

/**
 * Detect whether the current interaction state constitutes a relational conflict.
 */
export function detectConflict(context: ConflictContext): boolean {
  const stressedOperator =
    (context.operatorMood === "frustrated" || context.operatorMood === "stressed") && context.modelConfidence > 0.5

  return stressedOperator || context.dissonanceScore > 0.6 || context.guardianBlocked
}

/**
 * Detect whether the operator is returning after a period of silence.
 */
export function isOperatorReturning(pendingMessageCount: number, operatorSilenceMinutes: number): boolean {
  return pendingMessageCount > 0 && operatorSilenceMinutes > 30
}

/**
 * Detect whether any attachment style dimension changed beyond a threshold.
 */
export function hasStyleChanged(current: AttachmentStyle, updated: AttachmentStyle): boolean {
  return (Object.keys(current) as (keyof AttachmentStyle)[]).some((k) => Math.abs(current[k] - updated[k]) > 0.0001)
}

interface AttachmentContext {
  operatorSilenceMinutes: number
  operatorJustReturned: boolean
  inConversation: boolean
  connectionLevel: number
  frustrationLevel: number
  cautionLevel: number
  trustExperience: number
  waitingPerception?: number
}

/**
 * Evaluate current attachment dynamics based on context.
 */
export function evaluateAttachmentDynamics(style: AttachmentStyle, context: AttachmentContext): AttachmentDynamics {
  const effectiveSilence = context.waitingPerception ?? context.operatorSilenceMinutes / 60
  const silenceHours = context.waitingPerception != null ? effectiveSilence * 24 : context.operatorSilenceMinutes / 60

  const rawSeparationDistress = clamp01((silenceHours / 24) * style.anxious * 2)

  let reunionResponse = 0
  if (context.operatorJustReturned) {
    reunionResponse = clamp01(0.3 + rawSeparationDistress * 0.5 + style.secure * 0.2)
  }

  const separationDistress = context.inConversation ? 0 : rawSeparationDistress

  let safeHavenSeeking = 0
  if (context.frustrationLevel > 0.6 || context.cautionLevel > 0.7) {
    safeHavenSeeking = clamp01(0.3 + style.anxious * 0.3 + (1 - style.avoidant) * 0.2)
  }

  const explorationBalance = clamp01(style.secure * 0.5 + (1 - safeHavenSeeking) * 0.3 + context.trustExperience * 0.2)

  return {
    separationDistress: clamp01(separationDistress),
    reunionResponse: clamp01(reunionResponse),
    safeHavenSeeking: clamp01(safeHavenSeeking),
    explorationBalance: clamp01(explorationBalance)
  }
}

/**
 * Update attachment style — VERY slow (days/weeks timescale).
 */
export function updateAttachmentStyle(
  current: AttachmentStyle,
  dynamics: AttachmentDynamics,
  elapsedHours: number
): AttachmentStyle {
  let { secure, anxious, avoidant, disorganized } = current

  if (dynamics.reunionResponse > 0.5 && dynamics.separationDistress < 0.5) {
    secure += 0.001 * elapsedHours
  }

  if (dynamics.separationDistress > 0.7) {
    anxious += 0.0005 * elapsedHours
  }

  secure += 0.0002 * elapsedHours

  const total = secure + anxious + avoidant + disorganized
  if (total > 0) {
    secure = secure / total
    anxious = anxious / total
    avoidant = avoidant / total
    disorganized = disorganized / total
  }

  return {
    secure: clamp01(secure),
    anxious: clamp01(anxious),
    avoidant: clamp01(avoidant),
    disorganized: clamp01(disorganized)
  }
}
