import { describe, expect, it, vi } from "vitest"
import type { EmotionalState } from "@/emotion/types.ts"

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1)
  }
}))

vi.mock("@/lib/time.ts", () => {
  const { TZDate } = require("@date-fns/tz")
  return {
    nowLocal: vi.fn(() => new TZDate("2025-06-15T10:00:00", "Europe/Berlin"))
  }
})

vi.mock("@/memory/working.ts", () => ({
  getDriftThrottle: vi.fn().mockResolvedValue("none"),
  getDreamLastRun: vi.fn().mockResolvedValue(new Date().toISOString())
}))

vi.mock("@/db/client.ts", () => ({
  db: {}
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn().mockResolvedValue(1)
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn().mockResolvedValue({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.5,
    boredom: 0.5,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5,
    confidence: 0.5,
    energy: 0.5
  })
}))

import { TZDate } from "@date-fns/tz"
import { redis } from "@/integrations/redis.ts"
import { nowLocal } from "@/lib/time.ts"
import { computeSkipProbability, recordActiveTick } from "./gating.ts"

const baseEmotion: EmotionalState = {
  curiosity: 0.5,
  satisfaction: 0.5,
  frustration: 0.5,
  boredom: 0.5,
  excitement: 0.5,
  caution: 0.5,
  connection: 0.5,
  confidence: 0.5,
  energy: 0.5
}

describe("computeSkipProbability", () => {
  it("returns 0 when in conversation", async () => {
    const result = await computeSkipProbability(baseEmotion, true, false)
    expect(result).toBe(0)
  })

  it("returns 0 when there are pending messages", async () => {
    const result = await computeSkipProbability(baseEmotion, false, true)
    expect(result).toBe(0)
  })

  it("returns a value between 0 and max skip", async () => {
    const result = await computeSkipProbability(baseEmotion, false, false)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(0.8)
  })

  it("applies night-time modulation (higher skip)", async () => {
    vi.mocked(nowLocal).mockReturnValue(new TZDate("2025-06-15T03:00:00", "Europe/Berlin"))
    const nightResult = await computeSkipProbability(baseEmotion, false, false)

    vi.mocked(nowLocal).mockReturnValue(new TZDate("2025-06-15T08:00:00", "Europe/Berlin"))
    const morningResult = await computeSkipProbability(baseEmotion, false, false)

    expect(nightResult).toBeGreaterThan(morningResult)
  })

  it("increases skip after burst cooldown", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null)
    const baseResult = await computeSkipProbability(baseEmotion, false, false)

    vi.mocked(redis.get).mockResolvedValueOnce("3")
    const cooldownResult = await computeSkipProbability(baseEmotion, false, false)

    expect(cooldownResult).toBeGreaterThan(baseResult)
  })
})

describe("recordActiveTick", () => {
  it("sets burst cooldown in Redis", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    await recordActiveTick()
    expect(redis.set).toHaveBeenCalledWith(
      "working:gating:burstCooldown",
      expect.any(Number),
      expect.objectContaining({ ex: expect.any(Number) })
    )
    vi.restoreAllMocks()
  })
})
