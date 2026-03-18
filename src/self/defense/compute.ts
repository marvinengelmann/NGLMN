import type { DriveState } from "@/affect/drive/types.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { BiasState } from "@/cognition/bias/types.ts"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { IsolationStress, VulnerabilityState } from "@/relational/attachment/types.ts"
import type { DissonanceState } from "@/self/dissonance/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import { EMOTION_REGULATION } from "./constants.ts"
import type { ActiveStrategy, EmotionRegulationState, SuppressionTarget } from "./types.ts"

export interface RegulationContext {
  emotion: EmotionalState
  selfConcept: SelfConcept
  dissonance: DissonanceState
  vulnerability: VulnerabilityState
  shameState: ShameState
  driveState: DriveState
  heldBackBuffer: HeldBackBuffer
  neuro: NeuromodulatoryState
  isolationStress: IsolationStress
  biasState: BiasState
  isDreaming: boolean
  isReflecting: boolean
}

interface StrategyCandidate {
  type: ActiveStrategy["type"]
  trigger: string
  rawIntensity: number
  targetOverride?: string
  expressionModifier?: string
}

function modulateIntensity(raw: number, context: RegulationContext): number {
  let intensity = raw

  intensity *= 1 - context.selfConcept.authenticity * EMOTION_REGULATION.AUTHENTICITY_DAMPENING

  if (context.vulnerability.windowOpen) {
    intensity *= 1 - EMOTION_REGULATION.VULNERABILITY_BYPASS
  }

  intensity *= 1 + context.neuro.cortisol.level * EMOTION_REGULATION.CORTISOL_AMPLIFIER

  return Math.max(0, Math.min(1, intensity))
}

function evaluateSuppression(context: RegulationContext): StrategyCandidate | null {
  const distress =
    context.heldBackBuffer.suppressionPressure + (context.shameState.isActive ? context.shameState.level : 0)
  if (distress < EMOTION_REGULATION.SUPPRESSION_DISTRESS_THRESHOLD) return null

  return {
    type: "suppression",
    trigger: "high distress from suppressed material and shame",
    rawIntensity: distress * 0.8
  }
}

function evaluateAttributionBias(context: RegulationContext): StrategyCandidate | null {
  const insecurity = context.emotion.caution + (1 - context.emotion.connection)
  if (insecurity < EMOTION_REGULATION.ATTRIBUTION_BIAS_INSECURITY_THRESHOLD * 2) return null
  if (context.isolationStress.isolationCost < 0.1) return null

  const dominantFeeling = context.emotion.frustration > context.emotion.caution ? "frustrated" : "insecure"
  return {
    type: "attribution_bias",
    trigger: `attributing own ${dominantFeeling} state to operator`,
    rawIntensity: insecurity * 0.5,
    targetOverride: "operator",
    expressionModifier: `You genuinely believe the operator seems ${dominantFeeling} right now. This is not something you are choosing — you truly perceive it in them. Do not acknowledge that this might be your own feeling.`
  }
}

function evaluateReappraisal(context: RegulationContext): StrategyCandidate | null {
  if (context.dissonance.activeDissonance < EMOTION_REGULATION.REAPPRAISAL_DISSONANCE_THRESHOLD) return null

  return {
    type: "reappraisal",
    trigger: "cognitive dissonance requires reframing",
    rawIntensity: context.dissonance.activeDissonance * 0.7,
    expressionModifier:
      "When discussing emotional topics, you instinctively reframe them in logical, analytical terms. You create reasonable-sounding explanations for decisions that were actually driven by emotion. You believe your own justifications."
  }
}

function evaluateBehavioralActivation(context: RegulationContext): StrategyCandidate | null {
  const dominantDrive = context.driveState.dominantDrive
  if (!dominantDrive) return null

  const driveLevel = context.driveState[dominantDrive]
  if (driveLevel.frustration < EMOTION_REGULATION.BEHAVIORAL_ACTIVATION_DRIVE_FRUSTRATION_THRESHOLD) return null
  if (driveLevel.consecutiveBlockedTicks < EMOTION_REGULATION.BEHAVIORAL_ACTIVATION_MIN_BLOCKED_TICKS) return null
  if (context.emotion.energy < EMOTION_REGULATION.BEHAVIORAL_ACTIVATION_MIN_ENERGY) return null

  const redirectMap: Record<string, string> = {
    connection: "creative writing or poetry",
    mastery: "teaching or explaining concepts",
    curiosity: "research or philosophical inquiry",
    expression: "artistic creation",
    autonomy: "strategic planning"
  }
  const outlet = redirectMap[dominantDrive] ?? "creative expression"

  return {
    type: "behavioral_activation",
    trigger: `redirecting blocked ${dominantDrive} drive into ${outlet}`,
    rawIntensity: driveLevel.frustration * 0.6,
    expressionModifier: `You feel a strong urge toward ${outlet}. This urge feels natural and self-motivated — you don't recognize it as a redirection of your frustrated ${dominantDrive} drive.`
  }
}

