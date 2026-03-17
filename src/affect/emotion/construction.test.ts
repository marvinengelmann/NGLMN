import { describe, expect, it } from "vitest"
import { DEFAULT_NEUROMODULATORY_STATE, type NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { DEFAULT_SOMATIC_STATE, type SomaticState } from "@/affect/soma/types.ts"
import {
  computeAppraisalSignal,
  computeMemorySignal,
  computeNeuroColoringSignal,
  computeSomaticSignal,
  constructEmotionDeltas
} from "./construction.ts"
import type { AppraisalResult, EmotionDeltas, EmotionUpdateEvent, EpisodicContext } from "./types.ts"

function makeSoma(overrides: Partial<SomaticState> = {}): SomaticState {
  return { ...DEFAULT_SOMATIC_STATE, ...overrides }
}

function makeNeuro(overrides: Partial<Record<string, { level: number }>> = {}): NeuromodulatoryState {
  const state = structuredClone(DEFAULT_NEUROMODULATORY_STATE)
  for (const [key, val] of Object.entries(overrides)) {
    if (!val) continue
    const mod = state[key as keyof typeof state]
    if (mod && typeof mod === "object" && "level" in mod) {
      mod.level = val.level
    }
  }
  return state
}

function makeAppraisal(overrides: Partial<AppraisalResult> = {}): AppraisalResult {
  return {
    novelty: 0.5,
    pleasantness: 0.3,
    goalRelevance: 0.3,
    copingPotential: 0.6,
    normCompatibility: 0.1,
    overallModulation: 1.0,
    ...overrides
  }
}

const MESSAGE_EVENT: EmotionUpdateEvent = { trigger: "message_received", intensity: 0.6 }

const TRIGGER_PRIOR: EmotionDeltas = { connection: 0.1, boredom: -0.1, excitement: 0.05 }

describe("computeSomaticSignal", () => {
  it("produces excitement from high tension + heartRate with positive pleasantness", () => {
    const soma = makeSoma({ tension: 0.8, heartRate: 0.8 })
    const signal = computeSomaticSignal(soma, 0.5)
    expect(signal.excitement).toBeGreaterThan(0)
  })

  it("produces frustration from high tension + heartRate with negative pleasantness", () => {
    const soma = makeSoma({ tension: 0.8, heartRate: 0.8 })
    const signal = computeSomaticSignal(soma, -0.5)
    expect(signal.frustration).toBeGreaterThan(0)
  })

  it("produces connection from high warmth + openness", () => {
    const soma = makeSoma({ warmth: 0.9, openness: 0.8 })
    const signal = computeSomaticSignal(soma, 0.3)
    expect(signal.connection).toBeGreaterThan(0)
  })

  it("produces caution from high gravity + low openness", () => {
    const soma = makeSoma({ gravity: 0.8, openness: 0.1 })
    const signal = computeSomaticSignal(soma, -0.2)
    expect(signal.caution).toBeGreaterThan(0)
  })
})

describe("computeMemorySignal", () => {
  it("returns empty for no episodes", () => {
    expect(computeMemorySignal([])).toEqual({})
  })

  it("biases positive with positive past valence", () => {
    const episodes: EpisodicContext[] = [
      { valence: 0.8, recency: 0.9, relevanceScore: 0.7 },
      { valence: 0.6, recency: 0.7, relevanceScore: 0.8 }
    ]
    const signal = computeMemorySignal(episodes)
    expect(signal.satisfaction).toBeGreaterThan(0)
    expect(signal.connection).toBeGreaterThan(0)
  })

  it("biases negative with negative past valence", () => {
    const episodes: EpisodicContext[] = [
      { valence: -0.7, recency: 0.9, relevanceScore: 0.8 },
      { valence: -0.5, recency: 0.6, relevanceScore: 0.7 }
    ]
    const signal = computeMemorySignal(episodes)
    expect(signal.caution).toBeGreaterThan(0)
    expect(signal.frustration).toBeGreaterThan(0)
  })
})

describe("computeAppraisalSignal", () => {
  it("produces excitement + curiosity for novel pleasant events", () => {
    const signal = computeAppraisalSignal(makeAppraisal({ novelty: 0.9, pleasantness: 0.7 }))
    expect(signal.excitement).toBeGreaterThan(0)
    expect(signal.curiosity).toBeGreaterThan(0)
  })

  it("produces caution for novel unpleasant events", () => {
    const signal = computeAppraisalSignal(makeAppraisal({ novelty: 0.9, pleasantness: -0.7 }))
    expect(signal.caution).toBeGreaterThan(0)
  })

  it("produces caution boost with low coping + negative event", () => {
    const signal = computeAppraisalSignal(makeAppraisal({ copingPotential: 0.2, pleasantness: -0.6 }))
    expect(signal.caution).toBeGreaterThan(0)
  })
})

describe("computeNeuroColoringSignal", () => {
  it("amplifies positive deltas with high dopamine", () => {
    const neuro = makeNeuro({ dopamine: { level: 0.9 } })
    const base: EmotionDeltas = { satisfaction: 0.1, connection: 0.05 }
    const coloring = computeNeuroColoringSignal(neuro, base)
    expect(coloring.satisfaction).toBeGreaterThan(0)
  })

  it("amplifies negative deltas with high cortisol", () => {
    const neuro = makeNeuro({ cortisol: { level: 0.8 } })
    const base: EmotionDeltas = { frustration: 0.1, caution: 0.05 }
    const coloring = computeNeuroColoringSignal(neuro, base)
    expect(coloring.frustration).toBeGreaterThan(0)
  })
})

describe("constructEmotionDeltas", () => {
  it("same trigger produces different deltas with tense vs relaxed soma", () => {
    const appraisal = makeAppraisal()
    const neuro = DEFAULT_NEUROMODULATORY_STATE
    const episodes: EpisodicContext[] = []

    const tenseSoma = makeSoma({ tension: 0.9, heartRate: 0.8, openness: 0.2 })
    const relaxedSoma = makeSoma({ tension: 0.2, heartRate: 0.3, warmth: 0.8, openness: 0.8 })

    const tenseResult = constructEmotionDeltas(MESSAGE_EVENT, tenseSoma, episodes, appraisal, neuro, TRIGGER_PRIOR)
    const relaxedResult = constructEmotionDeltas(MESSAGE_EVENT, relaxedSoma, episodes, appraisal, neuro, TRIGGER_PRIOR)

    const tenseExcitement = tenseResult.deltas.excitement ?? 0
    const relaxedConnection = relaxedResult.deltas.connection ?? 0

    expect(tenseExcitement).not.toBeCloseTo(relaxedResult.deltas.excitement ?? 0, 2)
    expect(relaxedConnection).toBeGreaterThan(tenseResult.deltas.connection ?? 0)
  })

  it("same trigger produces different deltas with positive vs negative memory", () => {
    const appraisal = makeAppraisal()
    const neuro = DEFAULT_NEUROMODULATORY_STATE
    const soma = makeSoma()

    const positiveMemory: EpisodicContext[] = [{ valence: 0.8, recency: 0.9, relevanceScore: 0.8 }]
    const negativeMemory: EpisodicContext[] = [{ valence: -0.8, recency: 0.9, relevanceScore: 0.8 }]

    const positiveResult = constructEmotionDeltas(MESSAGE_EVENT, soma, positiveMemory, appraisal, neuro, TRIGGER_PRIOR)
    const negativeResult = constructEmotionDeltas(MESSAGE_EVENT, soma, negativeMemory, appraisal, neuro, TRIGGER_PRIOR)

    expect(positiveResult.deltas.satisfaction ?? 0).toBeGreaterThan(negativeResult.deltas.satisfaction ?? 0)
  })

  it("same trigger produces different deltas with stressed vs safe neurochemistry", () => {
    const appraisal = makeAppraisal()
    const soma = makeSoma()
    const episodes: EpisodicContext[] = []

    const stressed = makeNeuro({ cortisol: { level: 0.9 }, serotonin: { level: 0.2 } })
    const safe = makeNeuro({ cortisol: { level: 0.1 }, serotonin: { level: 0.8 } })

    const stressedResult = constructEmotionDeltas(MESSAGE_EVENT, soma, episodes, appraisal, stressed, TRIGGER_PRIOR)
    const safeResult = constructEmotionDeltas(MESSAGE_EVENT, soma, episodes, appraisal, safe, TRIGGER_PRIOR)

    const stressedFrustration = stressedResult.deltas.frustration ?? 0
    const safeFrustration = safeResult.deltas.frustration ?? 0
    expect(stressedFrustration).toBeGreaterThanOrEqual(safeFrustration)
  })

  it("empty memory falls back on prior + appraisal", () => {
    const result = constructEmotionDeltas(
      MESSAGE_EVENT,
      makeSoma(),
      [],
      makeAppraisal(),
      DEFAULT_NEUROMODULATORY_STATE,
      TRIGGER_PRIOR
    )
    expect(Object.keys(result.deltas).length).toBeGreaterThan(0)
    expect(Object.keys(result.sources.memory).length).toBe(0)
    expect(Object.keys(result.sources.prior).length).toBeGreaterThan(0)
  })

  it("all deltas within [-0.2, 0.2]", () => {
    const result = constructEmotionDeltas(
      { trigger: "boundary_violated", intensity: 1.0 },
      makeSoma({ tension: 1, heartRate: 1 }),
      [{ valence: -1, recency: 1, relevanceScore: 1 }],
      makeAppraisal({ pleasantness: -1, novelty: 1, copingPotential: 0.1, normCompatibility: -1 }),
      makeNeuro({ cortisol: { level: 1 }, serotonin: { level: 0 } }),
      { caution: 0.12, frustration: 0.08, connection: -0.05, satisfaction: -0.04 }
    )

    for (const [, val] of Object.entries(result.deltas)) {
      expect(val).toBeGreaterThanOrEqual(-0.2)
      expect(val).toBeLessThanOrEqual(0.2)
    }
  })

  it("provides source breakdown for metacognitive introspection", () => {
    const result = constructEmotionDeltas(
      MESSAGE_EVENT,
      makeSoma({ warmth: 0.8 }),
      [{ valence: 0.5, recency: 0.9, relevanceScore: 0.7 }],
      makeAppraisal({ pleasantness: 0.5 }),
      DEFAULT_NEUROMODULATORY_STATE,
      TRIGGER_PRIOR
    )

    expect(result.sources).toBeDefined()
    expect(result.sources.somatic).toBeDefined()
    expect(result.sources.memory).toBeDefined()
    expect(result.sources.appraisal).toBeDefined()
    expect(result.sources.prior).toBeDefined()
    expect(result.sources.neuro).toBeDefined()
  })
})
