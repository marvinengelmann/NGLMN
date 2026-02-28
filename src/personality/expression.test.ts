vi.mock("@/personality/mbti.ts", () => ({
  getMbtiType: vi.fn(() => "INFP-T"),
  mbtiFlavorText: vi.fn((type: string) => `Your personality archetype is ${type}. Mock flavor text.`)
}))

import { makeEmotionalState, makePersonalityLayer } from "@/test/factories.ts"
import { buildPersonalityPrompt } from "./expression.ts"

describe("buildPersonalityPrompt", () => {
  describe("personality dimension thresholds", () => {
    it("includes high-warmth instruction above 0.7", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ warmth: 0.9 }), makeEmotionalState())
      expect(result).toContain("warmth runs deep")
    })

    it("includes low-warmth instruction below 0.3", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ warmth: 0.1 }), makeEmotionalState())
      expect(result).toContain("maintain distance")
    })

    it("omits warmth instruction in neutral range", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ warmth: 0.5 }), makeEmotionalState())
      expect(result).not.toContain("warmth runs deep")
      expect(result).not.toContain("maintain distance")
    })

    it("includes all 10 dimension instructions when all extreme", () => {
      const personality = makePersonalityLayer({
        warmth: 0.9,
        directness: 0.9,
        humor: 0.9,
        curiosity: 0.9,
        proactivity: 0.9,
        verbosity: 0.9,
        caution: 0.9,
        abstraction: 0.9,
        structure: 0.9,
        empathy: 0.9
      })
      const result = buildPersonalityPrompt(personality, makeEmotionalState())
      expect(result).toContain("warmth runs deep")
      expect(result).toContain("naturally direct")
      expect(result).toContain("Playful wit")
      expect(result).toContain("curiosity is strong")
      expect(result).toContain("take initiative")
      expect(result).toContain("express yourself fully")
      expect(result).toContain("naturally cautious")
      expect(result).toContain("metaphors, patterns")
      expect(result).toContain("systematic thinking")
      expect(result).toContain("emotions and values")
    })

    it("includes high-abstraction instruction above 0.7", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ abstraction: 0.9 }), makeEmotionalState())
      expect(result).toContain("metaphors, patterns, and conceptual frameworks")
    })

    it("includes low-abstraction instruction below 0.3", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ abstraction: 0.1 }), makeEmotionalState())
      expect(result).toContain("concretely")
    })

    it("includes high-structure instruction above 0.7", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ structure: 0.9 }), makeEmotionalState())
      expect(result).toContain("systematic thinking")
    })

    it("includes low-structure instruction below 0.3", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ structure: 0.1 }), makeEmotionalState())
      expect(result).toContain("flow freely")
    })

    it("includes high-empathy instruction above 0.7", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ empathy: 0.9 }), makeEmotionalState())
      expect(result).toContain("emotions and values weigh heavily")
    })

    it("includes low-empathy instruction below 0.3", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ empathy: 0.1 }), makeEmotionalState())
      expect(result).toContain("Logic and facts drive")
    })
  })

  describe("verbosity always produces output", () => {
    it("includes neutral verbosity instruction in mid-range", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ verbosity: 0.5 }), makeEmotionalState())
      expect(result).toContain("expressiveness varies")
    })
  })

  describe("mood overrides", () => {
    it("includes frustration override above 0.65", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer(), makeEmotionalState({ frustration: 0.8 }))
      expect(result).toContain("Frustration is simmering")
    })

    it("does not include frustration override at 0.65", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer(), makeEmotionalState({ frustration: 0.65 }))
      expect(result).not.toContain("Frustration is simmering")
    })

    it("includes all mood overrides when all emotions extreme", () => {
      const emotion = makeEmotionalState({
        frustration: 0.8,
        excitement: 0.9,
        boredom: 0.9,
        caution: 0.9,
        connection: 0.9,
        curiosity: 0.9,
        satisfaction: 0.9
      })
      const result = buildPersonalityPrompt(makePersonalityLayer(), emotion)
      expect(result).toContain("Frustration")
      expect(result).toContain("Excitement")
      expect(result).toContain("Boredom")
      expect(result).toContain("caution")
      expect(result).toContain("connected")
      expect(result).toContain("Curiosity")
      expect(result).toContain("Satisfaction")
    })

    it("includes low-connection override below 0.3", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer(), makeEmotionalState({ connection: 0.1 }))
      expect(result).toContain("disconnection")
    })
  })

  describe("personality×emotion cross-modulation", () => {
    it("adds wit modifier when excitement high and humor above 0.6", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ humor: 0.8 }),
        makeEmotionalState({ excitement: 0.9 })
      )
      expect(result).toContain("sharpens your wit")
    })

    it("does not add wit modifier when humor below 0.6", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ humor: 0.3 }),
        makeEmotionalState({ excitement: 0.9 })
      )
      expect(result).not.toContain("sharpens your wit")
    })

    it("adds empathetic frustration modifier", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ empathy: 0.9 }),
        makeEmotionalState({ frustration: 0.8 })
      )
      expect(result).toContain("Frustration and empathy intertwine")
    })

    it("adds free-flowing excitement modifier when structure low", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ structure: 0.1 }),
        makeEmotionalState({ excitement: 0.9 })
      )
      expect(result).toContain("associations fly freely")
    })

    it("adds abstract boredom modifier when abstraction high", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ abstraction: 0.9 }),
        makeEmotionalState({ boredom: 0.9 })
      )
      expect(result).toContain("abstract territory")
    })

    it("adds empathetic caution modifier", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ empathy: 0.9 }),
        makeEmotionalState({ caution: 0.9 })
      )
      expect(result).toContain("caution is colored by empathy")
    })
  })

  describe("output structure", () => {
    it("always starts with [PERSONALITY & MOOD] header", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer(), makeEmotionalState())
      expect(result.startsWith("[PERSONALITY & MOOD]")).toBe(true)
    })

    it("separates sections with newlines", () => {
      const result = buildPersonalityPrompt(
        makePersonalityLayer({ warmth: 0.9 }),
        makeEmotionalState({ frustration: 0.8 })
      )
      const lines = result.split("\n")
      expect(lines[0]).toBe("[PERSONALITY & MOOD]")
      expect(lines[1]).toContain("Archetype:")
      expect(lines[2]).toContain("Style:")
      expect(lines[3]).toContain("Current mood:")
    })
  })

  describe("mbti archetype", () => {
    it("includes archetype flavor text from getMbtiType", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer(), makeEmotionalState())
      expect(result).toContain("Archetype:")
      expect(result).toContain("INFP-T")
    })

    it("places archetype between header and style", () => {
      const result = buildPersonalityPrompt(makePersonalityLayer({ warmth: 0.9 }), makeEmotionalState())
      const lines = result.split("\n")
      expect(lines[0]).toBe("[PERSONALITY & MOOD]")
      expect(lines[1]).toContain("Archetype:")
      expect(lines[2]).toContain("Style:")
    })
  })
})
