import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  setTickContext: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  isDreamTime: vi.fn(() => false),
  nowISO: vi.fn(() => "2026-01-01T00:00:00+00:00")
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

import { act } from "@/core/phases/act.ts"
import { maintain } from "@/core/phases/maintain.ts"
import { sense } from "@/core/phases/sense.ts"
import { think } from "@/core/phases/think.ts"
import { isDreamTime } from "@/lib/time.ts"
import { isTickRunning, setLastTickSummary, setTickRunning } from "@/memory/working.ts"
import { runHeartbeat } from "./heartbeat.ts"

const mockIsDreamTime = isDreamTime as ReturnType<typeof vi.fn>
const mockSense = sense as ReturnType<typeof vi.fn>
const mockThink = think as ReturnType<typeof vi.fn>
const mockAct = act as ReturnType<typeof vi.fn>
const mockMaintain = maintain as ReturnType<typeof vi.fn>
const mockIsTickRunning = isTickRunning as ReturnType<typeof vi.fn>
const mockSetLastTickSummary = setLastTickSummary as ReturnType<typeof vi.fn>
const mockSetTickRunning = setTickRunning as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDreamTime.mockReturnValue(false)
})

describe("runHeartbeat", () => {
  it("skips during dream hours but still updates last tick summary", async () => {
    mockIsDreamTime.mockReturnValue(true)

    const result = await runHeartbeat()

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
    mockIsTickRunning.mockResolvedValue(true)

    const result = await runHeartbeat()

    expect(result).toEqual({ skipped: true })
    expect(mockSense).not.toHaveBeenCalled()
  })

  it("executes phases in order: SENSE → THINK → ACT → MAINTAIN", async () => {
    mockIsTickRunning.mockResolvedValue(false)

    const callOrder: string[] = []
    const senseResult = { emotion: {}, messages: [] }
    const thinkResult = { triageResult: {}, consciousnessPrompt: "" }
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

    const result = await runHeartbeat()

    expect(callOrder).toEqual(["sense", "think", "act", "maintain"])
    expect(result).toEqual(maintainResult)
  })

  it("sets tick running flag and clears it after completion", async () => {
    mockIsTickRunning.mockResolvedValue(false)
    mockSense.mockResolvedValue({})
    mockThink.mockResolvedValue({})
    mockAct.mockResolvedValue({})
    mockMaintain.mockResolvedValue({})

    await runHeartbeat()

    expect(mockSetTickRunning).toHaveBeenCalledWith(true)
    expect(mockSetTickRunning).toHaveBeenCalledWith(false)
  })

  it("clears tick running flag even when a phase throws", async () => {
    mockIsTickRunning.mockResolvedValue(false)
    mockSense.mockRejectedValue(new Error("sense failed"))

    await expect(runHeartbeat()).rejects.toThrow("sense failed")

    expect(mockSetTickRunning).toHaveBeenCalledWith(true)
    expect(mockSetTickRunning).toHaveBeenCalledWith(false)
  })

  it("passes sense result to think, and both to act", async () => {
    mockIsTickRunning.mockResolvedValue(false)

    const senseResult = { emotion: { curiosity: 0.7 }, messages: [] }
    const thinkResult = { triageResult: { decision: "idle" } }

    mockSense.mockResolvedValue(senseResult)
    mockThink.mockResolvedValue(thinkResult)
    mockAct.mockResolvedValue({})
    mockMaintain.mockResolvedValue({})

    await runHeartbeat()

    expect(mockThink).toHaveBeenCalledWith(expect.anything(), senseResult)
    expect(mockAct).toHaveBeenCalledWith(expect.anything(), senseResult, thinkResult)
    expect(mockMaintain).toHaveBeenCalledWith(expect.anything(), thinkResult, expect.anything())
  })
})
