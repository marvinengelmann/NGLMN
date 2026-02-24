vi.mock("@trigger.dev/sdk", () => ({
  schedules: { task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })) }
}))

vi.mock("@/dream/orchestrator.ts", () => ({
  isDreamTime: vi.fn(),
  runDreamCycle: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  TIMEZONE: "Europe/Berlin"
}))

vi.mock("./evolution.ts", () => ({
  evolutionTask: { trigger: vi.fn() }
}))

import { isDreamTime, runDreamCycle } from "@/dream/orchestrator.ts"
import { captureError } from "@/lib/sentry.ts"
import { dreamTask } from "./dream.ts"
import { evolutionTask } from "./evolution.ts"

const mockIsDreamTime = isDreamTime as ReturnType<typeof vi.fn>
const mockRunDreamCycle = runDreamCycle as ReturnType<typeof vi.fn>
const mockEvolutionTrigger = evolutionTask.trigger as ReturnType<typeof vi.fn>
const mockCaptureError = captureError as ReturnType<typeof vi.fn>

const run = (dreamTask as unknown as Record<string, () => Promise<unknown>>).run as () => Promise<
  Record<string, unknown>
>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("dream task", () => {
  it("skips when not dream time", async () => {
    mockIsDreamTime.mockReturnValue(false)

    const result = await run()

    expect(result).toEqual({ action: "skipped", reason: "not dream time" })
    expect(mockRunDreamCycle).not.toHaveBeenCalled()
  })

  it("runs dream cycle and returns result when dream time", async () => {
    mockIsDreamTime.mockReturnValue(true)
    mockRunDreamCycle.mockResolvedValue({
      errors: [],
      evolutionTriggers: [],
      consolidation: { episodesProcessed: 5 },
      reflection: { insights: ["test"] },
      creative: null
    })

    const result = await run()

    expect(result.action).toBe("completed")
  })

  it("captures each error individually in Sentry", async () => {
    const err1 = new Error("reflection failed")
    const err2 = new Error("consolidation failed")
    mockIsDreamTime.mockReturnValue(true)
    mockRunDreamCycle.mockResolvedValue({
      errors: [err1, err2],
      evolutionTriggers: []
    })

    await run()

    expect(mockCaptureError).toHaveBeenCalledTimes(2)
    expect(mockCaptureError).toHaveBeenCalledWith(err1, { phase: "dream_cycle" })
    expect(mockCaptureError).toHaveBeenCalledWith(err2, { phase: "dream_cycle" })
  })

  it("triggers evolution tasks from dream insights", async () => {
    mockIsDreamTime.mockReturnValue(true)
    const triggers = [
      { type: "prompt", promptId: "triage", insight: "improve" },
      { type: "workflow", insight: "automate" }
    ]
    mockRunDreamCycle.mockResolvedValue({
      errors: [],
      evolutionTriggers: triggers,
      consolidation: null,
      reflection: null,
      creative: null
    })

    await run()

    expect(mockEvolutionTrigger).toHaveBeenCalledTimes(2)
    expect(mockEvolutionTrigger).toHaveBeenCalledWith(triggers[0])
    expect(mockEvolutionTrigger).toHaveBeenCalledWith(triggers[1])
  })

  it("does not trigger evolution when no triggers present", async () => {
    mockIsDreamTime.mockReturnValue(true)
    mockRunDreamCycle.mockResolvedValue({
      errors: [],
      evolutionTriggers: [],
      consolidation: null,
      reflection: null,
      creative: null
    })

    await run()

    expect(mockEvolutionTrigger).not.toHaveBeenCalled()
  })
})
