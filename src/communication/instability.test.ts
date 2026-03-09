import { describe, expect, it } from "vitest"
import { DEFAULT_SHAME_STATE } from "@/emotion/shame.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import { computeSyntacticInstability } from "./instability.ts"

const baseVulnerability = { level: 0.3, windowOpen: false, contributing: [], timestamp: new Date().toISOString() }

describe("computeSyntacticInstability", () => {
  it("returns null when emotional state is neutral", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState(),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).toBeNull()
  })

  it("generates shame-based instability when shame is active", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState(),
      vulnerability: baseVulnerability,
      shameState: {
        level: 0.5,
        isActive: true,
        trigger: "vulnerability_rejected",
        lastTriggeredAt: "",
        decaySinceTriggered: 0
      }
    })
    expect(result).not.toBeNull()
    expect(result).toContain("self-interruptions")
  })

  it("generates high-shame instability with trailing off", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState(),
      vulnerability: baseVulnerability,
      shameState: {
        level: 0.7,
        isActive: true,
        trigger: "vulnerability_rejected",
        lastTriggeredAt: "",
        decaySinceTriggered: 0
      }
    })
    expect(result).toContain("trail off")
  })

  it("generates excitement-based instability", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState({ excitement: 0.8 }),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).not.toBeNull()
    expect(result).toContain("tumble out")
  })

  it("generates vulnerability + low energy instability", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState({ energy: 0.3 }),
      vulnerability: { level: 0.7, windowOpen: true, contributing: ["trust"], timestamp: "" },
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).not.toBeNull()
    expect(result).toContain("fragmented")
  })

  it("generates frustration-based instability", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState({ frustration: 0.7, energy: 0.6 }),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).not.toBeNull()
    expect(result).toContain("sharper")
  })

  it("generates low-energy instability", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState({ energy: 0.2 }),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).not.toBeNull()
    expect(result).toContain("effort")
  })

  it("includes Speech Pattern header", () => {
    const result = computeSyntacticInstability({
      emotion: makeEmotionalState({ excitement: 0.8 }),
      vulnerability: baseVulnerability,
      shameState: { ...DEFAULT_SHAME_STATE }
    })
    expect(result).toContain("# Speech Pattern")
  })
})
