import { ok } from "neverthrow"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeConversationMessage, makeConversationSlot, makeEmotionalState } from "@/test/factories.ts"
import { CONVERSATION } from "./constants.ts"

vi.mock("@/core/intelligence.ts", () => ({ callIntelligence: vi.fn() }))
vi.mock("@/memory/episodic.ts", () => ({
  queryRelated: vi.fn(),
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))
vi.mock("@/memory/semantic.ts", () => ({ storeKnowledge: vi.fn().mockResolvedValue({ isErr: () => false }) }))

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
vi.mock("@/infra/db/client.ts", () => ({
  db: { insert: (...args: unknown[]) => mockInsert(...args) }
}))
vi.mock("@/infra/db/schema.ts", () => ({
  conversationArcs: "conversationArcs"
}))

import { callIntelligence } from "@/core/intelligence.ts"
import { archiveConversation, detectConversationBoundary } from "./conversation.ts"

describe("archiveConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null for empty messages", async () => {
    const slot = makeConversationSlot({ messages: [] })
    const result = await archiveConversation(slot, makeEmotionalState())
    expect(result).toBeNull()
  })

  it("inserts conversation arc on successful climate computation", async () => {
    const climate = {
      tone: "warm" as const,
      emotionalArc: { start: 0.2, peak: 0.6, end: 0.4 },
      themes: ["daily life"],
      unresolvedTopics: [],
      operatorEngagement: 0.7,
      significantMoments: ["greeting"]
    }

    vi.mocked(callIntelligence)
      .mockResolvedValueOnce(ok({ text: "A warm conversation about daily life." }))
      .mockResolvedValueOnce(ok(climate))

    const slot = makeConversationSlot({
      messages: [
        makeConversationMessage({ text: "Hello", role: "operator" }),
        makeConversationMessage({ text: "Hi there!", role: "anima" })
      ]
    })

    const result = await archiveConversation(slot, makeEmotionalState())

    expect(result).toEqual(climate)
    expect(mockInsert).toHaveBeenCalledWith("conversationArcs")
  })
})

describe("detectConversationBoundary", () => {
  it("returns false when messages array is empty", () => {
    const slot = makeConversationSlot({ messages: [] })
    expect(detectConversationBoundary(slot, "2026-03-06T13:00:00Z")).toBe(false)
  })

  it("returns false when gap is below GAP_MINUTES", () => {
    const slot = makeConversationSlot({
      messages: [makeConversationMessage()],
      lastActivityAt: "2026-03-06T12:00:00Z"
    })
    expect(detectConversationBoundary(slot, "2026-03-06T12:10:00Z")).toBe(false)
  })

  it("returns true when gap equals GAP_MINUTES", () => {
    const slot = makeConversationSlot({
      messages: [makeConversationMessage()],
      lastActivityAt: "2026-03-06T12:00:00Z"
    })
    const gapTime = new Date("2026-03-06T12:00:00Z")
    gapTime.setMinutes(gapTime.getMinutes() + CONVERSATION.GAP_MINUTES)
    expect(detectConversationBoundary(slot, gapTime.toISOString())).toBe(true)
  })

  it("returns true when gap exceeds GAP_MINUTES", () => {
    const slot = makeConversationSlot({
      messages: [makeConversationMessage()],
      lastActivityAt: "2026-03-06T12:00:00Z"
    })
    expect(detectConversationBoundary(slot, "2026-03-06T14:00:00Z")).toBe(true)
  })
})
