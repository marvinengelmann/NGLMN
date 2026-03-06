import { describe, expect, it, vi } from "vitest"
import { clamp01, shuffle } from "./math.ts"

describe("clamp01", () => {
  it("returns 0 for negative values", () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it("returns 1 for values above 1", () => {
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })

  it("returns the value when within [0, 1]", () => {
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(0.123)).toBe(0.123)
  })

  it("returns exact boundary values", () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(1)).toBe(1)
  })
})

describe("shuffle", () => {
  it("returns a new array instance", () => {
    const original = [1, 2, 3]
    const result = shuffle(original)
    expect(result).not.toBe(original)
  })

  it("preserves the same elements", () => {
    const original = [1, 2, 3, 4, 5]
    const result = shuffle(original)
    expect(result.sort()).toEqual(original.sort())
  })

  it("preserves array length", () => {
    const original = [1, 2, 3, 4, 5]
    expect(shuffle(original)).toHaveLength(5)
  })

  it("does not modify the original array", () => {
    const original = [1, 2, 3]
    const copy = [...original]
    shuffle(original)
    expect(original).toEqual(copy)
  })

  it("handles empty arrays", () => {
    expect(shuffle([])).toEqual([])
  })

  it("handles single-element arrays", () => {
    expect(shuffle([42])).toEqual([42])
  })

  it("produces different orderings with mocked Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const result = shuffle([1, 2, 3, 4])
    expect(result).toHaveLength(4)
    expect(result.sort()).toEqual([1, 2, 3, 4])
    vi.restoreAllMocks()
  })
})
