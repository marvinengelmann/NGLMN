import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSendMessage, mockGetUpdates, mockSendChatAction, mockGetMe } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockGetUpdates: vi.fn(),
  mockSendChatAction: vi.fn(),
  mockGetMe: vi.fn()
}))

vi.mock("grammy", () => ({
  Api: class MockApi {
    sendMessage = mockSendMessage
    getUpdates = mockGetUpdates
    sendChatAction = mockSendChatAction
    getMe = mockGetMe
  }
}))

vi.mock("@/config/env.ts", () => ({
  env: () => ({
    TELEGRAM_BOT_TOKEN: "test-bot-token",
    TELEGRAM_OPERATOR_CHAT_ID: "12345"
  })
}))

vi.mock("@/memory/working.ts", () => ({
  getLastUpdateId: vi.fn()
}))

vi.mock("@/integrations/location.ts", () => ({
  storeOperatorLocationFromTelegram: vi.fn()
}))

import { storeOperatorLocationFromTelegram } from "@/integrations/location.ts"
import { getLastUpdateId } from "@/memory/working.ts"
import {
  fetchNewMessages,
  pingTelegram,
  sendAlert,
  sendDriftAlert,
  sendGuardianAlert,
  sendMessageWithReply,
  sendToOperator,
  sendTypingAction
} from "./telegram.ts"

const mockGetLastUpdateId = getLastUpdateId as ReturnType<typeof vi.fn>
const mockStoreLocation = storeOperatorLocationFromTelegram as ReturnType<typeof vi.fn>

