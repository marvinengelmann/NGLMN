import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  addBreadcrumb: vi.fn(),
  captureError: vi.fn()
}))

vi.mock("@/db/client.ts", () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn() })) }
}))

vi.mock("@/db/schema.ts", () => ({
  tickLog: {}
}))

vi.mock("@/memory/working.ts", () => ({
  setLastTickSummary: vi.fn(),
  pushRecentTickDuration: vi.fn(),
  getEffectivePersonality: vi.fn(() => null),
  getReflectionLastAt: vi.fn(() => null)
}))

vi.mock("@/security/guardian.ts", () => ({
  detectDrift: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendDriftAlert: vi.fn()
}))

vi.mock("@/routine/reflection.ts", () => ({
  shouldTriggerReflection: vi.fn(() => ({ trigger: false, reason: "No introspective urge" }))
}))

vi.mock("@/trigger/reflection.ts", () => ({
  adHocReflectionTask: { trigger: vi.fn() }
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(() => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.5,
    boredom: 0.5,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  }))
}))

import { db } from "@/db/client.ts"
import { sendDriftAlert } from "@/integrations/telegram.ts"
import { addBreadcrumb } from "@/lib/sentry.ts"
import { getEffectivePersonality, pushRecentTickDuration, setLastTickSummary } from "@/memory/working.ts"
import { shouldTriggerReflection } from "@/routine/reflection.ts"
import { detectDrift } from "@/security/guardian.ts"
import { makeDriftReport, makePersonalityLayer, makeTriageResult } from "@/test/factories.ts"
import { adHocReflectionTask } from "@/trigger/reflection.ts"
import type { ActResult } from "./act.ts"
import { maintain } from "./maintain.ts"
import type { TickContext } from "./sense.ts"
import type { ThinkResult } from "./think.ts"

const mockDetectDrift = detectDrift as ReturnType<typeof vi.fn>
const mockSendDriftAlert = sendDriftAlert as ReturnType<typeof vi.fn>
const mockShouldTriggerReflection = shouldTriggerReflection as ReturnType<typeof vi.fn>
const mockAdHocReflectionTrigger = adHocReflectionTask.trigger as ReturnType<typeof vi.fn>
const mockSetLastTickSummary = setLastTickSummary as ReturnType<typeof vi.fn>
const mockPushRecentTickDuration = pushRecentTickDuration as ReturnType<typeof vi.fn>
const mockAddBreadcrumb = addBreadcrumb as ReturnType<typeof vi.fn>
const mockDbInsert = db.insert as ReturnType<typeof vi.fn>
const mockGetEffectivePersonality = getEffectivePersonality as ReturnType<typeof vi.fn>

const ctx: TickContext = {
  tickId: "tick-test",
  startTime: Date.now() - 100,
  timestamp: new Date().toISOString()
}

const thinkResult: ThinkResult = {
  triageResult: makeTriageResult({ decision: "simple", reason: "test reason" }),
  consciousnessPrompt: "personality",
  triggeredWorkflows: []
}

const actResult: ActResult = {
  responseSent: true,
  responseText: "hello",
  modelUsed: "xai/grok-4-1-fast-non-reasoning"
}

describe("maintain phase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectDrift.mockResolvedValue(makeDriftReport())
    mockShouldTriggerReflection.mockReturnValue({ trigger: false, reason: "No introspective urge" })
    mockGetEffectivePersonality.mockResolvedValue(makePersonalityLayer())
  })

  it("sends drift alert when drift is unhealthy", async () => {
    const unhealthyDrift = makeDriftReport({
      healthy: false,
      signals: [{ type: "cost_spike", severity: "high", detail: "cost doubled", detectedAt: new Date().toISOString() }]
    })
    mockDetectDrift.mockResolvedValue(unhealthyDrift)

    await maintain(ctx, thinkResult, actResult)

    expect(mockSendDriftAlert).toHaveBeenCalledWith(unhealthyDrift)
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      "drift",
      "Unhealthy drift detected",
      expect.objectContaining({ signals: unhealthyDrift.signals }),
      "warning"
    )
  })

  it("does not send drift alert when healthy", async () => {
    mockDetectDrift.mockResolvedValue(makeDriftReport({ healthy: true }))

    await maintain(ctx, thinkResult, actResult)

    expect(mockSendDriftAlert).not.toHaveBeenCalled()
  })

  it("triggers ad-hoc reflection when emotional urge detected", async () => {
    mockShouldTriggerReflection.mockReturnValue({
      trigger: true,
      reason: "Strong curiosity (high, 0.92) driving introspection"
    })

    await maintain(ctx, thinkResult, actResult)

    expect(mockAdHocReflectionTrigger).toHaveBeenCalledWith({
      reason: "Strong curiosity (high, 0.92) driving introspection"
    })
  })

  it("skips reflection check when personality not loaded", async () => {
    mockGetEffectivePersonality.mockResolvedValue(null)

    await maintain(ctx, thinkResult, actResult)

    expect(mockShouldTriggerReflection).not.toHaveBeenCalled()
    expect(mockAdHocReflectionTrigger).not.toHaveBeenCalled()
  })

  it("builds correct tick summary", async () => {
    const result = await maintain(ctx, thinkResult, actResult)

    expect(result.tickId).toBe("tick-test")
    expect(result.triageDecision).toBe("simple")
    expect(result.triageReason).toBe("test reason")
    expect(result.responseSent).toBe(true)
    expect(result.modelUsed).toBe("xai/grok-4-1-fast-non-reasoning")
    expect(result.messagesProcessed).toBe(0)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("inserts tick log into database", async () => {
    await maintain(ctx, thinkResult, actResult)

    expect(mockDbInsert).toHaveBeenCalled()
  })

  it("saves tick summary and duration to Redis", async () => {
    await maintain(ctx, thinkResult, actResult)

    expect(mockSetLastTickSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tickId: "tick-test", responseSent: true })
    )
    expect(mockPushRecentTickDuration).toHaveBeenCalledWith(expect.any(Number))
  })

  it("handles reflection check failure gracefully", async () => {
    mockShouldTriggerReflection.mockImplementation(() => {
      throw new Error("reflection check boom")
    })

    const result = await maintain(ctx, thinkResult, actResult)

    expect(result.tickId).toBe("tick-test")
  })

  it("handles idle act result correctly", async () => {
    const idleActResult: ActResult = { responseSent: false }

    const result = await maintain(ctx, thinkResult, idleActResult)

    expect(result.responseSent).toBe(false)
    expect(result.modelUsed).toBeUndefined()
  })
})
