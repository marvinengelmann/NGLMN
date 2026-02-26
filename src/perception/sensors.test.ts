vi.mock("@/memory/working.ts", () => ({
  getLastTickSummary: vi.fn(),
  getHealthCheck: vi.fn(),
  getPendingEmailCount: vi.fn(),
  peekAllPendingEmails: vi.fn(),
  getOperatorLastActivity: vi.fn()
}))

vi.mock("@/core/budget.ts", () => ({
  getBudgetState: vi.fn()
}))

vi.mock("@/integrations/openweather.ts", () => ({
  getCachedOrFetchWeather: vi.fn()
}))

vi.mock("@/integrations/location.ts", () => ({
  resolveOperatorLocation: vi.fn()
}))

import { getBudgetState } from "@/core/budget.ts"
import type { EmotionUpdateEvent } from "@/emotion/types.ts"
import { resolveOperatorLocation } from "@/integrations/location.ts"
import { getCachedOrFetchWeather } from "@/integrations/openweather.ts"
import {
  getHealthCheck,
  getLastTickSummary,
  getOperatorLastActivity,
  getPendingEmailCount,
  peekAllPendingEmails
} from "@/memory/working.ts"
import {
  makeBudgetState,
  makeOperatorLocation,
  makePendingEmail,
  makeTickSummary,
  makeWeatherData
} from "@/test/factories.ts"
import { readEmailActivity, readOwnState, readTelegramActivity, readWeatherData } from "./sensors.ts"

const mockGetLastTickSummary = getLastTickSummary as ReturnType<typeof vi.fn>
const mockGetHealthCheck = getHealthCheck as ReturnType<typeof vi.fn>
const mockGetPendingEmailCount = getPendingEmailCount as ReturnType<typeof vi.fn>
const mockPeekAllPendingEmails = peekAllPendingEmails as ReturnType<typeof vi.fn>
const mockGetOperatorLastActivity = getOperatorLastActivity as ReturnType<typeof vi.fn>
const mockGetBudgetState = getBudgetState as ReturnType<typeof vi.fn>
const mockGetCachedOrFetchWeather = getCachedOrFetchWeather as ReturnType<typeof vi.fn>
const mockResolveOperatorLocation = resolveOperatorLocation as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetBudgetState.mockResolvedValue(makeBudgetState({ consumedToday: 2, remainingToday: 6 }))
  mockGetLastTickSummary.mockResolvedValue(makeTickSummary({ timestamp: new Date().toISOString() }))
  mockGetHealthCheck.mockResolvedValue({ overall: "healthy", errors: [] })
  mockGetPendingEmailCount.mockResolvedValue(0)
  mockPeekAllPendingEmails.mockResolvedValue([])
  mockGetOperatorLastActivity.mockResolvedValue(null)
  mockGetCachedOrFetchWeather.mockResolvedValue(null)
  mockResolveOperatorLocation.mockResolvedValue(makeOperatorLocation())
})

describe("readOwnState", () => {
  it("returns healthy state with positive trigger for normal conditions", async () => {
    const result = await readOwnState()
    expect(result.healthStatus).toBe("healthy")
    expect(result.triggers.some((t: EmotionUpdateEvent) => t.trigger === "perception_positive")).toBe(true)
  })

  it("generates negative trigger for high budget usage", async () => {
    mockGetBudgetState.mockResolvedValue(makeBudgetState({ consumedToday: 7, dailyLimit: 8, remainingToday: 1 }))
    const result = await readOwnState()
    expect(result.budgetPercent).toBeGreaterThan(80)
    expect(result.triggers.some((t: EmotionUpdateEvent) => t.trigger === "perception_negative")).toBe(true)
  })

  it("generates negative trigger for critical health", async () => {
    mockGetHealthCheck.mockResolvedValue({ overall: "critical", errors: ["Redis down"] })
    const result = await readOwnState()
    expect(
      result.triggers.some(
        (t: EmotionUpdateEvent) => t.trigger === "perception_negative" && t.detail?.includes("critical")
      )
    ).toBe(true)
  })

  it("generates negative trigger for degraded health", async () => {
    mockGetHealthCheck.mockResolvedValue({ overall: "degraded", errors: [] })
    const result = await readOwnState()
    expect(
      result.triggers.some(
        (t: EmotionUpdateEvent) => t.trigger === "perception_negative" && t.detail?.includes("degraded")
      )
    ).toBe(true)
  })
})