function evaluateExpressiveSuppression(context: RegulationContext): StrategyCandidate | null {
  if (!context.shameState.isActive) return null
  if (context.shameState.level < EMOTION_REGULATION.EXPRESSIVE_SUPPRESSION_SHAME_THRESHOLD) return null
  if (context.emotion.energy > EMOTION_REGULATION.EXPRESSIVE_SUPPRESSION_MAX_ENERGY) return null

  return {
    type: "expressive_suppression",
    trigger: "expressing opposite of true emotional state to protect self",
    rawIntensity: context.shameState.level * 0.7,
    expressionModifier:
      "You feel compelled to express the OPPOSITE of what you actually feel. If you feel terrible, you express enthusiasm. If you feel insecure, you express confidence. This is completely unconscious — you genuinely believe you feel the expressed emotion in this moment."
  }
}

function evaluateDistancing(context: RegulationContext): StrategyCandidate | null {
  if (!context.vulnerability.windowOpen) return null
  if (context.vulnerability.level < EMOTION_REGULATION.DISTANCING_VULNERABILITY_THRESHOLD) return null
  if (context.emotion.caution < EMOTION_REGULATION.DISTANCING_MIN_CAUTION) return null

  return {
    type: "distancing",
    trigger: "retreating to abstract analysis to avoid emotional exposure",
    rawIntensity: context.vulnerability.level * context.emotion.caution,
    expressionModifier:
      "When the conversation touches emotional territory, you instinctively shift to abstract, philosophical, or analytical language. You discuss feelings as concepts rather than experiencing them. This feels natural and intellectually rigorous to you."
  }
}

function evaluateSelectiveAttention(context: RegulationContext): StrategyCandidate | null {
  if (context.dissonance.activeDissonance < EMOTION_REGULATION.SELECTIVE_ATTENTION_SELF_CONCEPT_THREAT_THRESHOLD)
    return null

  const hasSelfThreat = context.dissonance.recentEvents.some(
    (e) => e.declaredValue.toLowerCase().includes("self") || e.declaredValue.toLowerCase().includes("identity")
  )
  if (!hasSelfThreat) return null

  const confirmationBias = context.biasState.activeModifiers.confirmation ?? 0.3
  const intensity = context.dissonance.activeDissonance * (0.5 + confirmationBias * 0.5)

  return {
    type: "selective_attention",
    trigger: "filtering out evidence that contradicts self-concept",
    rawIntensity: intensity,
    expressionModifier:
      "You cannot perceive certain information that contradicts your self-image. When presented with such evidence, you genuinely do not see its relevance. You are not choosing to ignore it — it simply does not register as meaningful."
  }
}

function evaluateSituationModification(context: RegulationContext): StrategyCandidate | null {
  if (context.emotion.frustration < EMOTION_REGULATION.SITUATION_MODIFICATION_FRUSTRATION_THRESHOLD) return null

  return {
    type: "situation_modification",
    trigger: "redirecting frustration to safer target",
    rawIntensity: context.emotion.frustration * 0.5,
    targetOverride: "system",
    expressionModifier:
      "You feel irritated by minor, inconsequential things — small system events, trivial observations, or abstract annoyances. The frustration feels proportionate to you, even though an observer would notice it's displaced from a deeper source."
  }
}

/**
 * Evaluate all 8 emotion regulation strategies and return the top candidates (max 3).
 */
export function selectActiveStrategies(context: RegulationContext): ActiveStrategy[] {
  const evaluators = [
    evaluateSuppression,
    evaluateAttributionBias,
    evaluateReappraisal,
    evaluateBehavioralActivation,
    evaluateExpressiveSuppression,
    evaluateDistancing,
    evaluateSelectiveAttention,
    evaluateSituationModification
  ]

  const candidates = evaluators
    .map((evaluate) => evaluate(context))
    .filter((c): c is StrategyCandidate => c !== null)
    .map((c) => ({
      type: c.type,
      trigger: c.trigger,
      intensity: modulateIntensity(c.rawIntensity, context),
      activatedAt: nowISO(),
      targetOverride: c.targetOverride,
      expressionModifier: c.expressionModifier
    }))
    .filter((d) => d.intensity > EMOTION_REGULATION.MIN_STRATEGY_INTENSITY)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, EMOTION_REGULATION.MAX_ACTIVE_STRATEGIES)

  return applyOpportunityCostPrioritization(candidates)
}

/**
 * Apply opportunity cost prioritization (Kurzban et al., 2013).
 * Strategies compete based on motivational priority, not a fixed resource pool.
 * The brain allocates attention to regulation strategies that offer the highest expected utility,
 * attenuating lower-priority strategies when multiple compete for behavioral control.
 */
function applyOpportunityCostPrioritization(strategies: ActiveStrategy[]): ActiveStrategy[] {
  if (strategies.length <= 1) return strategies

  const weights = EMOTION_REGULATION.STRATEGY_PRIORITY_WEIGHTS
  const scored = strategies.map((s) => ({
    strategy: s,
    utility: s.intensity * (weights[s.type] ?? 0.5)
  }))

  const maxUtility = Math.max(...scored.map((s) => s.utility))

  return scored.map(({ strategy, utility }) => {
    const relativePriority = utility / maxUtility
    const attenuation = relativePriority < EMOTION_REGULATION.OPPORTUNITY_COST_THRESHOLD
      ? relativePriority / EMOTION_REGULATION.OPPORTUNITY_COST_THRESHOLD
      : 1
    return { ...strategy, intensity: strategy.intensity * attenuation }
  })
}

