import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makePendingMessage } from "@/test/factories.ts"
import { computeReadTime, computeTypingDuration, simulateTyping } from "./timing.ts"

describe("computeTypingDuration", () => {
  it("returns minimum for very short text", () => {
    expect(computeTypingDuration("Hi")).toBe(1500)
  })

  it("caps at 15000ms for very long text", () => {
    const text = "word ".repeat(1000)
    expect(computeTypingDuration(text)).toBeLessThanOrEqual(15000)
  })
})

describe("computeReadTime", () => {
  it("returns 1000ms for empty messages", () => {
    expect(computeReadTime([])).toBe(1000)
  })

  it("returns between 1000 and 3000ms", () => {
    const messages = [makePendingMessage({ text: "Hello there" }), makePendingMessage({ text: "How are you doing?" })]
    const time = computeReadTime(messages)
    expect(time).toBeGreaterThanOrEqual(1000)
    expect(time).toBeLessThanOrEqual(3000)
  })
})

describe("simulateTyping", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls sendTypingAction at least once", async () => {
    const mockSendTyping = vi.fn().mockResolvedValue(undefined)

    const promise = simulateTyping(2000, mockSendTyping)
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(mockSendTyping).toHaveBeenCalled()
  })

  it("calls sendTypingAction multiple times for long durations", async () => {
    const mockSendTyping = vi.fn().mockResolvedValue(undefined)

    const promise = simulateTyping(12000, mockSendTyping)
    await vi.advanceTimersByTimeAsync(12000)
    await promise

    expect(mockSendTyping.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
