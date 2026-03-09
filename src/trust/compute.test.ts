import { describe, expect, it, vi } from "vitest"

vi.mock("@/emotion/state.ts", () => ({
  getCurrentEmotion: vi.fn()
}))

vi.mock("./state.ts", () => ({
  getTrustEventLog: vi.fn(),
  pushTrustEvent: vi.fn()
}))

import { getAutonomyLevel } from "./compute.ts"

describe("getAutonomyLevel", () => {
  it("returns locked when experience is 0", () => {
    expect(getAutonomyLevel(0, true)).toBe("locked")
    expect(getAutonomyLevel(0, false)).toBe("locked")
  })

  it("returns approval_required when canAct is false", () => {
    expect(getAutonomyLevel(0.5, false)).toBe("approval_required")
  })

  it("returns supervised when experience is below 0.7", () => {
    expect(getAutonomyLevel(0.5, true)).toBe("supervised")
    expect(getAutonomyLevel(0.69, true)).toBe("supervised")
  })

  it("returns independent when experience is 0.7 or above", () => {
    expect(getAutonomyLevel(0.7, true)).toBe("independent")
    expect(getAutonomyLevel(1.0, true)).toBe("independent")
  })
})
