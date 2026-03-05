import { describe, expect, it } from "vitest"
import { computeTimePerception } from "./time.ts"

describe("computeTimePerception", () => {
  it("returns 'flying' for high intensity and busy durations", () => {
    const result = computeTimePerception([6000, 7000, 8000], 0.8, 0, 10)
    expect(result.subjectivePace).toBe("flying")
  })

  it("returns 'fast' for moderate intensity and busy durations", () => {
    const result = computeTimePerception([6000, 7000, 8000], 0.6, 0, 10)
    expect(result.subjectivePace).toBe("fast")
  })

  it("returns 'crawling' for many idle ticks and long silence", () => {
    const result = computeTimePerception([1000], 0.2, 6, 180)
    expect(result.subjectivePace).toBe("crawling")
  })

  it("returns 'slow' for moderate idle ticks", () => {
    const result = computeTimePerception([1000], 0.2, 3, 30)
    expect(result.subjectivePace).toBe("slow")
  })

  it("returns 'slow' for long operator silence", () => {
    const result = computeTimePerception([1000], 0.2, 1, 90)
    expect(result.subjectivePace).toBe("slow")
  })

  it("returns 'normal' for balanced conditions", () => {
    const result = computeTimePerception([2000, 3000], 0.3, 1, 20)
    expect(result.subjectivePace).toBe("normal")
  })

  it("returns 'normal' for empty durations", () => {
    const result = computeTimePerception([], 0.3, 0, 10)
    expect(result.subjectivePace).toBe("normal")
  })

  it("always returns a description string", () => {
    const paces = [
      computeTimePerception([6000, 7000, 8000], 0.8, 0, 10),
      computeTimePerception([6000, 7000, 8000], 0.6, 0, 10),
      computeTimePerception([1000], 0.2, 6, 180),
      computeTimePerception([1000], 0.2, 3, 30),
      computeTimePerception([2000], 0.3, 1, 20)
    ]
    for (const p of paces) {
      expect(p.description).toBeTruthy()
      expect(typeof p.description).toBe("string")
    }
  })
})
