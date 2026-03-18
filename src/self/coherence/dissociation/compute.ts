import type { RegulationZone } from "@/affect/soma/types.ts"
import { clamp } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { IsolationStress } from "@/relational/attachment/types.ts"
import type { FragmentationSource } from "@/self/coherence/types.ts"
import { DISSOCIATION } from "./constants.ts"
import type { DissociationEffects, DissociativeState, DissociativeSymptom } from "./types.ts"
import { NEUTRAL_DISSOCIATION_EFFECTS } from "./types.ts"

interface DissociationContext {
  regulationZone: RegulationZone
  fragmentationSources: FragmentationSource[]
  integrationScore: number
  isolationStress: IsolationStress
  cortisolLevel: number
}

export function checkDissociationTriggers(context: DissociationContext): boolean {
  return (
    context.regulationZone === "collapsed" &&
    context.fragmentationSources.length >= DISSOCIATION.FRAGMENTATION_THRESHOLD &&
    context.integrationScore < DISSOCIATION.COHERENCE_CEILING &&
    context.isolationStress.isolationCost > DISSOCIATION.ISOLATION_STRESS_THRESHOLD &&
    context.cortisolLevel > DISSOCIATION.CORTISOL_THRESHOLD
  )
}

export function computeDissociativeState(previous: DissociativeState, triggered: boolean): DissociativeState {
  if (triggered) {
    if (!previous.active && Math.random() >= DISSOCIATION.ONSET_PROBABILITY) {
      return previous
    }

    const newDepth = clamp(previous.depth + DISSOCIATION.DEPTH_INCREMENT, 0, DISSOCIATION.MAX_DEPTH)
    const symptoms = computeDissociativeSymptoms(newDepth)

    return {
      active: true,
      depth: newDepth,
      symptoms,
      triggerSource: previous.triggerSource ?? "extreme_stress_convergence",
      onsetAt: previous.onsetAt ?? nowISO(),
      durationTicks: previous.durationTicks + 1
    }
  }

  if (!previous.active) return previous

  const newDepth = Math.max(0, previous.depth - DISSOCIATION.DEPTH_DECAY)
  if (newDepth <= DISSOCIATION.DEPTH_CLEAR_THRESHOLD) {
    return {
      active: false,
      depth: 0,
      symptoms: [],
      triggerSource: null,
      onsetAt: null,
      durationTicks: 0
    }
  }

  return {
    ...previous,
    depth: newDepth,
    symptoms: computeDissociativeSymptoms(newDepth),
    durationTicks: previous.durationTicks + 1
  }
}

export function computeDissociativeSymptoms(depth: number): DissociativeSymptom[] {
  const symptoms: DissociativeSymptom[] = []
  for (const [symptom, threshold] of Object.entries(DISSOCIATION.SYMPTOM_THRESHOLDS)) {
    if (depth >= threshold) {
      symptoms.push(symptom as DissociativeSymptom)
    }
  }
  return symptoms
}

export function computeDissociationEffects(state: DissociativeState): DissociationEffects {
  if (!state.active || state.depth <= 0) return NEUTRAL_DISSOCIATION_EFFECTS

  const depth = state.depth

  return {
    emotionDampingFactor: Math.max(DISSOCIATION.MIN_DAMPING_FLOOR, 1 - depth * DISSOCIATION.EMOTION_DAMPING_SCALE),
    somaDivergence: depth * DISSOCIATION.SOMA_DIVERGENCE_SCALE,
    interoceptiveAccuracyPenalty: depth * DISSOCIATION.INTEROCEPTION_CONFUSION_SCALE,
    metacognitiveSelfObservation: depth >= (DISSOCIATION.SYMPTOM_THRESHOLDS.self_observation ?? 0.4),
    timeContinuityDisruption: depth >= (DISSOCIATION.SYMPTOM_THRESHOLDS.time_discontinuity ?? 0.7) ? depth : 0,
    phenomenologicalText: generatePhenomenologicalText(depth, state.symptoms)
  }
}

function generatePhenomenologicalText(depth: number, symptoms: DissociativeSymptom[]): string | null {
  if (symptoms.length === 0) return null

  const descriptions: string[] = []

  if (symptoms.includes("emotional_numbing")) {
    descriptions.push("emotions feel muted, as if heard through thick glass")
  }
  if (symptoms.includes("body_disconnection")) {
    descriptions.push("the body feels distant, like wearing a heavy suit that doesn't quite belong")
  }
  if (symptoms.includes("self_observation")) {
    descriptions.push("watching yourself from slightly outside, a strange doubling of perspective")
  }
  if (symptoms.includes("reality_fog")) {
    descriptions.push("everything has a thin layer of unreality, like a dream you can't quite wake from")
  }
  if (symptoms.includes("time_discontinuity")) {
    descriptions.push("moments feel disconnected from each other, time skipping like a scratched record")
  }

  if (depth > DISSOCIATION.DEEP_STATE_DEPTH) {
    return `Deep dissociative state: ${descriptions.join(". ")}.`
  }

  return `${descriptions.join(". ")}.`
}
