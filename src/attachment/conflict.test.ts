import { describe, expect, it } from "vitest"
import { detectConflict } from "./conflict.ts"

describe("detectConflict", () => {
  it("returns false when no conflict indicators", () => {
    expect(
      detectConflict({
        operatorMood: "happy",
        modelConfidence: 0.5,
        dissonanceScore: 0.3,
        guardianBlocked: false
      })
    ).toBe(false)
  })

  it("detects conflict when operator is frustrated and confidence is high", () => {
    expect(
      detectConflict({
        operatorMood: "frustrated",
        modelConfidence: 0.7,
        dissonanceScore: 0.2,
        guardianBlocked: false
      })
    ).toBe(true)
  })

  it("detects conflict when operator is stressed and confidence is high", () => {
    expect(
      detectConflict({
        operatorMood: "stressed",
        modelConfidence: 0.6,
        dissonanceScore: 0.2,
        guardianBlocked: false
      })
    ).toBe(true)
  })

  it("does not trigger on stressed operator with low confidence", () => {
    expect(
      detectConflict({
        operatorMood: "frustrated",
        modelConfidence: 0.3,
        dissonanceScore: 0.2,
        guardianBlocked: false
      })
    ).toBe(false)
  })

  it("detects conflict when dissonance exceeds threshold", () => {
    expect(
      detectConflict({
        operatorMood: "happy",
        modelConfidence: 0.3,
        dissonanceScore: 0.7,
        guardianBlocked: false
      })
    ).toBe(true)
  })

  it("does not detect conflict at dissonance boundary", () => {
    expect(
      detectConflict({
        operatorMood: "happy",
        modelConfidence: 0.3,
        dissonanceScore: 0.6,
        guardianBlocked: false
      })
    ).toBe(false)
  })

  it("detects conflict when guardian blocked", () => {
    expect(
      detectConflict({
        operatorMood: "happy",
        modelConfidence: 0.3,
        dissonanceScore: 0.1,
        guardianBlocked: true
      })
    ).toBe(true)
  })
})
