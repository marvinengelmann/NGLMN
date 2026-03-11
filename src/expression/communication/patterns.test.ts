import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDbFrom = vi.fn()
const mockDbWhere = vi.fn()
const mockDbOrderBy = vi.fn()
const mockDbLimit = vi.fn()

vi.mock("@/infra/db/client.ts", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        mockDbFrom(table)
        return {
          where: (condition: unknown) => {
            mockDbWhere(condition)
            return {
              orderBy: (order: unknown) => {
                mockDbOrderBy(order)
                return { limit: mockDbLimit }
              }
            }
          },
          orderBy: (order: unknown) => {
            mockDbOrderBy(order)
            return { limit: mockDbLimit }
          }
        }
      }
    })
  }
}))

vi.mock("@/infra/db/schema.ts", () => ({
  conversationArcs: { createdAt: "createdAt" }
}))

vi.mock("@/infra/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn()
  }
}))

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn()
}))

vi.mock("@/infra/lib/logger.ts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { err, ok } from "neverthrow"
import { callIntelligence } from "@/core/intelligence.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { analyzeConversationPatterns } from "./patterns.ts"

describe("analyzeConversationPatterns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns cached patterns if available", async () => {
    const cached = { patterns: ["pattern1"], recurringUnresolved: ["topic1"] }
    vi.mocked(redis.get).mockResolvedValue(cached)

    const result = await analyzeConversationPatterns()

    expect(result).toEqual(cached)
    expect(callIntelligence).not.toHaveBeenCalled()
  })

  it("returns empty when less than 3 arcs", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    mockDbLimit.mockResolvedValue([{ tone: "warm" }, { tone: "tense" }])

    const result = await analyzeConversationPatterns()

    expect(result).toEqual({ patterns: [], recurringUnresolved: [] })
    expect(callIntelligence).not.toHaveBeenCalled()
  })

  it("calls LLM with arc summaries when enough arcs exist", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    const arcs = Array.from({ length: 4 }, (_, i) => ({
      tone: "warm",
      themes: ["topic-a"],
      unresolvedTopics: ["unresolved-x"],
      emotionalArc: { start: 0.2, peak: 0.6, end: 0.4 },
      operatorEngagement: 0.7,
      messageCount: 5 + i
    }))
    mockDbLimit.mockResolvedValue(arcs)

    vi.mocked(callIntelligence).mockResolvedValue(
      ok({ patterns: ["work conversations end frustrated"], recurringUnresolved: ["career direction"] })
    )

    const result = await analyzeConversationPatterns()

    expect(callIntelligence).toHaveBeenCalledOnce()
    expect(result.patterns).toContain("work conversations end frustrated")
    expect(result.recurringUnresolved).toContain("career direction")
    expect(redis.set).toHaveBeenCalledWith("working:conversation:patterns", result, { ex: 3600 })
  })

  it("returns empty on LLM failure", async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    mockDbLimit.mockResolvedValue(
      Array.from({ length: 4 }, () => ({
        tone: "warm",
        themes: ["t"],
        unresolvedTopics: [],
        emotionalArc: { start: 0, peak: 0.5, end: 0 },
        operatorEngagement: 0.5
      }))
    )

    vi.mocked(callIntelligence).mockResolvedValue(err({ tag: "LLM_ERROR", message: "fail" }))

    const result = await analyzeConversationPatterns()

    expect(result).toEqual({ patterns: [], recurringUnresolved: [] })
  })
})
