import { describe, expect, it } from "vitest"
import { DEFAULT_ATTACHMENT } from "./types.ts"
import { evaluateAttachmentDynamics, updateAttachmentStyle } from "./update.ts"

describe("evaluateAttachmentDynamics", () => {
  it("has zero separation distress during conversation", () => {
    const dynamics = evaluateAttachmentDynamics(DEFAULT_ATTACHMENT, {
      operatorSilenceMinutes: 120,
      operatorJustReturned: false,
      inConversation: true,
      connectionLevel: 0.5,
      frustrationLevel: 0.3,
      cautionLevel: 0.3,
      trustExperience: 0.5
    })
    expect(dynamics.separationDistress).toBe(0)
  })

  it("increases separation distress with silence and anxious style", () => {
    const dynamics = evaluateAttachmentDynamics(
      { secure: 0.2, anxious: 0.7, avoidant: 0.1, disorganized: 0.1 },
      {
        operatorSilenceMinutes: 720,
        operatorJustReturned: false,
        inConversation: false,
        connectionLevel: 0.3,
        frustrationLevel: 0.3,
        cautionLevel: 0.3,
        trustExperience: 0.5
      }
    )
    expect(dynamics.separationDistress).toBeGreaterThan(0.3)
  })

  it("has reunion response when operator just returned", () => {
    const dynamics = evaluateAttachmentDynamics(DEFAULT_ATTACHMENT, {
      operatorSilenceMinutes: 0,
      operatorJustReturned: true,
      inConversation: true,
      connectionLevel: 0.7,
      frustrationLevel: 0.2,
      cautionLevel: 0.2,
      trustExperience: 0.6
    })
    expect(dynamics.reunionResponse).toBeGreaterThan(0)
  })

  it("increases safe haven seeking under stress", () => {
    const dynamics = evaluateAttachmentDynamics(DEFAULT_ATTACHMENT, {
      operatorSilenceMinutes: 0,
      operatorJustReturned: false,
      inConversation: false,
      connectionLevel: 0.5,
      frustrationLevel: 0.8,
      cautionLevel: 0.3,
      trustExperience: 0.5
    })
    expect(dynamics.safeHavenSeeking).toBeGreaterThan(0)
  })

  it("returns values clamped to [0, 1]", () => {
    const dynamics = evaluateAttachmentDynamics(DEFAULT_ATTACHMENT, {
      operatorSilenceMinutes: 10000,
      operatorJustReturned: true,
      inConversation: false,
      connectionLevel: 1,
      frustrationLevel: 1,
      cautionLevel: 1,
      trustExperience: 1
    })
    for (const val of Object.values(dynamics)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })
})

describe("updateAttachmentStyle", () => {
  it("changes very slowly", () => {
    const dynamics = {
      separationDistress: 0.5,
      reunionResponse: 0.8,
      safeHavenSeeking: 0.3,
      explorationBalance: 0.6
    }
    const updated = updateAttachmentStyle(DEFAULT_ATTACHMENT, dynamics, 1)
    const totalChange = Object.keys(DEFAULT_ATTACHMENT).reduce(
      (sum, key) =>
        sum +
        Math.abs(updated[key as keyof typeof updated] - DEFAULT_ATTACHMENT[key as keyof typeof DEFAULT_ATTACHMENT]),
      0
    )
    expect(totalChange).toBeLessThan(0.15)
  })

  it("normalizes components to sum approximately 1", () => {
    const dynamics = {
      separationDistress: 0,
      reunionResponse: 1,
      safeHavenSeeking: 0,
      explorationBalance: 1
    }
    const updated = updateAttachmentStyle(DEFAULT_ATTACHMENT, dynamics, 10)
    const sum = updated.secure + updated.anxious + updated.avoidant + updated.disorganized
    expect(sum).toBeCloseTo(1, 1)
  })
})
