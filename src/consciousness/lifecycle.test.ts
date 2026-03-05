import { describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK")
  }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { redis } from "@/integrations/redis.ts"
import { isLifeEventActive, maybeStartLifeEvent } from "./lifecycle.ts"

describe("isLifeEventActive", () => {
  it("returns false when no Redis key is set", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    expect(await isLifeEventActive()).toBe(false)
  })

  it("returns true when Redis key exists", async () => {
    vi.mocked(redis.get).mockResolvedValue("shower")
    expect(await isLifeEventActive()).toBe(true)
  })
})

describe("maybeStartLifeEvent", () => {
  it("returns true without starting new event when one is already active", async () => {
    vi.mocked(redis.get).mockResolvedValue("walk")
    const result = await maybeStartLifeEvent()
    expect(result).toBe(true)
    expect(redis.set).not.toHaveBeenCalled()
  })

  it("starts a life event when random is below probability", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    const result = await maybeStartLifeEvent()
    expect(result).toBe(false)

    vi.restoreAllMocks()
  })

  it("sets Redis key with TTL when event starts", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    await maybeStartLifeEvent()

    expect(redis.set).toHaveBeenCalledWith(
      "working:lifecycle:event",
      expect.any(String),
      expect.objectContaining({ ex: expect.any(Number) })
    )

    vi.restoreAllMocks()
  })
})
