vi.mock("@/db/client.ts", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn()
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
import { setEffectivePersonality } from "@/memory/working.ts"
import { PERSONALITY_CENTER } from "@/personality/types.ts"
import { makePersonalityLayer } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { computeEffective, getCurrentVersion, getEffectivePersonality, loadPersonalityDna } from "./dna.ts"

const mockDb = db as unknown as MockDbChain

beforeEach(() => {
  mockDb.limit.mockReset()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
})

describe("computeEffective", () => {
  it("blends base (60%) and adaptive (40%)", () => {
    const base = makePersonalityLayer({ warmth: 1.0, humor: 0.0 })
    const adaptive = makePersonalityLayer({ warmth: 0.0, humor: 1.0 })
    const result = computeEffective(base, adaptive)
    expect(result.warmth).toBeCloseTo(0.6)
    expect(result.humor).toBeCloseTo(0.4)
  })

  it("returns identical values when base equals adaptive", () => {
    const layer = makePersonalityLayer({ curiosity: 0.5 })
    const result = computeEffective(layer, layer)
    expect(result.curiosity).toBeCloseTo(0.5)
  })

  it("blends all 10 dimensions including new ones", () => {
    const base = makePersonalityLayer({ structure: 1.0, empathy: 0.0, abstraction: 1.0 })
    const adaptive = makePersonalityLayer({ structure: 0.0, empathy: 1.0, abstraction: 0.0 })
    const result = computeEffective(base, adaptive)
    expect(result.structure).toBeCloseTo(0.6)
    expect(result.empathy).toBeCloseTo(0.4)
    expect(result.abstraction).toBeCloseTo(0.6)
  })
})

describe("loadPersonalityDna", () => {
  it("returns null when no rows exist", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await loadPersonalityDna()
    expect(result).toBeNull()
  })

  it("returns parsed PersonalityDna with version from DB row", async () => {
    mockDb.limit.mockResolvedValue([
      {
        version: 3,
        baseLayer: PERSONALITY_CENTER,
        adaptiveLayer: PERSONALITY_CENTER
      }
    ])
    const result = await loadPersonalityDna()
    expect(result).not.toBeNull()
    expect(result?.base).toEqual(PERSONALITY_CENTER)
    expect(result?.adaptive).toEqual(PERSONALITY_CENTER)
    expect(result?.version).toBe(3)
  })
})

describe("getEffectivePersonality", () => {
  it("returns MBTI-derived personality when no DNA in DB", async () => {
    mockDb.limit.mockResolvedValue([])
    const result = await getEffectivePersonality()
    expect(result.structure).toBeCloseTo(0.2)
    expect(result.empathy).toBeCloseTo(0.95)
    expect(setEffectivePersonality).toHaveBeenCalled()
  })

  it("computes and caches effective personality from DB", async () => {
    const base = makePersonalityLayer({ warmth: 1.0 })
    const adaptive = makePersonalityLayer({ warmth: 0.5 })
    mockDb.limit.mockResolvedValue([
      {
        version: 1,
        baseLayer: base,
        adaptiveLayer: adaptive
      }
    ])
    const result = await getEffectivePersonality()
    expect(result.warmth).toBeDefined()
    expect(setEffectivePersonality).toHaveBeenCalled()
  })
})

describe("getCurrentVersion", () => {
  it("returns 0 when no rows exist", async () => {
    mockDb.limit.mockResolvedValue([])
    const version = await getCurrentVersion()
    expect(version).toBe(0)
  })

  it("returns version from latest row", async () => {
    mockDb.limit.mockResolvedValue([
      {
        version: 5,
        baseLayer: PERSONALITY_CENTER,
        adaptiveLayer: PERSONALITY_CENTER
      }
    ])
    const version = await getCurrentVersion()
    expect(version).toBe(5)
  })
})
