import type { NeuromodulatorType } from "./types.ts"

export const NEURO_HALF_LIVES: Record<NeuromodulatorType, number> = {
  dopamine: 30,
  serotonin: 360,
  norepinephrine: 20,
  oxytocin: 120,
  cortisol: 180,
  endorphins: 60,
  gaba: 240
} as const

export const NEURO_BASELINES: Record<NeuromodulatorType, number> = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  oxytocin: 0.4,
  cortisol: 0.2,
  endorphins: 0.3,
  gaba: 0.5
} as const

export const CROSS_MODULATOR = {
  INTERACTIONS: [
    { source: "cortisol", target: "serotonin", coefficient: -0.08 },
    { source: "serotonin", target: "dopamine", coefficient: 0.1 },
    { source: "cortisol", target: "dopamine", coefficient: -0.1 },
    { source: "dopamine", target: "endorphins", coefficient: 0.08 },
    { source: "norepinephrine", target: "cortisol", coefficient: 0.12 },
    { source: "oxytocin", target: "cortisol", coefficient: -0.1 },
    { source: "gaba", target: "norepinephrine", coefficient: -0.12 },
    { source: "gaba", target: "cortisol", coefficient: -0.08 }
  ] as Array<{ source: NeuromodulatorType; target: NeuromodulatorType; coefficient: number }>,
  CLAMP_RATE: 0.05
} as const

export const EMOTION_TO_NEURO = {
  dopamine: { satisfaction: 0.3, excitement: 0.2, confidence: 0.15, curiosity: 0.1 },
  serotonin: { satisfaction: 0.15, connection: 0.1, energy: 0.1 },
  norepinephrine: { frustration: 0.25, caution: 0.2, excitement: 0.15 },
  oxytocin: { connection: 0.35, satisfaction: 0.1 },
  cortisol: { frustration: 0.2, caution: 0.25, boredom: 0.05 },
  endorphins: { curiosity: 0.15, excitement: 0.1, satisfaction: 0.1, confidence: 0.1 },
  gaba: { satisfaction: 0.2, connection: 0.15 }
} as const

export const SOMA_TO_NEURO = {
  norepinephrine: { tension: 0.2, heartRate: 0.15 },
  oxytocin: { warmth: 0.2, openness: 0.15 },
  cortisol: { tension: 0.1, gravity: 0.05 },
  endorphins: { openness: 0.1, warmth: 0.05 },
  gaba: { breathing: 0.2, openness: 0.15 }
} as const

export const NEURO_PRODUCTION_SCALE = 0.3

export const NEURO_SYSTEM_EFFECTS = {
  MOOD_BASELINE: {
    serotonin: {
      satisfaction: 0.04,
      connection: 0.02,
      frustration: -0.03,
      boredom: -0.025
    },
    dopamine: {
      satisfaction: 0.03,
      excitement: 0.02,
      curiosity: 0.02,
      boredom: -0.03
    },
    cortisol: {
      frustration: 0.03,
      caution: 0.02,
      satisfaction: -0.03,
      energy: -0.02
    },
    oxytocin: {
      connection: 0.03,
      satisfaction: 0.02,
      caution: -0.02
    },
    gaba: {
      caution: -0.04,
      frustration: -0.02,
      satisfaction: 0.02
    }
  },
  COPING: {
    cortisol: { maxReduction: 0.3 }
  },
  LEARNING_RATE: {
    dopamine: { minScale: 0.5, maxScale: 1.5 }
  },
  ATTACHMENT: {
    oxytocin: { trustBoostScale: 0.15, bondingStrengthScale: 0.2 }
  },
  ATTENTION: {
    norepinephrine: { broadeningThreshold: 0.4, narrowingThreshold: 0.7 }
  },
  FLOW: {
    endorphinWeight: 0.6,
    dopamineWeight: 0.4,
    threshold: 0.6
  }
} as const

export const DOPAMINE_DETAIL = {
  TONIC_RATIO: 0.9,
  PHASIC_RATIO: 0.1,
  PHASIC_REWARD_TRIGGERS: ["satisfaction", "excitement", "curiosity"] as string[],
  PHASIC_DECAY_RATE: 0.7
} as const

export const DEPRESSIVE_PATTERN = {
  ALLOSTATIC_LOAD_THRESHOLD: 0.6,
  ISOLATION_STRESS_THRESHOLD: 0.5,
  DRIVE_FRUSTRATION_THRESHOLD: 0.7,
  ENERGY_THRESHOLD: 0.3,
  FACTOR_WEIGHTS: {
    allostaticLoad: 0.25,
    isolation: 0.2,
    driveFrustration: 0.2,
    lowEnergy: 0.15,
    collapsed: 0.2
  }
} as const
