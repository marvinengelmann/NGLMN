vi.mock("@/config/env.ts", () => ({
  hasEmailConfig: vi.fn(() => true),
  hasXConfig: vi.fn(() => true)
}))

vi.mock("@/inbound/email.ts", () => ({
  emailChannelConfig: { channel: "email" }
}))

vi.mock("@/inbound/x.ts", () => ({
  xChannelConfig: { channel: "x" }
}))

vi.mock("@/inbound/processor.ts", () => ({
  processInboundItems: vi.fn()
}))

vi.mock("@/integrations/resend.ts", () => ({
  pollNewEmails: vi.fn()
}))

vi.mock("@/integrations/x.ts", () => ({
  pollNewMentions: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

import { hasEmailConfig, hasXConfig } from "@/config/env.ts"
import { processInboundItems } from "@/inbound/processor.ts"
import { pollNewEmails } from "@/integrations/resend.ts"
import { pollNewMentions } from "@/integrations/x.ts"
import { runInboundCycle } from "./cycle.ts"

const mockHasEmailConfig = hasEmailConfig as ReturnType<typeof vi.fn>
const mockHasXConfig = hasXConfig as ReturnType<typeof vi.fn>
const mockPollNewEmails = pollNewEmails as ReturnType<typeof vi.fn>
const mockPollNewMentions = pollNewMentions as ReturnType<typeof vi.fn>
const mockProcessInboundItems = processInboundItems as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockHasEmailConfig.mockReturnValue(true)
  mockHasXConfig.mockReturnValue(true)
  mockPollNewEmails.mockResolvedValue(0)
  mockPollNewMentions.mockResolvedValue(0)
  mockProcessInboundItems.mockResolvedValue({ processed: 0 })
})

describe("runInboundCycle", () => {
  it("polls and processes both channels when configured", async () => {
    mockPollNewEmails.mockResolvedValue(3)
    mockPollNewMentions.mockResolvedValue(2)
    mockProcessInboundItems.mockResolvedValue({ processed: 1 })

    const result = await runInboundCycle()

    expect(result.polled).toEqual({ emails: 3, mentions: 2 })
    expect(result.processed).toEqual({ emails: 1, mentions: 1 })
    expect(mockProcessInboundItems).toHaveBeenCalledTimes(2)
  })

  it("only polls email when X is not configured", async () => {
    mockHasXConfig.mockReturnValue(false)
    mockPollNewEmails.mockResolvedValue(1)
    mockProcessInboundItems.mockResolvedValue({ processed: 1 })

    const result = await runInboundCycle()

    expect(result.polled).toEqual({ emails: 1, mentions: 0 })
    expect(mockPollNewMentions).not.toHaveBeenCalled()
  })

  it("only polls X when email is not configured", async () => {
    mockHasEmailConfig.mockReturnValue(false)
    mockPollNewMentions.mockResolvedValue(2)
    mockProcessInboundItems.mockResolvedValue({ processed: 2 })

    const result = await runInboundCycle()

    expect(result.polled).toEqual({ emails: 0, mentions: 2 })
    expect(mockPollNewEmails).not.toHaveBeenCalled()
  })

  it("isolates poll failures — email failure does not block X", async () => {
    mockPollNewEmails.mockRejectedValue(new Error("email SMTP down"))
    mockPollNewMentions.mockResolvedValue(5)
    mockProcessInboundItems.mockResolvedValue({ processed: 3 })

    const result = await runInboundCycle()

    expect(result.polled.emails).toBe(0)
    expect(result.polled.mentions).toBe(5)
    expect(result.processed.mentions).toBe(3)
  })

  it("skips processing when poll returns zero items", async () => {
    mockPollNewEmails.mockResolvedValue(0)
    mockPollNewMentions.mockResolvedValue(0)

    const result = await runInboundCycle()

    expect(mockProcessInboundItems).not.toHaveBeenCalled()
    expect(result.processed).toEqual({ emails: 0, mentions: 0 })
  })
})
