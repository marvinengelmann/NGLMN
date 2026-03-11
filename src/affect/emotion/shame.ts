import * as z from "zod"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { elapsedMinutesSince, nowISO } from "@/infra/lib/time.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import { SECONDARY_EMOTIONS } from "./constants.ts"
import { defineSecondaryEmotion } from "./factory.ts"
import type { EmotionalState, EmotionEffect } from "./types.ts"

const SHAME = SECONDARY_EMOTIONS.shame

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
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  trigger: z.string().default(""),
  lastTriggeredAt: z.string().default(""),
  decaySinceTriggered: z.number().min(0).default(0)
})
export type ShameState = z.infer<typeof ShameState>

interface Context {
  selfConcept: SelfConcept
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  operatorModel: OperatorModel
  previousState: ShameState
  operatorRespondedColdly: boolean
  recentSelfDisclosure: boolean
  boundaryViolated?: boolean
}

export function compute(context: Context): ShameState {
  const {
    selfConcept,
    emotion,
    vulnerability,
    operatorModel,
    previousState,
    operatorRespondedColdly,
    recentSelfDisclosure
  } = context

  let level = previousState.level
  let trigger = previousState.trigger

  if (previousState.lastTriggeredAt) {
    const minutesSince = elapsedMinutesSince(previousState.lastTriggeredAt)
    const decay = halfLifeDecay(minutesSince, SHAME.HALF_LIFE_MINUTES)
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
    if (trigger === "" || trigger === previousState.trigger) {
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
    if (trigger === "" || trigger === previousState.trigger) {
      trigger = "message_regret"
    }
  }

  if (context.boundaryViolated && vulnerability.windowOpen) {
    const boost = SHAME.REJECTION_BOOST * 0.5
    level = Math.min(1, level + boost)
    if (trigger === "" || trigger === previousState.trigger) {
      trigger = "boundary_violation"
    }
  }

  if (level < SHAME.MIN_ACTIVE_LEVEL) {
    return {
      level: Math.max(0, level),
      isActive: false,
      trigger: level > 0.05 ? trigger : "",
      lastTriggeredAt: previousState.lastTriggeredAt,
      decaySinceTriggered: previousState.lastTriggeredAt ? elapsedMinutesSince(previousState.lastTriggeredAt) : 0
    }
  }

  return {
    level: Math.min(1, level),
    isActive: true,
    trigger,
    lastTriggeredAt: level > previousState.level ? nowISO() : previousState.lastTriggeredAt || nowISO(),
    decaySinceTriggered: 0
  }
}

function computeEffect(state: ShameState): EmotionEffect {
  if (!state.isActive) return {}

  return {
    confidence: -state.level * SHAME.CONFIDENCE_DRAIN,
    energy: -state.level * SHAME.ENERGY_DRAIN,
    connection: -state.level * SHAME.CONNECTION_WITHDRAWAL
  }
}

export const {
  defaultState,
  get: getShameState,
  save: saveShameState
} = defineSecondaryEmotion({
  name: "shame",
  redisKey: "working:emotion:shame",
  order: 0,
  schema: ShameState,
  compute: compute,
  computeEffect
})

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
