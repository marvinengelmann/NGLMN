import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/emotion/types.ts"
import { selectActiveVoices, shouldRunDialog } from "./voices.ts"

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

describe("selectActiveVoices", () => {
  it("always returns 2-4 voices", () => {
    const voices = selectActiveVoices(baseEmotion, {
      dissonanceScore: 0,
      action: "idle",
      hasMessages: false
    })
    expect(voices.length).toBeGreaterThanOrEqual(2)
    expect(voices.length).toBeLessThanOrEqual(4)
  })

  it("includes observer when dissonance is high", () => {
    const voices = selectActiveVoices(baseEmotion, {
      dissonanceScore: 0.6,
      action: "idle",
      hasMessages: false
    })
    expect(voices).toContain("observer")
  })

  it("includes guardian when caution is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, caution: 0.8 }, {
      dissonanceScore: 0,
      action: "idle",
      hasMessages: false
    })
    expect(voices).toContain("guardian")
  })

  it("includes explorer when curiosity is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, curiosity: 0.8 }, {
      dissonanceScore: 0,
      action: "idle",
      hasMessages: false
    })
    expect(voices).toContain("explorer")
  })

  it("always weights feeler and explorer higher (INFP personality)", () => {
    const voices = selectActiveVoices(baseEmotion, {
      dissonanceScore: 0,
      action: "idle",
      hasMessages: false
    })
    expect(voices).toContain("feeler")
    expect(voices).toContain("explorer")
  })
})

describe("shouldRunDialog", () => {
  it("returns true when there are messages", () => {
    expect(shouldRunDialog(baseEmotion, true, 0, "idle")).toBe(true)
  })

  it("returns true when dissonance is high", () => {
    expect(shouldRunDialog(baseEmotion, false, 0.5, "idle")).toBe(true)
  })

  it("returns true when action is not idle", () => {
    expect(shouldRunDialog(baseEmotion, false, 0, "reflect")).toBe(true)
  })

  it("returns true when emotion is extreme", () => {
    expect(shouldRunDialog({ ...baseEmotion, frustration: 0.9 }, false, 0, "idle")).toBe(true)
  })

  it("returns false for idle tick with balanced emotions", () => {
    expect(shouldRunDialog(baseEmotion, false, 0, "idle")).toBe(false)
  })
})
