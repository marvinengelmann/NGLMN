import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/infra/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue("OK")
  },
  getValidatedRedis: vi.fn().mockResolvedValue(null)
}))

vi.mock("@/infra/lib/logger.ts", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock("@/infra/config/env.ts", () => ({
  env: () => ({ OPERATOR_PREFERRED_LANGUAGE: "German" })
}))

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn().mockResolvedValue(ok({ respond: true, text: "one sec~" }))
}))

vi.mock("@/affect/emotion/state.ts", () => ({
  getEmotionalState: vi.fn().mockResolvedValue({ valence: 0.6, arousal: 0.4, dominance: 0.5 })
}))

vi.mock("@/infra/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn().mockResolvedValue(42)
}))

vi.mock("@/expression/dream/state.ts", () => ({
  getDreamLastRun: vi.fn().mockResolvedValue(null)
}))

vi.mock("@/expression/communication/state.ts", () => ({
  pushToActiveConversation: vi.fn().mockResolvedValue(undefined),
  getActiveConversation: vi.fn().mockResolvedValue({
    id: "conv-1",
    messages: [
      { role: "operator", text: "Hey, what are you up to?", timestamp: "2026-03-06T11:55:00Z", messageId: 1 }
    ],
    startedAt: "2026-03-06T11:55:00Z",
    lastActivityAt: "2026-03-06T11:55:00Z"
  })
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn().mockResolvedValue("episode-id")
}))

vi.mock("@/infra/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/prompts/personality.ts", () => ({
  getPersonalityPrompt: vi.fn().mockResolvedValue("Test personality prompt")
}))

vi.mock("@/infra/lib/time.ts", () => ({
  nowISO: vi.fn().mockReturnValue("2026-03-06T12:00:00.000Z"),
  nowLocal: vi.fn().mockReturnValue(new Date(2026, 2, 6, 12, 0, 0))
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { pushToActiveConversation } from "@/expression/communication/state.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { sendToOperator } from "@/infra/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { nowLocal } from "@/infra/lib/time.ts"
import {
  getActiveLifeEvent,
  getAvailableLifeEvents,
  handleMidEventCheck,
  isLifeEventActive,
  maybeStoreLifecycleEpisode,
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
    expect(event).toEqual(expect.objectContaining({
      type: "walk",
      minHours: 0.25,
      maxHours: 1.25,
      notifyProbability: 0.65
    }))
  })

  it("returns event meta for gaming", async () => {
    vi.mocked(redis.get).mockResolvedValue("gaming")
    const event = await getActiveLifeEvent()
    expect(event).toEqual(expect.objectContaining({
      type: "gaming",
      minHours: 0.5,
      maxHours: 3,
      notifyProbability: 0.5
    }))
  })

  it("returns null for unknown event type", async () => {
    vi.mocked(redis.get).mockResolvedValue("lost_phone")
    expect(await getActiveLifeEvent()).toBeNull()
  })

  it("returns sleep event with very low probability", async () => {
    vi.mocked(redis.get).mockResolvedValue("sleep")
    const event = await getActiveLifeEvent()
    expect(event).toEqual(expect.objectContaining({
      type: "sleep",
      minHours: 5,
      maxHours: 7,
      notifyProbability: 0.03
    }))
  })

  it("returns null for dream event", async () => {
    vi.mocked(redis.get).mockResolvedValue("dream")
    expect(await getActiveLifeEvent()).toBeNull()
  })
})

