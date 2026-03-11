import { describe, expect, it, vi } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { generateBoredomImpulse } from "./boredom.ts"

const baseEmotion: EmotionalState = {
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

describe("generateBoredomImpulse", () => {
  it("returns null when boredom is below threshold", () => {
    const result = generateBoredomImpulse({ ...baseEmotion, boredom: 0.3 }, 5)
    expect(result).toBeNull()
  })

  it("returns null when consecutiveIdleTicks is below threshold", () => {
    const result = generateBoredomImpulse({ ...baseEmotion, boredom: 0.8 }, 1)
    expect(result).toBeNull()
  })

  it("returns a string when both conditions are met and random allows it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const result = generateBoredomImpulse({ ...baseEmotion, boredom: 0.9 }, 5)
    expect(result).toBeTypeOf("string")
    expect(result?.length).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  it("returns null when random exceeds probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    const result = generateBoredomImpulse({ ...baseEmotion, boredom: 0.55 }, 3)
    expect(result).toBeNull()
    vi.restoreAllMocks()
  })

  it("returns impulses from known categories", () => {
    const results: string[] = []
    vi.spyOn(Math, "random").mockReturnValue(0)

    Array.from({ length: 20 }).forEach(() => {
      const result = generateBoredomImpulse({ ...baseEmotion, boredom: 0.9 }, 10)
      if (result) results.push(result)
    })

    vi.restoreAllMocks()
    expect(results.length).toBeGreaterThan(0)
    results.forEach((r) => {
      expect(r.length).toBeGreaterThan(5)
    })
  })
})