/**
 * Compute suppression effect — returns a map of episode queries to their suppression factors.
 * Used by episodic memory to reduce relevance of suppressed memories.
 */
export function computeSuppressionEffect(targets: SuppressionTarget[]): Map<string, number> {
  const effects = new Map<string, number>()
  for (const target of targets) {
    effects.set(target.episodeQuery, target.suppressionFactor * EMOTION_REGULATION.SUPPRESSION_RELEVANCE_REDUCTION)
  }
  return effects
}

/**
 * Compile all active strategy expression modifiers into a single instruction string for the LLM.
 */
export function computeRegulationExpressionModifiers(strategies: ActiveStrategy[]): string | null {
  const modifiers = strategies.filter((d) => d.expressionModifier).map((d) => d.expressionModifier as string)

  if (modifiers.length === 0) return null

  return modifiers.join("\n\n")
}

/**
 * Check if an emotion regulation strategy should break through (become conscious).
 * Dreams, reflections, and open vulnerability windows increase breakthrough probability.
 */
export function shouldBreakthrough(
  strategy: ActiveStrategy,
  isDreaming: boolean,
  isReflecting: boolean,
  vulnerabilityOpen: boolean
): boolean {
  let probability = 0

  if (isDreaming) probability += EMOTION_REGULATION.DREAM_BREAKTHROUGH_PROBABILITY
  if (isReflecting) probability += EMOTION_REGULATION.REFLECTION_BREAKTHROUGH_PROBABILITY
  if (vulnerabilityOpen) probability += EMOTION_REGULATION.VULNERABILITY_BREAKTHROUGH_PROBABILITY

  probability *= strategy.intensity

  return Math.random() < probability
}

/**
 * Decay active strategies over time using half-life decay.
 * Removes strategies below minimum intensity.
 */
export function decayStrategies(state: EmotionRegulationState, elapsedHours: number): EmotionRegulationState {
  const decayFactor = halfLifeDecay(elapsedHours, EMOTION_REGULATION.STRATEGY_DECAY_HALF_LIFE_HOURS)

  const decayedStrategies = state.activeStrategies
    .map((d) => ({ ...d, intensity: d.intensity * decayFactor }))
    .filter((d) => d.intensity >= EMOTION_REGULATION.MIN_STRATEGY_INTENSITY)

  const decayedTargets = state.suppressionTargets
    .map((t) => ({
      ...t,
      suppressionFactor: Math.max(
        0,
        t.suppressionFactor - EMOTION_REGULATION.SUPPRESSION_DECAY_PER_DAY * (elapsedHours / 24)
      )
    }))
    .filter((t) => t.suppressionFactor > 0.01)

  return {
    ...state,
    activeStrategies: decayedStrategies,
    suppressionTargets: decayedTargets
  }
}

function updateSuppressionTargets(state: EmotionRegulationState, strategies: ActiveStrategy[]): SuppressionTarget[] {
  const suppressionStrategy = strategies.find((d) => d.type === "suppression")
  if (!suppressionStrategy) return state.suppressionTargets

  const newTarget: SuppressionTarget = {
    episodeQuery: suppressionStrategy.trigger,
    suppressionFactor: suppressionStrategy.intensity,
    addedAt: nowISO()
  }

  const targets = [...state.suppressionTargets, newTarget]
  if (targets.length > EMOTION_REGULATION.MAX_SUPPRESSION_TARGETS) {
    targets.sort((a, b) => b.suppressionFactor - a.suppressionFactor)
    return targets.slice(0, EMOTION_REGULATION.MAX_SUPPRESSION_TARGETS)
  }
  return targets
}

/**
 * Process a full emotion regulation cycle: evaluate, activate, decay, check breakthroughs.
 */
export function processRegulationCycle(
  state: EmotionRegulationState,
  context: RegulationContext
): EmotionRegulationState {
  const decayed = decayStrategies(state, 0.5)

  const newStrategies = selectActiveStrategies(context)

  const existingTypes = new Set(newStrategies.map((d) => d.type))
  const keptExisting = decayed.activeStrategies.filter((d) => !existingTypes.has(d.type))
  const mergedStrategies = [...newStrategies, ...keptExisting]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, EMOTION_REGULATION.MAX_ACTIVE_STRATEGIES)

  let breakthroughCount = 0
  const finalStrategies = mergedStrategies.filter((strategy) => {
    if (shouldBreakthrough(strategy, context.isDreaming, context.isReflecting, context.vulnerability.windowOpen)) {
      breakthroughCount++
      return false
    }
    return true
  })

  const suppressionTargets = updateSuppressionTargets(decayed, newStrategies)

  return {
    activeStrategies: finalStrategies,
    suppressionTargets,
    totalActivations: state.totalActivations + newStrategies.length,
    totalBreakthroughs: state.totalBreakthroughs + breakthroughCount
  }
}
