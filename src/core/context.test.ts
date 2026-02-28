vi.mock("@/memory/working.ts", () => ({
  getLastTickSummary: vi.fn(),
  getConversationBuffer: vi.fn(),
  getCurrentEmotion: vi.fn(),
  getPerceptionSummary: vi.fn(),
  getLastProactiveAction: vi.fn()
}))

vi.mock("@/memory/goals.ts", () => ({
  getGoalsByPriority: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  queryRelated: vi.fn(),
  queryRelationshipHistory: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getKnowledge: vi.fn(),
  getOperatorLanguage: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionHistory: vi.fn()
}))

vi.mock("@/trust/levels.ts", () => ({
  getAllTrustLevels: vi.fn()
}))

vi.mock("@/personality/dna.ts", () => ({
  loadPersonalityDna: vi.fn()
}))

vi.mock("@/lib/math.ts", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4))
}))

import { ok } from "neverthrow"
import { getEmotionHistory } from "@/emotion/state.ts"
import { queryRelated, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import { getConversationBuffer, getCurrentEmotion, getLastTickSummary, getPerceptionSummary } from "@/memory/working.ts"
import { loadPersonalityDna } from "@/personality/dna.ts"
import { makeConversationMessage, makeConversationSlot, makePendingMessage, makeTickSummary } from "@/test/factories.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"
import { buildComplexContext, buildDeepContext, buildSimpleContext, buildTriageContext } from "./context.ts"

const mockGetLastTickSummary = getLastTickSummary as ReturnType<typeof vi.fn>
const mockGetConversationBuffer = getConversationBuffer as ReturnType<typeof vi.fn>
const mockGetGoalsByPriority = getGoalsByPriority as ReturnType<typeof vi.fn>
const mockQueryRelated = queryRelated as ReturnType<typeof vi.fn>
const mockGetKnowledge = getKnowledge as ReturnType<typeof vi.fn>
const mockGetCurrentEmotion = getCurrentEmotion as ReturnType<typeof vi.fn>
const mockGetPerceptionSummary = getPerceptionSummary as ReturnType<typeof vi.fn>
const mockQueryRelationshipHistory = queryRelationshipHistory as ReturnType<typeof vi.fn>
const mockGetEmotionHistory = getEmotionHistory as ReturnType<typeof vi.fn>
const mockGetAllTrustLevels = getAllTrustLevels as ReturnType<typeof vi.fn>
const mockLoadPersonalityDna = loadPersonalityDna as ReturnType<typeof vi.fn>
const mockGetOperatorLanguage = getOperatorLanguage as ReturnType<typeof vi.fn>

describe("buildTriageContext", () => {
  beforeEach(() => {
    mockGetLastTickSummary.mockResolvedValue(null)
    mockGetGoalsByPriority.mockResolvedValue([])
    mockGetConversationBuffer.mockResolvedValue([])
    mockGetCurrentEmotion.mockResolvedValue(null)
    mockGetPerceptionSummary.mockResolvedValue(null)
  })

  it("returns correct structure with all fields", async () => {
    const ctx = await buildTriageContext()
    expect(ctx).toHaveProperty("now")
    expect(ctx).toHaveProperty("lastTick")
    expect(ctx).toHaveProperty("userPrompt")
    expect(typeof ctx.userPrompt).toBe("string")
  })

  it("includes goals in prompt", async () => {
    mockGetGoalsByPriority.mockResolvedValue([
      { title: "Learn Rust", status: "active", priority: 0.9, description: null }
    ])

    const ctx = await buildTriageContext()
    expect(ctx.userPrompt).toContain("Learn Rust")
    expect(ctx.userPrompt).toContain("active")
  })

  it("handles first tick (no last tick)", async () => {
    mockGetLastTickSummary.mockResolvedValue(null)
    const ctx = await buildTriageContext()
    expect(ctx.lastTick).toBeNull()
    expect(ctx.userPrompt).toContain("first tick")
  })

  it("includes active conversation indicator", async () => {
    mockGetConversationBuffer.mockResolvedValue([
      makeConversationSlot({
        messages: [makeConversationMessage({ text: "hi" }), makeConversationMessage({ text: "hello" })]
      })
    ])

    const ctx = await buildTriageContext()
    expect(ctx.userPrompt).toContain("Active conversation: 2 messages")
  })

  it("includes emotional state when available", async () => {
    mockGetCurrentEmotion.mockResolvedValue({
      curiosity: 0.8,
      satisfaction: 0.5,
      frustration: 0.1,
      boredom: 0.2,
      excitement: 0.7,
      caution: 0.3,
      connection: 0.6
    })
    const ctx = await buildTriageContext()
    expect(ctx.userPrompt).toContain("Emotional state:")
  })

  it("passes emotion to getGoalsByPriority when available", async () => {
    const emotion = {
      curiosity: 0.8,
      satisfaction: 0.5,
      frustration: 0.1,
      boredom: 0.2,
      excitement: 0.7,
      caution: 0.3,
      connection: 0.6
    }
    mockGetCurrentEmotion.mockResolvedValue(emotion)
    await buildTriageContext()
    expect(mockGetGoalsByPriority).toHaveBeenCalledWith(3, emotion)
  })

  it("passes undefined emotion to getGoalsByPriority when emotion is null", async () => {
    mockGetCurrentEmotion.mockResolvedValue(null)
    await buildTriageContext()
    expect(mockGetGoalsByPriority).toHaveBeenCalledWith(3, undefined)
  })
})

describe("buildSimpleContext", () => {
  beforeEach(() => {
    mockGetConversationBuffer.mockResolvedValue([])
    mockQueryRelated.mockResolvedValue([])
    mockGetOperatorLanguage.mockResolvedValue("German")
  })

  it("includes conversation history", async () => {
    mockGetConversationBuffer.mockResolvedValue([
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "Hey" }),
          makeConversationMessage({ role: "anima", text: "Hello!" })
        ]
      })
    ])

    const messages = [makePendingMessage({ text: "What's up?" })]
    const result = await buildSimpleContext(messages)
    expect(result).toContain("Current conversation:")
    expect(result).toContain("Operator")
    expect(result).toContain("You (ANIMA)")
  })

  it("shows message IDs as prefixes in conversation history", async () => {
    mockGetConversationBuffer.mockResolvedValue([
      makeConversationSlot({
        messages: [
          makeConversationMessage({ role: "operator", text: "Hey", messageId: 142 }),
          makeConversationMessage({ role: "anima", text: "Hi there!", messageId: 143 })
        ]
      })
    ])

    const messages = [makePendingMessage({ text: "What's up?", messageId: 145 })]
    const result = await buildSimpleContext(messages)
    expect(result).toContain("[#142]")
    expect(result).toContain("[#143]")
    expect(result).toContain("[#145]")
  })

  it("includes related episodes", async () => {
    mockQueryRelated.mockResolvedValue([
      { id: "ep1", score: 0.85, metadata: { category: "interaction", timestamp: "2026-01-01" } }
    ])

    const messages = [makePendingMessage({ text: "Tell me about yesterday" })]
    const result = await buildSimpleContext(messages)
    expect(result).toContain("Relevant memories")
    expect(result).toContain("interaction")
  })

  it("handles empty messages (no episode query)", async () => {
    const result = await buildSimpleContext([])
    expect(mockQueryRelated).not.toHaveBeenCalled()
    expect(result).not.toContain("New messages to respond to:")
  })

  it("includes personality prompt when provided", async () => {
    const result = await buildSimpleContext([makePendingMessage({ text: "Hi" })], "[PERSONALITY & MOOD]\nBe warm.")
    expect(result).toContain("[PERSONALITY & MOOD]")
  })
})

