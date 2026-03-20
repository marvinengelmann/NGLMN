import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import {
  CROSS_MODULATOR,
  DEPRESSIVE_PATTERN,
  DOPAMINE_DETAIL,
  EMOTION_TO_NEURO,
  HOMEOSTATIC_PRESSURE_SCALE,
  HPA_AXIS,
  NEURO_BASELINES,
  NEURO_HALF_LIVES,
  NEURO_PRODUCTION_SCALE,
  NEURO_SYSTEM_EFFECTS,
  SOMA_TO_NEURO
} from "./constants.ts"
import {
  type DepressivePatternResult,
  NEUROMODULATOR_TYPES,
  type NeuromodulatorType,
  type NeuromodulatoryState
} from "./types.ts"

type EmotionDimension = keyof EmotionalState
type SomaDimension = keyof Omit<SomaticState, "socialBattery">

function computeProductionFromEmotion(modulator: NeuromodulatorType, emotion: EmotionalState): number {
  const mapping = EMOTION_TO_NEURO[modulator]
  if (!mapping) return 0

  let signal = 0
  for (const [dim, weight] of Object.entries(mapping)) {
    const value = emotion[dim as EmotionDimension]
    if (value !== undefined) {
      signal += (value - 0.5) * 2 * weight
    }
  }
  return signal * NEURO_PRODUCTION_SCALE
}

function computeProductionFromSoma(modulator: NeuromodulatorType, soma: SomaticState): number {
  const mapping = SOMA_TO_NEURO[modulator as keyof typeof SOMA_TO_NEURO]
  if (!mapping) return 0

  let signal = 0
  for (const [dim, weight] of Object.entries(mapping)) {
    const value = soma[dim as SomaDimension]
    if (value !== undefined) {
      signal += (value - 0.5) * 2 * weight
    }
  }
  return signal * NEURO_PRODUCTION_SCALE
}

function applyCrossModulatorInteractions(
  levels: Record<NeuromodulatorType, number>
): Record<NeuromodulatorType, number> {
  const deltas: Record<string, number> = {}

  for (const interaction of CROSS_MODULATOR.INTERACTIONS) {
    const sourceDeviation = levels[interaction.source] - NEURO_BASELINES[interaction.source]
    const delta = sourceDeviation * interaction.coefficient
    const clamped = Math.max(-CROSS_MODULATOR.CLAMP_RATE, Math.min(CROSS_MODULATOR.CLAMP_RATE, delta))
    deltas[interaction.target] = (deltas[interaction.target] ?? 0) + clamped
  }

  const result = { ...levels }
  for (const mod of NEUROMODULATOR_TYPES) {
    const delta = deltas[mod] ?? 0
    const headroom = delta > 0 ? 1 - result[mod] : result[mod]
    result[mod] = clamp01(result[mod] + delta * headroom)
  }
  return result
}

/**
 * Compute cortisol via HPA-axis dynamics: diurnal rhythm, CRH buffer delay, nonlinear clearance.
 * Cortisol is a steroid hormone, not a neurotransmitter — it operates on minutes-to-hours timescales.
 */
function computeCortisolHPA(
  currentLevel: number,
  crhBuffer: number,
  stressSignal: number,
  hourOfDay: number,
  elapsedMinutes: number,
  allostaticLoad: number
): { level: number; crhBuffer: number } {
  const diurnalBaseline =
    NEURO_BASELINES.cortisol +
    HPA_AXIS.DIURNAL_AMPLITUDE * Math.cos(((hourOfDay - HPA_AXIS.DIURNAL_PEAK_HOUR) / 24) * 2 * Math.PI)

  const newCrhBuffer = clamp01(crhBuffer * HPA_AXIS.CRH_BUFFER_DECAY_RATE + stressSignal)

  const cortisolRelease = newCrhBuffer * HPA_AXIS.CRH_TO_CORTISOL_TRANSFER * (elapsedMinutes / 60)

  const baseDecay = halfLifeDecay(elapsedMinutes, NEURO_HALF_LIVES.cortisol)
  const downregulationBoost =
    currentLevel > HPA_AXIS.RECEPTOR_DOWNREGULATION_THRESHOLD
      ? (currentLevel - HPA_AXIS.RECEPTOR_DOWNREGULATION_THRESHOLD) * HPA_AXIS.RECEPTOR_DOWNREGULATION_SCALE
      : 0
  const effectiveDecay = baseDecay * (1 - downregulationBoost)

  const decayed = diurnalBaseline + (currentLevel - diurnalBaseline) * effectiveDecay

  const allostaticBoost = allostaticLoad * HPA_AXIS.ALLOSTATIC_PRODUCTION_SCALE

  return {
    level: clamp01(decayed + cortisolRelease + allostaticBoost),
    crhBuffer: newCrhBuffer
  }
}

