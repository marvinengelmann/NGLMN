import { afterEach, describe, expect, it, vi } from "vitest"
import { env, resetEnvCache } from "./env.ts"

afterEach(() => {
  resetEnvCache()
  vi.unstubAllEnvs()
})

describe("env", () => {
  it("validates and returns a string env var", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test")
    expect(env().DATABASE_URL).toBe("postgresql://localhost/test")
  })

  it("caches validated values on subsequent access", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test")
    const first = env().DATABASE_URL
    vi.stubEnv("DATABASE_URL", "changed")
    expect(env().DATABASE_URL).toBe(first)
  })

  it("throws on unknown env var", () => {
    expect(() => (env() as Record<string, unknown>).TOTALLY_UNKNOWN_VAR).toThrow("Unknown env var accessed")
  })

  it("throws on missing required env var when not set", () => {
    vi.stubEnv("DATABASE_URL", undefined as unknown as string)
    expect(() => env().DATABASE_URL).toThrow("Missing or invalid env var")
  })

  it("returns default for optional env vars with defaults", () => {
    vi.stubEnv("NODE_ENV", undefined as unknown as string)
    expect(env().NODE_ENV).toBe("development")
  })
})

describe("resetEnvCache", () => {
  it("clears the cache so values are re-validated", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/first")
    expect(env().DATABASE_URL).toBe("postgresql://localhost/first")

    resetEnvCache()
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/second")
    expect(env().DATABASE_URL).toBe("postgresql://localhost/second")
  })
})
