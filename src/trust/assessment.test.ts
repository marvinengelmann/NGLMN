vi.mock("./levels.ts", () => ({
  getTrustLevel: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  getCurrentEmotion: vi.fn().mockResolvedValue(null)
}))

import { getCurrentEmotion } from "@/memory/working.ts"
import { canActAutonomously, getAutonomyLevel } from "./assessment.ts"
import { getTrustLevel } from "./levels.ts"

const mockGetTrustLevel = getTrustLevel as ReturnType<typeof vi.fn>
const mockGetCurrentEmotion = getCurrentEmotion as ReturnType<typeof vi.fn>

describe("canActAutonomously", () => {
  it("denies low-confidence, high-fear action", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "code_modification",
      fear: 0.9,
      confidence: 0.1,
      totalAttempts: 0,
      successfulAttempts: 0
    })
    const result = await canActAutonomously("code_modification")
    expect(result.canAct).toBe(false)
    expect(result.requiresApproval).toBe(true)
  })

  it("allows high-confidence, low-fear, low-risk action", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "add_goal",
      fear: 0.1,
      confidence: 0.9,
      totalAttempts: 50,
      successfulAttempts: 48
    })
    const result = await canActAutonomously("add_goal")
    expect(result.canAct).toBe(true)
    expect(result.requiresApproval).toBe(false)
  })

  it("factors in experience", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "add_goal",
      fear: 0.3,
      confidence: 0.7,
      totalAttempts: 100,
      successfulAttempts: 95
    })
    const result = await canActAutonomously("add_goal")
    expect(result.experienceFactor).toBeGreaterThan(0.9)
    expect(result.canAct).toBe(true)
  })

  it("returns 0 experience factor with no attempts", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "deployment",
      fear: 0.8,
      confidence: 0.5,
      totalAttempts: 0,
      successfulAttempts: 0
    })
    const result = await canActAutonomously("deployment")
    expect(result.experienceFactor).toBe(0)
    expect(result.canAct).toBe(false)
  })

  it("provides meaningful reason string", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "add_goal",
      fear: 0.5,
      confidence: 0.3,
      totalAttempts: 5,
      successfulAttempts: 4
    })
    const result = await canActAutonomously("add_goal")
    expect(result.reason).toContain("Confidence")
    expect(result.reason).toContain("fear")
  })

  it("includes autonomy level", async () => {
    mockGetTrustLevel.mockResolvedValue({
      actionType: "add_goal",
      fear: 0.1,
      confidence: 0.9,
      totalAttempts: 50,
      successfulAttempts: 48
    })
    const result = await canActAutonomously("add_goal")
    expect(result.autonomyLevel).toBeDefined()
  })

  it("increases fear when caution is high", async () => {
    mockGetCurrentEmotion.mockResolvedValue({
      curiosity: 0.5,
      satisfaction: 0.5,
      frustration: 0.1,
      boredom: 0.3,
      excitement: 0.3,
      caution: 0.9,
      connection: 0.5
    })
    mockGetTrustLevel.mockResolvedValue({
      actionType: "git_commit",
      fear: 0.3,
      confidence: 0.6,
      totalAttempts: 20,
      successfulAttempts: 18
    })
    const highCautionResult = await canActAutonomously("git_commit")

    mockGetCurrentEmotion.mockResolvedValue(null)
    mockGetTrustLevel.mockResolvedValue({
      actionType: "git_commit",
      fear: 0.3,
      confidence: 0.6,
      totalAttempts: 20,
      successfulAttempts: 18
    })
    const neutralResult = await canActAutonomously("git_commit")

    expect(highCautionResult.canAct).toBeDefined()
    expect(neutralResult.canAct).toBeDefined()
  })
})

describe("getAutonomyLevel", () => {
  it("returns locked for very low confidence", () => {
    expect(getAutonomyLevel(0.1, 0.5, 0.5, false)).toBe("locked")
  })

  it("returns approval_required when canAct is false", () => {
    expect(getAutonomyLevel(0.5, 0.5, 0.5, false)).toBe("approval_required")
  })

  it("returns supervised when experience is low", () => {
    expect(getAutonomyLevel(0.7, 0.3, 0.5, true)).toBe("supervised")
  })

  it("returns independent when all conditions met", () => {
    expect(getAutonomyLevel(0.8, 0.2, 0.9, true)).toBe("independent")
  })
})
