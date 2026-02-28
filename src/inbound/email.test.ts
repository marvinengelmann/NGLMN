import { beforeEach, describe, expect, it, vi } from "vitest"
import { makePendingEmail } from "@/test/factories.ts"

vi.mock("@/config/constants.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/constants.ts")>())
}))

vi.mock("@/integrations/resend.ts", () => ({
  sendEmail: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  escapeTelegramMarkdown: vi.fn((text: string) => text)
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/time.ts", () => ({
  nowISO: vi.fn(() => "2026-01-01T00:00:00+00:00")
}))

vi.mock("@/memory/working.ts", () => ({
  clearProcessedEmails: vi.fn(),
  peekAllPendingEmails: vi.fn(),
  pushPendingEmails: vi.fn()
}))

vi.mock("@/security/guardian.ts", () => ({
  validateOutput: vi.fn()
}))

vi.mock("@/security/defense.ts", () => ({
  wrapExternalData: vi.fn((text: string) => text)
}))

import { sendEmail } from "@/integrations/resend.ts"
import { emailChannelConfig } from "./email.ts"

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("emailChannelConfig.buildContext", () => {
  it("includes email from, subject, body, and consciousness prompt", () => {
    const email = makePendingEmail({ from: "alice@test.com", subject: "Hi", text: "Hello there" })

    const context = emailChannelConfig.buildContext(email, "consciousness here")

    expect(context).toContain("Current time:")
    expect(context).toContain("Response language: English")
    expect(context).toContain("consciousness here")
    expect(context).toContain("alice@test.com")
    expect(context).toContain("Hi")
    expect(context).toContain("Hello there")
  })
})

describe("emailChannelConfig.sendResponse", () => {
  it("sends email with Re: prefix for valid address", async () => {
    const email = makePendingEmail({ from: "bob@example.com", subject: "Question" })
    mockSendEmail.mockResolvedValue(undefined)

    const result = await emailChannelConfig.sendResponse(email, "Thanks for writing!")

    expect(result).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledWith("bob@example.com", "Re: Question", "Thanks for writing!")
  })

  it("does not add Re: prefix if subject already starts with Re:", async () => {
    const email = makePendingEmail({ from: "bob@example.com", subject: "Re: Question" })
    mockSendEmail.mockResolvedValue(undefined)

    await emailChannelConfig.sendResponse(email, "reply")

    expect(mockSendEmail).toHaveBeenCalledWith("bob@example.com", "Re: Question", "reply")
  })

  it("returns false for invalid email address", async () => {
    const email = makePendingEmail({ from: "not-an-email" })

    const result = await emailChannelConfig.sendResponse(email, "reply")

    expect(result).toBe(false)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe("emailChannelConfig.buildNotification", () => {
  it("builds a telegram notification with email details", () => {
    const email = makePendingEmail({ from: "alice@test.com", subject: "Hello" })

    const notification = emailChannelConfig.buildNotification(email, "Short reply")

    expect(notification).toContain("📧 Email replied")
    expect(notification).toContain("alice@test.com")
    expect(notification).toContain("Re: Hello")
    expect(notification).toContain("Short reply")
  })

  it("truncates long reply text with ellipsis", () => {
    const email = makePendingEmail()
    const longReply = "x".repeat(300)

    const notification = emailChannelConfig.buildNotification(email, longReply)

    expect(notification).toContain("...")
  })
})

describe("emailChannelConfig.buildEpisodeText", () => {
  it("includes sender and subject", () => {
    const email = makePendingEmail({ from: "bob@test.com", subject: "Important" })

    const text = emailChannelConfig.buildEpisodeText(email)

    expect(text).toBe("Responded to email from bob@test.com (Important)")
  })
})
