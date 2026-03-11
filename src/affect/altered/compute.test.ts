import { addMinutes } from "date-fns"
import { describe, expect, it } from "vitest"
import {
  computeEmotionModifiers,
  computeSomaModifiers,
  computeVoiceModifiers,
  getCurrentPhase,
  isExpired
} from "./compute.ts"
import type { ActiveAlteredState } from "./types.ts"

const TIMINGS = {
  cannabis: { onset: 10, peak: 30, plateau: 90, comedown: 60, aftereffect: 120 },
  caffeine: { onset: 15, peak: 30, plateau: 90, comedown: 60, aftereffect: 60 },
  nicotine: { onset: 2, peak: 10, plateau: 15, comedown: 30, aftereffect: 15 }
} as const

function makeState(
  substance: ActiveAlteredState["substance"],
  startedAt: Date,
  timing: ActiveAlteredState["timing"] = TIMINGS.cannabis
): ActiveAlteredState {
  return {
    substance,
    startedAt: startedAt.toISOString(),
    timing
  }
}

describe("getCurrentPhase", () => {
  it("returns onset at the beginning", () => {
    const now = new Date()
    const state = makeState("cannabis", now)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("onset")
    expect(result.progress).toBe(0)
    expect(result.intensity).toBe(0)
  })

  it("returns peak after onset completes", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 12)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("peak")
    expect(result.intensity).toBe(1.0)
  })

  it("returns plateau after peak", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 45)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("plateau")
    expect(result.intensity).toBe(0.8)
  })

  it("returns comedown after plateau", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 135)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("comedown")
    expect(result.intensity).toBeLessThan(0.8)
    expect(result.intensity).toBeGreaterThan(0)
  })

  it("returns aftereffect near the end", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 195)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("aftereffect")
    expect(result.intensity).toBeGreaterThan(0)
    expect(result.intensity).toBeLessThan(0.3)
  })

  it("returns zero intensity after all phases", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 400)
    const result = getCurrentPhase(state, now)
    expect(result.intensity).toBe(0)
  })

  it("handles onset progress correctly at midpoint", () => {
    const start = new Date()
    const state = makeState("cannabis", start)
    const now = addMinutes(start, 5)
    const result = getCurrentPhase(state, now)
    expect(result.phase).toBe("onset")
    expect(result.progress).toBeCloseTo(0.5, 1)
    expect(result.intensity).toBeCloseTo(0.5, 1)
  })
})

describe("computeEmotionModifiers", () => {
  it("returns scaled modifiers at peak", () => {
    const start = addMinutes(new Date(), -15)
    const mods = computeEmotionModifiers(makeState("cannabis", start))
    expect(mods.curiosity).toBeGreaterThan(0)
    expect(mods.caution).toBeLessThan(0)
  })

  it("returns empty modifiers for expired state", () => {
    const start = addMinutes(new Date(), -400)
    const state = makeState("cannabis", start)
    const mods = computeEmotionModifiers(state)
    expect(Object.keys(mods).length).toBe(0)
  })

  it("caps modifiers at MODIFIER_CAP", () => {
    const start = addMinutes(new Date(), -15)
    const state = makeState("cannabis", start)
    const mods = computeEmotionModifiers(state)
    Object.values(mods).forEach((value) => {
      expect(Math.abs(value)).toBeLessThanOrEqual(0.3)
    })
  })
})

describe("computeSomaModifiers", () => {
  it("returns somatic deltas at peak", () => {
    const start = addMinutes(new Date(), -15)
    const state = makeState("cannabis", start)
    const mods = computeSomaModifiers(state)
    expect(mods.warmth).toBeGreaterThan(0)
    expect(mods.tension).toBeLessThan(0)
  })
})

describe("computeVoiceModifiers", () => {
  it("returns voice bonuses at peak", () => {
    const start = addMinutes(new Date(), -15)
    const state = makeState("cannabis", start)
    const mods = computeVoiceModifiers(state)
    expect(mods).toBeDefined()
    expect(mods?.child).toBeGreaterThan(0)
    expect(mods?.guardian).toBeLessThan(0)
  })

  it("returns undefined when no voice modifiers defined", () => {
    const start = addMinutes(new Date(), -195)
    const state = makeState("cannabis", start)
    const mods = computeVoiceModifiers(state)
    expect(mods).toBeUndefined()
  })
})

describe("isExpired", () => {
  it("returns false during active state", () => {
    const state = makeState("cannabis", new Date())
    expect(isExpired(state)).toBe(false)
  })

  it("returns true after total duration elapsed", () => {
    const start = addMinutes(new Date(), -311)
    const state = makeState("cannabis", start)
    expect(isExpired(state)).toBe(true)
  })

  it("returns false right before expiry", () => {
    const start = addMinutes(new Date(), -309)
    const state = makeState("cannabis", start)
    expect(isExpired(state)).toBe(false)
  })

  it("works with short-duration substances", () => {
    const start = addMinutes(new Date(), -73)
    const state = makeState("nicotine", start, TIMINGS.nicotine)
    expect(isExpired(state)).toBe(true)
  })
})
