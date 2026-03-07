import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1)
  }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock("@/config/env.ts", () => ({
  env: () => ({ OPERATOR_PREFERRED_LANGUAGE: "German", PERSONALITY_TYPE: "INFJ" })
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
  PERSONALITY_PROMPT: "Test personality prompt"
}))

vi.mock("@/lib/time.ts", () => ({
  nowLocal: vi.fn().mockReturnValue(new Date(2026, 2, 6, 12, 0, 0))
}))

vi.mock("@/consciousness/lifecycle-details.ts", () => ({
  pickEventDetail: vi.fn().mockReturnValue("Celeste")
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { redis } from "@/integrations/redis.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { pushToActiveConversation } from "@/memory/working.ts"
import {
  getActiveLifeEvent,
  isLifeEventActive,
  maybeStartLifeEvent,
  maybeStoreLifecycleEpisode,
  sendLifecycleNotification
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

  it("returns lost_phone meta", async () => {
    vi.mocked(redis.get).mockResolvedValue("lost_phone")
    const event = await getActiveLifeEvent()
    expect(event).toEqual({
      type: "lost_phone",
      minHours: 8,
      maxHours: 24,
      notifyProbability: 0,
      interruptible: false
    })
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
    vi.mocked(redis.get).mockResolvedValue(null)
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

describe("maybeStartLifeEvent", () => {
  it("returns true without starting new event when one is already active", async () => {
    vi.mocked(redis.get).mockResolvedValue("walk")
    const result = await maybeStartLifeEvent(false)
    expect(result).toBe(true)
    expect(redis.set).not.toHaveBeenCalled()
  })

  it("starts a life event when random is below probability", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    const result = await maybeStartLifeEvent(false)
    expect(result).toBe(false)

    vi.restoreAllMocks()
  })

  it("sets Redis key with TTL when event starts", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    expect(redis.set).toHaveBeenCalledWith(
      "working:lifecycle:event",
      expect.any(String),
      expect.objectContaining({ ex: expect.any(Number) })
    )

    vi.restoreAllMocks()
  })

  it("stores event meta in Redis when event starts", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockResolvedValue("OK")
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    const metaCall = vi.mocked(redis.set).mock.calls.find(
      (call) => call[0] === "working:lifecycle:event:meta"
    )
    expect(metaCall).toBeDefined()
    const metaStr = metaCall![1] as string
    const meta = JSON.parse(metaStr)
    expect(meta).toHaveProperty("type")
    expect(meta).toHaveProperty("detail", "Celeste")
    expect(meta).toHaveProperty("startedAt")
    expect(meta).toHaveProperty("durationHours")

    vi.restoreAllMocks()
  })

  it("uses lost_phone event when lost_phone probability hits", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.set).mockResolvedValue("OK")
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    expect(redis.set).toHaveBeenCalledWith(
      "working:lifecycle:event",
      "lost_phone",
      expect.objectContaining({ ex: expect.any(Number) })
    )

    vi.restoreAllMocks()
  })

  it("sends start notification when hasActiveConversation and probability hits", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)

    await maybeStartLifeEvent(true)
    await new Promise((r) => setTimeout(r, 10))

    expect(callIntelligence).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it("does not send start notification when hasActiveConversation is false", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockClear()
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    expect(callIntelligence).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})

describe("maybeStoreLifecycleEpisode", () => {
  it("stores episode and deletes meta when event just ended", async () => {
    vi.mocked(redis.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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
    vi.mocked(redis.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        type: "cooking",
        detail: "Pasta from scratch",
        startedAt: "2026-03-06T14:30:00Z",
        durationHours: 0.8
      })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith(
      "Made Pasta from scratch — took about 0.8 hours",
      "activity",
      { relevanceScore: 0.6 }
    )
  })

  it("builds correct summary for movie events", async () => {
    vi.mocked(redis.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        type: "movie",
        detail: "Studio Ghibli Film",
        startedAt: "2026-03-06T14:30:00Z",
        durationHours: 2.1
      })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith(
      "Watched a Studio Ghibli Film (2.1 hours)",
      "activity",
      { relevanceScore: 0.6 }
    )
  })
})
