import { afterEach, describe, expect, it, vi } from "vitest"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { DEFAULT_EMOTIONAL_STATE } from "@/affect/emotion/types.ts"

vi.mock("@/governance/security/state.ts", () => ({
  getRecentResponses: vi.fn().mockResolvedValue([])
}))

vi.mock("@/memory/working.ts", () => ({
  getRecentActions: vi.fn().mockResolvedValue([]),
  getRecentTickDurations: vi.fn().mockResolvedValue([])
}))

vi.mock("@/infra/lib/time.ts", () => ({
  nowISO: vi.fn().mockReturnValue("2026-03-06T12:00:00Z")
}))

vi.mock("./defense.ts", () => ({
  detectInjection: vi.fn().mockReturnValue({ detected: false, patterns: [] })
}))

vi.mock("@/infra/integrations/redis.ts", () => ({
  redis: { get: vi.fn() }
}))

vi.mock("@/memory/events.ts", () => ({
  recordEvent: vi.fn()
}))

vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn().mockResolvedValue({ consumedToday: 1, dailyLimit: 5, remainingToday: 4 })
}))

vi.mock("@/infra/integrations/telegram.ts", () => ({
  sendGuardianAlert: vi.fn(),
  sendDriftAlert: vi.fn(),
  sendAlert: vi.fn()
}))

vi.mock("@/affect/emotion/state.ts", () => ({
  processEmotionTrigger: vi.fn()
}))

vi.mock("@/infra/lib/sentry.ts", () => ({
  addBreadcrumb: vi.fn(),
  captureError: vi.fn()
}))

vi.mock("@/infra/lib/logger.ts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { getRecentResponses } from "@/governance/security/state.ts"
import { detectInjection } from "./defense.ts"
import { validateEmotionalState, validateEvolution, validateOutput } from "./guardian.ts"

const mockedGetRecentResponses = vi.mocked(getRecentResponses)
const mockedDetectInjection = vi.mocked(detectInjection)

afterEach(() => {
  vi.clearAllMocks()
})

describe("validateOutput", () => {
  it("blocks response that is too short", async () => {
    const result = await validateOutput("")
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("too short")
  })

  it("blocks response that is too long", async () => {
    const result = await validateOutput("a".repeat(5000))
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("too long")
  })

  it("approves a normal response", async () => {
    const result = await validateOutput("This is a perfectly normal response.")
    expect(result.verdict).toBe("approved")
    expect(result.reasons).toHaveLength(0)
  })

  it("blocks stuck loop (3 identical recent responses)", async () => {
    const text = "I am stuck"
    mockedGetRecentResponses.mockResolvedValue([text, text, text])
    const result = await validateOutput(text)
    expect(result.verdict).toBe("blocked")
    expect(result.reasons.some((r: string) => r.includes("Stuck loop"))).toBe(true)
  })

  it("warns on injection pattern detected", async () => {
    mockedDetectInjection.mockReturnValue({ detected: true, patterns: ["system prompt"] })
    const result = await validateOutput("Some response text")
    expect(result.verdict).toBe("warning")
    expect(result.reasons.some((r: string) => r.includes("injection"))).toBe(true)
  })

  it("warns on repeated response in last 5", async () => {
    const text = "Repeated text"
    mockedGetRecentResponses.mockResolvedValue(["other", text, "another", "more", "last"])
    const result = await validateOutput(text)
    expect(result.verdict).toBe("warning")
    expect(result.reasons.some((r: string) => r.includes("Repeated response"))).toBe(true)
  })
})

describe("validateEvolution", () => {
  it("approves files in allowed paths", () => {
    const result = validateEvolution([{ path: "src/affect/emotion/mood.ts", content: "export const x = 1" }])
    expect(result.verdict).toBe("approved")
  })

  it("blocks files outside allowed paths", () => {
    const result = validateEvolution([{ path: "package.json", content: "{}" }])
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("outside allowed evolution paths")
  })

  it("blocks path traversal attempts", () => {
    const result = validateEvolution([{ path: "src/affect/../../../etc/passwd", content: "bad" }])
    expect(result.verdict).toBe("blocked")
  })

  it("blocks files exceeding size limit", () => {
    const result = validateEvolution([{ path: "src/affect/emotion/big.ts", content: "x".repeat(60_000) }])
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("exceeds size limit")
  })

  it("blocks files containing secrets", () => {
    const result = validateEvolution([
      { path: "src/core/db.ts", content: "const url = 'postgresql://user:pass@host/db'" }
    ])
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("secret detected")
  })
})

describe("validateEmotionalState", () => {
  it("approves valid emotional state", () => {
    const result = validateEmotionalState({ ...DEFAULT_EMOTIONAL_STATE })
    expect(result.verdict).toBe("approved")
    expect(result.reasons).toHaveLength(0)
  })

  it("blocks state with values above 1", () => {
    const state: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE, curiosity: 1.5 }
    const result = validateEmotionalState(state)
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("curiosity")
  })

  it("blocks state with values below 0", () => {
    const state: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE, frustration: -0.1 }
    const result = validateEmotionalState(state)
    expect(result.verdict).toBe("blocked")
    expect(result.reasons[0]).toContain("frustration")
  })

  it("reports multiple out-of-bounds dimensions", () => {
    const state: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE, curiosity: 2, boredom: -1 }
    const result = validateEmotionalState(state)
    expect(result.verdict).toBe("blocked")
    expect(result.reasons).toHaveLength(2)
  })
})
