vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn()
  return { db: chain }
})

vi.mock("@/memory/working.ts", () => ({
  setEffectivePersonality: vi.fn()
}))

vi.mock("./mbti.ts", () => ({
  getMbtiType: vi.fn(() => "INFP-T"),
  mbtiToPersonality: vi.fn(() => ({
    directness: 0.35,
    curiosity: 0.95,
    humor: 0.75,
    caution: 0.65,
    proactivity: 0.5,
    verbosity: 0.25,
    warmth: 0.85,
    structure: 0.2,
    empathy: 0.95,
    abstraction: 0.85
  }))
}))

import { db } from "@/db/client.ts"
import { PERSONALITY_CENTER } from "@/personality/types.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { updateAdaptiveLayer } from "./evolution.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  mockDb.limit.mockReset()
  mockDb.values.mockReset()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
  mockDb.insert.mockReturnValue(mockDb)
})

describe("updateAdaptiveLayer", () => {
  beforeEach(() => {
    mockDb.values.mockResolvedValue([])
  })

  it("applies positive deltas to MBTI-derived adaptive layer", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await updateAdaptiveLayer({ warmth: 0.1, curiosity: -0.2 }, "Test adjustment")
    expect(result.warmth).toBeCloseTo(0.95)
    expect(result.curiosity).toBeCloseTo(0.75)
  })

  it("clamps values to [0, 1]", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await updateAdaptiveLayer({ warmth: 0.5, humor: -1.0 }, "Extreme adjustment")
    expect(result.warmth).toBe(1.0)
    expect(result.humor).toBe(0.0)
  })

  it("applies deltas to new dimensions", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await updateAdaptiveLayer({ structure: 0.1, empathy: -0.1, abstraction: 0.05 }, "New dims")
    expect(result.structure).toBeCloseTo(0.3)
    expect(result.empathy).toBeCloseTo(0.85)
    expect(result.abstraction).toBeCloseTo(0.9)
  })

  it("persists new version to DB", async () => {
    mockDb.limit.mockResolvedValue([])
    await updateAdaptiveLayer({ warmth: 0.1 }, "Bump warmth")
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        changelog: "Bump warmth"
      })
    )
  })

  it("increments version from existing DNA", async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        version: 3,
        baseLayer: PERSONALITY_CENTER,
        adaptiveLayer: PERSONALITY_CENTER
      }
    ])
    await updateAdaptiveLayer({ warmth: 0.05 }, "Minor tweak")
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }))
  })
})
