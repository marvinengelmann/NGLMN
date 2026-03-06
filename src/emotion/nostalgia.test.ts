import { subDays } from "date-fns"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NOSTALGIA } from "@/config/constants.ts"
import { detectNostalgia } from "./nostalgia.ts"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("detectNostalgia", () => {
  const now = new Date("2026-03-06T12:00:00Z")

  it("returns null when no episodes are provided", () => {
    expect(detectNostalgia([], now)).toBeNull()
  })

  it("returns null when episodes are too recent", () => {
    const episodes = [
      { metadata: { timestamp: "2026-03-05T12:00:00Z", relevanceScore: 0.8 } }
    ]
    expect(detectNostalgia(episodes, now)).toBeNull()
  })

  it("returns null when episodes have no metadata", () => {
    const episodes = [{ metadata: undefined }]
    expect(detectNostalgia(episodes, now)).toBeNull()
  })

  it("returns null when episodes have no timestamp", () => {
    const episodes = [{ metadata: { relevanceScore: 0.8 } as { timestamp: string; relevanceScore: number } }]
    expect(detectNostalgia(episodes, now)).toBeNull()
  })

  it("returns nostalgia event when old episodes exist and Math.random triggers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const oldDate = subDays(now, NOSTALGIA.AGE_THRESHOLD_DAYS + 10).toISOString()
    const episodes = [{ metadata: { timestamp: oldDate, relevanceScore: 0.8 } }]
    const result = detectNostalgia(episodes, now)
    expect(result).toEqual({ trigger: "nostalgia_wave", intensity: NOSTALGIA.INTENSITY })
  })

  it("returns null when Math.random is above probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    const oldDate = subDays(now, NOSTALGIA.AGE_THRESHOLD_DAYS + 10).toISOString()
    const episodes = [{ metadata: { timestamp: oldDate, relevanceScore: 0.8 } }]
    expect(detectNostalgia(episodes, now)).toBeNull()
  })

  it("handles invalid timestamps gracefully", () => {
    const episodes = [{ metadata: { timestamp: "not-a-date", relevanceScore: 0.5 } }]
    expect(detectNostalgia(episodes, now)).toBeNull()
  })
})