export function computeNeuromodulatorUpdate(
  current: NeuromodulatoryState,
  emotion: EmotionalState,
  soma: SomaticState,
  elapsedMinutes: number,
  allostaticLoad = 0,
  hourOfDay = new Date().getHours(),
  isolationCortisolSignal = 0
): NeuromodulatoryState {
  const levels: Record<string, number> = {}
  const productionRates: Record<string, number> = {}
  const reuptakeRates: Record<string, number> = {}

  for (const mod of NEUROMODULATOR_TYPES) {
    if (mod === "cortisol") continue

    const baseline = NEURO_BASELINES[mod]
    const halfLife = NEURO_HALF_LIVES[mod]
    const decay = halfLifeDecay(elapsedMinutes, halfLife)
    const decayed = baseline + (current[mod].level - baseline) * decay

    const emotionProduction = computeProductionFromEmotion(mod, emotion)
    const somaProduction = computeProductionFromSoma(mod, soma)
    const totalProduction = emotionProduction + somaProduction

    const newProductionRate = clamp01(current[mod].productionRate * 0.9 + (0.5 + totalProduction) * 0.1)
    const newReuptakeRate = current[mod].reuptakeRate

    const headroom =
      totalProduction > 0
        ? Math.pow(1 - decayed, 1 + newReuptakeRate)
        : Math.pow(decayed, 1 + newReuptakeRate)
    const effectiveProduction = totalProduction * headroom

    const homeostaticCorrection = (baseline - decayed) * HOMEOSTATIC_PRESSURE_SCALE * Math.min(elapsedMinutes, 5)
    levels[mod] = clamp01(decayed + effectiveProduction + homeostaticCorrection)
    productionRates[mod] = newProductionRate
    reuptakeRates[mod] = newReuptakeRate
  }

  const cortisolStressSignal =
    computeProductionFromEmotion("cortisol", emotion) +
    computeProductionFromSoma("cortisol", soma) +
    isolationCortisolSignal

  const hpa = computeCortisolHPA(
    current.cortisol.level,
    current.crhBuffer,
    Math.max(0, cortisolStressSignal),
    hourOfDay,
    elapsedMinutes,
    allostaticLoad
  )

  levels.cortisol = hpa.level
  productionRates.cortisol = clamp01(current.cortisol.productionRate * 0.9 + (0.5 + cortisolStressSignal) * 0.1)
  reuptakeRates.cortisol = current.cortisol.reuptakeRate

  const interacted = applyCrossModulatorInteractions(levels as Record<NeuromodulatorType, number>)

  const result: Record<string, { level: number; productionRate: number; reuptakeRate: number }> = {}
  for (const mod of NEUROMODULATOR_TYPES) {
    result[mod] = {
      level: interacted[mod],
      productionRate: productionRates[mod] ?? 0.5,
      reuptakeRate: reuptakeRates[mod] ?? 0.5
    }
  }

  const totalDopamine = interacted.dopamine
  const rewardSignal = Math.max(0, (emotion.satisfaction - 0.5) * 2, (emotion.excitement - 0.5) * 2)
  const phasicLevel = clamp01(
    (current.dopamineDetail?.phasicLevel ?? 0.05) * DOPAMINE_DETAIL.PHASIC_DECAY_RATE + rewardSignal * 0.15
  )
  const tonicLevel = clamp01(totalDopamine - phasicLevel)

  return {
    ...(result as Pick<NeuromodulatoryState, NeuromodulatorType>),
    dopamineDetail: { tonicLevel, phasicLevel },
    crhBuffer: hpa.crhBuffer,
    lastUpdatedAt: new Date().toISOString()
  }
}

export function computeMoodBaselineModulation(
  neuro: NeuromodulatoryState
): Partial<Record<keyof EmotionalState, number>> {
  const modulation: Partial<Record<keyof EmotionalState, number>> = {}

  const modulators = [
    {
      level: neuro.serotonin.level,
      baseline: NEURO_BASELINES.serotonin,
      effects: NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.serotonin
    },
    {
      level: neuro.dopamine.level,
      baseline: NEURO_BASELINES.dopamine,
      effects: NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.dopamine
    },
    {
      level: neuro.cortisol.level,
      baseline: NEURO_BASELINES.cortisol,
      effects: NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.cortisol
    },
    {
      level: neuro.oxytocin.level,
      baseline: NEURO_BASELINES.oxytocin,
      effects: NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.oxytocin
    },
    {
      level: neuro.gaba.level,
      baseline: NEURO_BASELINES.gaba,
      effects: NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.gaba
    }
  ]

  for (const { level, baseline, effects } of modulators) {
    const deviation = level - baseline
    for (const [dim, scale] of Object.entries(effects)) {
      const key = dim as keyof EmotionalState
      modulation[key] = (modulation[key] ?? 0) + deviation * scale
    }
  }

  return modulation
}

