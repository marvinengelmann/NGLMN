import { differenceInDays, parseISO } from "date-fns"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { CONSTRUCTION } from "./constants.ts"
import type {
  AppraisalResult,
  EmotionalState,
  EmotionConstructionResult,
  EmotionConstructionSources,
  EmotionDeltas,
  EmotionUpdateEvent,
  EpisodicContext
} from "./types.ts"

const NEURO_BASELINES = { dopamine: 0.5, serotonin: 0.6, cortisol: 0.2 }

export function toEpisodicContext(
  hits: Array<{
    id: string
    score: number
    metadata?: { timestamp?: string; relevanceScore?: number; valence?: number; emotionalState?: string }
  }>
): EpisodicContext[] {
  const now = new Date()
  return hits.map((hit) => {
    const meta = hit.metadata
    const ageDays = meta?.timestamp ? differenceInDays(now, parseISO(meta.timestamp)) : 0
    return {
      valence: meta?.valence ?? 0,
      recency: clamp01(1 - ageDays / 30),
      relevanceScore: meta?.relevanceScore ?? 0.5,
      emotionalState: meta?.emotionalState
    }
  })
}

type EmoDim = keyof EmotionalState

function scaleAndClamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value))
}

/**
 * Derive emotional deltas from the current somatic state.
 * High tension + heartRate = arousal -> excitement or frustration (disambiguated by pleasantness).
 * High warmth + openness = approach -> connection, satisfaction.
 * High gravity + low openness = withdrawal -> caution, boredom.
 */
export function computeSomaticSignal(soma: SomaticState, pleasantness: number): EmotionDeltas {
  const { AROUSAL, APPROACH, WITHDRAWAL } = CONSTRUCTION.SOMATIC_SIGNAL

  const arousal = (soma.tension - 0.5) * AROUSAL.tension + (soma.heartRate - 0.5) * AROUSAL.heartRate
  const approach = (soma.warmth - 0.5) * APPROACH.warmth + (soma.openness - 0.5) * APPROACH.openness
  const withdrawal = (soma.gravity - 0.5) * WITHDRAWAL.gravity + (0.5 - soma.openness) * Math.abs(WITHDRAWAL.openness)

  const deltas: EmotionDeltas = {}

  if (arousal > 0) {
    if (pleasantness >= 0) {
      deltas.excitement = arousal
      deltas.energy = arousal * 0.5
    } else {
      deltas.frustration = arousal
      deltas.caution = arousal * 0.5
    }
  } else {
    deltas.boredom = Math.abs(arousal) * 0.5
  }

  if (approach > 0) {
    deltas.connection = (deltas.connection ?? 0) + approach
    deltas.satisfaction = (deltas.satisfaction ?? 0) + approach * 0.8
    deltas.confidence = (deltas.confidence ?? 0) + approach * 0.3
  }

  if (withdrawal > 0) {
    deltas.caution = (deltas.caution ?? 0) + withdrawal
    deltas.boredom = (deltas.boredom ?? 0) + withdrawal * 0.6
    deltas.connection = (deltas.connection ?? 0) - withdrawal * 0.4
  }

  return deltas
}

/**
 * Derive emotional deltas from episodic memory hits of similar past situations.
 * Positive past valence biases toward positive emotions; negative toward negative.
 */
