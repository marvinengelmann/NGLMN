import { afterEach, describe, expect, it, vi } from "vitest"
import { THINKING, TYPING } from "./constants.ts"
import { computeInterParagraphPause, computeTypingDuration, splitIntoParagraphs } from "./timing.ts"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("computeTypingDuration", () => {
  it("returns at least MIN_MS for short text", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    expect(computeTypingDuration("hi")).toBeGreaterThanOrEqual(TYPING.MIN_MS)
  })

  it("returns at most MAX_MS for very long text", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const longText = "word ".repeat(500)
    expect(computeTypingDuration(longText)).toBeLessThanOrEqual(TYPING.MAX_MS)
  })

  it("returns a deterministic value when Math.random is fixed at 0.5 (jitter = 1)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const text = "one two three four five"
    const result1 = computeTypingDuration(text)
    const result2 = computeTypingDuration(text)
    expect(result1).toBe(result2)
  })

  it("scales with word count", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const short = computeTypingDuration("hello world")
    const long = computeTypingDuration("hello world this is a much longer sentence with more words")
    expect(long).toBeGreaterThanOrEqual(short)
  })
})

describe("splitIntoParagraphs", () => {
  it("returns single-element array for short text", () => {
    expect(splitIntoParagraphs("Short text")).toEqual(["Short text"])
  })

  it("returns original text if below MIN_SPLIT_LENGTH", () => {
    const text = "a".repeat(THINKING.MIN_SPLIT_LENGTH - 1)
    expect(splitIntoParagraphs(text)).toEqual([text])
  })

  it("splits text on double newlines", () => {
    const p1 = "a".repeat(100)
    const p2 = "b".repeat(100)
    const text = `${p1}\n\n${p2}`
    expect(splitIntoParagraphs(text)).toEqual([p1, p2])
  })

  it("returns original text when no paragraph breaks exist", () => {
    const text = "a".repeat(250)
    expect(splitIntoParagraphs(text)).toEqual([text])
  })

  it("handles multiple consecutive newlines", () => {
    const p1 = "a".repeat(100)
    const p2 = "b".repeat(100)
    const text = `${p1}\n\n\n\n${p2}`
    expect(splitIntoParagraphs(text)).toEqual([p1, p2])
  })
})

describe("computeInterParagraphPause", () => {
  it("returns value within expected range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const pause = computeInterParagraphPause()
    expect(pause).toBeGreaterThanOrEqual(THINKING.INTER_PARAGRAPH_MIN_MS)
    expect(pause).toBeLessThanOrEqual(THINKING.INTER_PARAGRAPH_MAX_MS)
  })

  it("returns min when Math.random returns 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(computeInterParagraphPause()).toBe(THINKING.INTER_PARAGRAPH_MIN_MS)
  })
})
