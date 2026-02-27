vi.mock("@trigger.dev/sdk", () => ({
  schedules: { task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })) }
}))

vi.mock("@sentry/node", () => ({
  captureMessage: vi.fn()
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
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
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

import * as Sentry from "@sentry/node"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { getRef } from "@/integrations/github.ts"
import { pingResend } from "@/integrations/resend.ts"
import { pingTelegram } from "@/integrations/telegram.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import {
  getCurrentEmotion,
  getLastTickSummary,
  pingRedis,
  setHealthCheck,
  setLastHealthyCommit
} from "@/memory/working.ts"
import { validateEmotionalState } from "@/security/guardian.ts"
import { healthCheckTask } from "./health-check.ts"

const run = (healthCheckTask as unknown as Record<string, () => Promise<unknown>>).run as () => Promise<
  Record<string, unknown>
>

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
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  mockSelect.mockReturnValue({ from: mockFrom })
  mockFrom.mockResolvedValueOnce([{ value: 10 }]).mockResolvedValueOnce([{ value: 1 }])
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })
  ;(getCurrentEmotion as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(validateEmotionalState as ReturnType<typeof vi.fn>).mockReturnValue({ verdict: "approved", reasons: [] })
  ;(getRef as ReturnType<typeof vi.fn>).mockResolvedValue({ sha: "abc123" })
  ;(setHealthCheck as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(setLastHealthyCommit as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAllHealthy()
})

describe("health-check overall status", () => {
  it("returns healthy when all services are up", async () => {
    const result = await run()

    expect(result.overall).toBe("healthy")
    expect((result.errors as string[]).length).toBe(0)
  })

  it("returns critical when Redis is down", async () => {
    ;(pingRedis as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const result = await run()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when Postgres is down", async () => {
    ;(db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("pg down"))

    const result = await run()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when budget exceeded", async () => {
    ;(getBudgetState as ReturnType<typeof vi.fn>).mockResolvedValue({
      consumedToday: 9,
      dailyLimit: 8,
      remainingToday: -1
    })

    const result = await run()

    expect(result.overall).toBe("critical")
  })

  it("returns critical when process is dead (no recent tick)", async () => {
    ;(getLastTickSummary as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await run()

    expect(result.overall).toBe("critical")
  })

  it("returns degraded when Telegram is down but core services are up", async () => {
    ;(pingTelegram as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const result = await run()

    expect(result.overall).toBe("degraded")
  })

  it("returns degraded when Vector is down but core services are up", async () => {
    ;(vectorIndex.info as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("vector down"))

    const result = await run()

    expect(result.overall).toBe("degraded")
  })

  it("returns critical when getBudgetState throws", async () => {
    ;(getBudgetState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"))

    const result = await run()

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

    const result = await run()

    expect(result.overall).toBe("degraded")
    expect(result.errors).toContain('Emotional dimension "connection" out of bounds: 1.5')
  })
})

describe("health-check service isolation", () => {
  it("continues checking other services when one throws", async () => {
    ;(pingTelegram as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("telegram timeout"))

    const result = await run()

    expect(result.services).toEqual(
      expect.objectContaining({
        redis: "ok",
        postgres: "ok",
        telegram: "error"
      })
    )
  })
})

describe("health-check side effects", () => {
  it("sends Sentry fatal message on critical status", async () => {
    ;(pingRedis as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    await run()

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Health check critical",
      expect.objectContaining({ level: "fatal" })
    )
  })

  it("does not send Sentry message on healthy status", async () => {
    await run()

    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it("updates last healthy commit on healthy status", async () => {
    await run()

    expect(setLastHealthyCommit).toHaveBeenCalledWith("abc123")
  })

  it("does not update last healthy commit on non-healthy status", async () => {
    ;(pingRedis as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    await run()

    expect(setLastHealthyCommit).not.toHaveBeenCalled()
  })

  it("stores health check result", async () => {
    await run()

    expect(setHealthCheck).toHaveBeenCalledWith(expect.objectContaining({ overall: "healthy" }))
  })
})

describe("health-check personality DNA", () => {
  it("adds error when personality DNA count is 0", async () => {
    const mockFrom = vi.fn()
    mockFrom.mockResolvedValueOnce([{ value: 10 }]).mockResolvedValueOnce([{ value: 0 }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const result = await run()

    expect(result.errors).toContain("Personality DNA: no entries in database")
  })
})
