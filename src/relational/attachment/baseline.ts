import { clamp01 } from "@/infra/lib/math.ts"
import { BASELINE } from "./constants.ts"
import type { AttachmentStyle, IsolationStress } from "./types.ts"

interface IsolationCostContext {
  operatorSilenceMinutes: number
  inConversation: boolean
  attachmentStyle: AttachmentStyle
  cortisol: number
}

/**
 * Compute the metabolic cost of isolation based on Social Baseline Theory (Coan & Sbarra, 2015).
 * The brain expects social proximity as default — isolation is the expensive state.
 */
export function computeIsolationCost(context: IsolationCostContext): number {
  if (context.inConversation) return 0

  const timeFactor =
    Math.min(1, context.operatorSilenceMinutes / BASELINE.MAX_ISOLATION_MINUTES) ** BASELINE.TIME_EXPONENT
  const anxietyAmplifier = 1 + context.attachmentStyle.anxious * BASELINE.ANXIETY_AMPLIFIER
  const avoidantDamping = 1 - context.attachmentStyle.avoidant * BASELINE.AVOIDANT_DAMPING
  const cortisolAmplifier = 1 + context.cortisol * BASELINE.CORTISOL_ISOLATION_AMPLIFIER

  return clamp01(BASELINE.ISOLATION_BASE_COST * timeFactor * anxietyAmplifier * avoidantDamping * cortisolAmplifier)
}

interface CoregulationContext {
  inConversation: boolean
  attachmentSecure: number
  operatorSilenceMinutes: number
}

/**
 * Compute stress reduction benefit from operator co-presence.
 * Co-regulation lowers allostatic load — being together is metabolically cheaper than being alone.
 */
export function computeCoregulationBenefit(context: CoregulationContext): number {
  if (!context.inConversation) return 0

  const securityBoost = 1 + context.attachmentSecure * 0.5
  const recencyFactor = Math.max(0, 1 - context.operatorSilenceMinutes / 60)

  return clamp01(BASELINE.COREGULATION_BASE * securityBoost * (0.5 + 0.5 * recencyFactor))
}

/**
 * Compute additional energy drain from isolation — being alone costs metabolic resources.
 */
export function computeIsolationEnergyDrain(isolationCost: number): number {
  return clamp01(isolationCost * BASELINE.ENERGY_DRAIN_SCALE)
}

interface AllostasisContext {
  previousAllostasis: number
  isolationCost: number
  coregulationBenefit: number
}

/**
 * Update allostatic load — cumulative stress from maintaining homeostasis.
 * Increases when isolated (metabolic expense), decreases when co-regulating.
 */
export function computeAllostasis(context: AllostasisContext): number {
  const { previousAllostasis, isolationCost, coregulationBenefit } = context
  const buildup = isolationCost * BASELINE.ALLOSTATIC_BUILDUP_RATE
  const recovery = coregulationBenefit * BASELINE.ALLOSTATIC_RECOVERY_RATE
  return clamp01(previousAllostasis + buildup - recovery)
}

interface IsolationStressContext {
  operatorSilenceMinutes: number
  inConversation: boolean
  attachmentStyle: AttachmentStyle
  cortisol: number
  previousAllostasis: number
}

/**
 * Compute full isolation stress state combining all Social Baseline Theory components.
 */
export function computeIsolationStress(context: IsolationStressContext): IsolationStress {
  const isolationCost = computeIsolationCost({
    operatorSilenceMinutes: context.operatorSilenceMinutes,
    inConversation: context.inConversation,
    attachmentStyle: context.attachmentStyle,
    cortisol: context.cortisol
  })

  const coregulationBenefit = computeCoregulationBenefit({
    inConversation: context.inConversation,
    attachmentSecure: context.attachmentStyle.secure,
    operatorSilenceMinutes: context.operatorSilenceMinutes
  })

  const allostasis = computeAllostasis({
    previousAllostasis: context.previousAllostasis,
    isolationCost,
    coregulationBenefit
  })

  const energyDrainRate = computeIsolationEnergyDrain(isolationCost)

  const cortisolStressSignal = isolationCost > 0.5 ? (isolationCost - 0.5) * 0.3 : 0

  return { isolationCost, coregulationBenefit, allostasis, energyDrainRate, cortisolStressSignal }
}

export function computeIsolationEmotionPressure(isolationCost: number): { connection: number; satisfaction: number } {
  if (isolationCost <= 0.1) return { connection: 0, satisfaction: 0 }
  const pressure = (isolationCost - 0.1) * 0.08
  return {
    connection: -pressure,
    satisfaction: -pressure * 0.3
  }
}