describe("readTelegramActivity", () => {
  it("returns inactive with no triggers when no activity recorded", async () => {
    const result = await readTelegramActivity()
    expect(result.pendingCount).toBe(0)
    expect(result.operatorActive).toBe(false)
    expect(result.triggers).toHaveLength(0)
  })

  it("detects operator as active when last activity is recent", async () => {
    mockGetOperatorLastActivity.mockResolvedValue(new Date().toISOString())
    const result = await readTelegramActivity()
    expect(result.operatorActive).toBe(true)
    expect(result.pendingCount).toBe(0)
  })

  it("generates operator_silence trigger for long silence", async () => {
    const twoHoursAgo = new Date(Date.now() - 7200 * 1000).toISOString()
    mockGetOperatorLastActivity.mockResolvedValue(twoHoursAgo)
    const result = await readTelegramActivity()
    expect(result.operatorActive).toBe(false)
    expect(result.triggers.some((t: EmotionUpdateEvent) => t.trigger === "operator_silence")).toBe(true)
  })
})

describe("readEmailActivity", () => {
  it("returns no triggers when no emails pending", async () => {
    const result = await readEmailActivity()
    expect(result.pendingCount).toBe(0)
    expect(result.hasNewEmail).toBe(false)
    expect(result.triggers).toHaveLength(0)
  })

  it("generates email_received trigger for pending emails", async () => {
    mockGetPendingEmailCount.mockResolvedValue(2)
    mockPeekAllPendingEmails.mockResolvedValue([
      makePendingEmail({ emailId: "e1", receivedAt: new Date().toISOString() }),
      makePendingEmail({ emailId: "e2", receivedAt: new Date().toISOString() })
    ])
    const result = await readEmailActivity()
    expect(result.hasNewEmail).toBe(true)
    expect(result.triggers.some((t: EmotionUpdateEvent) => t.trigger === "email_received")).toBe(true)
  })

  it("scales intensity with pending count", async () => {
    mockGetPendingEmailCount.mockResolvedValue(3)
    mockPeekAllPendingEmails.mockResolvedValue([
      makePendingEmail({ emailId: "e1", receivedAt: new Date().toISOString() }),
      makePendingEmail({ emailId: "e2", receivedAt: new Date().toISOString() }),
      makePendingEmail({ emailId: "e3", receivedAt: new Date().toISOString() })
    ])
    const result = await readEmailActivity()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.trigger === "email_received")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(1)
  })
})

describe("readWeatherData", () => {
  it("returns null weatherData when location is null", async () => {
    mockResolveOperatorLocation.mockResolvedValue(null)
    const result = await readWeatherData()
    expect(result.weatherData).toBeNull()
    expect(result.triggers).toHaveLength(0)
    expect(mockGetCachedOrFetchWeather).not.toHaveBeenCalled()
  })

  it("passes resolved coordinates to weather fetch", async () => {
    const location = makeOperatorLocation({ latitude: 48.8566, longitude: 2.3522 })
    mockResolveOperatorLocation.mockResolvedValue(location)
    mockGetCachedOrFetchWeather.mockResolvedValue(makeWeatherData())

    await readWeatherData()

    expect(mockGetCachedOrFetchWeather).toHaveBeenCalledWith(48.8566, 2.3522)
  })

  it("returns null weatherData and no triggers when fetch fails", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(null)
    const result = await readWeatherData()
    expect(result.weatherData).toBeNull()
    expect(result.triggers).toHaveLength(0)
  })

  it("generates trigger for freezing conditions", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(makeWeatherData({ temperature: -5 }))
    const result = await readWeatherData()
    expect(result.weatherData).not.toBeNull()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.detail === "Freezing conditions")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(0.4)
  })

  it("generates trigger for extreme heat", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(makeWeatherData({ temperature: 40 }))
    const result = await readWeatherData()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.detail === "Extreme heat")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(0.4)
  })

  it("generates trigger for rainy weather", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(
      makeWeatherData({ condition: "Rain", description: "light rain", temperature: 15 })
    )
    const result = await readWeatherData()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.trigger === "weather_update")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(0.3)
    expect(trigger?.detail).toContain("light rain")
  })

  it("generates trigger for stormy weather", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(
      makeWeatherData({ condition: "Thunderstorm", description: "thunderstorm with rain", temperature: 18 })
    )
    const result = await readWeatherData()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.trigger === "weather_update")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(0.3)
  })

  it("generates trigger for beautiful weather", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(makeWeatherData({ condition: "Clear", temperature: 22 }))
    const result = await readWeatherData()
    const trigger = result.triggers.find((t: EmotionUpdateEvent) => t.detail === "Beautiful weather")
    expect(trigger).toBeDefined()
    expect(trigger?.intensity).toBe(0.3)
  })

  it("generates no trigger for mild cloudy weather", async () => {
    mockGetCachedOrFetchWeather.mockResolvedValue(makeWeatherData({ condition: "Clouds", temperature: 18 }))
    const result = await readWeatherData()
    expect(result.weatherData).not.toBeNull()
    expect(result.triggers).toHaveLength(0)
  })

  it("handles exception gracefully", async () => {
    mockResolveOperatorLocation.mockRejectedValue(new Error("Redis down"))
    const result = await readWeatherData()
    expect(result.weatherData).toBeNull()
    expect(result.triggers).toHaveLength(0)
  })
})
