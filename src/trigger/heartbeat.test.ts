import { describe, expect, it, vi } from "vitest"

vi.mock("@trigger.dev/sdk", () => ({
  task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })),
  schedules: { task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })) }
}))

vi.mock("date-fns", () => ({
  formatISO: vi.fn(() => "2026-02-24T12:00:00Z"),
  getHours: vi.fn(() => 12)
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  setTickContext: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  nowLocal: vi.fn(() => new Date())
}))

vi.mock("@/memory/working.ts", () => ({
  isTickRunning: vi.fn(),
  setLastTickSummary: vi.fn(),
  setTickRunning: vi.fn()
}))

vi.mock("@/core/phases/sense.ts", () => ({
  sense: vi.fn()
}))

vi.mock("@/core/phases/think.ts", () => ({
  think: vi.fn()
}))

vi.mock("@/core/phases/act.ts", () => ({
  act: vi.fn()
}))

vi.mock("@/core/phases/maintain.ts", () => ({
  maintain: vi.fn()
}))

import { getHours } from "date-fns"
import { act } from "@/core/phases/act.ts"
import { maintain } from "@/core/phases/maintain.ts"
import { sense } from "@/core/phases/sense.ts"
import { think } from "@/core/phases/think.ts"
import { isTickRunning, setLastTickSummary, setTickRunning } from "@/memory/working.ts"
import { heartbeatTask } from "./heartbeat.ts"

const mockGetHours = getHours as ReturnType<typeof vi.fn>
const mockSense = sense as ReturnType<typeof vi.fn>
const mockThink = think as ReturnType<typeof vi.fn>
const mockAct = act as ReturnType<typeof vi.fn>
const mockMaintain = maintain as ReturnType<typeof vi.fn>
const mockIsTickRunning = isTickRunning as ReturnType<typeof vi.fn>
const mockSetLastTickSummary = setLastTickSummary as ReturnType<typeof vi.fn>
const mockSetTickRunning = setTickRunning as ReturnType<typeof vi.fn>

const run = (heartbeatTask as unknown as Record<string, () => Promise<unknown>>).run as () => Promise<unknown>

describe("heartbeat", () => {
  it("skips during dream hours (0-5) but still updates last tick summary", async () => {
    mockGetHours.mockReturnValue(3)

    const result = await run()

    expect(result).toEqual({ skipped: true, reason: "dream_hours" })
    expect(mockSense).not.toHaveBeenCalled()
    expect(mockSetLastTickSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        triageDecision: "idle",
        triageReason: "dream_hours",
        messagesProcessed: 0,
        responseSent: false,
        durationMs: 0
      })
    )
  })

  it("skips when another tick is already running", async () => {
    mockGetHours.mockReturnValue(12)
    mockIsTickRunning.mockResolvedValue(true)

    const result = await run()

    expect(result).toEqual({ skipped: true })
    expect(mockSense).not.toHaveBeenCalled()
  })

  it("executes phases in order: SENSE → THINK → ACT → MAINTAIN", async () => {
    mockGetHours.mockReturnValue(12)
    mockIsTickRunning.mockResolvedValue(false)

    const callOrder: string[] = []
    const senseResult = { emotion: {}, messages: [] }
    const thinkResult = { triageResult: {}, personalityPrompt: "" }
    const actResult = { responseSent: false }
    const maintainResult = { tickId: "tick-1" }

    mockSense.mockImplementation(async () => {
      callOrder.push("sense")
      return senseResult
    })
    mockThink.mockImplementation(async () => {
      callOrder.push("think")
      return thinkResult
    })
    mockAct.mockImplementation(async () => {
      callOrder.push("act")
      return actResult
    })
    mockMaintain.mockImplementation(async () => {
      callOrder.push("maintain")
      return maintainResult
    })

    const result = await run()

    expect(callOrder).toEqual(["sense", "think", "act", "maintain"])
    expect(result).toEqual(maintainResult)
  })

  it("sets tick running flag and clears it after completion", async () => {
    mockGetHours.mockReturnValue(12)
    mockIsTickRunning.mockResolvedValue(false)
    mockSense.mockResolvedValue({})
    mockThink.mockResolvedValue({})
    mockAct.mockResolvedValue({})
    mockMaintain.mockResolvedValue({})

    await run()

    expect(mockSetTickRunning).toHaveBeenCalledWith(true)
    expect(mockSetTickRunning).toHaveBeenCalledWith(false)
  })

  it("clears tick running flag even when a phase throws", async () => {
    mockGetHours.mockReturnValue(12)
    mockIsTickRunning.mockResolvedValue(false)
    mockSense.mockRejectedValue(new Error("sense failed"))

    await expect(run()).rejects.toThrow("sense failed")

    expect(mockSetTickRunning).toHaveBeenCalledWith(true)
    expect(mockSetTickRunning).toHaveBeenCalledWith(false)
  })

  it("passes sense result to think, and both to act", async () => {
    mockGetHours.mockReturnValue(12)
    mockIsTickRunning.mockResolvedValue(false)

    const senseResult = { emotion: { curiosity: 0.7 }, messages: [] }
    const thinkResult = { triageResult: { decision: "idle" } }

    mockSense.mockResolvedValue(senseResult)
    mockThink.mockResolvedValue(thinkResult)
    mockAct.mockResolvedValue({})
    mockMaintain.mockResolvedValue({})

    await run()

    expect(mockThink).toHaveBeenCalledWith(expect.anything(), senseResult)
    expect(mockAct).toHaveBeenCalledWith(expect.anything(), senseResult, thinkResult)
    expect(mockMaintain).toHaveBeenCalledWith(expect.anything(), thinkResult, expect.anything())
  })
})