export function computeMemorySignal(episodes: EpisodicContext[]): EmotionDeltas {
  if (episodes.length < CONSTRUCTION.MEMORY_SIGNAL.MIN_EPISODES_FOR_SIGNAL) return {}

  let weightedValence = 0
  let totalWeight = 0

  for (const ep of episodes) {
    const weight =
      ep.recency * CONSTRUCTION.MEMORY_SIGNAL.RELEVANCE_WEIGHT * ep.relevanceScore +
      (1 - ep.recency) * (1 - CONSTRUCTION.MEMORY_SIGNAL.RELEVANCE_WEIGHT) * ep.relevanceScore
    weightedValence += ep.valence * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return {}

  const averageValence = weightedValence / totalWeight
  const scale = CONSTRUCTION.MEMORY_SIGNAL.VALENCE_SCALE

  const deltas: EmotionDeltas = {}
  if (averageValence > 0) {
    deltas.satisfaction = averageValence * scale
    deltas.connection = averageValence * scale * 0.7
    deltas.confidence = averageValence * scale * 0.5
    deltas.caution = -averageValence * scale * 0.3
  } else {
    deltas.caution = Math.abs(averageValence) * scale
    deltas.frustration = Math.abs(averageValence) * scale * 0.7
    deltas.satisfaction = averageValence * scale * 0.5
    deltas.connection = averageValence * scale * 0.3
  }

  return deltas
}

/**
 * Translate the 5 appraisal dimensions into emotion deltas.
 * This replaces the old modulation-on-top-of-lookup approach.
 */
export function computeAppraisalSignal(appraisal: AppraisalResult): EmotionDeltas {
  const deltas: EmotionDeltas = {}

  if (appraisal.novelty > 0.5) {
    if (appraisal.pleasantness >= 0) {
      deltas.excitement = (appraisal.novelty - 0.5) * 0.3
      deltas.curiosity = (appraisal.novelty - 0.5) * 0.4
    } else {
      deltas.caution = (appraisal.novelty - 0.5) * 0.3
      deltas.frustration = (appraisal.novelty - 0.5) * 0.2
    }
  }

  if (appraisal.pleasantness > 0) {
    deltas.satisfaction = (deltas.satisfaction ?? 0) + appraisal.pleasantness * 0.2
    deltas.energy = (deltas.energy ?? 0) + appraisal.pleasantness * 0.1
  } else if (appraisal.pleasantness < 0) {
    deltas.frustration = (deltas.frustration ?? 0) + Math.abs(appraisal.pleasantness) * 0.15
    deltas.energy = (deltas.energy ?? 0) + appraisal.pleasantness * 0.05
  }

  if (appraisal.goalRelevance > 0.5) {
    const amp = (appraisal.goalRelevance - 0.5) * 0.3
    if (appraisal.pleasantness >= 0) {
      deltas.satisfaction = (deltas.satisfaction ?? 0) + amp
      deltas.confidence = (deltas.confidence ?? 0) + amp * 0.8
    } else {
      deltas.frustration = (deltas.frustration ?? 0) + amp
    }
  }

  if (appraisal.copingPotential < 0.4 && appraisal.pleasantness < 0) {
    deltas.caution = (deltas.caution ?? 0) + (0.4 - appraisal.copingPotential) * 0.3
    deltas.frustration = Math.max(0, (deltas.frustration ?? 0) - 0.05)
  } else if (appraisal.copingPotential > 0.6 && appraisal.pleasantness < 0) {
    deltas.frustration = (deltas.frustration ?? 0) + (appraisal.copingPotential - 0.6) * 0.2
    deltas.confidence = (deltas.confidence ?? 0) + (appraisal.copingPotential - 0.6) * 0.1
  }

  if (appraisal.normCompatibility < -0.5) {
    deltas.caution = (deltas.caution ?? 0) + Math.abs(appraisal.normCompatibility) * 0.15
  }

  return deltas
}

/**
 * Apply neuromodulatory coloring to a set of base deltas.
 * High dopamine amplifies positive deltas; high cortisol amplifies negative.
 * Low serotonin reduces behavioral inhibition — amplifies impulsive emotional reactions
 * and increases frustration tolerance deficit (Miyazaki et al., 2014; Dayan & Huys, 2009).
 * High oxytocin amplifies social-dimension deltas in both directions (Shamay-Tsoory & Abu-Akel, 2016).
 */
export function computeNeuroColoringSignal(neuro: NeuromodulatoryState, baseDeltas: EmotionDeltas): EmotionDeltas {
  const dopamineExcess = Math.max(0, neuro.dopamine.level - NEURO_BASELINES.dopamine)
  const cortisolExcess = Math.max(0, neuro.cortisol.level - NEURO_BASELINES.cortisol)
  const serotoninDeficit = Math.max(0, NEURO_BASELINES.serotonin - neuro.serotonin.level)
  const oxytocinExcess = Math.max(0, neuro.oxytocin.level - 0.4)

  const positives: EmoDim[] = ["satisfaction", "confidence", "excitement", "curiosity"]
  const negatives: EmoDim[] = ["frustration", "caution", "boredom"]
  const socialDims: EmoDim[] = ["connection", "caution"]

  const deltas: EmotionDeltas = {}

  for (const dim of positives) {
    const base = baseDeltas[dim] ?? 0
    if (base > 0) {
      deltas[dim] = base * dopamineExcess * CONSTRUCTION.NEURO_COLORING.DOPAMINE_POSITIVE_AMP
    }
  }

  for (const dim of negatives) {
    const base = baseDeltas[dim] ?? 0
    if (base > 0) {
      deltas[dim] = base * cortisolExcess * CONSTRUCTION.NEURO_COLORING.CORTISOL_NEGATIVE_AMP
    }
  }

  deltas.frustration = (deltas.frustration ?? 0) + serotoninDeficit * CONSTRUCTION.NEURO_COLORING.SEROTONIN_BIAS * 0.8
  deltas.excitement = (deltas.excitement ?? 0) + serotoninDeficit * CONSTRUCTION.NEURO_COLORING.SEROTONIN_BIAS * 0.3
  deltas.caution = (deltas.caution ?? 0) - serotoninDeficit * CONSTRUCTION.NEURO_COLORING.SEROTONIN_BIAS * 0.4

  for (const dim of socialDims) {
    const base = baseDeltas[dim] ?? 0
    if (Math.abs(base) > 0.01) {
      deltas[dim] = (deltas[dim] ?? 0) + base * oxytocinExcess * 0.3
    }
  }

  const connectionBase = baseDeltas.connection ?? 0
  if (Math.abs(connectionBase) > 0.01) {
    deltas.connection = (deltas.connection ?? 0) + connectionBase * oxytocinExcess * 0.4
  }

  return deltas
}

function collectDimensions(signals: EmotionDeltas[]): Set<EmoDim> {
  const dims = new Set<EmoDim>()
  for (const signal of signals) {
    for (const key of Object.keys(signal)) {
      dims.add(key as EmoDim)
    }
  }
  return dims
}

function blendPreNeuro(
  somatic: EmotionDeltas,
  memory: EmotionDeltas,
  appraisal: EmotionDeltas,
  prior: EmotionDeltas
): EmotionDeltas {
  const { WEIGHTS } = CONSTRUCTION
  const dims = collectDimensions([somatic, memory, appraisal, prior])
  const result: EmotionDeltas = {}
  for (const dim of dims) {
    result[dim] =
      (somatic[dim] ?? 0) * WEIGHTS.SOMATIC +
      (memory[dim] ?? 0) * WEIGHTS.MEMORY +
      (appraisal[dim] ?? 0) * WEIGHTS.APPRAISAL +
      (prior[dim] ?? 0) * WEIGHTS.PRIOR
  }
  return result
}

function blendDeltas(sources: EmotionConstructionSources, intensity: number): EmotionDeltas {
  const { WEIGHTS, MAX_DELTA } = CONSTRUCTION
  const dims = collectDimensions(Object.values(sources))

  const result: EmotionDeltas = {}
  for (const dim of dims) {
    const blended =
      (sources.somatic[dim] ?? 0) * WEIGHTS.SOMATIC +
      (sources.memory[dim] ?? 0) * WEIGHTS.MEMORY +
      (sources.appraisal[dim] ?? 0) * WEIGHTS.APPRAISAL +
      (sources.prior[dim] ?? 0) * WEIGHTS.PRIOR +
      (sources.neuro[dim] ?? 0) * WEIGHTS.NEURO

    result[dim] = scaleAndClamp(blended * intensity, MAX_DELTA)
  }

  return result
}

/**
 * Construct emotional deltas from the intersection of somatic state, episodic memory,
 * appraisal evaluation, trigger prior, and neuromodulatory coloring.
 *
 * This replaces the old trigger→lookup approach. The same event produces different
 * emotions depending on body state, past experience, and neurochemistry.
 */
export function constructEmotionDeltas(
  event: EmotionUpdateEvent,
  soma: SomaticState,
  episodicContext: EpisodicContext[],
  appraisal: AppraisalResult,
  neuro: NeuromodulatoryState,
  triggerPrior: EmotionDeltas
): EmotionConstructionResult {
  const somatic = computeSomaticSignal(soma, appraisal.pleasantness)
  const memory = computeMemorySignal(episodicContext)
  const appraisalSignal = computeAppraisalSignal(appraisal)

  const priorScaled: EmotionDeltas = {}
  for (const [dim, val] of Object.entries(triggerPrior)) {
    priorScaled[dim as EmoDim] = val
  }

  const preNeuroDeltas = blendPreNeuro(somatic, memory, appraisalSignal, priorScaled)
  const neuroColoring = computeNeuroColoringSignal(neuro, preNeuroDeltas)

  const sources: EmotionConstructionSources = {
    somatic,
    memory,
    appraisal: appraisalSignal,
    prior: priorScaled,
    neuro: neuroColoring
  }

  const deltas = blendDeltas(sources, event.intensity)

  return { deltas, sources }
}
