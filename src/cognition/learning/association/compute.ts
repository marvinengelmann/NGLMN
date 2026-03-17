import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { HEBBIAN } from "./constants.ts"
import type { AssociationActivation, HebbianAssociation } from "./types.ts"

/**
 * Strengthen an association via Long-Term Potentiation (LTP).
 * Uses diminishing returns near max strength.
 */
export function strengthenAssociation(association: HebbianAssociation): HebbianAssociation {
  const increment = HEBBIAN.LTP_INCREMENT * (1 - association.strength)
  return {
    ...association,
    strength: clamp(association.strength + increment, 0, HEBBIAN.MAX_STRENGTH),
    coactivationCount: association.coactivationCount + 1,
    lastCoactivatedAt: nowISO()
  }
}

/**
 * Decay an association via Long-Term Depression (LTD).
 * Slow, proportional to time since last activation.
 */
export function decayAssociation(association: HebbianAssociation, daysSinceLastActivation: number): HebbianAssociation {
  const decay = HEBBIAN.LTD_RATE * daysSinceLastActivation
  return {
    ...association,
    strength: Math.max(0, association.strength - decay)
  }
}

interface StimulusExtractionContext {
  hourOfDay: number
  messageTopics: string[]
  emotionLabels: string[]
  operatorMood: string
  currentAction: string
  entityNames: string[]
}

/**
 * Extract stimulus labels from the current tick context.
 * These labels represent "what is active right now" for Hebbian co-activation.
 */
export function extractStimuliFromContext(context: StimulusExtractionContext): string[] {
  const stimuli: string[] = []

  const hour = context.hourOfDay
  if (hour >= 6 && hour < 12) stimuli.push("time:morning")
  else if (hour >= 12 && hour < 17) stimuli.push("time:afternoon")
  else if (hour >= 17 && hour < 22) stimuli.push("time:evening")
  else stimuli.push("time:night")

  for (const topic of context.messageTopics.slice(0, 3)) {
    stimuli.push(`topic:${topic}`)
  }

  for (const label of context.emotionLabels.slice(0, 3)) {
    stimuli.push(`emotion:${label}`)
  }

  if (context.operatorMood !== "unknown") {
    stimuli.push(`operator_mood:${context.operatorMood}`)
  }

  if (context.currentAction !== "idle") {
    stimuli.push(`action:${context.currentAction}`)
  }

  for (const entity of context.entityNames.slice(0, 3)) {
    stimuli.push(`entity:${entity}`)
  }

  return stimuli
}

/**
 * Derive dominant emotion labels from an emotional state.
 */
export function extractEmotionLabels(emotion: EmotionalState): string[] {
  const entries = Object.entries(emotion) as [string, number][]
  return entries.filter(([, value]) => value > 0.5).map(([key]) => key)
}

/**
 * Find pairs of stimuli that co-occurred in the current tick AND recent ticks.
 * Only pairs within the coactivation window are considered.
 */
export function findCoactivations(currentStimuli: string[], recentStimuliHistory: string[][]): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const seen = new Set<string>()

  const windowHistory = recentStimuliHistory.slice(-HEBBIAN.COACTIVATION_WINDOW_TICKS)
  const recentSet = new Set(windowHistory.flat())

  for (let i = 0; i < currentStimuli.length; i++) {
    for (let j = i + 1; j < currentStimuli.length; j++) {
      const a = currentStimuli[i] as string
      const b = currentStimuli[j] as string
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push(a < b ? [a, b] : [b, a])
      }
    }
  }

  for (const stimulus of currentStimuli) {
    for (const recentStimulus of recentSet) {
      if (stimulus === recentStimulus) continue
      if (currentStimuli.includes(recentStimulus)) continue
      const a = stimulus
      const b = recentStimulus
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push(a < b ? [a, b] : [b, a])
      }
    }
  }

  return pairs
}

/**
 * Query associations that are implicitly primed by current active stimuli.
 * Returns associations above ACTIVATION_THRESHOLD where one side matches an active stimulus.
 * The OTHER side is the "primed" stimulus — implicitly anticipated but not currently present.
 */
export function queryImplicitAssociations(
  currentStimuli: string[],
  associations: HebbianAssociation[]
): AssociationActivation[] {
  const stimuliSet = new Set(currentStimuli)
  const activations: AssociationActivation[] = []

  for (const assoc of associations) {
    if (assoc.strength < HEBBIAN.ACTIVATION_THRESHOLD) continue

    const aPresent = stimuliSet.has(assoc.stimulusA)
    const bPresent = stimuliSet.has(assoc.stimulusB)

    if ((aPresent && !bPresent) || (bPresent && !aPresent)) {
      activations.push({
        stimulusA: assoc.stimulusA,
        stimulusB: assoc.stimulusB,
        activationStrength: assoc.strength
      })
    }
  }

  return activations.sort((a, b) => b.activationStrength - a.activationStrength)
}

/**
 * Prune associations below minimum strength and enforce count limit.
 */
export function pruneWeakAssociations(associations: HebbianAssociation[]): HebbianAssociation[] {
  const filtered = associations.filter((a) => a.strength >= HEBBIAN.MIN_STRENGTH)
  if (filtered.length <= HEBBIAN.MAX_ASSOCIATIONS) return filtered

  filtered.sort((a, b) => b.strength - a.strength)
  return filtered.slice(0, HEBBIAN.MAX_ASSOCIATIONS)
}

/**
 * Process a full Hebbian learning cycle: find coactivations in the current context
 * and strengthen matching associations (or create new ones).
 */
export function processHebbianCycle(
  associations: HebbianAssociation[],
  currentStimuli: string[],
  recentStimuliHistory: string[][]
): HebbianAssociation[] {
  const coactivations = findCoactivations(currentStimuli, recentStimuliHistory)
  if (coactivations.length === 0) return associations

  const assocMap = new Map<string, HebbianAssociation>()
  for (const assoc of associations) {
    const key = `${assoc.stimulusA}|${assoc.stimulusB}`
    assocMap.set(key, assoc)
  }

  const now = nowISO()
  for (const [a, b] of coactivations) {
    const key = `${a}|${b}`
    const existing = assocMap.get(key)

    if (existing) {
      assocMap.set(key, strengthenAssociation(existing))
    } else {
      assocMap.set(key, {
        id: crypto.randomUUID(),
        stimulusA: a,
        stimulusB: b,
        strength: HEBBIAN.LTP_INCREMENT,
        coactivationCount: 1,
        lastCoactivatedAt: now,
        createdAt: now
      })
    }
  }

  return Array.from(assocMap.values())
}
