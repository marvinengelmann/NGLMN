vi.mock("@/memory/working.ts", () => ({
  getWeatherData: vi.fn(),
  setWeatherData: vi.fn()
}))

import { getWeatherData, setWeatherData } from "@/memory/working.ts"
import { makeWeatherData } from "@/test/factories.ts"
import { fetchCurrentWeather, getCachedOrFetchWeather, pingOpenWeather } from "./openweather.ts"

const mockGetWeatherData = getWeatherData as ReturnType<typeof vi.fn>
const mockSetWeatherData = setWeatherData as ReturnType<typeof vi.fn>

const VALID_API_RESPONSE = {
  weather: [{ main: "Clear", description: "clear sky" }],
  main: { temp: 20, feels_like: 19, humidity: 55, pressure: 1013 },
  wind: { speed: 3.5 },
  clouds: { all: 10 },
  sys: { sunrise: 1000000, sunset: 9999999999 },
  name: "Mannheim"
}

beforeEach(() => {
  vi.stubEnv("OPENWEATHER_API_KEY", "test-key")
  mockGetWeatherData.mockResolvedValue(null)
  mockSetWeatherData.mockResolvedValue(undefined)
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("fetchCurrentWeather", () => {
  it("parses a successful API response with locationName", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(VALID_API_RESPONSE), { status: 200 }))

    const result = await fetchCurrentWeather(49.4875, 8.466)

    expect(result).not.toBeNull()
    expect(result?.temperature).toBe(20)
    expect(result?.feelsLike).toBe(19)
    expect(result?.humidity).toBe(55)
    expect(result?.condition).toBe("Clear")
    expect(result?.description).toBe("clear sky")
    expect(result?.windSpeed).toBe(3.5)
    expect(result?.cloudPercent).toBe(10)
    expect(result?.isDay).toBe(true)
    expect(result?.locationName).toBe("Mannheim")
    expect(result?.fetchedAt).toBeTruthy()
  })

  it("passes lat/lon to API URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(VALID_API_RESPONSE), { status: 200 }))

    await fetchCurrentWeather(49.4875, 8.466)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("lat=49.4875")
    expect(calledUrl).toContain("lon=8.466")
  })

  it("returns null when API returns non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }))

    const result = await fetchCurrentWeather(49.4875, 8.466)
    expect(result).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    const result = await fetchCurrentWeather(49.4875, 8.466)
    expect(result).toBeNull()
  })

  it("returns null when response is missing required fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ weather: [] }), { status: 200 }))

    const result = await fetchCurrentWeather(49.4875, 8.466)
    expect(result).toBeNull()
  })

  it("returns null when API key is missing", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "")

    const result = await fetchCurrentWeather(49.4875, 8.466)
    expect(result).toBeNull()
  })

  it("handles missing name in API response gracefully", async () => {
    const { name: _, ...responseWithoutName } = VALID_API_RESPONSE
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(responseWithoutName), { status: 200 }))

    const result = await fetchCurrentWeather(49.4875, 8.466)

    expect(result).not.toBeNull()
    expect(result?.locationName).toBeUndefined()
  })
})

describe("getCachedOrFetchWeather", () => {
  it("returns cached data when available", async () => {
    const cached = makeWeatherData({ temperature: 15 })
    mockGetWeatherData.mockResolvedValue(cached)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await getCachedOrFetchWeather(49.4875, 8.466)

    expect(result).toEqual(cached)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fetches from API and caches when no cached data", async () => {
    mockGetWeatherData.mockResolvedValue(null)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(VALID_API_RESPONSE), { status: 200 }))

    const result = await getCachedOrFetchWeather(49.4875, 8.466)

    expect(result).not.toBeNull()
    expect(result?.temperature).toBe(20)
    expect(result?.locationName).toBe("Mannheim")
    expect(mockSetWeatherData).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 20, locationName: "Mannheim" })
    )
  })

  it("returns null when both cache and API fail", async () => {
    mockGetWeatherData.mockResolvedValue(null)
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"))

    const result = await getCachedOrFetchWeather(49.4875, 8.466)
    expect(result).toBeNull()
  })
})

describe("pingOpenWeather", () => {
  it("returns true when API is reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(VALID_API_RESPONSE), { status: 200 }))

    const result = await pingOpenWeather()
    expect(result).toBe(true)
  })

  it("returns false when API returns error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Error", { status: 500 }))

    const result = await pingOpenWeather()
    expect(result).toBe(false)
  })

  it("returns false when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"))

    const result = await pingOpenWeather()
    expect(result).toBe(false)
  })

  it("returns false when API key is missing", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "")

    const result = await pingOpenWeather()
    expect(result).toBe(false)
  })
})
