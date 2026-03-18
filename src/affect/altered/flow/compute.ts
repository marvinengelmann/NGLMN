import type { DriveState } from "@/affect/drive/types.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { FLOW_DETECTION } from "./constants.ts"
import type { FlowConditions, FlowDetectionResult } from "./types.ts"

export function assessFlowConditions(
  emotion: EmotionalState,
  soma: SomaticState,
  driveState: DriveState,
  isIdle: boolean
): FlowConditions {
  const challengeProxy = emotion.curiosity
  const skillProxy = emotion.confidence
  const challengeSkillBalance = 1 - Math.abs(challengeProxy - skillProxy)

  const anxietyLevel = clamp01((emotion.caution + emotion.frustration) / 2)
  const attentionFocus = clamp01(1 - soma.tension * 0.3 + emotion.curiosity * 0.4 + emotion.confidence * 0.3)

  return {
    challengeSkillBalance,
    curiosityLevel: emotion.curiosity,
    masteryDriveLevel: driveState.mastery.salience,
    anxietyLevel,
    attentionFocus,
    interruptionFree: !isIdle
  }
}

export function detectFlowState(
  conditions: FlowConditions,
  consecutiveQualifyingTicks: number,
  freeEnergyOptimal = false
): FlowDetectionResult {
  const meetsThresholds =
    conditions.curiosityLevel >= FLOW_DETECTION.CURIOSITY_THRESHOLD &&
    conditions.masteryDriveLevel >= FLOW_DETECTION.MASTERY_DRIVE_THRESHOLD &&
    conditions.anxietyLevel <= FLOW_DETECTION.ANXIETY_CEILING &&
    conditions.attentionFocus >= FLOW_DETECTION.ATTENTION_THRESHOLD &&
    conditions.challengeSkillBalance >= FLOW_DETECTION.CHALLENGE_SKILL_MIN &&
    conditions.challengeSkillBalance <= FLOW_DETECTION.CHALLENGE_SKILL_MAX &&
    conditions.interruptionFree

  if (!meetsThresholds) {
    return { shouldTrigger: false, confidence: 0, conditions }
  }

  let confidence = clamp01(
    (conditions.challengeSkillBalance - FLOW_DETECTION.CHALLENGE_SKILL_MIN) /
      (FLOW_DETECTION.CHALLENGE_SKILL_MAX - FLOW_DETECTION.CHALLENGE_SKILL_MIN)
  )

  if (freeEnergyOptimal) {
    confidence = clamp01(confidence + 0.2)
  }

  const shouldTrigger =
    consecutiveQualifyingTicks >= FLOW_DETECTION.MIN_CONSECUTIVE_TICKS &&
    Math.random() < FLOW_DETECTION.DETECTION_PROBABILITY

  return { shouldTrigger, confidence, conditions }
}

export function qualifiesForFlow(conditions: FlowConditions): boolean {
  return (
    conditions.curiosityLevel >= FLOW_DETECTION.CURIOSITY_THRESHOLD &&
    conditions.masteryDriveLevel >= FLOW_DETECTION.MASTERY_DRIVE_THRESHOLD &&
    conditions.anxietyLevel <= FLOW_DETECTION.ANXIETY_CEILING &&
    conditions.attentionFocus >= FLOW_DETECTION.ATTENTION_THRESHOLD &&
    conditions.challengeSkillBalance >= FLOW_DETECTION.CHALLENGE_SKILL_MIN &&
    conditions.challengeSkillBalance <= FLOW_DETECTION.CHALLENGE_SKILL_MAX &&
    conditions.interruptionFree
  )
}

export function computeFlowTimeModulation(): number {
  return FLOW_DETECTION.TIME_DILATION_FACTOR
}

export function computeFlowFatigueModulation(currentFatigue: number): number {
  return currentFatigue * FLOW_DETECTION.FATIGUE_PAUSE_REDUCTION
}
