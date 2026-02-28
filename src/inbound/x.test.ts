import { beforeEach, describe, expect, it, vi } from "vitest"
import { makePendingMention } from "@/test/factories.ts"

vi.mock("@/config/constants.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/constants.ts")>())
}))

vi.mock("@/integrations/telegram.ts", () => ({
  escapeTelegramMarkdown: vi.fn((text: string) => text)
}))

vi.mock("@/integrations/x.ts", () => ({
  replyToTweet: vi.fn()
}))

vi.mock("@/lib/time.ts", () => ({
  nowISO: vi.fn(() => "2026-01-01T00:00:00+00:00")
}))

vi.mock("@/memory/working.ts", () => ({
  clearProcessedMentions: vi.fn(),
  peekAllPendingMentions: vi.fn(),
  pushPendingMentions: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validatePublicOutput: vi.fn()
}))

vi.mock("@/security/defense.ts", () => ({
  wrapExternalData: vi.fn((text: string) => text)
}))

import { replyToTweet } from "@/integrations/x.ts"
import { xChannelConfig } from "./x.ts"

const mockReplyToTweet = replyToTweet as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("xChannelConfig.buildContext", () => {
  it("includes mention details and consciousness prompt", () => {
    const mention = makePendingMention({ authorUsername: "alice", text: "Hey @anima!" })

    const context = xChannelConfig.buildContext(mention, "consciousness here")

    expect(context).toContain("Current time:")
    expect(context).toContain("Response language: English")
    expect(context).toContain("consciousness here")
    expect(context).toContain("PUBLIC X (Twitter)")
    expect(context).toContain("Max 280 characters")
    expect(context).toContain("@alice")
    expect(context).toContain("Hey @anima!")
  })
})

describe("xChannelConfig.sendResponse", () => {
  it("returns true when replyToTweet succeeds", async () => {
    mockReplyToTweet.mockResolvedValue("tweet-reply-id")
    const mention = makePendingMention({ tweetId: "t123" })

    const result = await xChannelConfig.sendResponse(mention, "Nice point!")

    expect(result).toBe(true)
    expect(mockReplyToTweet).toHaveBeenCalledWith("Nice point!", "t123")
  })

  it("returns false when replyToTweet returns null", async () => {
    mockReplyToTweet.mockResolvedValue(null)
    const mention = makePendingMention()

    const result = await xChannelConfig.sendResponse(mention, "reply")

    expect(result).toBe(false)
  })
})

describe("xChannelConfig.buildNotification", () => {
  it("builds a telegram notification with mention details", () => {
    const mention = makePendingMention({ authorUsername: "bob" })

    const notification = xChannelConfig.buildNotification(mention, "Great question!")

    expect(notification).toContain("🐦 X reply sent")
    expect(notification).toContain("@bob")
    expect(notification).toContain("Great question!")
  })
})

describe("xChannelConfig.buildEpisodeText", () => {
  it("includes author and truncated text", () => {
    const mention = makePendingMention({ authorUsername: "carol", text: "What do you think about AI?" })

    const text = xChannelConfig.buildEpisodeText(mention)

    expect(text).toBe('Replied to X mention from @carol: "What do you think about AI?"')
  })

  it("truncates long mention text to 100 chars", () => {
    const longText = "a".repeat(100) + "b".repeat(100)
    const mention = makePendingMention({ text: longText })

    const text = xChannelConfig.buildEpisodeText(mention)

    expect(text).toContain("a".repeat(100))
    expect(text).not.toContain("b")
  })
})
