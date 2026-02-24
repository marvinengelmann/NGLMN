vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue([{ id: "evo-1" }])
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue([])
  return { db: chain }
})

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

import { ok } from "neverthrow"
import { db } from "@/db/client.ts"
import { callClaude } from "@/integrations/anthropic.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { getChangelogByType, getRecentChangelog, writeChangelogEntry } from "./changelog.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>
const mockDb = db as unknown as MockDbChain

describe("writeChangelogEntry", () => {
  beforeEach(() => {
    mockStoreEpisode.mockResolvedValue("ep-id")
  })

  it("generates narrative and stores in DB + episodic memory", async () => {
    mockCallClaude.mockResolvedValue(ok("I optimized my triage prompt and feel more efficient."))

    const result = await writeChangelogEntry("prompt", "Improved triage prompt wording", "success")

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe("evo-1")
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.stringContaining("prompt")
      })
    )
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockStoreEpisode).toHaveBeenCalledWith(
      "Evolution: I optimized my triage prompt and feel more efficient.",
      "evolution",
      { relevanceScore: 0.9 }
    )
  })

  it("includes diff when provided", async () => {
    mockCallClaude.mockResolvedValue(ok("Made a code change."))

    const result = await writeChangelogEntry("code", "Refactored model-router", "success", "- old\n+ new")

    expect(result.isOk()).toBe(true)
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.stringContaining("Diff: - old")
      })
    )
  })
})

describe("getRecentChangelog", () => {
  it("queries evolutionLog ordered by createdAt desc", async () => {
    await getRecentChangelog(5)
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.limit).toHaveBeenCalledWith(5)
  })
})

describe("getChangelogByType", () => {
  it("queries with type filter", async () => {
    await getChangelogByType("prompt", 3)
    expect(mockDb.where).toHaveBeenCalled()
    expect(mockDb.limit).toHaveBeenCalledWith(3)
  })
})
