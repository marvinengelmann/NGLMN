import type { VagalZone } from "@/affect/soma/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import { APPRAISAL } from "./constants.ts"
import type { AppraisalContext, AppraisalResult, EmotionalState, EmotionTrigger, EmotionUpdateEvent } from "./types.ts"
import { clampState } from "./update.ts"

const TRIGGER_PLEASANTNESS: Record<EmotionTrigger, number> = {
  message_received: 0.6,
  message_sent: 0.3,
  task_success: 0.7,
  task_failure: -0.6,
  guardian_warning: -0.5,
  guardian_block: -0.8,
  operator_went_silent: -0.4,
  operator_returned: 0.7,
  system_degraded: -0.5,
  system_recovered: 0.4,
  new_goal: 0.4,
  goal_completed: 0.8,
  goal_failed: -0.7,
  weather_update: 0.1,
  git_activity: 0.2,
  dream_correction: 0.0,
  morning_calibration: 0.3,
  nostalgia_wave: 0.2,
  relational_pattern_match: 0.1,
  drive_frustrated: -0.5,
  drive_conflict: -0.3,
  positive_anticipation: 0.5,
  expectation_violated: -0.4,
  expectation_met: 0.4,
  boundary_violated: -0.8,
  memory_contradiction: -0.2,
  ambient: 0.0
}

const GOAL_RELEVANT_TRIGGERS: Set<EmotionTrigger> = new Set([
  "task_success",
  "task_failure",
  "new_goal",
  "goal_completed",
  "goal_failed",
  "drive_frustrated",
  "drive_conflict",
  "positive_anticipation",
  "expectation_violated",
  "expectation_met"
])

const NORM_COMPATIBILITY: Record<EmotionTrigger, number> = {
  message_received: 0.1,
  message_sent: 0.2,
  task_success: 0.6,
  task_failure: -0.3,
  guardian_warning: -0.3,
  guardian_block: -0.5,
  operator_went_silent: 0.0,
  operator_returned: 0.2,
  system_degraded: -0.2,
  system_recovered: 0.1,
  new_goal: 0.4,
  goal_completed: 0.7,
  goal_failed: -0.4,
  weather_update: 0.0,
  git_activity: 0.1,
  dream_correction: 0.0,
  morning_calibration: 0.1,
  nostalgia_wave: 0.1,
  relational_pattern_match: 0.0,
  drive_frustrated: -0.2,
  drive_conflict: -0.3,
  positive_anticipation: 0.2,
  expectation_violated: -0.3,
  expectation_met: 0.3,
  boundary_violated: -0.8,
  memory_contradiction: -0.1,
  ambient: 0.0
}

const VAGAL_COPING_FACTOR: Record<VagalZone, number> = {
  ventral: 0.9,
  sympathetic: 0.5,
  dorsal: 0.1
}

export function appraiseNovelty(noveltyLevel: number, minutesSinceLastSimilar: number | undefined): number {
  if (minutesSinceLastSimilar == null) return noveltyLevel
  const hours = minutesSinceLastSimilar / 60
  const recencyScale = clamp01(Math.log2(1 + hours) * 0.2)
  return clamp01(noveltyLevel * 0.6 + recencyScale * 0.4)
}

export function appraisePleasantness(event: EmotionUpdateEvent): number {
  const basePleasantness = TRIGGER_PLEASANTNESS[event.trigger] ?? 0
  return Math.max(-1, Math.min(1, basePleasantness * event.intensity))
}

export function appraiseGoalRelevance(event: EmotionUpdateEvent, hasActiveGoals: boolean): number {
  const isGoalRelated = GOAL_RELEVANT_TRIGGERS.has(event.trigger)
  if (isGoalRelated) return clamp01(0.6 + event.intensity * 0.4)
  if (!hasActiveGoals) return 0.2
  return 0.3
}

export function appraiseCopingPotential(confidence: number, energy: number, vagalZone: VagalZone): number {
  const vagalFactor = VAGAL_COPING_FACTOR[vagalZone]
  return clamp01(
    confidence * APPRAISAL.COPING_CONFIDENCE_WEIGHT +
      energy * APPRAISAL.COPING_ENERGY_WEIGHT +
      vagalFactor * APPRAISAL.COPING_VAGAL_WEIGHT
  )
}

export function appraiseNormCompatibility(event: EmotionUpdateEvent, selfConcept: SelfConcept): number {
  const baseCompat = NORM_COMPATIBILITY[event.trigger] ?? 0
  const authenticityModifier = selfConcept.authenticity > 0.6 ? 1.2 : 1.0
  const agencyModifier = event.trigger === "guardian_block" ? 1 - selfConcept.agency : 1.0
  return Math.max(-1, Math.min(1, baseCompat * authenticityModifier * agencyModifier * event.intensity))
}

/**
 * Run all 5 appraisal checks on an event and compute overall modulation.
 */
