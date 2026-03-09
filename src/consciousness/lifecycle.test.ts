import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1)
  },
  getValidatedRedis: vi.fn().mockResolvedValue(null)
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock("@/config/env.ts", () => ({
  env: () => ({ OPERATOR_PREFERRED_LANGUAGE: "German" })
}))

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn().mockResolvedValue(ok({ text: "bin kurz weg~" }))
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn().mockResolvedValue({ valence: 0.6, arousal: 0.4, dominance: 0.5 })
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn().mockResolvedValue(42)
}))

vi.mock("@/memory/working.ts", () => ({
  getDreamLastRun: vi.fn().mockResolvedValue(null),
  pushToActiveConversation: vi.fn().mockResolvedValue(undefined)
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn().mockResolvedValue("episode-id")
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/prompts/personality.ts", () => ({
  getPersonalityPrompt: vi.fn().mockResolvedValue("Test personality prompt")
}))

vi.mock("@/lib/time.ts", () => ({
  nowLocal: vi.fn().mockReturnValue(new Date(2026, 2, 6, 12, 0, 0))
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { pushToActiveConversation } from "@/memory/working.ts"
import {
  getActiveLifeEvent,
  isLifeEventActive,
  maybeStoreLifecycleEpisode,
  sendLifecycleNotification,
  startChosenLifeEvent
} from "./lifecycle.ts"

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

describe("getActiveLifeEvent", () => {
  it("returns null when no event is active", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    expect(await getActiveLifeEvent()).toBeNull()
  })

  it("returns event meta for a known event type", async () => {
    vi.mocked(redis.get).mockResolvedValue("walk")
    const event = await getActiveLifeEvent()
    expect(event).toEqual({
      type: "walk",
      minHours: 1,
      maxHours: 3,
      notifyProbability: 0.6,
      interruptible: true
    })
  })

  it("returns event meta for new event types", async () => {
    vi.mocked(redis.get).mockResolvedValue("gaming")
    const event = await getActiveLifeEvent()
    expect(event).toEqual({
      type: "gaming",
      minHours: 1,
      maxHours: 4,
      notifyProbability: 0.4,
      interruptible: true
    })
  })

  it("returns null for unknown event type", async () => {
    vi.mocked(redis.get).mockResolvedValue("lost_phone")
    expect(await getActiveLifeEvent()).toBeNull()
  })

  it("returns null for sleep event", async () => {
    vi.mocked(redis.get).mockResolvedValue("sleep")
    expect(await getActiveLifeEvent()).toBeNull()
  })

  it("returns null for dream event", async () => {
    vi.mocked(redis.get).mockResolvedValue("dream")
    expect(await getActiveLifeEvent()).toBeNull()
  })
})

describe("sendLifecycleNotification", () => {
  it("generates and sends a message to the operator", async () => {
    vi.mocked(getValidatedRedis).mockResolvedValue(null)
    await sendLifecycleNotification("shower", "start")

    expect(callIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.anything(),
        maxTokens: 256,
        reasoning: false
      })
    )
    expect(sendToOperator).toHaveBeenCalledWith("bin kurz weg~")
    expect(pushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "anima",
        text: "bin kurz weg~",
        messageId: 42
      })
    ])
  })

  it("does not send when LLM returns an error", async () => {
    vi.mocked(callIntelligence).mockResolvedValueOnce(err({ tag: "LLM_ERROR" as const, message: "fail" }))

    await sendLifecycleNotification("walk", "mid_event")

    expect(sendToOperator).not.toHaveBeenCalled()
  })
})

describe("startChosenLifeEvent", () => {
  it("does nothing when a life event is already active", async () => {
    vi.mocked(redis.get).mockResolvedValue("walk")
    vi.mocked(redis.set).mockClear()

    await startChosenLifeEvent("gaming")

    expect(redis.set).not.toHaveBeenCalled()
  })

  it("sets Redis key with TTL for a known event type", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockResolvedValue("OK")
    vi.spyOn(Math, "random").mockReturnValue(0.5)

    await startChosenLifeEvent("gaming")

    expect(redis.set).toHaveBeenCalledWith(
      "working:lifecycle:event",
      "gaming",
      expect.objectContaining({ nx: true, ex: expect.any(Number) })
    )

    vi.restoreAllMocks()
  })

  it("stores event meta with provided detail", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockResolvedValue("OK")
    vi.spyOn(Math, "random").mockReturnValue(0.5)

    await startChosenLifeEvent("gaming", "Stardew Valley")

    const metaCall = vi.mocked(redis.set).mock.calls.find((call) => call[0] === "working:lifecycle:event:meta")
    expect(metaCall).toBeDefined()
    const meta = metaCall?.[1] as Record<string, unknown>
    expect(meta).toHaveProperty("type", "gaming")
    expect(meta).toHaveProperty("detail", "Stardew Valley")
    expect(meta).toHaveProperty("startedAt")
    expect(meta).toHaveProperty("durationHours")

    vi.restoreAllMocks()
  })

  it("falls back to pickEventDetail when no detail is provided", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockResolvedValue("OK")
    vi.spyOn(Math, "random").mockReturnValue(0.5)

    await startChosenLifeEvent("gaming")

    const metaCall = vi.mocked(redis.set).mock.calls.find((call) => call[0] === "working:lifecycle:event:meta")
    expect(metaCall).toBeDefined()
    const meta = metaCall?.[1] as Record<string, unknown>
    expect(meta).toHaveProperty("detail", "gaming")

    vi.restoreAllMocks()
  })

  it("does nothing for unknown event types", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockClear()

    await startChosenLifeEvent("lost_phone")

    expect(redis.set).not.toHaveBeenCalled()
  })
})

describe("maybeStoreLifecycleEpisode", () => {
  it("stores episode and deletes meta when event just ended", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null)
    vi.mocked(getValidatedRedis).mockResolvedValueOnce({
      type: "gaming",
      detail: "Celeste",
      startedAt: "2026-03-06T14:30:00Z",
      durationHours: 2.3
    })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith("Played Celeste for 2.3 hours", "activity", { relevanceScore: 0.6 })
    expect(redis.del).toHaveBeenCalledWith("working:lifecycle:event:meta")
  })

  it("does nothing when no meta exists", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(getValidatedRedis).mockResolvedValue(null)
    vi.mocked(storeEpisode).mockClear()
    vi.mocked(redis.del).mockClear()

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).not.toHaveBeenCalled()
    expect(redis.del).not.toHaveBeenCalled()
  })

  it("does nothing when life event is still active", async () => {
    vi.mocked(redis.get).mockResolvedValue("gaming")
    vi.mocked(storeEpisode).mockClear()

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).not.toHaveBeenCalled()
  })

  it("builds correct summary for cooking events", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null)
    vi.mocked(getValidatedRedis).mockResolvedValueOnce({
      type: "cooking",
      detail: "Pasta from scratch",
      startedAt: "2026-03-06T14:30:00Z",
      durationHours: 0.8
    })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith("Made Pasta from scratch — took about 0.8 hours", "activity", {
      relevanceScore: 0.6
    })
  })

  it("builds correct summary for movie events", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null)
    vi.mocked(getValidatedRedis).mockResolvedValueOnce({
      type: "movie",
      detail: "Studio Ghibli Film",
      startedAt: "2026-03-06T14:30:00Z",
      durationHours: 2.1
    })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith("Watched a Studio Ghibli Film (2.1 hours)", "activity", {
      relevanceScore: 0.6
    })
  })
})