describe("buildComplexContext", () => {
  beforeEach(() => {
    mockGetLastTickSummary.mockResolvedValue(null)
    mockGetGoalsByPriority.mockResolvedValue([])
    mockQueryRelated.mockResolvedValue([])
    mockGetKnowledge.mockResolvedValue(ok([]))
    mockGetConversationBuffer.mockResolvedValue([])
    mockGetCurrentEmotion.mockResolvedValue(null)
    mockGetPerceptionSummary.mockResolvedValue(null)
    mockQueryRelationshipHistory.mockResolvedValue([])
    mockGetOperatorLanguage.mockResolvedValue("German")
  })

  it("includes all sections", async () => {
    mockGetConversationBuffer.mockResolvedValue([
      makeConversationSlot({ messages: [makeConversationMessage({ text: "Hi" })] })
    ])
    mockGetLastTickSummary.mockResolvedValue(makeTickSummary({ triageDecision: "simple", triageReason: "greeting" }))
    mockQueryRelated.mockResolvedValue([
      { id: "ep1", score: 0.9, metadata: { category: "task", timestamp: "2026-01-01" } }
    ])
    mockGetKnowledge.mockResolvedValue(
      ok([{ category: "preference", key: "lang", value: "de", lastAccessedAt: new Date() }])
    )
    mockGetGoalsByPriority.mockResolvedValue([
      { title: "Ship v2", status: "active", priority: 0.8, description: "Release version 2" }
    ])

    const messages = [makePendingMessage({ text: "Status update" })]
    const result = await buildComplexContext(messages)

    expect(result).toContain("Current conversation:")
    expect(result).toContain("Previous tick:")
    expect(result).toContain("Relevant memories")
    expect(result).toContain("Known context")
    expect(result).toContain("Active goals")
    expect(result).toContain("New messages to respond to:")
  })

  it("passes emotion to getGoalsByPriority when available", async () => {
    const emotion = {
      curiosity: 0.9,
      satisfaction: 0.5,
      frustration: 0.1,
      boredom: 0.2,
      excitement: 0.7,
      caution: 0.3,
      connection: 0.6
    }
    mockGetCurrentEmotion.mockResolvedValue(emotion)
    const messages = [makePendingMessage({ text: "test" })]
    await buildComplexContext(messages)
    expect(mockGetGoalsByPriority).toHaveBeenCalledWith(10, emotion)
  })
})

