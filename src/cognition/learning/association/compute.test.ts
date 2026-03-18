import { describe, expect, it } from "vitest"
import {
  decayAssociation,
  extractEmotionLabels,
  extractStimuliFromContext,
  findCoactivations,
  processHebbianCycle,
  pruneWeakAssociations,
  queryImplicitAssociations,
  strengthenAssociation
} from "./compute.ts"
import { HEBBIAN } from "./constants.ts"
import type { HebbianAssociation } from "./types.ts"

function makeAssociation(overrides: Partial<HebbianAssociation> = {}): HebbianAssociation {
  return {
    id: "test-id",
    stimulusA: "topic:work",
    stimulusB: "emotion:frustration",
    strength: 0.5,
    coactivationCount: 10,
    lastCoactivatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe("strengthenAssociation", () => {
  it("increases strength with diminishing returns", () => {
    const weak = makeAssociation({ strength: 0.1 })
    const strong = makeAssociation({ strength: 0.8 })

    const weakResult = strengthenAssociation(weak)
    const strongResult = strengthenAssociation(strong)

    const weakGain = weakResult.strength - weak.strength
    const strongGain = strongResult.strength - strong.strength

    expect(weakGain).toBeGreaterThan(strongGain)
  })

  it("increments coactivation count", () => {
    const result = strengthenAssociation(makeAssociation({ coactivationCount: 5 }))
    expect(result.coactivationCount).toBe(6)
  })

  it("does not exceed MAX_STRENGTH", () => {
    const result = strengthenAssociation(makeAssociation({ strength: HEBBIAN.MAX_STRENGTH }))
    expect(result.strength).toBeLessThanOrEqual(HEBBIAN.MAX_STRENGTH)
  })
})

describe("decayAssociation", () => {
  it("reduces strength proportional to days elapsed", () => {
    const assoc = makeAssociation({ strength: 0.5 })
    const result = decayAssociation(assoc, 10)
    expect(result.strength).toBeLessThan(0.5)
    expect(result.strength).toBe(0.5 - HEBBIAN.LTD_RATE * 10)
  })

  it("does not go below 0", () => {
    const assoc = makeAssociation({ strength: 0.001 })
    const result = decayAssociation(assoc, 100)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })
})

describe("extractStimuliFromContext", () => {
  it("extracts time-of-day label", () => {
    const stimuli = extractStimuliFromContext({
      hourOfDay: 20,
      messageTopics: [],
      emotionLabels: [],
      operatorMood: "unknown",
      currentAction: "idle",
      entityNames: []
    })
    expect(stimuli).toContain("time:evening")
  })

  it("includes message topics", () => {
    const stimuli = extractStimuliFromContext({
      hourOfDay: 10,
      messageTopics: ["work", "stress"],
      emotionLabels: [],
      operatorMood: "unknown",
      currentAction: "idle",
      entityNames: []
    })
    expect(stimuli).toContain("topic:work")
    expect(stimuli).toContain("topic:stress")
  })

  it("excludes idle action", () => {
    const stimuli = extractStimuliFromContext({
      hourOfDay: 10,
      messageTopics: [],
      emotionLabels: [],
      operatorMood: "unknown",
      currentAction: "idle",
      entityNames: []
    })
    expect(stimuli.some((s) => s.startsWith("action:"))).toBe(false)
  })

  it("excludes unknown operator mood", () => {
    const stimuli = extractStimuliFromContext({
      hourOfDay: 10,
      messageTopics: [],
      emotionLabels: [],
      operatorMood: "unknown",
      currentAction: "idle",
      entityNames: []
    })
    expect(stimuli.some((s) => s.startsWith("operator_mood:"))).toBe(false)
  })
})

describe("extractEmotionLabels", () => {
  it("returns emotions above 0.5", () => {
    const labels = extractEmotionLabels({
      curiosity: 0.8,
      satisfaction: 0.3,
      frustration: 0.6,
      boredom: 0.1,
      excitement: 0.2,
      caution: 0.4,
      connection: 0.9,
      confidence: 0.5,
      energy: 0.7
    })
    expect(labels).toContain("curiosity")
    expect(labels).toContain("frustration")
    expect(labels).toContain("connection")
    expect(labels).toContain("energy")
    expect(labels).not.toContain("satisfaction")
    expect(labels).not.toContain("boredom")
  })
})

describe("findCoactivations", () => {
  it("finds pairs among current stimuli as simultaneous", () => {
    const pairs = findCoactivations(["a", "b", "c"], [])
    expect(pairs.length).toBe(3)
    expect(pairs.every((p) => p.timing === "simultaneous")).toBe(true)
  })

  it("finds cross-pairs with recent history", () => {
    const pairs = findCoactivations(["a"], [["b", "c"]])
    expect(pairs.some((p) => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"))).toBe(true)
  })

  it("does not duplicate pairs", () => {
    const pairs = findCoactivations(["a", "b"], [["a", "b"]])
    const keys = pairs.map((p) => `${p.a}|${p.b}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("marks cross-tick pairs with forward/backward timing", () => {
    const pairs = findCoactivations(["current"], [["previous"]])
    const crossPair = pairs.find((p) => p.a !== p.b)
    expect(crossPair).toBeDefined()
    expect(crossPair?.timing).not.toBe("simultaneous")
  })
})

describe("queryImplicitAssociations", () => {
  it("returns primed stimuli above threshold", () => {
    const associations = [
      makeAssociation({ stimulusA: "time:evening", stimulusB: "topic:stress", strength: 0.6 }),
      makeAssociation({ stimulusA: "time:evening", stimulusB: "topic:relax", strength: 0.05 })
    ]
    const result = queryImplicitAssociations(["time:evening"], associations)
    expect(result.length).toBe(1)
    expect(result[0]?.stimulusB).toBe("topic:stress")
  })

  it("returns empty when no stimuli match", () => {
    const associations = [makeAssociation({ stimulusA: "time:morning", stimulusB: "topic:work", strength: 0.8 })]
    const result = queryImplicitAssociations(["time:evening"], associations)
    expect(result.length).toBe(0)
  })

  it("excludes associations where both sides are present", () => {
    const associations = [makeAssociation({ stimulusA: "a", stimulusB: "b", strength: 0.8 })]
    const result = queryImplicitAssociations(["a", "b"], associations)
    expect(result.length).toBe(0)
  })

  it("sorts by activation strength descending", () => {
    const associations = [
      makeAssociation({ stimulusA: "a", stimulusB: "b", strength: 0.3 }),
      makeAssociation({ stimulusA: "a", stimulusB: "c", strength: 0.8 })
    ]
    const result = queryImplicitAssociations(["a"], associations)
    expect(result[0]?.stimulusB).toBe("c")
  })
})

describe("pruneWeakAssociations", () => {
  it("removes associations below MIN_STRENGTH", () => {
    const associations = [makeAssociation({ strength: 0.005 }), makeAssociation({ strength: 0.5, id: "keep" })]
    const result = pruneWeakAssociations(associations)
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe("keep")
  })

  it("caps at MAX_ASSOCIATIONS", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      makeAssociation({ id: `id-${i}`, strength: 0.1 + (i / 250) * 0.5 })
    )
    const result = pruneWeakAssociations(many)
    expect(result.length).toBeLessThanOrEqual(HEBBIAN.MAX_ASSOCIATIONS)
  })
})

describe("processHebbianCycle", () => {
  it("creates new associations from coactivations", () => {
    const result = processHebbianCycle([], ["a", "b"], [])
    expect(result.length).toBe(1)
    expect(result[0]?.strength).toBe(HEBBIAN.LTP_INCREMENT)
  })

  it("strengthens existing associations", () => {
    const existing = [makeAssociation({ stimulusA: "a", stimulusB: "b", strength: 0.3 })]
    const result = processHebbianCycle(existing, ["a", "b"], [])
    expect(result[0]?.strength).toBeGreaterThan(0.3)
  })

  it("returns unchanged associations when no coactivations", () => {
    const existing = [makeAssociation()]
    const result = processHebbianCycle(existing, ["only_one"], [])
    expect(result.length).toBe(1)
    expect(result[0]?.strength).toBe(existing[0]?.strength)
  })
})
