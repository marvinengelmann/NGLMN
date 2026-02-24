vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendToOperator: vi.fn()
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn()
}))

vi.mock("@/personality/dna.ts", () => ({
  getEffectivePersonality: vi.fn()
}))

vi.mock("@/personality/expression.ts", () => ({
  buildPersonalityPrompt: vi.fn()
}))

vi.mock("@/personality/mbti.ts", () => ({
  getMbtiType: vi.fn(() => "INFP-T")
}))

vi.mock("@/memory/working.ts", () => ({
  getDreamInsights: vi.fn(),
  clearDreamInsights: vi.fn(),
  pushConversationMessage: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getOperatorLanguage: vi.fn(() => "German")
}))

import { ok } from "neverthrow"
import { getEmotionalState } from "@/emotion/state.ts"
import { callClaude } from "@/integrations/anthropic.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { clearDreamInsights, getDreamInsights, pushConversationMessage } from "@/memory/working.ts"
import { getEffectivePersonality } from "@/personality/dna.ts"
import { buildPersonalityPrompt } from "@/personality/expression.ts"
import { makeEmotionalState, makePersonalityLayer } from "@/test/factories.ts"
import { composeMorningMessage, sendMorningMessage } from "./morning.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockSendToOperator = sendToOperator as ReturnType<typeof vi.fn>
const mockGetEmotionalState = getEmotionalState as ReturnType<typeof vi.fn>
const mockGetEffectivePersonality = getEffectivePersonality as ReturnType<typeof vi.fn>
const mockBuildPersonalityPrompt = buildPersonalityPrompt as ReturnType<typeof vi.fn>
const mockGetDreamInsights = getDreamInsights as ReturnType<typeof vi.fn>
const mockClearDreamInsights = clearDreamInsights as ReturnType<typeof vi.fn>
const mockPushConversationMessage = pushConversationMessage as ReturnType<typeof vi.fn>
const mockStoreEpisode = storeEpisode as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetDreamInsights.mockResolvedValue(["Insight from dreams"])
  mockGetEmotionalState.mockResolvedValue(makeEmotionalState())
  mockGetEffectivePersonality.mockResolvedValue(makePersonalityLayer())
  mockBuildPersonalityPrompt.mockReturnValue("[PERSONALITY & MOOD]\nBe warm.")
  mockCallClaude.mockResolvedValue(ok("Good morning! Last night I thought about many things..."))
  mockSendToOperator.mockResolvedValue(undefined)
  mockStoreEpisode.mockResolvedValue("ep-id")
  mockClearDreamInsights.mockResolvedValue(undefined)
  mockPushConversationMessage.mockResolvedValue(undefined)
})

describe("composeMorningMessage", () => {
  it("generates a morning message using dream insights and personality", async () => {
    const message = await composeMorningMessage()

    expect(message).toBe("Good morning! Last night I thought about many things...")
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("PERSONALITY & MOOD")
      })
    )
  })

  it("handles missing dream insights gracefully", async () => {
    mockGetDreamInsights.mockResolvedValue(null)
    const message = await composeMorningMessage()
    expect(message).toBeDefined()
  })
})

describe("sendMorningMessage", () => {
  it("sends to operator and stores in memory", async () => {
    await sendMorningMessage()

    expect(mockSendToOperator).toHaveBeenCalledWith("Good morning! Last night I thought about many things...")
    expect(mockStoreEpisode).toHaveBeenCalledWith(expect.stringContaining("Morning message sent"), "interaction", {
      relevanceScore: 0.8
    })
    expect(mockPushConversationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "anima",
        text: "Good morning! Last night I thought about many things..."
      })
    )
  })

  it("clears dream insights after sending", async () => {
    await sendMorningMessage()
    expect(mockClearDreamInsights).toHaveBeenCalled()
  })
})
