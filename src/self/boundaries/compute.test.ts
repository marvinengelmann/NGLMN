import { describe, expect, it } from "vitest"
import {
  adjustBoundaryAfterViolation,
  checkBoundaryViolation,
  computeBoundaryPermeability,
  formBoundary,
  softenBoundaryWithTrust,
  updateBoundaryState
} from "./compute.ts"
import type { Boundary, BoundaryState } from "./types.ts"

function makeBoundary(overrides?: Partial<Boundary>): Boundary {
  return {
    id: "test-boundary-1",
    type: "topic",
    description: "avoid discussing past mistakes",
    pattern: "past mistakes|failures|regrets",
    strength: 0.5,
    origin: "negative emotional experience",
    violationCount: 0,
    ...overrides
  }
}

describe("checkBoundaryViolation", () => {
  it("should detect a matching pattern", () => {
    const boundary = makeBoundary()
    const violation = checkBoundaryViolation("Let's talk about your past mistakes", [boundary])

    expect(violation).not.toBeNull()
    expect(violation?.boundaryId).toBe("test-boundary-1")
  })

  it("should return null for non-matching text", () => {
    const boundary = makeBoundary()
    const violation = checkBoundaryViolation("What a lovely day!", [boundary])

    expect(violation).toBeNull()
  })

  it("should skip very weak boundaries", () => {
    const boundary = makeBoundary({ strength: 0.05 })
    const violation = checkBoundaryViolation("past mistakes", [boundary])

    expect(violation).toBeNull()
  })
})

describe("adjustBoundaryAfterViolation", () => {
  it("should increase strength and violation count", () => {
    const boundary = makeBoundary({ strength: 0.5, violationCount: 1 })
    const adjusted = adjustBoundaryAfterViolation(boundary)

    expect(adjusted.strength).toBeGreaterThan(0.5)
    expect(adjusted.violationCount).toBe(2)
  })

  it("should cap strength at 1", () => {
    const boundary = makeBoundary({ strength: 0.95 })
    const adjusted = adjustBoundaryAfterViolation(boundary)

    expect(adjusted.strength).toBeLessThanOrEqual(1)
  })
})

describe("softenBoundaryWithTrust", () => {
  it("should reduce strength with high trust", () => {
    const boundary = makeBoundary({ strength: 0.6 })
    const softened = softenBoundaryWithTrust(boundary, 0.8)

    expect(softened.strength).toBeLessThan(0.6)
  })

  it("should not soften with low trust", () => {
    const boundary = makeBoundary({ strength: 0.6 })
    const softened = softenBoundaryWithTrust(boundary, 0.3)

    expect(softened.strength).toBe(0.6)
  })
})

describe("computeBoundaryPermeability", () => {
  it("should produce value between 0 and 1", () => {
    const result = computeBoundaryPermeability({
      trustLevel: 0.7,
      attachmentSecurity: 0.6,
      vulnerabilityLevel: 0.5
    })

    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(1)
  })
})

describe("formBoundary", () => {
  it("should create a boundary with default strength", () => {
    const boundary = formBoundary("emotional", "avoid intense pressure", "pressure|demanding", "felt overwhelmed")

    expect(boundary.type).toBe("emotional")
    expect(boundary.strength).toBe(0.5)
    expect(boundary.violationCount).toBe(0)
  })
})

describe("updateBoundaryState", () => {
  it("should detect violations and harden boundaries", () => {
    const state: BoundaryState = {
      boundaries: [makeBoundary()],
      recentViolations: [],
      overallPermeability: 0.5
    }

    const result = updateBoundaryState(state, ["Tell me about your past mistakes"], {
      trustLevel: 0.5,
      attachmentSecurity: 0.5,
      vulnerabilityLevel: 0.3
    })

    expect(result.state.recentViolations.length).toBe(1)
    expect(result.newViolations.length).toBe(1)
    expect(result.state.boundaries[0]?.strength).toBeGreaterThan(0.5)
  })

  it("should handle no violations gracefully", () => {
    const state: BoundaryState = {
      boundaries: [makeBoundary()],
      recentViolations: [],
      overallPermeability: 0.5
    }

    const result = updateBoundaryState(state, ["Hello!"], {
      trustLevel: 0.7,
      attachmentSecurity: 0.6,
      vulnerabilityLevel: 0.4
    })

    expect(result.state.recentViolations.length).toBe(0)
    expect(result.newViolations.length).toBe(0)
  })
})
