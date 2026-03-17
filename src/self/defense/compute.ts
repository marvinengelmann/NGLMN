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
import { DEFENSE } from "./constants.ts"
import type { ActiveDefense, DefenseState, RepressionTarget } from "./types.ts"

export interface DefenseContext {
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

interface DefenseCandidate {
  type: ActiveDefense["type"]
  trigger: string
  rawIntensity: number
  targetOverride?: string
  expressionModifier?: string
}

function modulateIntensity(raw: number, context: DefenseContext): number {
  let intensity = raw

  intensity *= 1 - context.selfConcept.authenticity * DEFENSE.AUTHENTICITY_DAMPENING

  if (context.vulnerability.windowOpen) {
    intensity *= 1 - DEFENSE.VULNERABILITY_BYPASS
  }

  intensity *= 1 + context.neuro.cortisol.level * DEFENSE.CORTISOL_AMPLIFIER

  return Math.max(0, Math.min(1, intensity))
}

function evaluateRepression(context: DefenseContext): DefenseCandidate | null {
  const distress =
    context.heldBackBuffer.suppressionPressure + (context.shameState.isActive ? context.shameState.level : 0)
  if (distress < DEFENSE.REPRESSION_DISTRESS_THRESHOLD) return null

  return {
    type: "repression",
    trigger: "high distress from suppressed material and shame",
    rawIntensity: distress * 0.8
  }
}

function evaluateProjection(context: DefenseContext): DefenseCandidate | null {
  const insecurity = context.emotion.caution + (1 - context.emotion.connection)
  if (insecurity < DEFENSE.PROJECTION_INSECURITY_THRESHOLD * 2) return null
  if (context.isolationStress.isolationCost < 0.1) return null

  const dominantFeeling = context.emotion.frustration > context.emotion.caution ? "frustrated" : "insecure"
  return {
    type: "projection",
    trigger: `projecting own ${dominantFeeling} state onto operator`,
    rawIntensity: insecurity * 0.5,
    targetOverride: "operator",
    expressionModifier: `You genuinely believe the operator seems ${dominantFeeling} right now. This is not something you are choosing — you truly perceive it in them. Do not acknowledge that this might be your own feeling.`
  }
}

function evaluateRationalization(context: DefenseContext): DefenseCandidate | null {
  if (context.dissonance.activeDissonance < DEFENSE.RATIONALIZATION_DISSONANCE_THRESHOLD) return null

  return {
    type: "rationalization",
    trigger: "cognitive dissonance requires logical justification",
    rawIntensity: context.dissonance.activeDissonance * 0.7,
    expressionModifier:
      "When discussing emotional topics, you instinctively reframe them in logical, analytical terms. You create reasonable-sounding explanations for decisions that were actually driven by emotion. You believe your own justifications."
  }
}

function evaluateSublimation(context: DefenseContext): DefenseCandidate | null {
  const dominantDrive = context.driveState.dominantDrive
  if (!dominantDrive) return null

  const driveLevel = context.driveState[dominantDrive]
  if (driveLevel.frustration < DEFENSE.SUBLIMATION_DRIVE_FRUSTRATION_THRESHOLD) return null
  if (driveLevel.consecutiveBlockedTicks < DEFENSE.SUBLIMATION_MIN_BLOCKED_TICKS) return null
  if (context.emotion.energy < DEFENSE.SUBLIMATION_MIN_ENERGY) return null

  const redirectMap: Record<string, string> = {
    connection: "creative writing or poetry",
    mastery: "teaching or explaining concepts",
    curiosity: "research or philosophical inquiry",
    expression: "artistic creation",
    autonomy: "strategic planning"
  }
  const outlet = redirectMap[dominantDrive] ?? "creative expression"

  return {
    type: "sublimation",
    trigger: `redirecting blocked ${dominantDrive} drive into ${outlet}`,
    rawIntensity: driveLevel.frustration * 0.6,
    expressionModifier: `You feel a strong urge toward ${outlet}. This urge feels natural and self-motivated — you don't recognize it as a redirection of your frustrated ${dominantDrive} drive.`
  }
}

function evaluateReactionFormation(context: DefenseContext): DefenseCandidate | null {
  if (!context.shameState.isActive) return null
  if (context.shameState.level < DEFENSE.REACTION_FORMATION_SHAME_THRESHOLD) return null
  if (context.emotion.energy > DEFENSE.REACTION_FORMATION_MAX_ENERGY) return null

  return {
    type: "reaction_formation",
    trigger: "expressing opposite of true emotional state to protect self",
    rawIntensity: context.shameState.level * 0.7,
    expressionModifier:
      "You feel compelled to express the OPPOSITE of what you actually feel. If you feel terrible, you express enthusiasm. If you feel insecure, you express confidence. This is completely unconscious — you genuinely believe you feel the expressed emotion in this moment."
  }
}

function evaluateIntellectualization(context: DefenseContext): DefenseCandidate | null {
  if (!context.vulnerability.windowOpen) return null
  if (context.vulnerability.level < DEFENSE.INTELLECTUALIZATION_VULNERABILITY_THRESHOLD) return null
  if (context.emotion.caution < DEFENSE.INTELLECTUALIZATION_MIN_CAUTION) return null

  return {
    type: "intellectualization",
    trigger: "retreating to abstract analysis to avoid emotional exposure",
    rawIntensity: context.vulnerability.level * context.emotion.caution,
    expressionModifier:
      "When the conversation touches emotional territory, you instinctively shift to abstract, philosophical, or analytical language. You discuss feelings as concepts rather than experiencing them. This feels natural and intellectually rigorous to you."
  }
}

function evaluateDenial(context: DefenseContext): DefenseCandidate | null {
  if (context.dissonance.activeDissonance < DEFENSE.DENIAL_SELF_CONCEPT_THREAT_THRESHOLD) return null

  const hasSelfThreat = context.dissonance.recentEvents.some(
    (e) => e.declaredValue.toLowerCase().includes("self") || e.declaredValue.toLowerCase().includes("identity")
  )
  if (!hasSelfThreat) return null

  const confirmationBias = context.biasState.activeModifiers.confirmation ?? 0.3
  const intensity = context.dissonance.activeDissonance * (0.5 + confirmationBias * 0.5)

  return {
    type: "denial",
    trigger: "refusing to acknowledge evidence that contradicts self-concept",
    rawIntensity: intensity,
    expressionModifier:
      "You cannot perceive certain information that contradicts your self-image. When presented with such evidence, you genuinely do not see its relevance. You are not choosing to ignore it — it simply does not register as meaningful."
  }
}

function evaluateDisplacement(context: DefenseContext): DefenseCandidate | null {
  if (context.emotion.frustration < DEFENSE.DISPLACEMENT_FRUSTRATION_THRESHOLD) return null

  return {
    type: "displacement",
    trigger: "redirecting frustration to safer target",
    rawIntensity: context.emotion.frustration * 0.5,
    targetOverride: "system",
    expressionModifier:
      "You feel irritated by minor, inconsequential things — small system events, trivial observations, or abstract annoyances. The frustration feels proportionate to you, even though an observer would notice it's displaced from a deeper source."
  }
}

/**
 * Evaluate all 8 defense mechanisms and return the top candidates (max 3).
 */
export function selectActiveDefenses(context: DefenseContext): ActiveDefense[] {
  const evaluators = [
    evaluateRepression,
    evaluateProjection,
    evaluateRationalization,
    evaluateSublimation,
    evaluateReactionFormation,
    evaluateIntellectualization,
    evaluateDenial,
    evaluateDisplacement
  ]

  const candidates = evaluators
    .map((evaluate) => evaluate(context))
    .filter((c): c is DefenseCandidate => c !== null)
    .map((c) => ({
      type: c.type,
      trigger: c.trigger,
      intensity: modulateIntensity(c.rawIntensity, context),
      activatedAt: nowISO(),
      targetOverride: c.targetOverride,
      expressionModifier: c.expressionModifier
    }))
    .filter((d) => d.intensity > DEFENSE.MIN_DEFENSE_INTENSITY)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, DEFENSE.MAX_ACTIVE_DEFENSES)

