vi.mock("@/personality/mbti.ts", () => ({
  getEmotionBaseline: vi.fn()
}))

import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"
import { makeEmotionalState, makeMetricsSnapshot } from "@/test/factories.ts"
import { metricsRecalibration, morningRecalibration } from "./calibration.ts"

const mockGetEmotionBaseline = getEmotionBaseline as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetEmotionBaseline.mockReturnValue(DEFAULT_EMOTIONAL_STATE)
})

describe("morningRecalibration", () => {
  it("strongly drifts towards baseline (70% baseline, 30% current)", () => {
    const extreme = makeEmotionalState({
      frustration: 1.0,
      excitement: 0.0,
      curiosity: 0.0
    })
    const result = morningRecalibration(extreme)
    expect(result.frustration).toBeCloseTo(0.65)
    expect(result.curiosity).toBeCloseTo(0.35)
  })

  it("preserves baseline when already at baseline", () => {
    const result = morningRecalibration(DEFAULT_EMOTIONAL_STATE)
    expect(result.curiosity).toBeCloseTo(DEFAULT_EMOTIONAL_STATE.curiosity)
    expect(result.frustration).toBeCloseTo(DEFAULT_EMOTIONAL_STATE.frustration)
  })

  it("clamps all values to [0, 1]", () => {
    const result = morningRecalibration(makeEmotionalState({ curiosity: 1.0, frustration: 0.0 }))
    expect(result.curiosity).toBeGreaterThanOrEqual(0)
    expect(result.curiosity).toBeLessThanOrEqual(1)
  })

  it("drifts towards MBTI-shifted baseline when configured", () => {
    const mbtiBaseline = { ...DEFAULT_EMOTIONAL_STATE, curiosity: 0.7 }
    mockGetEmotionBaseline.mockReturnValue(mbtiBaseline)

    const state = makeEmotionalState({ curiosity: 0.3 })
    const result = morningRecalibration(state)
    expect(result.curiosity).toBeCloseTo(0.3 * 0.3 + 0.7 * 0.7)
  })
})

describe("metricsRecalibration", () => {
  it("reduces satisfaction when high but error rate is high", () => {
    const state = makeEmotionalState({ satisfaction: 0.9 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.5 })
    const result = metricsRecalibration(state, metrics)
    expect(result.satisfaction).toBeCloseTo(0.8)
  })

  it("increases frustration when low but error rate is very high", () => {
    const state = makeEmotionalState({ frustration: 0.1 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.6 })
    const result = metricsRecalibration(state, metrics)
    expect(result.frustration).toBeCloseTo(0.2)
  })

  it("reduces boredom when high but many interactions", () => {
    const state = makeEmotionalState({ boredom: 0.8 })
    const metrics = makeMetricsSnapshot({ interactionCount: 25 })
    const result = metricsRecalibration(state, metrics)
    expect(result.boredom).toBeCloseTo(0.7)
  })

  it("reduces excitement when high but mostly idle", () => {
    const state = makeEmotionalState({ excitement: 0.9 })
    const metrics = makeMetricsSnapshot({ idleRatio: 0.9 })
    const result = metricsRecalibration(state, metrics)
    expect(result.excitement).toBeCloseTo(0.8)
  })

  it("makes no changes when emotions align with metrics", () => {
    const state = makeEmotionalState({ satisfaction: 0.3, frustration: 0.5 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.5 })
    const result = metricsRecalibration(state, metrics)
    expect(result.satisfaction).toBeCloseTo(0.3)
    expect(result.frustration).toBeCloseTo(0.5)
  })

  it("clamps all values to [0, 1]", () => {
    const state = makeEmotionalState({ satisfaction: 0.05 })
    const metrics = makeMetricsSnapshot({ errorRate: 0.5 })
    const result = metricsRecalibration(state, metrics)
    expect(result.satisfaction).toBeGreaterThanOrEqual(0)
    expect(result.satisfaction).toBeLessThanOrEqual(1)
  })
})
