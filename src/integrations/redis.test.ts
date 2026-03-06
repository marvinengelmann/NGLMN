import { afterEach, describe, expect, it, vi } from "vitest"
import * as z from "zod"

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn()
    })
  }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { log } from "@/lib/logger.ts"
import { getValidatedRedis, getValidatedRedisOr, parseRedisJson, redis } from "./redis.ts"

const mockedRedis = redis as unknown as { get: ReturnType<typeof vi.fn> }
const mockedLog = vi.mocked(log)

afterEach(() => {
  vi.clearAllMocks()
})

const TestSchema = z.object({ name: z.string(), value: z.number() })

describe("parseRedisJson", () => {
  it("parses valid JSON string", () => {
    const result = parseRedisJson(TestSchema, '{"name":"test","value":42}', "key")
    expect(result).toEqual({ name: "test", value: 42 })
  })

  it("returns null and warns on invalid JSON", () => {
    const result = parseRedisJson(TestSchema, "not valid json", "key")
    expect(result).toBeNull()
    expect(mockedLog.warn).toHaveBeenCalledWith("Redis validation failed", expect.objectContaining({ key: "key" }))
  })

  it("handles non-string values (already parsed objects)", () => {
    const result = parseRedisJson(TestSchema, { name: "test", value: 42 }, "key")
    expect(result).toEqual({ name: "test", value: 42 })
  })

  it("returns null on schema validation failure", () => {
    const result = parseRedisJson(TestSchema, '{"name":123}', "key")
    expect(result).toBeNull()
    expect(mockedLog.warn).toHaveBeenCalled()
  })
})

describe("getValidatedRedis", () => {
  it("returns parsed value when key exists", async () => {
    mockedRedis.get.mockResolvedValue('{"name":"hello","value":1}')
    const result = await getValidatedRedis("test-key", TestSchema)
    expect(result).toEqual({ name: "hello", value: 1 })
  })

  it("returns null when key does not exist", async () => {
    mockedRedis.get.mockResolvedValue(null)
    const result = await getValidatedRedis("test-key", TestSchema)
    expect(result).toBeNull()
  })

  it("returns null on parse failure", async () => {
    mockedRedis.get.mockResolvedValue("garbage")
    const result = await getValidatedRedis("test-key", TestSchema)
    expect(result).toBeNull()
  })
})

describe("getValidatedRedisOr", () => {
  it("returns parsed value when key exists", async () => {
    mockedRedis.get.mockResolvedValue('{"name":"found","value":10}')
    const result = await getValidatedRedisOr("key", TestSchema, { name: "default", value: 0 })
    expect(result).toEqual({ name: "found", value: 10 })
  })

  it("returns default when key is null", async () => {
    mockedRedis.get.mockResolvedValue(null)
    const result = await getValidatedRedisOr("key", TestSchema, { name: "default", value: 0 })
    expect(result).toEqual({ name: "default", value: 0 })
  })

  it("returns default on parse failure", async () => {
    mockedRedis.get.mockResolvedValue("bad data")
    const result = await getValidatedRedisOr("key", TestSchema, { name: "fallback", value: -1 })
    expect(result).toEqual({ name: "fallback", value: -1 })
  })
})
