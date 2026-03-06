import { describe, expect, it, vi } from "vitest"
import { CONVERSATION } from "@/config/constants.ts"
import { makeConversationMessage, makeConversationSlot } from "@/test/factories.ts"

vi.mock("@/core/intelligence.ts", () => ({ callIntelligence: vi.fn() }))
vi.mock("@/memory/episodic.ts", () => ({
  queryRelated: vi.fn(),
  storeEpisode: vi.fn(),
  storeRelationshipEpisode: vi.fn()
}))

import { detectConversationBoundary } from "./conversation.ts"

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
