import { afterEach, describe, expect, it, vi } from "vitest"
import { DECEPTION } from "@/config/constants.ts"
import { makeDissonanceEvent, makeDissonanceState, makeHiddenDriver, makeSelfConcept } from "@/test/factories.ts"

vi.mock("./state.ts", () => ({ logDeceptionEvent: vi.fn() }))

import { selectDriverToHide, shouldDiscoverDriver, shouldHideDriver } from "./compute.ts"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("shouldHideDriver", () => {
  it("returns false when vulnerability is open", () => {
    expect(
      shouldHideDriver({
        dissonance: makeDissonanceState({ activeDissonance: 0.8 }),
        selfConcept: makeSelfConcept({ authenticity: 0.3 }),
        vulnerabilityOpen: true
      })
    ).toBe(false)
  })

  it("returns false when dissonance is below threshold", () => {
    expect(
      shouldHideDriver({
        dissonance: makeDissonanceState({ activeDissonance: DECEPTION.HIDE_DISSONANCE_THRESHOLD - 0.1 }),
        selfConcept: makeSelfConcept({ authenticity: 0.3 }),
        vulnerabilityOpen: false
      })
    ).toBe(false)
  })

  it("returns false when authenticity is at or above threshold", () => {
    expect(
      shouldHideDriver({
        dissonance: makeDissonanceState({ activeDissonance: 0.8 }),
        selfConcept: makeSelfConcept({ authenticity: DECEPTION.HIDE_AUTHENTICITY_THRESHOLD }),
        vulnerabilityOpen: false
      })
    ).toBe(false)
  })

  it("returns true when Math.random is below probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(
      shouldHideDriver({
        dissonance: makeDissonanceState({ activeDissonance: 0.8 }),
        selfConcept: makeSelfConcept({ authenticity: 0.3 }),
        vulnerabilityOpen: false
      })
    ).toBe(true)
  })

  it("returns false when Math.random is above probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    expect(
      shouldHideDriver({
        dissonance: makeDissonanceState({ activeDissonance: 0.5 }),
        selfConcept: makeSelfConcept({ authenticity: 0.5 }),
        vulnerabilityOpen: false
      })
    ).toBe(false)
  })
})

describe("selectDriverToHide", () => {
  it("returns null when no unresolved events exist", () => {
    const events = [makeDissonanceEvent({ resolution: "acceptance", dissonanceScore: 0.8 })]
    expect(selectDriverToHide(events)).toBeNull()
  })

  it("returns null for empty events array", () => {
    expect(selectDriverToHide([])).toBeNull()
  })

  it("selects the event with highest dissonance score", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const events = [
      makeDissonanceEvent({ actualAction: "low-action", dissonanceScore: 0.3, resolution: "unresolved" }),
      makeDissonanceEvent({ actualAction: "high-action", dissonanceScore: 0.9, resolution: "unresolved" })
    ]
    const result = selectDriverToHide(events)
    expect(result).not.toBeNull()
    expect(result?.actualDriver).toBe("high-action")
  })

  it("treats events without resolution as unresolved", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const events = [makeDissonanceEvent({ actualAction: "no-resolution", dissonanceScore: 0.7, resolution: undefined })]
    const result = selectDriverToHide(events)
    expect(result).not.toBeNull()
    expect(result?.actualDriver).toBe("no-resolution")
  })
})

describe("shouldDiscoverDriver", () => {
  const driver = makeHiddenDriver()

  it("returns true when dreaming and Math.random is below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(shouldDiscoverDriver(driver, true, false, false)).toBe(true)
  })

  it("returns false when dreaming and Math.random is above threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    expect(shouldDiscoverDriver(driver, true, false, false)).toBe(false)
  })

  it("returns true when reflecting and Math.random is below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(shouldDiscoverDriver(driver, false, true, false)).toBe(true)
  })

  it("returns true when vulnerability is open and Math.random is below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(shouldDiscoverDriver(driver, false, false, true)).toBe(true)
  })

  it("returns false when no condition is active", () => {
    expect(shouldDiscoverDriver(driver, false, false, false)).toBe(false)
  })
})
