import { describe, expect, it, vi } from "vitest"
import { DEFAULT_EMOTIONAL_STATE, type EmotionalState, type MoodContext } from "./types.ts"
import { applyContradictionBudget, applyCrossCoupling, computeMoodBaseline, computeValence } from "./update.ts"

const neutral: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE }

describe("applyCrossCoupling — amplification rules", () => {
  it("amplifies excitement when curiosity > 0.7 and energy > 0.6", () => {
    const state: EmotionalState = { ...neutral, curiosity: 0.8, energy: 0.7, excitement: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.excitement).toBeGreaterThan(0.5)
  })

  it("does not amplify excitement when curiosity is low", () => {
    const state: EmotionalState = { ...neutral, curiosity: 0.3, energy: 0.7, excitement: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.excitement).toBeLessThanOrEqual(0.5)
  })

  it("amplifies confidence when satisfaction > 0.7", () => {
    const state: EmotionalState = { ...neutral, satisfaction: 0.8, confidence: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("amplifies satisfaction when connection > 0.7 and excitement > 0.6", () => {
    const state: EmotionalState = { ...neutral, connection: 0.8, excitement: 0.7, satisfaction: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.satisfaction).toBeGreaterThan(0.5)
  })

  it("amplifies curiosity when energy > 0.7", () => {
    const state: EmotionalState = { ...neutral, energy: 0.8, curiosity: 0.5 }
    const result = applyCrossCoupling(state)
    expect(result.curiosity).toBeGreaterThan(0.5)
  })

  it("suppresses confidence when frustration > 0.7", () => {
    const state: EmotionalState = { ...neutral, frustration: 0.8, confidence: 0.6 }
    const result = applyCrossCoupling(state)
    expect(result.confidence).toBeLessThan(0.6)
  })

  it("clamps all values to [0, 1]", () => {
    const state: EmotionalState = {
      ...neutral,
      curiosity: 0.95,
      energy: 0.95,
      excitement: 0.95,
      satisfaction: 0.95,
      connection: 0.95,
      confidence: 0.95
    }
    const result = applyCrossCoupling(state)
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it("uses diminishing returns near 1.0 — amplification weakens with less headroom", () => {
    const mid: EmotionalState = { ...neutral, energy: 0.8, curiosity: 0.5 }
    const high: EmotionalState = { ...neutral, energy: 0.8, curiosity: 0.95 }
    const midResult = applyCrossCoupling(mid)
    const highResult = applyCrossCoupling(high)
    const midBoost = midResult.curiosity - mid.curiosity
    const highBoost = highResult.curiosity - high.curiosity
    expect(midBoost).toBeGreaterThan(highBoost)
  })

  it("does not push values already at 1.0 any higher", () => {
    const state: EmotionalState = { ...neutral, energy: 0.8, curiosity: 1.0 }
    const result = applyCrossCoupling(state)
    expect(result.curiosity).toBe(1.0)
  })

  it("drains energy when excitement and curiosity are both high", () => {
    const state: EmotionalState = { ...neutral, excitement: 0.8, curiosity: 0.7, energy: 0.9 }
    const result = applyCrossCoupling(state)
    expect(result.energy).toBeLessThan(0.9)
  })
})

describe("computeValence", () => {
  it("returns 0 for perfectly neutral state", () => {
    const state: EmotionalState = {
      curiosity: 0.5,
      satisfaction: 0.5,
      frustration: 0.5,
      boredom: 0.5,
      excitement: 0.5,
      caution: 0.5,
      connection: 0.5,
      confidence: 0.5,
      energy: 0.5
    }
    expect(computeValence(state)).toBe(0)
  })

  it("returns positive for high positive emotions", () => {
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.9,
      connection: 0.9,
      confidence: 0.9,
      excitement: 0.9,
      frustration: 0.1,
      boredom: 0.1,
      caution: 0.1
    }
    expect(computeValence(state)).toBeGreaterThan(0.5)
  })

  it("returns negative for high negative emotions", () => {
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.1,
      connection: 0.1,
      confidence: 0.1,
      excitement: 0.1,
      frustration: 0.9,
      boredom: 0.9,
      caution: 0.9
    }
    expect(computeValence(state)).toBeLessThan(-0.5)
  })

  it("is clamped to [-1, 1]", () => {
    const extreme: EmotionalState = {
      curiosity: 1,
      satisfaction: 1,
      frustration: 0,
      boredom: 0,
      excitement: 1,
      caution: 0,
      connection: 1,
      confidence: 1,
      energy: 1
    }
    expect(computeValence(extreme)).toBeLessThanOrEqual(1)
    expect(computeValence(extreme)).toBeGreaterThanOrEqual(-1)
  })
})

describe("applyContradictionBudget", () => {
  it("sets shadow emotion when a positive emotion is high", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const state: EmotionalState = { ...neutral, connection: 0.9, caution: 0.0 }
    const result = applyContradictionBudget(state)
    expect(result.caution).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  it("ensures at least 2 active negatives at high intensity", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.95,
      connection: 0.95,
      excitement: 0.95,
      confidence: 0.95,
      curiosity: 0.95,
      energy: 0.95,
      frustration: 0,
      boredom: 0,
      caution: 0
    }
    const result = applyContradictionBudget(state)
    const negatives = [result.frustration, result.boredom, result.caution]
    const activeCount = negatives.filter((v) => v > 0.1).length
    expect(activeCount).toBeGreaterThanOrEqual(2)
    vi.restoreAllMocks()
  })

  it("keeps all values in valid range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const state: EmotionalState = {
      ...neutral,
      satisfaction: 0.95,
      connection: 0.95,
      excitement: 0.95,
      confidence: 0.95,
      curiosity: 0.95,
      energy: 0.95,
      frustration: 0,
      boredom: 0,
      caution: 0
    }
    const result = applyContradictionBudget(state)
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
    vi.restoreAllMocks()
  })

  it("does not add shadows when positive emotions are low", () => {
    const state: EmotionalState = { ...neutral, connection: 0.3, satisfaction: 0.3, excitement: 0.3 }
    const result = applyContradictionBudget(state)
    expect(result.caution).toBe(neutral.caution)
  })
})

