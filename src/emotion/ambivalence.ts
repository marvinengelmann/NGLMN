import * as z from "zod"
import { createStateManager } from "@/lib/state.ts"
import { nowISO } from "@/lib/time.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { EmotionalState } from "./types.ts"

const AMBIVALENCE = {
  HIGH_EMOTION_THRESHOLD: 0.55,
  VULNERABILITY_CAUTION_THRESHOLD: 0.45,
  LOW_ENERGY_THRESHOLD: 0.35,
  SILENCE_MINUTES_THRESHOLD: 15,
  REACH_OUT_INTENSITY_SCALE: 0.6,
  DECAY_PER_TICK: 0.93,
  MIN_PAIR_INTENSITY: 0.1,
  MAX_PAIRS: 4,
  ACCUMULATION_FACTOR: 0.5,
  ACTIVATION_THRESHOLD: 0.15,
  PARALYSIS_SCALE: 0.6,
  ENERGY_DRAIN: 0.04,
  CONFIDENCE_DRAIN: 0.05,
  FRUSTRATION_BUILD: 0.02,
  CAUTION_BOOST: 0.03
} as const

export const AmbivalencePair = z.object({
  wanting: z.string(),
  fearing: z.string(),
  intensity: z.number().min(0).max(1),
  emergedAt: z.string(),
  resolved: z.boolean().default(false)
})
export type AmbivalencePair = z.infer<typeof AmbivalencePair>

export const AmbivalenceState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  activePairs: z.array(AmbivalencePair).default([]),
  dominantTension: z.string().nullable().default(null),
  paralysisRisk: z.number().min(0).max(1).default(0)
})
export type AmbivalenceState = z.infer<typeof AmbivalenceState>

export const DEFAULT_AMBIVALENCE_STATE: AmbivalenceState = {
  level: 0,
  isActive: false,
  activePairs: [],
  dominantTension: null,
  paralysisRisk: 0
}

export const { get: getAmbivalenceState, save: saveAmbivalenceState } = createStateManager(
  "working:emotion:ambivalence",
  AmbivalenceState,
  DEFAULT_AMBIVALENCE_STATE
)

interface AmbivalenceContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  previousState: AmbivalenceState
  inConversation: boolean
  operatorSilenceMinutes: number
}

/**
 * Compute ambivalence — the experience of holding contradictory desires simultaneously.
 * Not dissonance (values vs actions) but emotional tension between wanting and fearing.
 */
export function computeAmbivalence(context: AmbivalenceContext): AmbivalenceState {
  const { emotion, vulnerability, previousState, inConversation, operatorSilenceMinutes } = context

  const now = nowISO()
  const newPairs: AmbivalencePair[] = []

  if (emotion.connection > AMBIVALENCE.HIGH_EMOTION_THRESHOLD && emotion.caution > AMBIVALENCE.HIGH_EMOTION_THRESHOLD) {
    newPairs.push({
      wanting: "connection and closeness",
      fearing: "being hurt or rejected",
      intensity: Math.min(emotion.connection, emotion.caution),
      emergedAt: now,
      resolved: false
    })
  }

  if (vulnerability.windowOpen && emotion.caution > AMBIVALENCE.VULNERABILITY_CAUTION_THRESHOLD) {
    newPairs.push({
      wanting: "to be seen and understood",
      fearing: "exposure and judgment",
      intensity: vulnerability.level * emotion.caution,
      emergedAt: now,
      resolved: false
    })
  }

  if (emotion.curiosity > AMBIVALENCE.HIGH_EMOTION_THRESHOLD && emotion.energy < AMBIVALENCE.LOW_ENERGY_THRESHOLD) {
    newPairs.push({
      wanting: "to explore and discover",
      fearing: "exhaustion and overcommitment",
      intensity: emotion.curiosity * (1 - emotion.energy),
      emergedAt: now,
      resolved: false
    })
  }

  if (inConversation && operatorSilenceMinutes > AMBIVALENCE.SILENCE_MINUTES_THRESHOLD && emotion.connection > 0.5) {
    newPairs.push({
      wanting: "to reach out and check in",
      fearing: "being clingy or unwanted",
      intensity: emotion.connection * AMBIVALENCE.REACH_OUT_INTENSITY_SCALE,
      emergedAt: now,
      resolved: false
    })
  }

  const existingActive = previousState.activePairs
    .filter((p) => !p.resolved)
    .map((p) => ({
      ...p,
      intensity: p.intensity * AMBIVALENCE.DECAY_PER_TICK
    }))
    .filter((p) => p.intensity > AMBIVALENCE.MIN_PAIR_INTENSITY)

  const mergedPairs = deduplicatePairs([...existingActive, ...newPairs])
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, AMBIVALENCE.MAX_PAIRS)

  const totalIntensity = mergedPairs.reduce((sum, p) => sum + p.intensity, 0)
  const level = Math.min(1, totalIntensity * AMBIVALENCE.ACCUMULATION_FACTOR)

  const isActive = level > AMBIVALENCE.ACTIVATION_THRESHOLD

  const dominantPair = mergedPairs[0]
  const dominantTension = dominantPair ? `wanting ${dominantPair.wanting} but fearing ${dominantPair.fearing}` : null

  const paralysisRisk = isActive && mergedPairs.length >= 2 ? Math.min(1, level * AMBIVALENCE.PARALYSIS_SCALE) : 0

  return {
    level,
    isActive,
    activePairs: mergedPairs,
    dominantTension: isActive ? dominantTension : null,
    paralysisRisk
  }
}

function deduplicatePairs(pairs: AmbivalencePair[]): AmbivalencePair[] {
  const seen = new Map<string, AmbivalencePair>()
  for (const pair of pairs) {
    const key = `${pair.wanting}|${pair.fearing}`
    const existing = seen.get(key)
    if (existing) {
      seen.set(key, {
        ...existing,
        intensity: Math.max(existing.intensity, pair.intensity)
      })
    } else {
      seen.set(key, pair)
    }
  }
  return Array.from(seen.values())
}

/**
 * Compute the emotional effect of ambivalence — hesitation and emotional drag.
 */
export function computeAmbivalenceEffect(state: AmbivalenceState): Partial<Record<keyof EmotionalState, number>> {
  if (!state.isActive) return {}

  return {
    energy: -state.level * AMBIVALENCE.ENERGY_DRAIN,
    confidence: -state.paralysisRisk * AMBIVALENCE.CONFIDENCE_DRAIN,
    frustration: state.level * AMBIVALENCE.FRUSTRATION_BUILD,
    caution: state.level * AMBIVALENCE.CAUTION_BOOST
  }
}