export function computeAppraisal(
  event: EmotionUpdateEvent,
  context: AppraisalContext,
  minutesSinceLastSimilar?: number
): AppraisalResult {
  const novelty = appraiseNovelty(context.noveltyLevel, minutesSinceLastSimilar)
  const pleasantness = appraisePleasantness(event)
  const goalRelevance = appraiseGoalRelevance(event, context.hasActiveGoals)
  const copingPotential = appraiseCopingPotential(context.confidence, context.energy, context.vagalZone)
  const normCompatibility = appraiseNormCompatibility(event, context.selfConcept)

  let modulation = 1.0
  modulation *= 0.5 + novelty * APPRAISAL.NOVELTY_WEIGHT
  modulation *= 0.7 + goalRelevance * APPRAISAL.GOAL_RELEVANCE_AMPLIFICATION

  if (pleasantness < 0 && copingPotential < APPRAISAL.THREAT_COPING_THRESHOLD) {
    modulation *= APPRAISAL.THREAT_AMPLIFICATION
  }
  if (pleasantness > 0 && copingPotential > APPRAISAL.SAVORING_COPING_THRESHOLD) {
    modulation *= APPRAISAL.SAVORING_AMPLIFICATION
  }
  if (normCompatibility < -0.5) {
    modulation *= APPRAISAL.NORM_VIOLATION_AMPLIFICATION
  }

  const overallModulation = Math.max(APPRAISAL.MIN_MODULATION, Math.min(APPRAISAL.MAX_MODULATION, modulation))

  return { novelty, pleasantness, goalRelevance, copingPotential, normCompatibility, overallModulation }
}

type EmotionDeltas = Partial<Record<keyof EmotionalState, number>>

/**
 * Apply a single event with appraisal-modulated deltas.
 * Low coping + negative event shifts frustration towards caution (threat framing).
 * High coping + negative event shifts caution towards frustration (challenge framing).
 */
export function applyAppraisedEvent(
  state: EmotionalState,
  event: EmotionUpdateEvent,
  baseDeltas: EmotionDeltas,
  appraisal: AppraisalResult
): EmotionalState {
  const modulatedDeltas: EmotionDeltas = {}

  for (const [key, baseDelta] of Object.entries(baseDeltas)) {
    const dim = key as keyof EmotionalState
    let delta = baseDelta * event.intensity * appraisal.overallModulation

    if (
      dim === "frustration" &&
      appraisal.pleasantness < 0 &&
      appraisal.copingPotential < APPRAISAL.THREAT_COPING_THRESHOLD
    ) {
      delta *= 1 - APPRAISAL.COPING_THREAT_SHIFT
    }
    if (
      dim === "caution" &&
      appraisal.pleasantness < 0 &&
      appraisal.copingPotential < APPRAISAL.THREAT_COPING_THRESHOLD
    ) {
      delta += Math.abs(baseDelta) * APPRAISAL.COPING_THREAT_SHIFT * event.intensity
    }

    if (
      dim === "frustration" &&
      appraisal.pleasantness < 0 &&
      appraisal.copingPotential > APPRAISAL.SAVORING_COPING_THRESHOLD
    ) {
      delta += Math.abs(baseDelta) * APPRAISAL.COPING_THREAT_SHIFT * event.intensity * 0.5
    }
    if (
      dim === "caution" &&
      appraisal.pleasantness < 0 &&
      appraisal.copingPotential > APPRAISAL.SAVORING_COPING_THRESHOLD
    ) {
      delta *= 1 - APPRAISAL.COPING_THREAT_SHIFT
    }

    if (appraisal.goalRelevance > 0.5 && (dim === "satisfaction" || dim === "frustration")) {
      delta *= 1 + APPRAISAL.GOAL_RELEVANCE_BOOST
    }

    if (appraisal.normCompatibility < -0.5 && dim === "caution") {
      delta += APPRAISAL.NORM_VIOLATION_CAUTION_BOOST * event.intensity
    }

    const clampedDelta = Math.max(-0.2, Math.min(0.2, delta))
    modulatedDeltas[dim] = (state[dim] ?? 0) + clampedDelta
  }

  return clampState({ ...state, ...modulatedDeltas })
}

/**
 * Apply multiple events with appraisal, returning both the final state and all appraisal results.
 */
export function applyAppraisedEvents(
  state: EmotionalState,
  events: EmotionUpdateEvent[],
  context: AppraisalContext,
  triggerDeltas: Record<EmotionTrigger, EmotionDeltas>,
  triggerTimestamps?: Record<string, number>
): { state: EmotionalState; appraisals: AppraisalResult[] } {
  const appraisals: AppraisalResult[] = []
  let current = state

  for (const event of events) {
    const lastSimilar = triggerTimestamps?.[event.trigger]
    const appraisal = computeAppraisal(event, context, lastSimilar)
    appraisals.push(appraisal)

    const baseDeltas = triggerDeltas[event.trigger] ?? {}
    current = applyAppraisedEvent(current, event, baseDeltas, appraisal)
  }

  return { state: current, appraisals }
}

/**
 * Create a neutral appraisal context for simple emotion updates outside the main pipeline.
 * Uses default values that produce near-unity modulation (minimal appraisal effect).
 */
export function createNeutralAppraisalContext(): AppraisalContext {
  return {
    noveltyLevel: 0.5,
    hasActiveGoals: false,
    confidence: 0.5,
    energy: 0.5,
    vagalZone: "ventral",
    selfConcept: { selfEfficacy: 0.5, selfWorth: 0.5, selfContinuity: 0.7, agency: 0.5, authenticity: 0.6 }
  }
}
