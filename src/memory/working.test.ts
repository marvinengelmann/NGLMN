vi.mock("@/db/client.ts", () => ({ db: {} }))
vi.mock("@/db/schema.ts", () => ({}))

vi.mock("@/integrations/redis.ts", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    rpush: vi.fn(),
    lpush: vi.fn(),
    lrange: vi.fn(),
    llen: vi.fn(),
    ltrim: vi.fn(),
    ping: vi.fn(),
    incr: vi.fn()
  }
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

import { redis } from "@/integrations/redis.ts"
import { makePendingMessage } from "@/test/factories.ts"
import { getRecentRollbackCount, peekAllPendingMessages, pingRedis } from "./working.ts"

const mockRedis = vi.mocked(redis)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("parseRedisJson (via peekAllPendingMessages)", () => {
  it("parses valid JSON strings from Redis list", async () => {
    const msg = makePendingMessage({ text: "Hello!" })
    mockRedis.lrange.mockResolvedValue([JSON.stringify(msg)])

    const result = await peekAllPendingMessages()

    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe("Hello!")
  })

  it("parses already-deserialized objects from Redis list", async () => {
    const msg = makePendingMessage({ text: "Already parsed" })
    mockRedis.lrange.mockResolvedValue([msg as unknown as string])

    const result = await peekAllPendingMessages()

    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe("Already parsed")
  })

  it("throws on invalid JSON strings", async () => {
    mockRedis.lrange.mockResolvedValue(["not-valid-json"])

    await expect(peekAllPendingMessages()).rejects.toThrow()
  })

  it("throws on objects that don't match the schema", async () => {
    mockRedis.lrange.mockResolvedValue([JSON.stringify({ invalid: true })])

    await expect(peekAllPendingMessages()).rejects.toThrow()
  })
})

describe("pingRedis", () => {
  it("returns true when Redis responds with PONG", async () => {
    mockRedis.ping.mockResolvedValue("PONG")

    expect(await pingRedis()).toBe(true)
  })

  it("returns false when Redis responds with something else", async () => {
    mockRedis.ping.mockResolvedValue("ERROR")

    expect(await pingRedis()).toBe(false)
  })

  it("returns false when Redis throws", async () => {
    mockRedis.ping.mockRejectedValue(new Error("Connection failed"))

    expect(await pingRedis()).toBe(false)
  })
})

describe("getRecentRollbackCount", () => {
  it("counts events within time window", async () => {
    const recent = JSON.stringify({ tier: "soft", timestamp: new Date().toISOString() })
    const old = JSON.stringify({ tier: "hard", timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
    mockRedis.lrange.mockResolvedValue([recent, old])

    const count = await getRecentRollbackCount(24)

    expect(count).toBe(1)
  })

  it("returns 0 when all events are outside window", async () => {
    const old = JSON.stringify({ tier: "soft", timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() })
    mockRedis.lrange.mockResolvedValue([old])

    const count = await getRecentRollbackCount(24)

    expect(count).toBe(0)
  })

  it("returns 0 when list is empty", async () => {
    mockRedis.lrange.mockResolvedValue([])

    const count = await getRecentRollbackCount()

    expect(count).toBe(0)
  })
})
