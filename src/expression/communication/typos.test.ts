import { describe, expect, it, vi } from "vitest"
import { maybeIntroduceTypo } from "./typos.ts"

describe("maybeIntroduceTypo", () => {
  it("returns unchanged text for short strings", () => {
    const result = maybeIntroduceTypo("hi there", "casual")
    expect(result.text).toBe("hi there")
    expect(result.correction).toBeNull()
  })

  it("returns unchanged text when random exceeds probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    const result = maybeIntroduceTypo("this is a longer text for testing typos", "casual")
    expect(result.text).toBe("this is a longer text for testing typos")
    expect(result.correction).toBeNull()
    vi.restoreAllMocks()
  })

  it("introduces a typo when random is low enough", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)

    const input = "this is a longer text for testing purposes here"
    const result = maybeIntroduceTypo(input, "casual")

    expect(result.text !== input || result.correction === null).toBe(true)

    vi.restoreAllMocks()
  })

  it("respects different register probabilities", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.04)
    const input = "this is a test string with enough words for typo"

    const elaborateResult = maybeIntroduceTypo(input, "elaborate")
    expect(elaborateResult.correction).toBeNull()

    vi.restoreAllMocks()
  })

  it("does not modify text with fewer than 3 words", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const result = maybeIntroduceTypo("longwordthatismorethan15", "casual")
    expect(result.correction).toBeNull()
    vi.restoreAllMocks()
  })

  it("does not always correct typos — most are left uncorrected", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)

    const result = maybeIntroduceTypo("one two three four five six seven", "playful")

    expect(result.text).not.toBe("one two three four five six seven")
    expect(result.correction).toBeNull()
    vi.restoreAllMocks()
  })

  it("occasionally corrects a typo when correction roll is low", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)

    const result = maybeIntroduceTypo("one two three four five six seven", "playful")

    expect(result.text).not.toBe("one two three four five six seven")
    expect(result.correction).not.toBeNull()
    expect(result.correction).toMatch(/^\*/)
    vi.restoreAllMocks()
  })
})
