vi.mock("@sentry/node", () => ({
  captureMessage: vi.fn()
}))

vi.mock("@/config/env.ts", () => ({
  hasEmailConfig: vi.fn(() => true),
  hasXConfig: vi.fn(() => false)
}))

vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn()
}))

vi.mock("@/db/client.ts", () => ({
  db: { execute: vi.fn(), select: vi.fn() }
}))

vi.mock("@/db/schema.ts", () => ({
  personalityDna: {},
  semanticMemory: {}
}))

vi.mock("@/integrations/github.ts", () => ({
  getRef: vi.fn()
}))

vi.mock("@/integrations/resend.ts", () => ({
  pingResend: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  pingTelegram: vi.fn()
}))

vi.mock("@/integrations/vector.ts", () => ({
  vectorIndex: { info: vi.fn() }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  nowISO: vi.fn(() => "2026-01-01T00:00:00+00:00")
}))

vi.mock("@/memory/working.ts", () => ({
  getCurrentEmotion: vi.fn(),
  getLastTickSummary: vi.fn(),
  pingRedis: vi.fn(),
  setHealthCheck: vi.fn(),
  setLastHealthyCommit: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validateEmotionalState: vi.fn()
}))

import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { pingResend } from "@/integrations/resend.ts"
import { pingTelegram } from "@/integrations/telegram.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import { getCurrentEmotion, getLastTickSummary, pingRedis } from "@/memory/working.ts"
import { validateEmotionalState } from "@/security/guardian.ts"
import { runHealthCheck } from "./check.ts"

function setupAllHealthy() {
  ;(pingRedis as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  ;(db.execute as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(pingTelegram as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  ;(pingResend as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  ;(vectorIndex.info as ReturnType<typeof vi.fn>).mockResolvedValue({})
  ;(getLastTickSummary as ReturnType<typeof vi.fn>).mockResolvedValue({ timestamp: new Date().toISOString() })
  ;(getBudgetState as ReturnType<typeof vi.fn>).mockResolvedValue({
    consumedToday: 2,
    dailyLimit: 8,
    remainingToday: 6
  })
  const mockFrom = vi.fn()
  mockFrom.mockResolvedValueOnce([{ value: 10 }]).mockResolvedValueOnce([{ value: 1 }])
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })
  ;(getCurrentEmotion as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(validateEmotionalState as ReturnType<typeof vi.fn>).mockReturnValue({ verdict: "approved", reasons: [] })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAllHealthy()
})

describe("runHealthCheck overall status", () => {
  it("returns healthy when all services are up", async () => {
    const result = await runHealthCheck()

    expect(result.overall).toBe("healthy")
    expect(result.errors.length).toBe(0)
  })

  it("returns critical when Redis is down", async () => {
    ;(pingRedis as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const result = await runHealthCheck()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when Postgres is down", async () => {
    ;(db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("pg down"))

    const result = await runHealthCheck()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when budget exceeded", async () => {
    ;(getBudgetState as ReturnType<typeof vi.fn>).mockResolvedValue({
      consumedToday: 9,
      dailyLimit: 8,
      remainingToday: -1
    })

    const result = await runHealthCheck()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when process is dead (no recent tick)", async () => {
    ;(getLastTickSummary as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await runHealthCheck()

    expect(result.overall).toBe("critical")
  })

  it("returns degraded when Telegram is down but core services are up", async () => {
    ;(pingTelegram as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const result = await runHealthCheck()

    expect(result.overall).toBe("degraded")
  })

  it("returns degraded when Vector is down but core services are up", async () => {
    ;(vectorIndex.info as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("vector down"))

    const result = await runHealthCheck()

    expect(result.overall).toBe("degraded")
  })

  it("returns critical when getBudgetState throws", async () => {
    ;(getBudgetState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"))

    const result = await runHealthCheck()

    expect(result.overall).toBe("critical")
    expect(result.errors).toContain("Budget: redis down")
  })

  it("returns degraded when emotional state is blocked", async () => {
    ;(getCurrentEmotion as ReturnType<typeof vi.fn>).mockResolvedValue({
      curiosity: 0.5,
      satisfaction: 0.5,
      frustration: 0.5,
      boredom: 0.5,
      excitement: 0.5,
      caution: 0.5,
      connection: 1.5
    })
    ;(validateEmotionalState as ReturnType<typeof vi.fn>).mockReturnValue({
      verdict: "blocked",
      reasons: ['Emotional dimension "connection" out of bounds: 1.5'],
      checkedAt: new Date().toISOString()
    })

    const result = await runHealthCheck()

    expect(result.overall).toBe("degraded")
    expect(result.errors).toContain('Emotional dimension "connection" out of bounds: 1.5')
  })
})

describe("runHealthCheck service isolation", () => {
  it("continues checking other services when one throws", async () => {
    ;(pingTelegram as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("telegram timeout"))

    const result = await runHealthCheck()

    expect(result.services).toEqual(
      expect.objectContaining({
        redis: "ok",
        postgres: "ok",
        telegram: "error"
      })
    )
  })
})

describe("runHealthCheck personality DNA", () => {
  it("adds error when personality DNA count is 0", async () => {
    const mockFrom = vi.fn()
    mockFrom.mockResolvedValueOnce([{ value: 10 }]).mockResolvedValueOnce([{ value: 0 }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const result = await runHealthCheck()

    expect(result.errors).toContain("Personality DNA: no entries in database")
  })
})