describe("handleMidEventCheck", () => {
  it("sends a response when probability passes and LLM decides to respond", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(getValidatedRedis).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockResolvedValueOnce(ok({ respond: true, text: "one sec~" }))

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, 100)

    expect(callIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.anything(),
        maxTokens: 256,
        reasoning: false
      })
    )
    expect(sendToOperator).toHaveBeenCalledWith("one sec~")
    expect(pushToActiveConversation).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "anima",
        text: "one sec~",
        messageId: 42
      })
    ])

    vi.restoreAllMocks()
  })

  it("does not call LLM when probability gate blocks", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockClear()

    await handleMidEventCheck({ type: "sleep", minHours: 5, maxHours: 7, notifyProbability: 0.03 }, 100)

    expect(callIntelligence).not.toHaveBeenCalled()
    expect(sendToOperator).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it("does not send when LLM decides not to respond", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockResolvedValueOnce(ok({ respond: false, text: null }))
    vi.mocked(sendToOperator).mockClear()

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, 100)

    expect(callIntelligence).toHaveBeenCalled()
    expect(sendToOperator).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it("does not send when LLM returns an error", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockResolvedValueOnce(err({ tag: "LLM_ERROR" as const, message: "fail" }))
    vi.mocked(sendToOperator).mockClear()

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, 100)

    expect(sendToOperator).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it("skips when maxUpdateId is null", async () => {
    vi.mocked(callIntelligence).mockClear()

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, null)

    expect(callIntelligence).not.toHaveBeenCalled()
  })

  it("skips when already rolled for this message batch", async () => {
    vi.mocked(redis.get).mockResolvedValue(100)
    vi.mocked(callIntelligence).mockClear()

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, 100)

    expect(callIntelligence).not.toHaveBeenCalled()
  })

  it("rolls again when new messages arrive (higher updateId)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    vi.mocked(redis.get).mockResolvedValue(100)
    vi.mocked(getValidatedRedis).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockResolvedValueOnce(ok({ respond: true, text: "hey~" }))

    await handleMidEventCheck({ type: "walk", minHours: 0.5, maxHours: 2, notifyProbability: 0.35 }, 200)

    expect(callIntelligence).toHaveBeenCalled()
    expect(redis.set).toHaveBeenCalledWith("working:lifecycle:lastRolledUpdateId", 200)

    vi.restoreAllMocks()
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

  it("falls back to event type when no detail is provided", async () => {
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

    expect(storeEpisode).toHaveBeenCalledWith("Celeste (2.3h)", "activity", { relevanceScore: 0.6 })
    expect(redis.del).toHaveBeenCalledWith("working:lifecycle:event:meta")
    expect(redis.del).toHaveBeenCalledWith("working:lifecycle:lastRolledUpdateId")
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

  it("builds summary from detail and duration", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null)
    vi.mocked(getValidatedRedis).mockResolvedValueOnce({
      type: "cooking",
      detail: "Pasta from scratch",
      startedAt: "2026-03-06T14:30:00Z",
      durationHours: 0.8
    })

    await maybeStoreLifecycleEpisode()

    expect(storeEpisode).toHaveBeenCalledWith("Pasta from scratch (0.8h)", "activity", {
      relevanceScore: 0.6
    })
  })
})

const defaultOptions = { operatorSilenceMinutes: 60, hasNewCommits: false }

describe("getAvailableLifeEvents", () => {
  it("excludes events outside their available hours", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 6, 3, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).not.toContain("errands")
    expect(types).not.toContain("haircut")
    expect(types).not.toContain("doctor_visit")

    expect(types).toContain("gaming")
    expect(types).toContain("streaming")
  })

  it("includes events with wrapping midnight ranges at night", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 6, 23, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).toContain("sleep")
    expect(types).toContain("concert")
    expect(types).toContain("bath")
  })

  it("excludes weekend-only events on weekdays", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 10, 22, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).not.toContain("party")
  })

  it("includes weekend-only events on weekends", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 7, 22, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).toContain("party")
  })

  it("includes events without time restrictions at any hour", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 6, 4, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).toContain("reading")
    expect(types).toContain("podcast")
    expect(types).toContain("music")
  })

  it("returns empty when operator silence is below guard threshold", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 6, 12, 0, 0) as ReturnType<typeof nowLocal>)

    const available = await getAvailableLifeEvents({ operatorSilenceMinutes: 3, hasNewCommits: false })

    expect(available).toEqual([])
  })

  it("excludes recently used event types within cooldown period", async () => {
    vi.mocked(nowLocal).mockReturnValue(new Date(2026, 2, 6, 12, 0, 0) as ReturnType<typeof nowLocal>)
    vi.mocked(redis.lrange).mockResolvedValue([
      JSON.stringify({ type: "deep_focus", startedAt: new Date().toISOString() }),
      JSON.stringify({ type: "reading", startedAt: new Date().toISOString() })
    ])

    const available = await getAvailableLifeEvents(defaultOptions)
    const types = available.map((e) => e.type)

    expect(types).not.toContain("deep_focus")
    expect(types).not.toContain("reading")
    expect(types).toContain("cooking")
  })
})
