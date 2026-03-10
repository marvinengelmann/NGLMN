import { describe, expect, it } from "vitest"
import { RELATIONSHIP_PHASES } from "./constants.ts"
import { computeRelationshipPhase, shouldTransitionPhase } from "./phases.ts"

describe("computeRelationshipPhase", () => {
  it("returns discovering for low interaction count", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 10,
        daysSinceFirst: 3,
        connectionAvg: 0.5,
        conflicts: 0,
        trust: 0.3,
        attachmentSecurity: 0.4,
        currentPhase: "discovering"
      })
    ).toBe("discovering")
  })

  it("returns honeymoon for moderate interactions with high connection", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: RELATIONSHIP_PHASES.DISCOVERING_INTERACTIONS,
        daysSinceFirst: 14,
        connectionAvg: RELATIONSHIP_PHASES.HONEYMOON_CONNECTION + 0.1,
        conflicts: 0,
        trust: 0.5,
        attachmentSecurity: 0.5,
        currentPhase: "discovering"
      })
    ).toBe("honeymoon")
  })

  it("returns first_tensions when conflicts arise with low connection", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 100,
        daysSinceFirst: 30,
        connectionAvg: RELATIONSHIP_PHASES.TENSIONS_CONNECTION - 0.1,
        conflicts: RELATIONSHIP_PHASES.TENSIONS_MIN_CONFLICTS,
        trust: 0.4,
        attachmentSecurity: 0.4,
        currentPhase: "honeymoon"
      })
    ).toBe("first_tensions")
  })

  it("returns deepening when conflicts exist with high connection and trust", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 150,
        daysSinceFirst: 40,
        connectionAvg: RELATIONSHIP_PHASES.DEEPENING_CONNECTION + 0.1,
        conflicts: RELATIONSHIP_PHASES.TENSIONS_MIN_CONFLICTS,
        trust: RELATIONSHIP_PHASES.DEEPENING_TRUST + 0.1,
        attachmentSecurity: 0.5,
        currentPhase: "first_tensions"
      })
    ).toBe("deepening")
  })

  it("returns comfortable for long relationship with high security and few conflicts", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 500,
        daysSinceFirst: RELATIONSHIP_PHASES.COMFORTABLE_DAYS + 1,
        connectionAvg: 0.6,
        conflicts: 2,
        trust: 0.7,
        attachmentSecurity: RELATIONSHIP_PHASES.COMFORTABLE_SECURITY + 0.1,
        currentPhase: "deepening"
      })
    ).toBe("comfortable")
  })

  it("returns deepening over comfortable when conflicts are present", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 500,
        daysSinceFirst: RELATIONSHIP_PHASES.COMFORTABLE_DAYS + 1,
        connectionAvg: 0.6,
        conflicts: 5,
        trust: 0.7,
        attachmentSecurity: RELATIONSHIP_PHASES.COMFORTABLE_SECURITY + 0.1,
        currentPhase: "comfortable"
      })
    ).toBe("deepening")
  })

  it("returns first_tensions over comfortable when connection drops", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 500,
        daysSinceFirst: RELATIONSHIP_PHASES.COMFORTABLE_DAYS + 1,
        connectionAvg: 0.3,
        conflicts: 5,
        trust: 0.3,
        attachmentSecurity: RELATIONSHIP_PHASES.COMFORTABLE_SECURITY + 0.1,
        currentPhase: "comfortable"
      })
    ).toBe("first_tensions")
  })

  it("returns renewal when comfortable with connection spike", () => {
    expect(
      computeRelationshipPhase({
        interactionCount: 500,
        daysSinceFirst: 90,
        connectionAvg: RELATIONSHIP_PHASES.RENEWAL_CONNECTION_SPIKE + 0.1,
        conflicts: 5,
        trust: 0.8,
        attachmentSecurity: 0.8,
        currentPhase: "comfortable"
      })
    ).toBe("renewal")
  })
})

describe("shouldTransitionPhase", () => {
  it("returns false when current and computed are the same", () => {
    expect(shouldTransitionPhase("discovering", "discovering", 100)).toBe(false)
  })

  it("returns false when ticks are below MIN_PHASE_TICKS", () => {
    expect(shouldTransitionPhase("discovering", "honeymoon", RELATIONSHIP_PHASES.MIN_PHASE_TICKS - 1)).toBe(false)
  })

  it("returns true when phases differ and ticks meet minimum", () => {
    expect(shouldTransitionPhase("discovering", "honeymoon", RELATIONSHIP_PHASES.MIN_PHASE_TICKS)).toBe(true)
  })

  it("returns true when ticks exceed minimum", () => {
    expect(shouldTransitionPhase("honeymoon", "first_tensions", RELATIONSHIP_PHASES.MIN_PHASE_TICKS + 10)).toBe(true)
  })
})