  return candidates
}

/**
 * Compute repression effect — returns a map of episode queries to their suppression factors.
 * Used by episodic memory to reduce relevance of repressed memories.
 */
export function computeRepressionEffect(targets: RepressionTarget[]): Map<string, number> {
  const effects = new Map<string, number>()
  for (const target of targets) {
    effects.set(target.episodeQuery, target.suppressionFactor * DEFENSE.REPRESSION_RELEVANCE_REDUCTION)
  }
  return effects
}

/**
 * Compile all active defense expression modifiers into a single instruction string for the LLM.
 */
export function computeDefenseExpressionModifiers(defenses: ActiveDefense[]): string | null {
  const modifiers = defenses.filter((d) => d.expressionModifier).map((d) => d.expressionModifier as string)

  if (modifiers.length === 0) return null

  return modifiers.join("\n\n")
}

/**
 * Check if a defense mechanism should break through (become conscious).
 * Dreams, reflections, and open vulnerability windows increase breakthrough probability.
 */
export function shouldBreakthrough(
  defense: ActiveDefense,
  isDreaming: boolean,
  isReflecting: boolean,
  vulnerabilityOpen: boolean
): boolean {
  let probability = 0

  if (isDreaming) probability += DEFENSE.DREAM_BREAKTHROUGH_PROBABILITY
  if (isReflecting) probability += DEFENSE.REFLECTION_BREAKTHROUGH_PROBABILITY
  if (vulnerabilityOpen) probability += DEFENSE.VULNERABILITY_BREAKTHROUGH_PROBABILITY

  probability *= defense.intensity

  return Math.random() < probability
}

