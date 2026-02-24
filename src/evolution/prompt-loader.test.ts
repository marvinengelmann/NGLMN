vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
  return { db: chain }
})

vi.mock("@/db/schema.ts", () => ({
  promptVersions: { content: "content", promptId: "promptId", version: "version" }
}))

import { db } from "@/db/client.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { loadPrompt } from "./prompt-loader.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
})

describe("loadPrompt", () => {
  it("returns DB content when a version exists", async () => {
    mockDb.limit.mockResolvedValue([{ content: "You are a helpful AI." }])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("You are a helpful AI.")
  })

  it("returns fallback when DB returns empty rows", async () => {
    mockDb.limit.mockResolvedValue([])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("fallback prompt")
  })

  it("returns fallback when DB row has null content", async () => {
    mockDb.limit.mockResolvedValue([{ content: null }])

    const result = await loadPrompt("triage", "fallback prompt")

    expect(result).toBe("fallback prompt")
  })
})
