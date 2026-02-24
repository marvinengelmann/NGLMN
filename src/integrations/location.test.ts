vi.mock("@/memory/working.ts", () => ({
  getOperatorLocation: vi.fn(),
  setOperatorLocation: vi.fn(),
  clearWeatherData: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getKnowledge: vi.fn(),
  storeKnowledge: vi.fn()
}))

import { err, ok } from "neverthrow"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import { clearWeatherData, getOperatorLocation, setOperatorLocation } from "@/memory/working.ts"
import {
  geocodeCityName,
  resolveOperatorLocation,
  storeOperatorLocationFromTelegram,
  storeOperatorLocationInMemory
} from "./location.ts"

const mockGetOperatorLocation = getOperatorLocation as ReturnType<typeof vi.fn>
const mockSetOperatorLocation = setOperatorLocation as ReturnType<typeof vi.fn>
const mockClearWeatherData = clearWeatherData as ReturnType<typeof vi.fn>
const mockGetKnowledge = getKnowledge as ReturnType<typeof vi.fn>
const mockStoreKnowledge = storeKnowledge as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv("OPENWEATHER_API_KEY", "test-key")
  vi.stubEnv("OPENWEATHER_DEFAULT_LOCATION", "")
  mockGetOperatorLocation.mockResolvedValue(null)
  mockSetOperatorLocation.mockResolvedValue(undefined)
  mockClearWeatherData.mockResolvedValue(undefined)
  mockGetKnowledge.mockResolvedValue(ok([]))
  mockStoreKnowledge.mockResolvedValue(ok("id-1"))
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("geocodeCityName", () => {
  it("returns coordinates for a valid city", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ lat: 49.4875, lon: 8.466 }]), { status: 200 })
    )

    const result = await geocodeCityName("Mannheim")

    expect(result).toEqual({ latitude: 49.4875, longitude: 8.466 })
  })

  it("returns null when API returns empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    const result = await geocodeCityName("NonexistentCity")
    expect(result).toBeNull()
  })

  it("returns null when API returns non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }))

    const result = await geocodeCityName("Mannheim")
    expect(result).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    const result = await geocodeCityName("Mannheim")
    expect(result).toBeNull()
  })

  it("returns null when API key is missing", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "")

    const result = await geocodeCityName("Mannheim")
    expect(result).toBeNull()
  })
})

describe("resolveOperatorLocation", () => {
  it("returns Redis-cached location (priority 1)", async () => {
    const cached = {
      latitude: 49.4875,
      longitude: 8.466,
      source: "telegram" as const,
      updatedAt: new Date().toISOString()
    }
    mockGetOperatorLocation.mockResolvedValue(cached)

    const result = await resolveOperatorLocation()

    expect(result).toEqual(cached)
    expect(mockGetKnowledge).not.toHaveBeenCalled()
  })

  it("returns semantic memory location (priority 2)", async () => {
    mockGetOperatorLocation.mockResolvedValue(null)
    mockGetKnowledge.mockResolvedValue(
      ok([
        {
          value: { latitude: 48.8566, longitude: 2.3522, cityName: "Paris" },
          updatedAt: new Date()
        }
      ])
    )

    const result = await resolveOperatorLocation()

    expect(result).not.toBeNull()
    expect(result?.latitude).toBe(48.8566)
    expect(result?.longitude).toBe(2.3522)
    expect(result?.cityName).toBe("Paris")
    expect(result?.source).toBe("semantic_memory")
  })

  it("returns geocoded env default (priority 3)", async () => {
    mockGetOperatorLocation.mockResolvedValue(null)
    mockGetKnowledge.mockResolvedValue(ok([]))
    vi.stubEnv("OPENWEATHER_DEFAULT_LOCATION", "Mannheim")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ lat: 49.4875, lon: 8.466 }]), { status: 200 })
    )

    const result = await resolveOperatorLocation()

    expect(result).not.toBeNull()
    expect(result?.latitude).toBe(49.4875)
    expect(result?.longitude).toBe(8.466)
    expect(result?.cityName).toBe("Mannheim")
    expect(result?.source).toBe("env_default")
    expect(mockSetOperatorLocation).toHaveBeenCalledWith(expect.objectContaining({ source: "env_default" }), 86400)
  })

  it("returns null when all sources fail", async () => {
    mockGetOperatorLocation.mockResolvedValue(null)
    mockGetKnowledge.mockResolvedValue(ok([]))

    const result = await resolveOperatorLocation()
    expect(result).toBeNull()
  })

  it("skips semantic memory when it throws and falls through", async () => {
    mockGetOperatorLocation.mockResolvedValue(null)
    mockGetKnowledge.mockResolvedValue(err({ tag: "DB_ERROR", message: "DB down", cause: new Error("DB down") }))
    vi.stubEnv("OPENWEATHER_DEFAULT_LOCATION", "Berlin")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ lat: 52.52, lon: 13.405 }]), { status: 200 })
    )

    const result = await resolveOperatorLocation()

    expect(result).not.toBeNull()
    expect(result?.source).toBe("env_default")
  })
})

describe("storeOperatorLocationFromTelegram", () => {
  it("stores location in Redis and clears weather cache", async () => {
    await storeOperatorLocationFromTelegram(49.4875, 8.466)

    expect(mockSetOperatorLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 49.4875,
        longitude: 8.466,
        source: "telegram"
      })
    )
    expect(mockClearWeatherData).toHaveBeenCalled()
  })
})

describe("storeOperatorLocationInMemory", () => {
  it("stores location in semantic memory", async () => {
    await storeOperatorLocationInMemory(49.4875, 8.466, "Mannheim")

    expect(mockStoreKnowledge).toHaveBeenCalledWith(
      "knowledge",
      "operator_location",
      { latitude: 49.4875, longitude: 8.466, cityName: "Mannheim" },
      "operator",
      0.9
    )
  })

  it("stores without cityName", async () => {
    await storeOperatorLocationInMemory(52.52, 13.405)

    expect(mockStoreKnowledge).toHaveBeenCalledWith(
      "knowledge",
      "operator_location",
      { latitude: 52.52, longitude: 13.405, cityName: undefined },
      "operator",
      0.9
    )
  })
})
