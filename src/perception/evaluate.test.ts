vi.mock("./sensors.ts", () => ({
  readOwnState: vi.fn(),
  readTelegramActivity: vi.fn(),
  readEmailActivity: vi.fn(),
  readWeatherData: vi.fn(),
  readGitActivity: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  setPerceptionSummary: vi.fn()
}))

import { setPerceptionSummary } from "@/memory/working.ts"
import { makeWeatherData } from "@/test/factories.ts"
import { evaluatePerception } from "./evaluate.ts"
import { readEmailActivity, readGitActivity, readOwnState, readTelegramActivity, readWeatherData } from "./sensors.ts"

const mockReadOwnState = readOwnState as ReturnType<typeof vi.fn>
const mockReadTelegramActivity = readTelegramActivity as ReturnType<typeof vi.fn>
const mockReadEmailActivity = readEmailActivity as ReturnType<typeof vi.fn>
const mockReadWeatherData = readWeatherData as ReturnType<typeof vi.fn>
const mockReadGitActivity = readGitActivity as ReturnType<typeof vi.fn>
const mockSetPerceptionSummary = setPerceptionSummary as ReturnType<typeof vi.fn>

describe("evaluatePerception", () => {
  beforeEach(() => {
    mockReadOwnState.mockResolvedValue({
      budgetPercent: 25,
      lastTickAge: 60,
      errorCount: 0,
      healthStatus: "healthy",
      triggers: [{ trigger: "perception_positive", intensity: 0.3, detail: "All good" }]
    })
    mockReadTelegramActivity.mockResolvedValue({
      pendingCount: 2,
      lastMessageAge: 30,
      operatorActive: true,
      triggers: [{ trigger: "message_received", intensity: 0.6, detail: "2 pending" }]
    })
    mockReadEmailActivity.mockResolvedValue({
      pendingCount: 0,
      lastEmailAge: -1,
      hasNewEmail: false,
      triggers: []
    })
    mockReadWeatherData.mockResolvedValue({
      weatherData: null,
      triggers: []
    })
    mockReadGitActivity.mockResolvedValue({
      recentCommits: [],
      selfCommitCount: 0,
      externalCommitCount: 0,
      triggers: []
    })
    mockSetPerceptionSummary.mockResolvedValue(undefined)
  })

  it("aggregates triggers from all sensors", async () => {
    const result = await evaluatePerception()
    expect(result.emotionalTriggers).toHaveLength(2)
    expect(result.emotionalTriggers.some((t) => t.trigger === "perception_positive")).toBe(true)
    expect(result.emotionalTriggers.some((t) => t.trigger === "message_received")).toBe(true)
  })

  it("includes own state in summary", async () => {
    const result = await evaluatePerception()
    expect(result.ownState.budgetPercent).toBe(25)
    expect(result.ownState.healthStatus).toBe("healthy")
  })

  it("includes telegram activity in summary", async () => {
    const result = await evaluatePerception()
    expect(result.telegramActivity.pendingCount).toBe(2)
    expect(result.telegramActivity.operatorActive).toBe(true)
  })

  it("caches summary in Redis", async () => {
    await evaluatePerception()
    expect(mockSetPerceptionSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        ownState: expect.any(Object),
        telegramActivity: expect.any(Object),
        emotionalTriggers: expect.any(Array)
      })
    )
  })

  it("has valid ISO timestamp", async () => {
    const result = await evaluatePerception()
    expect(() => new Date(result.timestamp)).not.toThrow()
    expect(new Date(result.timestamp).toISOString()).toBeTruthy()
  })

  it("includes email activity in summary", async () => {
    mockReadEmailActivity.mockResolvedValue({
      pendingCount: 1,
      lastEmailAge: 120,
      hasNewEmail: true,
      triggers: [{ trigger: "email_received", intensity: 0.4, detail: "1 pending email(s)" }]
    })
    const result = await evaluatePerception()
    expect(result.emailActivity).toBeDefined()
    expect(result.emailActivity?.pendingCount).toBe(1)
    expect(result.emailActivity?.hasNewEmail).toBe(true)
  })

  it("aggregates email triggers with other triggers", async () => {
    mockReadEmailActivity.mockResolvedValue({
      pendingCount: 1,
      lastEmailAge: 120,
      hasNewEmail: true,
      triggers: [{ trigger: "email_received", intensity: 0.4, detail: "1 pending email(s)" }]
    })
    const result = await evaluatePerception()
    expect(result.emotionalTriggers).toHaveLength(3)
    expect(result.emotionalTriggers.some((t) => t.trigger === "email_received")).toBe(true)
  })

  it("includes weather data in summary when available", async () => {
    const weatherData = makeWeatherData({ temperature: 22, condition: "Clear" })
    mockReadWeatherData.mockResolvedValue({
      weatherData,
      triggers: [{ trigger: "weather_update", intensity: 0.3, detail: "Beautiful weather" }]
    })
    const result = await evaluatePerception()
    expect(result.weatherData).toEqual(weatherData)
    expect(result.emotionalTriggers.some((t) => t.trigger === "weather_update")).toBe(true)
  })

  it("excludes weather data from summary when null", async () => {
    mockReadWeatherData.mockResolvedValue({
      weatherData: null,
      triggers: []
    })
    const result = await evaluatePerception()
    expect(result.weatherData).toBeUndefined()
  })

  it("aggregates weather triggers with other triggers", async () => {
    mockReadWeatherData.mockResolvedValue({
      weatherData: makeWeatherData({ temperature: -5 }),
      triggers: [{ trigger: "weather_update", intensity: 0.4, detail: "Freezing conditions" }]
    })
    const result = await evaluatePerception()
    expect(result.emotionalTriggers).toHaveLength(3)
    expect(result.emotionalTriggers.some((t) => t.trigger === "weather_update")).toBe(true)
    expect(result.emotionalTriggers.some((t) => t.trigger === "perception_positive")).toBe(true)
    expect(result.emotionalTriggers.some((t) => t.trigger === "message_received")).toBe(true)
  })

  it("includes git activity in summary when commits exist", async () => {
    mockReadGitActivity.mockResolvedValue({
      recentCommits: [
        { sha: "abc123", message: "Evolution #1: Improve prompts", date: "2026-02-22T10:00:00Z", isSelfAuthored: true },
        {
          sha: "def456",
          message: "fix(perception): Add weather sensor",
          date: "2026-02-22T09:00:00Z",
          isSelfAuthored: false
        }
      ],
      selfCommitCount: 1,
      externalCommitCount: 1,
      triggers: [{ trigger: "git_activity", intensity: 0.2, detail: "1 external commit(s) in last 24h" }]
    })
    const result = await evaluatePerception()
    expect(result.gitActivity).toBeDefined()
    expect(result.gitActivity?.recentCommits).toHaveLength(2)
    expect(result.gitActivity?.selfCommitCount).toBe(1)
    expect(result.gitActivity?.externalCommitCount).toBe(1)
  })

  it("excludes git activity from summary when no commits", async () => {
    const result = await evaluatePerception()
    expect(result.gitActivity).toBeUndefined()
  })

  it("aggregates git triggers with other triggers", async () => {
    mockReadGitActivity.mockResolvedValue({
      recentCommits: [
        { sha: "abc123", message: "feat: new feature", date: "2026-02-22T10:00:00Z", isSelfAuthored: false }
      ],
      selfCommitCount: 0,
      externalCommitCount: 1,
      triggers: [{ trigger: "git_activity", intensity: 0.2, detail: "1 external commit(s) in last 24h" }]
    })
    const result = await evaluatePerception()
    expect(result.emotionalTriggers).toHaveLength(3)
    expect(result.emotionalTriggers.some((t) => t.trigger === "git_activity")).toBe(true)
  })
})
