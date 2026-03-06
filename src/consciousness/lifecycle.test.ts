import { err, ok } from "neverthrow"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK")
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

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/prompts/personality.ts", () => ({
  PERSONALITY_PROMPT: "Test personality prompt"
}))

import { redis } from "@/integrations/redis.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { pushToActiveConversation } from "@/memory/working.ts"
import { getActiveLifeEvent, isLifeEventActive, maybeStartLifeEvent, sendLifecycleNotification } from "./lifecycle.ts"

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
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    expect(redis.set).toHaveBeenCalledWith(
      "working:lifecycle:event",
      expect.any(String),
      expect.objectContaining({ ex: expect.any(Number) })
    )

    vi.restoreAllMocks()
  })

  it("sends start notification when hasActiveConversation and probability hits", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)

    await maybeStartLifeEvent(true)

    expect(callIntelligence).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it("does not send start notification when hasActiveConversation is false", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(callIntelligence).mockClear()
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    await maybeStartLifeEvent(false)

    expect(callIntelligence).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
