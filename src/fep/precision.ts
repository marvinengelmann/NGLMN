import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { RegulationZone } from "@/affect/soma/types.ts"
import { clamp, clamp01 } from "@/infra/lib/math.ts"
import { FEP } from "./constants.ts"
import type { PrecisionWeights } from "./types.ts"

interface BasePrecisionInput {
  interoceptiveAccuracy: number
  regulationZone: RegulationZone
  patternConfidence: number
  metacognitiveClarity: number
  operatorModelConfidence: number
  coherenceIntegrationScore: number
  cognitiveFatigue: number
  forecastAccuracy: number
}

/**
 * Derive base precision weights from existing confidence/accuracy signals across subsystems.
 */
export function computeBasePrecisionWeights(input: BasePrecisionInput): PrecisionWeights {
  const regulationGain = FEP.REGULATION_PRECISION_GAIN[input.regulationZone] ?? 1.0

  return {
    interoceptive: clamp01(input.interoceptiveAccuracy * regulationGain),
    anticipatory: clamp01(input.patternConfidence),
    novelty: clamp01(input.metacognitiveClarity * 0.8),
    relational: clamp01(input.operatorModelConfidence),
    coherence: clamp01(input.coherenceIntegrationScore),
    dissonance: clamp01(input.metacognitiveClarity),
    drive: clamp01(1 - input.cognitiveFatigue),
    forecast: clamp01(input.forecastAccuracy),
    metacognitive: clamp01(input.metacognitiveClarity)
  }
}

/**
 * Neuromodulators act as precision controllers — the key FEP insight.
 * Each modulator amplifies or dampens specific precision channels.
 */
export function applyNeuromodulatorPrecisionEffects(
  base: PrecisionWeights,
  neuro: NeuromodulatoryState
): PrecisionWeights {
  const ne = neuro.norepinephrine.level
  const da = neuro.dopamine.level
  const cortisol = neuro.cortisol.level
  const serotonin = neuro.serotonin.level
  const oxy = neuro.oxytocin.level
  const endo = neuro.endorphins.level
  const gaba = neuro.gaba.level

  const P = FEP.NEURO_PRECISION
  const globalArousal = clamp(P.NOREPINEPHRINE_BASE + ne * P.NOREPINEPHRINE_SCALE, 0.7, 1.3)
  const rewardGain = clamp(P.DOPAMINE_BASE + da * P.DOPAMINE_SCALE, 0.8, 1.2)
  const threatGain = clamp(P.CORTISOL_THREAT_BASE + cortisol * P.CORTISOL_THREAT_SCALE, 0.9, 1.2)
  const socialDampen = clamp(P.CORTISOL_SOCIAL_BASE - cortisol * P.CORTISOL_SOCIAL_SCALE, 0.7, 1.1)
  const serotoninMod = clamp(P.SEROTONIN_CONTINUOUS_BASE + serotonin * P.SEROTONIN_CONTINUOUS_SCALE, 0.7, 1.2)
  const oxytocinBoost = clamp(P.OXYTOCIN_BASE + oxy * P.OXYTOCIN_SCALE, 0.9, 1.2)
  const gabaDampen = clamp(1.1 - gaba * 0.3, 0.7, 1.1)

  const globalScale = globalArousal * gabaDampen

  const result: PrecisionWeights = {
    interoceptive: base.interoceptive * globalScale * threatGain * (1 + endo * P.ENDORPHIN_INTEROCEPTIVE),
    anticipatory: base.anticipatory * globalScale * rewardGain * serotoninMod * (1 + endo * P.ENDORPHIN_ANTICIPATORY),
    novelty: base.novelty * globalScale,
    relational: base.relational * globalScale * socialDampen * oxytocinBoost * (1 + endo * P.ENDORPHIN_RELATIONAL),
    coherence: base.coherence * globalScale * threatGain,
    dissonance: base.dissonance * globalScale,
    drive: base.drive * globalScale * rewardGain * (1 + endo * P.ENDORPHIN_DRIVE),
    forecast: base.forecast * globalScale * serotoninMod,
    metacognitive: base.metacognitive * globalScale
  }

  for (const key of Object.keys(result) as (keyof PrecisionWeights)[]) {
    result[key] = clamp(result[key], FEP.PRECISION_FLOOR, FEP.PRECISION_CEILING)
  }

  return result
}