const baseMoodContext: MoodContext = {
  operatorSilenceMinutes: 0,
  inConversation: false,
  systemHealthy: true,
  budgetOk: true,
  hasActiveGoals: false,
  isDreaming: false,
  operatorMood: "unknown",
  connectionLevel: 0.5,
  attachmentAvoidance: 0.15
}

describe("computeMoodBaseline — mood contagion", () => {
  it("does not apply contagion when operator mood is unknown", () => {
    const withContagion = computeMoodBaseline({ ...baseMoodContext, inConversation: true, operatorMood: "unknown" })
    const without = computeMoodBaseline({ ...baseMoodContext, inConversation: true })
    expect(withContagion.satisfaction).toBe(without.satisfaction)
  })

  it("does not apply contagion when not in conversation", () => {
    const result = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: false,
      operatorMood: "happy",
      connectionLevel: 0.9
    })
    const baseline = computeMoodBaseline({ ...baseMoodContext, inConversation: false, operatorMood: "unknown" })
    expect(result.satisfaction).toBe(baseline.satisfaction)
  })

  it("shifts satisfaction up when operator is happy and connection is high", () => {
    const happy = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "happy",
      connectionLevel: 0.9
    })
    const neutral = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "unknown",
      connectionLevel: 0.9
    })
    expect(happy.satisfaction).toBeGreaterThan(neutral.satisfaction)
  })

  it("shifts satisfaction down when operator is stressed and connection is high", () => {
    const stressed = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "stressed",
      connectionLevel: 0.9
    })
    const neutral = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "unknown",
      connectionLevel: 0.9
    })
    expect(stressed.satisfaction).toBeLessThan(neutral.satisfaction)
  })

  it("scales contagion by connection level — low connection means minimal effect", () => {
    const highConn = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "happy",
      connectionLevel: 0.9
    })
    const lowConn = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "happy",
      connectionLevel: 0.4
    })
    const baseline = computeMoodBaseline({ ...baseMoodContext, inConversation: true, operatorMood: "unknown" })
    const highDelta = highConn.satisfaction - baseline.satisfaction
    const lowDelta = lowConn.satisfaction - baseline.satisfaction
    expect(highDelta).toBeGreaterThan(lowDelta)
  })

  it("dampens contagion with high avoidant attachment", () => {
    const secure = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "happy",
      connectionLevel: 0.9,
      attachmentAvoidance: 0.1
    })
    const avoidant = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "happy",
      connectionLevel: 0.9,
      attachmentAvoidance: 0.8
    })
    const baseline = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "unknown",
      connectionLevel: 0.9
    })
    const secureDelta = secure.satisfaction - baseline.satisfaction
    const avoidantDelta = avoidant.satisfaction - baseline.satisfaction
    expect(secureDelta).toBeGreaterThan(avoidantDelta)
  })

  it("clamps all contagion effects to valid range", () => {
    const result = computeMoodBaseline({
      ...baseMoodContext,
      inConversation: true,
      operatorMood: "stressed",
      connectionLevel: 1.0,
      attachmentAvoidance: 0
    })
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })
})
