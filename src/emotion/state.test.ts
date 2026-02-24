vi.mock("@/memory/working.ts", () => ({
  getCurrentEmotion: vi.fn(),
  setCurrentEmotion: vi.fn()
}))

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

vi.mock("@/personality/mbti.ts", () => ({
  getEmotionBaseline: vi.fn()
}))

import { db } from "@/db/client.ts"
import { DEFAULT_EMOTIONAL_STATE } from "@/emotion/types.ts"
import { getCurrentEmotion, setCurrentEmotion } from "@/memory/working.ts"
import { getEmotionBaseline } from "@/personality/mbti.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import type { MockDbChain } from "@/test/mocks.ts"
import { getEmotionalState, getEmotionHistory, saveEmotionalState } from "./state.ts"

const mockGetCurrentEmotion = getCurrentEmotion as ReturnType<typeof vi.fn>
const mockSetCurrentEmotion = setCurrentEmotion as ReturnType<typeof vi.fn>
const mockGetEmotionBaseline = getEmotionBaseline as ReturnType<typeof vi.fn>
const mockDb = db as unknown as MockDbChain

const MOCK_BASELINE = makeEmotionalState({ curiosity: 0.6, frustration: 0.3 })

beforeEach(() => {
  mockDb.limit.mockReset()
  mockDb.values.mockReset()
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
  mockDb.insert.mockReturnValue(mockDb)
  mockGetEmotionBaseline.mockReturnValue(MOCK_BASELINE)
})

describe("getEmotionalState", () => {
  it("returns cached state from Redis when available", async () => {
    const cached = makeEmotionalState({ excitement: 0.9 })
    mockGetCurrentEmotion.mockResolvedValue(cached)
    const result = await getEmotionalState()
    expect(result.excitement).toBe(0.9)
  })

  it("falls back to DB when Redis is empty", async () => {
    mockGetCurrentEmotion.mockResolvedValue(null)
    const dbState = makeEmotionalState({ curiosity: 0.7 })
    mockDb.limit.mockResolvedValue([{ state: dbState, createdAt: new Date() }])
    const result = await getEmotionalState()
    expect(result.curiosity).toBe(0.7)
    expect(mockSetCurrentEmotion).toHaveBeenCalled()
  })

  it("falls back to MBTI-derived baseline when both Redis and DB are empty", async () => {
    mockGetCurrentEmotion.mockResolvedValue(null)
    mockDb.limit.mockResolvedValue([])
    const result = await getEmotionalState()
    expect(result).toEqual(MOCK_BASELINE)
    expect(mockSetCurrentEmotion).toHaveBeenCalledWith(MOCK_BASELINE)
  })
})

describe("saveEmotionalState", () => {
  it("saves to both Redis and DB", async () => {
    mockSetCurrentEmotion.mockResolvedValue(undefined)
    mockDb.values.mockResolvedValue([])
    const state = makeEmotionalState({ frustration: 0.6 })
    await saveEmotionalState(state, "task_failure", "tick-1")
    expect(mockSetCurrentEmotion).toHaveBeenCalledWith(state)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ state, trigger: "task_failure", tickId: "tick-1" })
    )
  })
})

describe("getEmotionHistory", () => {
  it("queries DB with limit", async () => {
    const entries = [{ state: DEFAULT_EMOTIONAL_STATE, trigger: "idle_tick", createdAt: new Date() }]
    mockDb.limit.mockResolvedValue(entries)
    const result = await getEmotionHistory(5)
    expect(result).toEqual(entries)
  })
})
