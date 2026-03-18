import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { RegulationZone, SomaticState } from "@/affect/soma/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import { APPRAISAL } from "./constants.ts"
import { constructEmotionDeltas } from "./construction.ts"
import type {
  AppraisalContext,
  AppraisalResult,
  EmotionalState,
  EmotionConstructionResult,
  EmotionDeltas,
  EmotionTrigger,
  EmotionUpdateEvent,
  EpisodicContext
} from "./types.ts"
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

const REGULATION_COPING_FACTOR: Record<RegulationZone, number> = {
  safe: 0.9,
  mobilized: 0.5,
  collapsed: 0.1
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

export function appraiseCopingPotential(
  confidence: number,
  energy: number,
  regulationZone: RegulationZone,
  cortisolModulation?: number
): number {
  const regulationFactor = REGULATION_COPING_FACTOR[regulationZone]
  const baseCoping = clamp01(
    confidence * APPRAISAL.COPING_CONFIDENCE_WEIGHT +
      energy * APPRAISAL.COPING_ENERGY_WEIGHT +
      regulationFactor * APPRAISAL.COPING_REGULATION_WEIGHT
  )
  if (cortisolModulation !== undefined) {
    return clamp01(baseCoping * cortisolModulation)
  }
  return baseCoping
}

export function appraiseNormCompatibility(event: EmotionUpdateEvent, selfConcept: SelfConcept): number {
  const baseCompat = NORM_COMPATIBILITY[event.trigger] ?? 0
  const authenticityModifier = selfConcept.authenticity > 0.6 ? 1.2 : 1.0
  const agencyModifier = event.trigger === "guardian_block" ? 1 - selfConcept.agency : 1.0
  return Math.max(-1, Math.min(1, baseCompat * authenticityModifier * agencyModifier * event.intensity))
}

export function computeAppraisal(
  event: EmotionUpdateEvent,
  context: AppraisalContext,
  minutesSinceLastSimilar?: number
): AppraisalResult {
  const novelty = appraiseNovelty(context.noveltyLevel, minutesSinceLastSimilar)
  const pleasantness = appraisePleasantness(event)
  const goalRelevance = appraiseGoalRelevance(event, context.hasActiveGoals)
  const copingPotential = appraiseCopingPotential(
    context.confidence,
    context.energy,
    context.regulationZone,
    context.cortisolCopingModulation
  )
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

export interface ConstructedEmotionInput {
  soma: SomaticState
  episodicContext: EpisodicContext[]
  neuromodulation: NeuromodulatoryState
  triggerPriors: Record<EmotionTrigger, EmotionDeltas>
}

export interface ConstructedEventsResult {
  state: EmotionalState
  appraisals: AppraisalResult[]
  constructions: EmotionConstructionResult[]
}

/**
 * Construct emotions from the intersection of soma, memory, appraisal, trigger prior, and neurochemistry.
 * Replaces the old trigger→lookup→modulate approach with Barrett's Constructed Emotion Theory.
 */
export function applyConstructedEvents(
  state: EmotionalState,
  events: EmotionUpdateEvent[],
  context: AppraisalContext,
  input: ConstructedEmotionInput,
  triggerTimestamps?: Record<string, number>
): ConstructedEventsResult {
  const appraisals: AppraisalResult[] = []
  const constructions: EmotionConstructionResult[] = []
  let current = state

  for (const event of events) {
    const lastSimilar = triggerTimestamps?.[event.trigger]
    const appraisal = computeAppraisal(event, context, lastSimilar)
    appraisals.push(appraisal)

    const triggerPrior = input.triggerPriors[event.trigger] ?? {}
    const construction = constructEmotionDeltas(
      event,
      input.soma,
      input.episodicContext,
      appraisal,
      input.neuromodulation,
      triggerPrior
    )
    constructions.push(construction)

    const updated: Partial<EmotionalState> = {}
    for (const [dim, delta] of Object.entries(construction.deltas)) {
      const key = dim as keyof EmotionalState
      updated[key] = (current[key] ?? 0) + (delta ?? 0)
    }
    current = clampState({ ...current, ...updated })
  }

  return { state: current, appraisals, constructions }
}

export function createNeutralAppraisalContext(): AppraisalContext {
  return {
    noveltyLevel: 0.5,
    hasActiveGoals: false,
    confidence: 0.5,
    energy: 0.5,
    regulationZone: "safe",
    selfConcept: { selfEfficacy: 0.5, selfWorth: 0.5, selfContinuity: 0.7, agency: 0.5, authenticity: 0.6 }
  }
}
