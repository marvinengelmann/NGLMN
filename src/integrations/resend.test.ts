import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockEmailsSend, mockEmailsReceivingList, mockEmailsReceivingGet, mockDomainsList } = vi.hoisted(() => ({
  mockEmailsSend: vi.fn(),
  mockEmailsReceivingList: vi.fn(),
  mockEmailsReceivingGet: vi.fn(),
  mockDomainsList: vi.fn()
}))

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockEmailsSend,
      receiving: {
        list: mockEmailsReceivingList,
        get: mockEmailsReceivingGet
      }
    }
    domains = { list: mockDomainsList }
  }
}))

vi.mock("@/config/env.ts", () => ({
  env: () => ({
    RESEND_API_KEY: "re_test_key",
    RESEND_FROM_EMAIL: "anima@test.com",
    RESEND_OPERATOR_EMAIL: "operator@test.com"
  })
}))

vi.mock("@/memory/working.ts", () => ({
  getLastPolledEmailId: vi.fn(),
  setLastPolledEmailId: vi.fn(),
  pushPendingEmails: vi.fn()
}))

vi.mock("@/security/defense.ts", () => ({
  sanitizeForContext: vi.fn((text: string) => text)
}))

import { getLastPolledEmailId, pushPendingEmails, setLastPolledEmailId } from "@/memory/working.ts"
import { pingResend, pollNewEmails, sendEmail, sendEmailAlert, sendEmailToOperator } from "./resend.ts"

const mockGetLastPolledEmailId = getLastPolledEmailId as ReturnType<typeof vi.fn>
const mockSetLastPolledEmailId = setLastPolledEmailId as ReturnType<typeof vi.fn>
const mockPushPendingEmails = pushPendingEmails as ReturnType<typeof vi.fn>