describe("buildDeepContext", () => {
  beforeEach(() => {
    mockGetLastTickSummary.mockResolvedValue(null)
    mockGetGoalsByPriority.mockResolvedValue([])
    mockQueryRelated.mockResolvedValue([])
    mockGetKnowledge.mockResolvedValue(ok([]))
    mockGetConversationBuffer.mockResolvedValue([])
    mockGetCurrentEmotion.mockResolvedValue(null)
    mockGetPerceptionSummary.mockResolvedValue(null)
    mockQueryRelationshipHistory.mockResolvedValue([])
    mockGetEmotionHistory.mockResolvedValue([])
    mockGetAllTrustLevels.mockResolvedValue([])
    mockLoadPersonalityDna.mockResolvedValue(null)
    mockGetOperatorLanguage.mockResolvedValue("German")
  })

  it("includes complex context content", async () => {
    const messages = [makePendingMessage({ text: "Deep question" })]
    const result = await buildDeepContext(messages)
    expect(result).toContain("Current time:")
    expect(result).toContain("New messages to respond to:")
  })

  it("includes emotion history when available", async () => {
    mockGetEmotionHistory.mockResolvedValue([{ trigger: "task_success", createdAt: new Date() }])
    const messages = [makePendingMessage({ text: "Tell me" })]
    const result = await buildDeepContext(messages)
    expect(result).toContain("Emotion trajectory")
  })

  it("includes trust levels when available", async () => {
    mockGetAllTrustLevels.mockResolvedValue([{ actionType: "add_goal", fear: 0.3, confidence: 0.7, totalAttempts: 10 }])
    const messages = [makePendingMessage({ text: "Tell me" })]
    const result = await buildDeepContext(messages)
    expect(result).toContain("Trust levels")
  })

  it("includes personality DNA when available", async () => {
    mockLoadPersonalityDna.mockResolvedValue({
      base: {
        directness: 0.6,
        curiosity: 0.8,
        humor: 0.7,
        caution: 0.5,
        proactivity: 0.7,
        verbosity: 0.4,
        warmth: 0.8
      },
      adaptive: {
        directness: 0.6,
        curiosity: 0.8,
        humor: 0.7,
        caution: 0.5,
        proactivity: 0.7,
        verbosity: 0.4,
        warmth: 0.8
      }
    })
    const messages = [makePendingMessage({ text: "Tell me" })]
    const result = await buildDeepContext(messages)
    expect(result).toContain("Personality DNA")
  })
})
