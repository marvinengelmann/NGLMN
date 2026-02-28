vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn()
  }
}))

vi.mock("@/emotion/state.ts", () => ({
  processEmotionTrigger: vi.fn()
}))

vi.mock("@/memory/goals.ts", () => ({
  createGoal: vi.fn(),
  goalExistsByTitle: vi.fn().mockResolvedValue(false)
}))

import { ok } from "neverthrow"
import { redis } from "@/integrations/redis.ts"
import { createGoal, goalExistsByTitle } from "@/memory/goals.ts"
import { makeEmotionalState, makePerceptionSummary } from "@/test/factories.ts"
import { detectPatterns, detectPerceptionGoals } from "./goals.ts"

const mockRedisGet = redis.get as ReturnType<typeof vi.fn>
const mockRedisSet = redis.set as ReturnType<typeof vi.fn>
const mockCreateGoal = createGoal as ReturnType<typeof vi.fn>
const mockGoalExistsByTitle = goalExistsByTitle as ReturnType<typeof vi.fn>

describe("detectPatterns", () => {
  it("detects operator silence pattern", () => {
    const perception = makePerceptionSummary({
      telegramActivity: { pendingCount: 0, lastMessageAge: 90000, operatorActive: false }
    })
    const patterns = detectPatterns(perception)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]?.title).toBe("Reconnect with operator")
  })

  it("does not detect operator silence if operator is active", () => {
    const perception = makePerceptionSummary({
      telegramActivity: { pendingCount: 0, lastMessageAge: 90000, operatorActive: true }
    })
    const patterns = detectPatterns(perception)
    expect(patterns.find((p) => p.title === "Reconnect with operator")).toBeUndefined()
  })

  it("detects budget crisis pattern", () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 90, lastTickAge: 60, errorCount: 0, healthStatus: "healthy" }
    })
    const patterns = detectPatterns(perception)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]?.title).toBe("Optimize resource usage")
  })

  it("does not detect budget crisis at 50%", () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 50, lastTickAge: 60, errorCount: 0, healthStatus: "healthy" }
    })
    const patterns = detectPatterns(perception)
    expect(patterns.find((p) => p.title === "Optimize resource usage")).toBeUndefined()
  })

  it("detects external git activity pattern", () => {
    const perception = makePerceptionSummary({
      gitActivity: {
        recentCommits: [
          { sha: "a", message: "fix", date: "2026-01-01", isSelfAuthored: false },
          { sha: "b", message: "feat", date: "2026-01-01", isSelfAuthored: false },
          { sha: "c", message: "chore", date: "2026-01-01", isSelfAuthored: false }
        ],
        selfCommitCount: 0,
        externalCommitCount: 3
      }
    })
    const patterns = detectPatterns(perception)
    expect(patterns.find((p) => p.title === "Review recent external changes")).toBeDefined()
  })

  it("detects system degradation pattern", () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 25, lastTickAge: 60, errorCount: 5, healthStatus: "degraded" }
    })
    const patterns = detectPatterns(perception)
    expect(patterns.find((p) => p.title === "Investigate system health issues")).toBeDefined()
  })

  it("does not detect degradation when healthy", () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 25, lastTickAge: 60, errorCount: 5, healthStatus: "healthy" }
    })
    const patterns = detectPatterns(perception)
    expect(patterns.find((p) => p.title === "Investigate system health issues")).toBeUndefined()
  })

  it("returns empty array when no patterns match", () => {
    const perception = makePerceptionSummary()
    const patterns = detectPatterns(perception)
    expect(patterns).toHaveLength(0)
  })
})

describe("detectPerceptionGoals", () => {
  const emotion = makeEmotionalState()

  beforeEach(() => {
    mockRedisGet.mockResolvedValue(null)
    mockRedisSet.mockResolvedValue("OK")
    mockCreateGoal.mockResolvedValue(ok("goal-new"))
    mockGoalExistsByTitle.mockResolvedValue(false)
  })

  it("skips when frequency key exists", async () => {
    mockRedisGet.mockResolvedValue("1")
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 95, lastTickAge: 60, errorCount: 0, healthStatus: "healthy" }
    })
    const count = await detectPerceptionGoals(perception, emotion)
    expect(count).toBe(0)
    expect(mockCreateGoal).not.toHaveBeenCalled()
  })

  it("sets frequency key with TTL after check", async () => {
    const perception = makePerceptionSummary()
    await detectPerceptionGoals(perception, emotion)
    expect(mockRedisSet).toHaveBeenCalledWith("working:perception:lastGoalCheck", "1", { ex: 3600 })
  })

  it("creates goals for detected patterns", async () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 90, lastTickAge: 60, errorCount: 0, healthStatus: "healthy" }
    })
    const count = await detectPerceptionGoals(perception, emotion)
    expect(count).toBe(1)
    expect(mockCreateGoal).toHaveBeenCalledWith(
      "Optimize resource usage",
      expect.stringContaining("90%"),
      "self",
      0.8,
      { emotionalWeight: 0.6 }
    )
  })

  it("skips goal creation when goal with same title already exists", async () => {
    mockGoalExistsByTitle.mockResolvedValue(true)
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 90, lastTickAge: 60, errorCount: 0, healthStatus: "healthy" }
    })
    const count = await detectPerceptionGoals(perception, emotion)
    expect(count).toBe(0)
    expect(mockCreateGoal).not.toHaveBeenCalled()
  })

  it("creates multiple goals for multiple patterns", async () => {
    const perception = makePerceptionSummary({
      ownState: { budgetPercent: 90, lastTickAge: 60, errorCount: 5, healthStatus: "degraded" }
    })
    const count = await detectPerceptionGoals(perception, emotion)
    expect(count).toBe(2)
    expect(mockCreateGoal).toHaveBeenCalledTimes(2)
  })
})