describe("resend integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sendEmail()", () => {
    it("calls Resend API with correct parameters", async () => {
      mockEmailsSend.mockResolvedValue({ data: { id: "email_1" }, error: null })

      await sendEmail("user@example.com", "Hello", "<p>World</p>")

      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: "anima@test.com",
        to: "user@example.com",
        subject: "Hello",
        html: "<p>World</p>"
      })
    })

    it("propagates errors from Resend API", async () => {
      mockEmailsSend.mockRejectedValue(new Error("API rate limit"))

      await expect(sendEmail("user@example.com", "Test", "<p>Hi</p>")).rejects.toThrow("API rate limit")
    })
  })

  describe("sendEmailToOperator()", () => {
    it("sends email to configured operator address", async () => {
      mockEmailsSend.mockResolvedValue({ data: { id: "email_2" }, error: null })

      await sendEmailToOperator("Subject", "<p>Body</p>")

      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: "anima@test.com",
        to: "operator@test.com",
        subject: "Subject",
        html: "<p>Body</p>"
      })
    })
  })

  describe("pollNewEmails()", () => {
    it("returns 0 when no new emails", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [] },
        error: null
      })

      const count = await pollNewEmails()

      expect(count).toBe(0)
    })

    it("returns 0 when list returns error", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: null,
        error: { message: "API error" }
      })

      const count = await pollNewEmails()

      expect(count).toBe(0)
    })

    it("processes new emails and pushes to pending queue", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [{ id: "recv_1" }] },
        error: null
      })
      mockEmailsReceivingGet.mockResolvedValue({
        data: {
          id: "recv_1",
          from: "sender@example.com",
          to: ["anima@test.com"],
          subject: "Test Email",
          text: "Hello Anima",
          html: null,
          created_at: "2026-01-01T00:00:00Z"
        },
        error: null
      })
      mockSetLastPolledEmailId.mockResolvedValue(undefined)
      mockPushPendingEmails.mockResolvedValue(undefined)

      const count = await pollNewEmails()

      expect(count).toBe(1)
      expect(mockSetLastPolledEmailId).toHaveBeenCalledWith("recv_1")
      expect(mockPushPendingEmails).toHaveBeenCalledWith([
        expect.objectContaining({
          emailId: "recv_1",
          from: "sender@example.com",
          subject: "Test Email",
          text: "Hello Anima"
        })
      ])
    })

    it("skips emails not addressed to anima", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [{ id: "recv_2" }] },
        error: null
      })
      mockEmailsReceivingGet.mockResolvedValue({
        data: {
          id: "recv_2",
          from: "sender@example.com",
          to: ["someone-else@other.com"],
          subject: "Not for Anima",
          text: "Wrong recipient",
          html: null,
          created_at: "2026-01-01T00:00:00Z"
        },
        error: null
      })
      mockSetLastPolledEmailId.mockResolvedValue(undefined)
      mockPushPendingEmails.mockResolvedValue(undefined)

      const count = await pollNewEmails()

      expect(count).toBe(0)
    })

    it("passes after parameter when lastPolledId exists", async () => {
      mockGetLastPolledEmailId.mockResolvedValue("prev_email_id")
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [] },
        error: null
      })

      await pollNewEmails()

      expect(mockEmailsReceivingList).toHaveBeenCalledWith({
        limit: 100,
        after: "prev_email_id"
      })
    })

    it("skips individual emails that fail to fetch", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [{ id: "recv_ok" }, { id: "recv_fail" }] },
        error: null
      })
      mockEmailsReceivingGet
        .mockResolvedValueOnce({
          data: {
            id: "recv_ok",
            from: "sender@example.com",
            to: ["anima@test.com"],
            subject: "Good",
            text: "Works",
            html: null,
            created_at: "2026-01-01T00:00:00Z"
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "not found" }
        })
      mockSetLastPolledEmailId.mockResolvedValue(undefined)
      mockPushPendingEmails.mockResolvedValue(undefined)

      const count = await pollNewEmails()

      expect(count).toBe(1)
    })

    it("uses html content as fallback when text is missing", async () => {
      mockGetLastPolledEmailId.mockResolvedValue(null)
      mockEmailsReceivingList.mockResolvedValue({
        data: { data: [{ id: "recv_html" }] },
        error: null
      })
      mockEmailsReceivingGet.mockResolvedValue({
        data: {
          id: "recv_html",
          from: "sender@example.com",
          to: ["anima@test.com"],
          subject: "HTML Only",
          text: null,
          html: "<p>HTML content</p>",
          created_at: "2026-01-01T00:00:00Z"
        },
        error: null
      })
      mockSetLastPolledEmailId.mockResolvedValue(undefined)
      mockPushPendingEmails.mockResolvedValue(undefined)

      await pollNewEmails()

      expect(mockPushPendingEmails).toHaveBeenCalledWith([
        expect.objectContaining({
          text: "<p>HTML content</p>"
        })
      ])
    })
  })

  describe("sendEmailAlert()", () => {
    it("sends formatted alert email with correct emoji prefix", async () => {
      mockEmailsSend.mockResolvedValue({ data: { id: "alert_1" }, error: null })

      await sendEmailAlert("warning", "Something needs attention")

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "operator@test.com",
          subject: expect.stringContaining("WARNING"),
          html: expect.stringContaining("Something needs attention")
        })
      )
    })

    it("uses critical emoji for critical alerts", async () => {
      mockEmailsSend.mockResolvedValue({ data: { id: "alert_2" }, error: null })

      await sendEmailAlert("critical", "System down")

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("CRITICAL")
        })
      )
    })
  })

  describe("pingResend()", () => {
    it("returns true when Resend API is reachable", async () => {
      mockDomainsList.mockResolvedValue({ data: [], error: null })

      const result = await pingResend()

      expect(result).toBe(true)
    })

    it("returns false when Resend API returns error", async () => {
      mockDomainsList.mockResolvedValue({ data: null, error: { message: "unauthorized" } })

      const result = await pingResend()

      expect(result).toBe(false)
    })

    it("returns false when Resend API throws", async () => {
      mockDomainsList.mockRejectedValue(new Error("network error"))

      const result = await pingResend()

      expect(result).toBe(false)
    })
  })
})