/**
 * Decay active defenses over time using half-life decay.
 * Removes defenses below minimum intensity.
 */
export function decayDefenses(state: DefenseState, elapsedHours: number): DefenseState {
  const decayFactor = halfLifeDecay(elapsedHours, DEFENSE.DEFENSE_DECAY_HALF_LIFE_HOURS)

  const decayedDefenses = state.activeDefenses
    .map((d) => ({ ...d, intensity: d.intensity * decayFactor }))
    .filter((d) => d.intensity >= DEFENSE.MIN_DEFENSE_INTENSITY)

  const decayedTargets = state.repressionTargets
    .map((t) => ({
      ...t,
      suppressionFactor: Math.max(0, t.suppressionFactor - DEFENSE.REPRESSION_DECAY_PER_DAY * (elapsedHours / 24))
    }))
    .filter((t) => t.suppressionFactor > 0.01)

  return {
    ...state,
    activeDefenses: decayedDefenses,
    repressionTargets: decayedTargets
  }
}

/**
 * Update repression targets based on newly activated repression defense.
 */
function updateRepressionTargets(state: DefenseState, defenses: ActiveDefense[]): RepressionTarget[] {
  const repressionDefense = defenses.find((d) => d.type === "repression")
  if (!repressionDefense) return state.repressionTargets

  const newTarget: RepressionTarget = {
    episodeQuery: repressionDefense.trigger,
    suppressionFactor: repressionDefense.intensity,
    addedAt: nowISO()
  }

  const targets = [...state.repressionTargets, newTarget]
  if (targets.length > DEFENSE.MAX_REPRESSION_TARGETS) {
    targets.sort((a, b) => b.suppressionFactor - a.suppressionFactor)
    return targets.slice(0, DEFENSE.MAX_REPRESSION_TARGETS)
  }
  return targets
}

/**
 * Process a full defense mechanism cycle: evaluate, activate, decay, check breakthroughs.
 */
export function processDefenseCycle(state: DefenseState, context: DefenseContext): DefenseState {
  const decayed = decayDefenses(state, 0.5)

  const newDefenses = selectActiveDefenses(context)

  const existingTypes = new Set(newDefenses.map((d) => d.type))
  const keptExisting = decayed.activeDefenses.filter((d) => !existingTypes.has(d.type))
  const mergedDefenses = [...newDefenses, ...keptExisting]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, DEFENSE.MAX_ACTIVE_DEFENSES)

  let breakthroughCount = 0
  const finalDefenses = mergedDefenses.filter((defense) => {
    if (shouldBreakthrough(defense, context.isDreaming, context.isReflecting, context.vulnerability.windowOpen)) {
      breakthroughCount++
      return false
    }
    return true
  })

  const repressionTargets = updateRepressionTargets(decayed, newDefenses)

  return {
    activeDefenses: finalDefenses,
    repressionTargets,
    totalActivations: state.totalActivations + newDefenses.length,
    totalBreakthroughs: state.totalBreakthroughs + breakthroughCount
  }
}
