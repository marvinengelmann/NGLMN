import * as z from "zod"
import { env } from "@/config/env.ts"
import type { OperatorLocation } from "@/integrations/types.ts"
import { fetchWithTimeout } from "@/lib/fetch.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { nowISO } from "@/lib/time.ts"
import { getKnowledge, storeKnowledge } from "@/memory/semantic.ts"
import { SemanticCategory, SemanticScope, SemanticSource } from "@/memory/types.ts"
import { clearWeatherData, getOperatorLocation, setOperatorLocation } from "@/perception/state.ts"

const OPENWEATHER_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct"
const ENV_DEFAULT_CACHE_TTL_SECONDS = 86400

/**
 * Geocode a city name to coordinates using the OpenWeather Geocoding API.
 */
export async function geocodeCityName(cityName: string): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = env().OPENWEATHER_API_KEY
  if (!apiKey) return null

  try {
    const url = `${OPENWEATHER_GEO_URL}?q=${encodeURIComponent(cityName)}&limit=1&appid=${apiKey}`
    const response = await fetchWithTimeout(url)
    if (!response.ok) return null

    const data = (await response.json()) as Array<{ lat: number; lon: number }>
    if (!data[0]) return null

    return { latitude: data[0].lat, longitude: data[0].lon }
  } catch {
    return null
  }
}

/**
 * Resolve the operator's current location using a priority chain:
 * 1. Redis cache (from Telegram location sharing)
 * 2. Semantic memory (learned location)
 * 3. OPENWEATHER_DEFAULT_LOCATION env var (geocoded)
 */
export async function resolveOperatorLocation(): Promise<OperatorLocation | null> {
  const cached = await getOperatorLocation()
  if (cached) return cached

  const knowledgeResult = await getKnowledge({ category: "knowledge", key: "operator_location" })
  if (knowledgeResult.isOk()) {
    const rows = knowledgeResult.value
    if (rows.length > 0) {
      const StoredLocation = z.object({
        latitude: z.number(),
        longitude: z.number(),
        cityName: z.string().optional()
      })
      const parsed = StoredLocation.safeParse(rows[0]?.value)
      if (parsed.success) {
        return {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          cityName: parsed.data.cityName,
          source: "semantic_memory",
          updatedAt: rows[0]?.updatedAt?.toISOString() ?? nowISO()
        }
      }
    }
  }

  const defaultLocation = env().OPENWEATHER_DEFAULT_LOCATION
  if (defaultLocation) {
    const coords = await geocodeCityName(defaultLocation)
    if (coords) {
      const location: OperatorLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        cityName: defaultLocation,
        source: "env_default",
        updatedAt: nowISO()
      }
      await setOperatorLocation(location, ENV_DEFAULT_CACHE_TTL_SECONDS)
      return location
    }
  }

  return null
}

/**
 * Store operator location from a Telegram location message.
 * Invalidates the weather cache so fresh data is fetched for the new location.
 */
export async function storeOperatorLocationFromTelegram(latitude: number, longitude: number): Promise<void> {
  const location: OperatorLocation = {
    latitude,
    longitude,
    source: "telegram",
    updatedAt: nowISO()
  }
  await setOperatorLocation(location)
  await clearWeatherData()
}

/**
 * Store operator location in semantic memory for long-term persistence.
 */
export async function storeOperatorLocationInMemory(
  latitude: number,
  longitude: number,
  cityName?: string
): Promise<void> {
  const result = await storeKnowledge(
    SemanticCategory.enum.knowledge,
    "operator_location",
    { latitude, longitude, cityName },
    SemanticSource.enum.operator,
    0.9,
    SemanticScope.enum.operator
  )
  if (result.isErr()) logAndCaptureError(result.error)
}
