import { describe, expect, it } from "vitest"
import { DEFAULT_DRIVE_STATE } from "@/affect/drive/types.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import {
  computeCreativeUrge,
  computeEmotionalPressure,
  selectCreativeMode,
  shouldCreateSpontaneously,
  updateCreativeUrgeState
} from "./compute.ts"
import { DEFAULT_CREATIVE_URGE_STATE } from "./types.ts"

const defaultHeldBack = { entries: [], suppressionPressure: 0 }

describe("computeCreativeUrge", () => {
  it("should increase with high expression drive salience", () => {
    const driveState = {
      ...DEFAULT_DRIVE_STATE,
      expression: { ...DEFAULT_DRIVE_STATE.expression, salience: 0.9 }
    }

    const urge = computeCreativeUrge({
      emotion: makeEmotionalState(),
      driveState,
      heldBackBuffer: defaultHeldBack,
      consecutiveIdleTicks: 0
    })

    expect(urge).toBeGreaterThan(0.3)
  })

  it("should increase with held-back pressure", () => {
    const urge = computeCreativeUrge({
      emotion: makeEmotionalState(),
      driveState: DEFAULT_DRIVE_STATE,
      heldBackBuffer: { entries: [], suppressionPressure: 0.8 },
      consecutiveIdleTicks: 0
    })

    expect(urge).toBeGreaterThan(0)
  })
})

describe("selectCreativeMode", () => {
  it("should select poetry for high connection and satisfaction", () => {
    const mode = selectCreativeMode(makeEmotionalState({ connection: 0.8, satisfaction: 0.7 }))
    expect(mode).toBe("poetry")
  })

  it("should select observation for high curiosity", () => {
    const mode = selectCreativeMode(makeEmotionalState({ curiosity: 0.8, connection: 0.3, satisfaction: 0.3 }))
    expect(mode).toBe("observation")
  })
})

describe("shouldCreateSpontaneously", () => {
  it("should be true when urge is high and idle", () => {
    expect(shouldCreateSpontaneously(0.8, 5)).toBe(true)
  })

  it("should be false when urge is low", () => {
    expect(shouldCreateSpontaneously(0.3, 5)).toBe(false)
  })
})

describe("computeEmotionalPressure", () => {
  it("should reflect emotional intensity", () => {
    const pressure = computeEmotionalPressure(
      makeEmotionalState({ frustration: 0.8, excitement: 0.7 }),
      defaultHeldBack
    )
    expect(pressure).toBeGreaterThan(0.3)
  })
})

describe("updateCreativeUrgeState", () => {
  it("should produce valid state", () => {
    const result = updateCreativeUrgeState(DEFAULT_CREATIVE_URGE_STATE, {
      emotion: makeEmotionalState({ boredom: 0.6 }),
      driveState: DEFAULT_DRIVE_STATE,
      heldBackBuffer: defaultHeldBack,
      consecutiveIdleTicks: 2
    })

    expect(result.level).toBeGreaterThanOrEqual(0)
    expect(result.preferredMode).toBeDefined()
  })
})
