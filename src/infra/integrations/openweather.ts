import { env } from "@/infra/config/env.ts"
import { fetchWithTimeout } from "@/infra/lib/fetch.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { getWeatherData, setWeatherData } from "@/perception/state.ts"
import type { WeatherData } from "./types.ts"

interface OpenWeatherResponse {
  weather?: Array<{ main: string; description: string }>
  main?: { temp: number; feels_like: number; humidity: number; pressure: number }
  wind?: { speed: number }
  clouds?: { all: number }
  sys?: { sunrise: number; sunset: number }
  name?: string
}

const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

/**
 * Fetch current weather from the OpenWeather API for given coordinates.
 * @param lat - Latitude of the location.
 * @param lon - Longitude of the location.
 * @returns Parsed WeatherData or null if the request fails.
 */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const apiKey = env().OPENWEATHER_API_KEY
  if (!apiKey) return null

  const url = `${OPENWEATHER_BASE_URL}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=en`

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) return null

    const data = (await response.json()) as OpenWeatherResponse

    const weather = data.weather?.[0]
    const { main, wind, clouds, sys } = data

    if (!weather || !main || !wind || !clouds || !sys) return null

    const now = Math.floor(Date.now() / 1000)
    const isDay = now >= sys.sunrise && now < sys.sunset

    return {
      temperature: main.temp,
      feelsLike: main.feels_like,
      humidity: main.humidity,
      pressure: main.pressure,
      windSpeed: wind.speed,
      condition: weather.main,
      description: weather.description,
      cloudPercent: clouds.all,
      isDay,
      locationName: data.name ?? undefined,
      fetchedAt: nowISO()
    }
  } catch {
    return null
  }
}

/**
 * Get weather data from cache or fetch from API if cache is expired.
 * @param lat - Latitude of the location.
 * @param lon - Longitude of the location.
 */
export async function getCachedOrFetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const cached = await getWeatherData()
  if (cached) return cached

  const fresh = await fetchCurrentWeather(lat, lon)
  if (fresh) {
    await setWeatherData(fresh)
  }
  return fresh
}

/**
 * Check if the OpenWeather API is reachable.
 */
export async function pingOpenWeather(): Promise<boolean> {
  const apiKey = env().OPENWEATHER_API_KEY
  if (!apiKey) return false

  try {
    const url = `${OPENWEATHER_BASE_URL}?lat=0&lon=0&appid=${apiKey}&units=metric&lang=en`
    const response = await fetchWithTimeout(url)
    return response.ok
  } catch {
    return false
  }
}
