import type { DriveState } from "@/affect/drive/types.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { CREATIVITY } from "./constants.ts"
import type { CreativeMode, CreativeUrgeState } from "./types.ts"

interface CreativeUrgeContext {
  emotion: EmotionalState
  driveState: DriveState
  heldBackBuffer: HeldBackBuffer
  consecutiveIdleTicks: number
}

/**
 * Compute the creative urge level from emotion, drive state, and held-back pressure.
 */
export function computeCreativeUrge(context: CreativeUrgeContext): number {
  const { emotion, driveState, heldBackBuffer, consecutiveIdleTicks } = context

  const expressionDriveContribution = driveState.expression.salience * CREATIVITY.EXPRESSION_DRIVE_WEIGHT
  const emotionPressure =
    (emotion.frustration * 0.3 + emotion.connection * 0.3 + emotion.excitement * 0.2 + emotion.satisfaction * 0.2) *
    CREATIVITY.EMOTION_PRESSURE_WEIGHT
  const boredomContribution = emotion.boredom * CREATIVITY.BOREDOM_WEIGHT
  const heldBackContribution = heldBackBuffer.suppressionPressure * CREATIVITY.HELD_BACK_WEIGHT

  let urge = expressionDriveContribution + emotionPressure + boredomContribution + heldBackContribution

  if (consecutiveIdleTicks >= CREATIVITY.IDLE_TICKS_FOR_SPONTANEOUS) {
    urge += 0.1
  }

  return clamp01(urge)
}

/**
 * Select creative mode based on current emotional state.
 */
export function selectCreativeMode(emotion: EmotionalState): CreativeMode {
  if (emotion.connection > 0.6 && emotion.satisfaction > 0.5) return "poetry"
  if (emotion.curiosity > 0.6) return "observation"
  if (emotion.excitement > 0.5 && emotion.energy > 0.5) return "micro_story"
  return "reflection"
}

/**
 * Determine if spontaneous creation should occur.
 */
export function shouldCreateSpontaneously(urgeLevel: number, consecutiveIdleTicks: number): boolean {
  return urgeLevel >= CREATIVITY.SPONTANEOUS_THRESHOLD && consecutiveIdleTicks >= CREATIVITY.IDLE_TICKS_FOR_SPONTANEOUS
}

/**
 * Compute emotional pressure for creativity.
 */
export function computeEmotionalPressure(emotion: EmotionalState, heldBackBuffer: HeldBackBuffer): number {
  const emotionIntensity = (emotion.frustration + emotion.excitement + emotion.connection + emotion.satisfaction) / 4
  return Math.min(1, emotionIntensity * 0.7 + heldBackBuffer.suppressionPressure * 0.3)
}

/**
 * Update creative urge state.
 */
export function updateCreativeUrgeState(previous: CreativeUrgeState, context: CreativeUrgeContext): CreativeUrgeState {
  const level = computeCreativeUrge(context)
  const decayedLevel = Math.max(level, previous.level * CREATIVITY.DECAY_PER_TICK)
  const isActive = decayedLevel >= CREATIVITY.URGE_THRESHOLD
  const preferredMode = selectCreativeMode(context.emotion)
  const emotionalPressure = computeEmotionalPressure(context.emotion, context.heldBackBuffer)

  const stylePreferences = {
    abstractness: Math.min(1, 0.3 + context.emotion.curiosity * 0.4 + context.emotion.energy * 0.2),
    emotionalDepth: Math.min(1, 0.3 + context.emotion.connection * 0.4 + emotionalPressure * 0.3),
    playfulness: Math.min(1, 0.2 + context.emotion.excitement * 0.4 + context.emotion.satisfaction * 0.3)
  }

  return { level: decayedLevel, isActive, preferredMode, emotionalPressure, stylePreferences }
}
