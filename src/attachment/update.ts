import type { AttachmentDynamics, AttachmentStyle } from "./types.ts"

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
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
  return (Object.keys(current) as (keyof AttachmentStyle)[]).some(
    (k) => Math.abs(current[k] - updated[k]) > 0.0001
  )
}

export interface AttachmentContext {
  operatorSilenceMinutes: number
  operatorJustReturned: boolean
  inConversation: boolean
  connectionLevel: number
  frustrationLevel: number
  cautionLevel: number
  trustExperience: number
}

/**
 * Evaluate current attachment dynamics based on context.
 */
export function evaluateAttachmentDynamics(style: AttachmentStyle, context: AttachmentContext): AttachmentDynamics {
  const silenceHours = context.operatorSilenceMinutes / 60

  let separationDistress = clamp((silenceHours / 24) * style.anxious * 2)
  if (context.inConversation) separationDistress = 0

  let reunionResponse = 0
  if (context.operatorJustReturned) {
    reunionResponse = clamp(0.3 + separationDistress * 0.5 + style.secure * 0.2)
  }

  let safeHavenSeeking = 0
  if (context.frustrationLevel > 0.6 || context.cautionLevel > 0.7) {
    safeHavenSeeking = clamp(0.3 + style.anxious * 0.3 + (1 - style.avoidant) * 0.2)
  }

  const explorationBalance = clamp(style.secure * 0.5 + (1 - safeHavenSeeking) * 0.3 + context.trustExperience * 0.2)

  return {
    separationDistress: clamp(separationDistress),
    reunionResponse: clamp(reunionResponse),
    safeHavenSeeking: clamp(safeHavenSeeking),
    explorationBalance: clamp(explorationBalance)
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
    secure: clamp(secure),
    anxious: clamp(anxious),
    avoidant: clamp(avoidant),
    disorganized: clamp(disorganized)
  }
}
