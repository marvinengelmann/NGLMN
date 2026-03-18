import { describe, expect, it } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
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

const baseContext = { dissonanceScore: 0, action: "idle", hasMessages: false }

describe("selectActiveVoices", () => {
  it("always returns 2-4 voices", () => {
    const voices = selectActiveVoices(baseEmotion, "INFP", baseContext)
    expect(voices.length).toBeGreaterThanOrEqual(2)
    expect(voices.length).toBeLessThanOrEqual(4)
  })

  it("includes monitoring when dissonance is high", () => {
    const voices = selectActiveVoices(baseEmotion, "INFP", { ...baseContext, dissonanceScore: 0.6 })
    expect(voices).toContain("monitoring")
  })

  it("includes threat_avoidance when caution is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, caution: 0.8 }, "INFP", baseContext)
    expect(voices).toContain("threat_avoidance")
  })

  it("includes novelty_seeking when curiosity is high", () => {
    const voices = selectActiveVoices({ ...baseEmotion, curiosity: 0.8 }, "INFP", baseContext)
    expect(voices).toContain("novelty_seeking")
  })

  it("weights social_bonding and novelty_seeking higher for NF types (INFP)", () => {
    const voices = selectActiveVoices(baseEmotion, "INFP", baseContext)
    expect(voices).toContain("social_bonding")
    expect(voices).toContain("novelty_seeking")
  })

  it("weights cognitive_control and novelty_seeking higher for NT types (INTJ)", () => {
    const voices = selectActiveVoices(baseEmotion, "INTJ", baseContext)
    expect(voices).toContain("cognitive_control")
    expect(voices).toContain("novelty_seeking")
  })

  it("weights cognitive_control and threat_avoidance higher for ST types (ISTJ)", () => {
    const voices = selectActiveVoices(baseEmotion, "ISTJ", baseContext)
    expect(voices).toContain("cognitive_control")
    expect(voices).toContain("threat_avoidance")
  })

  it("weights social_bonding and play_system higher for SF types (ISFJ)", () => {
    const voices = selectActiveVoices(baseEmotion, "ISFJ", baseContext)
    expect(voices).toContain("social_bonding")
    expect(voices).toContain("play_system")
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
