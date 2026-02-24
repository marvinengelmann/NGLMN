import { afterEach, describe, expect, it, vi } from "vitest"

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockMigrate = vi.fn()
const mockEnsureSeeded = vi.fn()
const mockSetupSentry = vi.fn()
const mockDrizzle = vi.fn(() => "mock-db")
const mockNeon = vi.fn(() => "mock-neon-client")

vi.mock("@neondatabase/serverless", () => ({
  neon: mockNeon
}))

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: mockDrizzle
}))

vi.mock("drizzle-orm/neon-http/migrator", () => ({
  migrate: mockMigrate
}))

vi.mock("@/config/env.ts", () => ({
  env: () => ({ DATABASE_URL: "postgres://test" })
}))

vi.mock("@/config/setup-sentry", () => ({
  setupSentry: mockSetupSentry
}))

vi.mock("@/db/seed.ts", () => ({
  ensureSeeded: mockEnsureSeeded
}))

vi.mock("@/integrations/redis.ts", () => ({
  redis: { get: mockGet, set: mockSet }
}))

describe("init", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("calls setupSentry and runs migration when init key is not set", async () => {
    mockGet.mockResolvedValue(null)

    await import("./init.ts")

    expect(mockSetupSentry).toHaveBeenCalledOnce()
    expect(mockGet).toHaveBeenCalledWith("working:init:complete")
    expect(mockNeon).toHaveBeenCalledWith("postgres://test")
    expect(mockDrizzle).toHaveBeenCalledWith({ client: "mock-neon-client" })
    expect(mockMigrate).toHaveBeenCalledWith("mock-db", { migrationsFolder: "./drizzle" })
    expect(mockEnsureSeeded).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith("working:init:complete", "true")
  })

  it("skips migration when init key is already set", async () => {
    mockGet.mockResolvedValue("true")

    await import("./init.ts")

    expect(mockSetupSentry).toHaveBeenCalled()
    expect(mockGet).toHaveBeenCalledWith("working:init:complete")
    expect(mockMigrate).not.toHaveBeenCalled()
    expect(mockEnsureSeeded).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })
})
