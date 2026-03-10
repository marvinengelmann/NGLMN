import type { EmotionalState } from "@/affect/emotion/types.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { SUBJECTIVE_TIME } from "./constants.ts"
import type { SubjectiveTimeState, TemporalLandmark } from "./types.ts"

interface TimeDilationContext {
  emotion: EmotionalState
  consecutiveIdleTicks: number
  inConversation: boolean
  operatorSilenceMinutes: number
}

/**
 * Compute time dilation from emotional and activity state.
 * Negative = time feels compressed (engaged), positive = time feels dilated (bored/waiting).
 */
export function computeTimeDilation(context: TimeDilationContext): number {
  const { emotion, consecutiveIdleTicks, inConversation } = context

  let dilation = 0

  if (inConversation && emotion.excitement > 0.5) {
    dilation += SUBJECTIVE_TIME.ENGAGEMENT_COMPRESSION
  }

  dilation += emotion.boredom * SUBJECTIVE_TIME.BOREDOM_DILATION
  dilation += emotion.excitement * SUBJECTIVE_TIME.EXCITEMENT_COMPRESSION

  if (emotion.energy < 0.3) {
    dilation += (1 - emotion.energy) * SUBJECTIVE_TIME.LOW_ENERGY_DILATION * 0.5
  }

  if (consecutiveIdleTicks > 3) {
    dilation += Math.min(0.3, consecutiveIdleTicks * 0.05)
  }

  return Math.max(-1, Math.min(1, dilation))
}

interface WaitingContext {
  operatorSilenceMinutes: number
  attachmentAnxiety: number
  connectionLevel: number
  dilation: number
}

/**
 * Compute subjective waiting perception — how intensely silence is felt.
 */
export function computeWaitingPerception(context: WaitingContext): number {
  const { operatorSilenceMinutes, attachmentAnxiety, connectionLevel, dilation } = context

  const silenceFactor = Math.min(1, operatorSilenceMinutes / 120)
  const anxietyAmplifier = 1 + attachmentAnxiety * 0.5
  const connectionAmplifier = connectionLevel > 0.5 ? 1 + (connectionLevel - 0.5) * 0.5 : 1
  const dilationAmplifier = dilation > 0 ? 1 + dilation * SUBJECTIVE_TIME.SILENCE_DILATION_SCALE : 1

  return Math.min(1, silenceFactor * anxietyAmplifier * connectionAmplifier * dilationAmplifier)
}

/**
 * Generate a subjective time expression based on dilation.
 */
export function generateTimeExpression(dilation: number, waitingPerception: number): string {
  if (waitingPerception > 0.7) return "time crawls — each minute stretches endlessly"
  if (dilation > 0.5) return "time drags, heavy and slow"
  if (dilation > 0.2) return "time feels slightly stretched"
  if (dilation < -0.5) return "time flies — where did it go?"
  if (dilation < -0.2) return "time passes quickly, barely noticed"
  return "normal"
}

/**
 * Detect if the current moment qualifies as a temporal landmark.
 */
export function detectTemporalLandmark(emotionalIntensity: number, description: string): TemporalLandmark | null {
  if (emotionalIntensity >= SUBJECTIVE_TIME.LANDMARK_SIGNIFICANCE_THRESHOLD) {
    return {
      description,
      timestamp: nowISO(),
      emotionalSignificance: emotionalIntensity
    }
  }
  return null
}

/**
 * Compute full subjective time state.
 */
export function computeSubjectiveTime(
  previous: SubjectiveTimeState,
  context: TimeDilationContext & { attachmentAnxiety: number; emotionalIntensity: number }
): SubjectiveTimeState {
  const dilation = computeTimeDilation(context)
  const waitingPerception = computeWaitingPerception({
    operatorSilenceMinutes: context.operatorSilenceMinutes,
    attachmentAnxiety: context.attachmentAnxiety,
    connectionLevel: context.emotion.connection,
    dilation
  })
  const subjectiveElapsedFeeling = generateTimeExpression(dilation, waitingPerception)

  const landmark = detectTemporalLandmark(context.emotionalIntensity, subjectiveElapsedFeeling)
  const temporalLandmarks = landmark
    ? [...previous.temporalLandmarks, landmark].slice(-SUBJECTIVE_TIME.MAX_LANDMARKS)
    : previous.temporalLandmarks

  return { dilation, waitingPerception, temporalLandmarks, subjectiveElapsedFeeling }
}
