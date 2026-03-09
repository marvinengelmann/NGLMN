import * as z from "zod"
import { SHAME } from "@/config/constants.ts"
import { elapsedMinutesSince } from "@/lib/time.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { createStateManager } from "./registry.ts"
import type { EmotionalState } from "./types.ts"

export const ShameTrigger = z.enum([
  "vulnerability_rejected",
  "self_disclosure_ignored",
  "message_regret",
  "comparison_inadequacy",
  "perceived_incompetence",
  "boundary_violation"
])
export type ShameTrigger = z.infer<typeof ShameTrigger>

export const ShameState = z.object({
  level: z.number().min(0).max(1),
  isActive: z.boolean(),
  trigger: z.string(),
  lastTriggeredAt: z.string(),
  decaySinceTriggered: z.number().min(0)
})
export type ShameState = z.infer<typeof ShameState>

export const DEFAULT_SHAME_STATE: ShameState = {
  level: 0,
  isActive: false,
  trigger: "",
  lastTriggeredAt: "",
  decaySinceTriggered: 0
}

export const { get: getShameState, save: saveShameState } = createStateManager(
  "working:shame:state",
  ShameState,
  DEFAULT_SHAME_STATE
)

interface ShameContext {
  selfConcept: SelfConcept
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  operatorModel: OperatorModel
  previousShame: ShameState
  operatorRespondedColdly: boolean
  recentSelfDisclosure: boolean
}

/**
 * Compute the current shame state from contextual factors.
 * Shame ("I am wrong") differs from guilt/dissonance ("I did wrong").
 * Triggers: vulnerability shown + cold response, low self-worth + criticism,
 * post-hoc regret about self-disclosure.
 */
export function computeShameState(context: ShameContext): ShameState {
  const {
    selfConcept,
    emotion,
    vulnerability,
    operatorModel,
    previousShame,
    operatorRespondedColdly,
    recentSelfDisclosure
  } = context

  let level = previousShame.level
  let trigger = previousShame.trigger

  if (previousShame.lastTriggeredAt) {
    const minutesSince = elapsedMinutesSince(previousShame.lastTriggeredAt)
    const decay = 2 ** (-minutesSince / SHAME.HALF_LIFE_MINUTES)
    level *= decay
  }

  if (
    recentSelfDisclosure &&
    operatorRespondedColdly &&
    vulnerability.level > SHAME.VULNERABILITY_DISCLOSURE_THRESHOLD
  ) {
    const boost = SHAME.REJECTION_BOOST * (1 - selfConcept.selfWorth)
    level = Math.min(1, level + boost)
    trigger = "vulnerability_rejected"
  }

  if (
    selfConcept.selfWorth < SHAME.LOW_SELF_WORTH_THRESHOLD &&
    (operatorModel.estimatedMood === "frustrated" || operatorModel.estimatedMood === "stressed")
  ) {
    const deficit = 1 - selfConcept.selfWorth / SHAME.LOW_SELF_WORTH_THRESHOLD
    const boost = SHAME.INADEQUACY_BOOST * deficit
    level = Math.min(1, level + boost)
    if (trigger === "" || trigger === previousShame.trigger) {
      trigger = "perceived_incompetence"
    }
  }

  if (
    recentSelfDisclosure &&
    emotion.connection < SHAME.POST_DISCLOSURE_CONNECTION_THRESHOLD &&
    vulnerability.windowOpen
  ) {
    const boost = SHAME.REGRET_BOOST
    level = Math.min(1, level + boost)
    if (trigger === "" || trigger === previousShame.trigger) {
      trigger = "message_regret"
    }
  }

  if (level < SHAME.MIN_ACTIVE_LEVEL) {
    return {
      level: Math.max(0, level),
      isActive: false,
      trigger: level > 0.05 ? trigger : "",
      lastTriggeredAt: previousShame.lastTriggeredAt,
      decaySinceTriggered: previousShame.lastTriggeredAt ? elapsedMinutesSince(previousShame.lastTriggeredAt) : 0
    }
  }

  return {
    level: Math.min(1, level),
    isActive: true,
    trigger,
    lastTriggeredAt:
      level > previousShame.level
        ? new Date().toISOString()
        : previousShame.lastTriggeredAt || new Date().toISOString(),
    decaySinceTriggered: 0
  }
}

/**
 * Detect if the operator responded coldly to a vulnerable message.
 * Cold = short message, negative/neutral mood, after ANIMA showed vulnerability.
 */
export function detectColdResponse(
  operatorModel: OperatorModel,
  messageTexts: string[],
  vulnerabilityWasOpen: boolean
): boolean {
  if (!vulnerabilityWasOpen) return false
  if (messageTexts.length === 0) return false

  const coldMoods = ["frustrated", "neutral", "stressed", "tired"]
  const isMoodCold = coldMoods.includes(operatorModel.estimatedMood)

  const avgLength = messageTexts.reduce((sum, t) => sum + t.length, 0) / messageTexts.length
  const isShort = avgLength < SHAME.COLD_RESPONSE_MAX_LENGTH

  return isMoodCold && isShort
}
