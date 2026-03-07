import { describe, expect, it, vi } from "vitest"
import { pickEventDetail } from "./lifecycle-details.ts"

const KNOWN_EVENT_TYPES = [
  "gaming",
  "cooking",
  "movie",
  "music",
  "drawing",
  "reading",
  "shower",
  "walk",
  "nap",
  "deep_focus",
  "exercise",
  "errands",
  "cleaning",
  "bath",
  "socializing",
  "lost_phone"
]

describe("pickEventDetail", () => {
  it("returns a non-empty string for all known event types", () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const detail = pickEventDetail(type)
      expect(detail).toBeTruthy()
      expect(typeof detail).toBe("string")
    }
  })

  it("returns the event type itself for unknown types", () => {
    expect(pickEventDetail("unknown_event")).toBe("unknown_event")
  })

  it("picks from the pool using Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const first = pickEventDetail("gaming")

    vi.spyOn(Math, "random").mockReturnValue(0.999)
    const last = pickEventDetail("gaming")

    expect(first).not.toBe(last)
    vi.restoreAllMocks()
  })
})