describe("telegram integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sendToOperator()", () => {
    it("sends message to operator chat with Markdown parse mode and returns message_id", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      const result = await sendToOperator("Hello operator")

      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Hello operator", { parse_mode: "Markdown" })
      expect(result).toBe(1)
    })

    it("propagates API errors", async () => {
      mockSendMessage.mockRejectedValue(new Error("bot blocked"))

      await expect(sendToOperator("test")).rejects.toThrow("bot blocked")
    })
  })

  describe("sendMessageWithReply()", () => {
    it("sends message and returns message ID", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 42 })

      const id = await sendMessageWithReply("Reply text")

      expect(id).toBe(42)
      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Reply text", {
        parse_mode: "Markdown"
      })
    })

    it("includes reply_parameters when replyToMessageId provided", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 43 })

      const id = await sendMessageWithReply("Reply", 100)

      expect(id).toBe(43)
      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Reply", {
        parse_mode: "Markdown",
        reply_parameters: { message_id: 100 }
      })
    })
  })

  describe("sendTypingAction()", () => {
    it("sends typing action to operator chat", async () => {
      mockSendChatAction.mockResolvedValue(true)

      await sendTypingAction()

      expect(mockSendChatAction).toHaveBeenCalledWith("12345", "typing")
    })
  })

  describe("sendAlert()", () => {
    it("sends formatted alert with emoji prefix", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendAlert("warning", "Something happened")

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("WARNING"), {
        parse_mode: "Markdown"
      })
    })

    it("uses critical emoji for critical alerts", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendAlert("critical", "System down")

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("CRITICAL"), {
        parse_mode: "Markdown"
      })
    })
  })

  describe("sendGuardianAlert()", () => {
    it("does nothing when verdict is approved", async () => {
      await sendGuardianAlert({
        verdict: "approved",
        reasons: [],
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it("sends alert when verdict is blocked", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendGuardianAlert({
        verdict: "blocked",
        reasons: ["unsafe content"],
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("Guardian blocked"), {
        parse_mode: "Markdown"
      })
    })

    it("sends warning when verdict is warning", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendGuardianAlert({
        verdict: "warning",
        reasons: ["mild concern"],
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("Guardian warning"), {
        parse_mode: "Markdown"
      })
    })
  })

  describe("sendDriftAlert()", () => {
    it("does nothing when system is healthy", async () => {
      await sendDriftAlert({
        signals: [],
        healthy: true,
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it("sends critical alert when high severity signals exist", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendDriftAlert({
        signals: [{ type: "rapid_non_idle", severity: "high", detail: "spike", detectedAt: new Date().toISOString() }],
        healthy: false,
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("CRITICAL"), {
        parse_mode: "Markdown"
      })
    })

    it("sends warning when only medium/low severity signals", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 1 })

      await sendDriftAlert({
        signals: [
          { type: "duration_anomaly", severity: "medium", detail: "minor drift", detectedAt: new Date().toISOString() }
        ],
        healthy: false,
        checkedAt: new Date().toISOString()
      })

      expect(mockSendMessage).toHaveBeenCalledWith("12345", expect.stringContaining("WARNING"), {
        parse_mode: "Markdown"
      })
    })
  })

  describe("fetchNewMessages()", () => {
    it("returns empty messages when no updates", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([])

      const result = await fetchNewMessages(30)

      expect(result.messages).toHaveLength(0)
      expect(result.maxUpdateId).toBeNull()
    })

    it("fetches updates with offset when lastUpdateId exists", async () => {
      mockGetLastUpdateId.mockResolvedValue(100)
      mockGetUpdates.mockResolvedValue([])

      await fetchNewMessages(30)

      expect(mockGetUpdates).toHaveBeenCalledWith({
        offset: 101,
        timeout: 30,
        allowed_updates: ["message"]
      })
    })

    it("passes configured timeout to getUpdates", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([])

      await fetchNewMessages(120)

      expect(mockGetUpdates).toHaveBeenCalledWith(expect.objectContaining({ timeout: 120 }))
    })

    it("parses text messages and returns maxUpdateId without committing", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([
        {
          update_id: 200,
          message: {
            message_id: 50,
            chat: { id: 12345 },
            from: { first_name: "TestUser" },
            text: "Hello there",
            date: 1700000000
          }
        }
      ])

      const result = await fetchNewMessages(30)

      expect(result.messages).toHaveLength(1)
      expect(result.maxUpdateId).toBe(200)
      expect(result.messages[0]).toEqual(
        expect.objectContaining({
          updateId: 200,
          chatId: 12345,
          from: "TestUser",
          text: "Hello there",
          messageId: 50
        })
      )
    })

    it("skips messages without text", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([
        {
          update_id: 201,
          message: {
            message_id: 51,
            chat: { id: 12345 },
            from: { first_name: "User" },
            date: 1700000000
          }
        }
      ])

      const result = await fetchNewMessages(30)

      expect(result.messages).toHaveLength(0)
      expect(result.maxUpdateId).toBe(201)
    })

    it("stores location when operator sends location", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([
        {
          update_id: 202,
          message: {
            message_id: 52,
            chat: { id: 12345 },
            from: { first_name: "Operator" },
            location: { latitude: 49.4875, longitude: 8.466 },
            date: 1700000000
          }
        }
      ])
      mockStoreLocation.mockResolvedValue(undefined)

      const result = await fetchNewMessages(30)

      expect(result.messages).toHaveLength(0)
      expect(mockStoreLocation).toHaveBeenCalledWith(49.4875, 8.466)
    })

    it("skips updates without message property", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([{ update_id: 203 }])

      const result = await fetchNewMessages(30)

      expect(result.messages).toHaveLength(0)
    })

    it("uses 'Unknown' when from.first_name is missing", async () => {
      mockGetLastUpdateId.mockResolvedValue(null)
      mockGetUpdates.mockResolvedValue([
        {
          update_id: 204,
          message: {
            message_id: 54,
            chat: { id: 12345 },
            text: "Anonymous",
            date: 1700000000
          }
        }
      ])

      const result = await fetchNewMessages(30)

      expect(result.messages[0]?.from).toBe("Unknown")
    })
  })

  describe("pingTelegram()", () => {
    it("returns true when bot API is reachable", async () => {
      mockGetMe.mockResolvedValue({ id: 123456, is_bot: true, first_name: "Anima" })

      const result = await pingTelegram()

      expect(result).toBe(true)
    })

    it("returns false when bot API throws", async () => {
      mockGetMe.mockRejectedValue(new Error("network error"))

      const result = await pingTelegram()

      expect(result).toBe(false)
    })
  })
})
