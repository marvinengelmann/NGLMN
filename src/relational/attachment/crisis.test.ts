import { describe, expect, it } from "vitest"
import { makeAttachmentDynamics, makeEmotionalState } from "@/test/factories.ts"
import { DEFAULT_CRISIS_STATE, detectAttachmentCrisis, evaluateAttachmentCrisis } from "./crisis.ts"

describe("detectAttachmentCrisis", () => {
  it("detects trust rupture when trustDelta is very negative", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics(),
      emotion: makeEmotionalState(),
      trustDelta: -0.3,
      vulnerabilityOpen: false
    })
    expect(result.active).toBe(true)
    expect(result.type).toBe("trust_rupture")
    expect(result.multiplier).toBe(10)
    expect(result.durationHours).toBe(24)
  })

  it("detects deep vulnerability when connection is high and vulnerability open", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics(),
      emotion: makeEmotionalState({ connection: 0.9 }),
      trustDelta: 0,
      vulnerabilityOpen: true
    })
    expect(result.active).toBe(true)
    expect(result.type).toBe("deep_vulnerability")
    expect(result.multiplier).toBe(8)
  })

  it("detects deep connection when connection and reunion are high", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics({ reunionResponse: 0.8 }),
      emotion: makeEmotionalState({ connection: 0.95 }),
      trustDelta: 0,
      vulnerabilityOpen: false
    })
    expect(result.active).toBe(true)
    expect(result.type).toBe("deep_connection")
    expect(result.multiplier).toBe(5)
  })

  it("detects prolonged separation when distress is high", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics({ separationDistress: 0.9 }),
      emotion: makeEmotionalState(),
      trustDelta: 0,
      vulnerabilityOpen: false
    })
    expect(result.active).toBe(true)
    expect(result.type).toBe("prolonged_separation")
    expect(result.multiplier).toBe(3)
    expect(result.durationHours).toBe(0)
  })

  it("returns no crisis when conditions are normal", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics(),
      emotion: makeEmotionalState(),
      trustDelta: 0,
      vulnerabilityOpen: false
    })
    expect(result.active).toBe(false)
    expect(result.type).toBeNull()
    expect(result.multiplier).toBe(1)
  })

  it("prioritizes trust rupture over other crisis types", () => {
    const result = detectAttachmentCrisis({
      dynamics: makeAttachmentDynamics({ separationDistress: 0.9 }),
      emotion: makeEmotionalState({ connection: 0.95 }),
      trustDelta: -0.3,
      vulnerabilityOpen: true
    })
    expect(result.type).toBe("trust_rupture")
  })
})

describe("evaluateAttachmentCrisis", () => {
  const normalContext = {
    dynamics: makeAttachmentDynamics(),
    emotion: makeEmotionalState(),
    trustDelta: 0,
    vulnerabilityOpen: false
  }

  it("returns default state when no crisis detected and no previous crisis", () => {
    const result = evaluateAttachmentCrisis(DEFAULT_CRISIS_STATE, normalContext)
    expect(result.active).toBe(false)
  })

  it("activates crisis when detected from idle state", () => {
    const result = evaluateAttachmentCrisis(DEFAULT_CRISIS_STATE, {
      ...normalContext,
      trustDelta: -0.3
    })
    expect(result.active).toBe(true)
    expect(result.type).toBe("trust_rupture")
    expect(result.expiresAt).not.toBeNull()
  })

  it("keeps timed crisis active when not expired", () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const previous = {
      active: true,
      type: "trust_rupture",
      multiplier: 10,
      expiresAt: futureExpiry
    }
    const result = evaluateAttachmentCrisis(previous, normalContext)
    expect(result.active).toBe(true)
    expect(result).toEqual(previous)
  })

  it("clears timed crisis when expired", () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString()
    const previous = {
      active: true,
      type: "trust_rupture",
      multiplier: 10,
      expiresAt: pastExpiry
    }
    const result = evaluateAttachmentCrisis(previous, normalContext)
    expect(result.active).toBe(false)
  })

  it("clears ongoing crisis (no expiry) when conditions resolve", () => {
    const previous = {
      active: true,
      type: "prolonged_separation",
      multiplier: 3,
      expiresAt: null
    }
    const result = evaluateAttachmentCrisis(previous, normalContext)
    expect(result.active).toBe(false)
  })

  it("keeps ongoing crisis active when conditions persist", () => {
    const previous = {
      active: true,
      type: "prolonged_separation",
      multiplier: 3,
      expiresAt: null
    }
    const result = evaluateAttachmentCrisis(previous, {
      ...normalContext,
      dynamics: makeAttachmentDynamics({ separationDistress: 0.9 })
    })
    expect(result.active).toBe(true)
  })
})