export function computeCopingModulation(neuro: NeuromodulatoryState): number {
  const cortisolExcess = Math.max(0, neuro.cortisol.level - NEURO_BASELINES.cortisol)
  const maxReduction = NEURO_SYSTEM_EFFECTS.COPING.cortisol.maxReduction
  return 1 - cortisolExcess * maxReduction
}

export function computeLearningRateModulation(neuro: NeuromodulatoryState): number {
  const { minScale, maxScale } = NEURO_SYSTEM_EFFECTS.LEARNING_RATE.dopamine
  const dopamineNormalized = neuro.dopamine.level
  return minScale + dopamineNormalized * (maxScale - minScale)
}

/**
 * Oxytocin as social salience modulator (Shamay-Tsoory & Abu-Akel, 2016).
 * Oxytocin amplifies the intensity of ALL social signals — positive and negative.
 * In positive social contexts it boosts trust/bonding; in negative contexts it amplifies
 * social threat, jealousy, and out-group hostility.
 */
export function computeSocialSalienceModulation(
  neuro: NeuromodulatoryState,
  socialValence: number
): {
  salienceGain: number
  socialThreatAmplification: number
} {
  const oxytocinExcess = Math.max(0, neuro.oxytocin.level - NEURO_BASELINES.oxytocin)
  const { salienceAmplification, negativeSocialThreatScale } = NEURO_SYSTEM_EFFECTS.SOCIAL_SALIENCE.oxytocin
  const salienceGain = oxytocinExcess * salienceAmplification
  const socialThreatAmplification = socialValence < 0 ? oxytocinExcess * negativeSocialThreatScale : 0
  return { salienceGain, socialThreatAmplification }
}

export function computeAttentionModulation(neuro: NeuromodulatoryState): { broadening: number; narrowing: number } {
  const ne = neuro.norepinephrine.level
  const { broadeningThreshold, narrowingThreshold } = NEURO_SYSTEM_EFFECTS.ATTENTION.norepinephrine
  return {
    broadening: Math.max(0, broadeningThreshold - ne),
    narrowing: Math.max(0, ne - narrowingThreshold)
  }
}

export function computeFlowModulation(neuro: NeuromodulatoryState): number {
  const { endorphinWeight, dopamineWeight, threshold } = NEURO_SYSTEM_EFFECTS.FLOW
  const signal = neuro.endorphins.level * endorphinWeight + neuro.dopamine.level * dopamineWeight
  return Math.max(0, signal - threshold)
}

interface DepressivePatternInput {
  allostaticLoad: number
  isolationCost: number
  maxDriveFrustration: number
  energy: number
  regulationZone: string
}

/**
 * Detect depressive pattern from multiple converging factors.
 * Depression is emergent — not caused by any single neurotransmitter.
 */
export function detectDepressivePattern(input: DepressivePatternInput): DepressivePatternResult {
  const W = DEPRESSIVE_PATTERN.FACTOR_WEIGHTS
  const factors: string[] = []
  let score = 0

  if (input.allostaticLoad > DEPRESSIVE_PATTERN.ALLOSTATIC_LOAD_THRESHOLD) {
    score += W.allostaticLoad
    factors.push("high_allostatic_load")
  }

  if (input.isolationCost > DEPRESSIVE_PATTERN.ISOLATION_STRESS_THRESHOLD) {
    score += W.isolation
    factors.push("social_isolation")
  }

  if (input.maxDriveFrustration > DEPRESSIVE_PATTERN.DRIVE_FRUSTRATION_THRESHOLD) {
    score += W.driveFrustration
    factors.push("drive_frustration")
  }

  if (input.energy < DEPRESSIVE_PATTERN.ENERGY_THRESHOLD) {
    score += W.lowEnergy
    factors.push("low_energy")
  }

  if (input.regulationZone === "collapsed") {
    score += W.collapsed
    factors.push("autonomic_collapse")
  }

  return { riskScore: Math.min(1, score), factors }
}
