import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import { clamp01, halfLifeDecay } from "@/infra/lib/math.ts"
import {
  CROSS_MODULATOR,
  DEPRESSIVE_CASCADE,
  EMOTION_TO_NEURO,
  NEURO_BASELINES,
  NEURO_HALF_LIVES,
  NEURO_PRODUCTION_SCALE,
  NEURO_SYSTEM_EFFECTS,
  SOMA_TO_NEURO
} from "./constants.ts"
import { NEUROMODULATOR_TYPES, type NeuromodulatorType, type NeuromodulatoryState } from "./types.ts"

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
    result[mod] = clamp01(result[mod] + (deltas[mod] ?? 0))
  }
  return result
}

export function computeNeuromodulatorUpdate(
  current: NeuromodulatoryState,
  emotion: EmotionalState,
  soma: SomaticState,
  elapsedMinutes: number
): NeuromodulatoryState {
  const levels: Record<string, number> = {}
  const productionRates: Record<string, number> = {}
  const reuptakeRates: Record<string, number> = {}

  for (const mod of NEUROMODULATOR_TYPES) {
    const baseline = NEURO_BASELINES[mod]
    const halfLife = NEURO_HALF_LIVES[mod]
    const decay = halfLifeDecay(elapsedMinutes, halfLife)
    const decayed = baseline + (current[mod].level - baseline) * decay

    const emotionProduction = computeProductionFromEmotion(mod, emotion)
    const somaProduction = computeProductionFromSoma(mod, soma)
    const totalProduction = emotionProduction + somaProduction

    const newProductionRate = clamp01(current[mod].productionRate * 0.9 + (0.5 + totalProduction) * 0.1)
    const newReuptakeRate = current[mod].reuptakeRate

    levels[mod] = clamp01(decayed + totalProduction)
    productionRates[mod] = newProductionRate
    reuptakeRates[mod] = newReuptakeRate
  }

  const interacted = applyCrossModulatorInteractions(levels as Record<NeuromodulatorType, number>)

  const result: Record<string, { level: number; productionRate: number; reuptakeRate: number }> = {}
  for (const mod of NEUROMODULATOR_TYPES) {
    result[mod] = {
      level: interacted[mod],
      productionRate: productionRates[mod] ?? 0.5,
      reuptakeRate: reuptakeRates[mod] ?? 0.5
    }
  }

  return {
    ...(result as Pick<NeuromodulatoryState, NeuromodulatorType>),
    lastUpdatedAt: new Date().toISOString()
  }
}

export function computeMoodBaselineModulation(
  neuro: NeuromodulatoryState
): Partial<Record<keyof EmotionalState, number>> {
  const serotoninDeviation = neuro.serotonin.level - NEURO_BASELINES.serotonin
  const effects = NEURO_SYSTEM_EFFECTS.MOOD_BASELINE.serotonin
  const modulation: Partial<Record<keyof EmotionalState, number>> = {}

  for (const [dim, scale] of Object.entries(effects)) {
    modulation[dim as keyof EmotionalState] = serotoninDeviation * scale
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

export function computeAttachmentModulation(neuro: NeuromodulatoryState): {
  trustBoost: number
  bondingStrength: number
} {
  const oxytocinExcess = Math.max(0, neuro.oxytocin.level - NEURO_BASELINES.oxytocin)
  const { trustBoostScale, bondingStrengthScale } = NEURO_SYSTEM_EFFECTS.ATTACHMENT.oxytocin
  return {
    trustBoost: oxytocinExcess * trustBoostScale,
    bondingStrength: oxytocinExcess * bondingStrengthScale
  }
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

export function detectDepressiveCascade(neuro: NeuromodulatoryState): boolean {
  return (
    neuro.cortisol.level > DEPRESSIVE_CASCADE.CORTISOL_THRESHOLD &&
    neuro.serotonin.level < DEPRESSIVE_CASCADE.SEROTONIN_THRESHOLD &&
    neuro.dopamine.level < DEPRESSIVE_CASCADE.DOPAMINE_THRESHOLD
  )
}
