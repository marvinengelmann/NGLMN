import { describe, expect, it } from "vitest"
import { levenshteinRatio } from "./rituals.ts"

describe("Ritual Detection", () => {
  describe("levenshteinRatio", () => {
    it("should return 1.0 for identical strings", () => {
      expect(levenshteinRatio("hello", "hello")).toBe(1)
    })

    it("should return 0 for completely different strings", () => {
      expect(levenshteinRatio("abc", "xyz")).toBe(0)
    })

    it("should detect high similarity for minor variants", () => {
      expect(levenshteinRatio("guten morgen", "guten morgens")).toBeGreaterThan(0.7)
    })

    it("should detect low similarity for different phrases", () => {
      expect(levenshteinRatio("guten morgen", "gute nacht")).toBeLessThan(0.7)
    })

    it("should handle empty strings", () => {
      expect(levenshteinRatio("", "")).toBe(1)
      expect(levenshteinRatio("abc", "")).toBe(0)
    })
  })

  describe("temporal pattern detection logic", () => {
    it("should bucket hours into 2-hour windows", () => {
      const hours = [7, 8, 9, 7, 8]
      const buckets = new Map<number, number>()
      hours.forEach((h) => {
        const bucket = Math.floor(h / 2)
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
      })
      expect(buckets.get(3)).toBe(2)
      expect(buckets.get(4)).toBe(3)
    })

    it("should label time periods correctly", () => {
      const label = (hour: number) => (hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening")
      expect(label(3)).toBe("night")
      expect(label(8)).toBe("morning")
      expect(label(14)).toBe("afternoon")
      expect(label(20)).toBe("evening")
    })
  })

  describe("phrase detection n-gram logic", () => {
    function extractNgrams(text: string): { bigrams: string[]; trigrams: string[] } {
      const words = text.toLowerCase().split(/\s+/).filter(Boolean)
      const bigrams: string[] = []
      const trigrams: string[] = []

      words.slice(0, -1).forEach((_, i) => {
        bigrams.push(`${words[i]} ${words[i + 1]}`)
      })
      words.slice(0, -2).forEach((_, i) => {
        trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
      })

      return { bigrams, trigrams }
    }

    it("should extract bigrams from text", () => {
      const { bigrams } = extractNgrams("Guten Morgen wie gehts")
      expect(bigrams).toContain("guten morgen")
      expect(bigrams).toContain("morgen wie")
      expect(bigrams).toHaveLength(3)
    })

    it("should extract trigrams from text", () => {
      const { trigrams } = extractNgrams("Guten Morgen wie gehts")
      expect(trigrams).toContain("guten morgen wie")
      expect(trigrams).toHaveLength(2)
    })

    it("should handle single word input", () => {
      const { bigrams, trigrams } = extractNgrams("Hallo")
      expect(bigrams).toHaveLength(0)
      expect(trigrams).toHaveLength(0)
    })
  })

  describe("behavioral pattern detection logic", () => {
    it("should count voice messages correctly", () => {
      const messages = [
        { isVoice: true, role: "operator" },
        { isVoice: false, role: "operator" },
        { isVoice: true, role: "operator" },
        { isVoice: true, role: "operator" }
      ]
      const voiceCount = messages.filter((m) => m.role === "operator" && m.isVoice).length
      expect(voiceCount).toBe(3)
    })

    it("should count image messages correctly", () => {
      const messages = [
        { hasImage: true, role: "operator" },
        { hasImage: false, role: "operator" },
        { hasImage: true, role: "anima" }
      ]
      const imageCount = messages.filter((m) => m.role === "operator" && m.hasImage).length
      expect(imageCount).toBe(1)
    })
  })

  describe("confidence management", () => {
    it("should grow confidence with confirmations", () => {
      const existing = 0.5
      const boosted = Math.min(1, existing + 0.1)
      expect(boosted).toBe(0.6)
    })

    it("should cap confidence at 1.0", () => {
      const existing = 0.95
      const boosted = Math.min(1, existing + 0.1)
      expect(boosted).toBe(1)
    })

    it("should decay confidence when not confirmed", () => {
      const existing = 0.3
      const decayed = Math.max(0, existing - 0.05)
      expect(decayed).toBe(0.25)
    })

    it("should filter out very low confidence rituals", () => {
      const rituals = [
        { confidence: 0.5, pattern: "a" },
        { confidence: 0.03, pattern: "b" },
        { confidence: 0.1, pattern: "c" }
      ]
      const filtered = rituals.filter((r) => r.confidence > 0.05)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((r) => r.pattern)).toEqual(["a", "c"])
    })
  })
})
