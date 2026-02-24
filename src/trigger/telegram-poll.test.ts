vi.mock("@trigger.dev/sdk", () => ({
  schedules: { task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() })) },
  wait: { completeToken: vi.fn() }
}))

vi.mock("@/integrations/telegram.ts", () => ({
  pollNewMessages: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/memory/working.ts", () => ({
  getConversationWaitToken: vi.fn(),
  setOperatorLastActivity: vi.fn()
}))

vi.mock("@/trigger/conversation-handler.ts", () => ({
  conversationHandlerTask: { trigger: vi.fn() }
}))

import { pollNewMessages } from "@/integrations/telegram.ts"
import { getConversationWaitToken, setOperatorLastActivity } from "@/memory/working.ts"
import { telegramPollTask } from "./telegram-poll.ts"

const mockPoll = pollNewMessages as ReturnType<typeof vi.fn>
const mockGetWaitToken = getConversationWaitToken as ReturnType<typeof vi.fn>
const mockSetActivity = setOperatorLastActivity as ReturnType<typeof vi.fn>

const run = (telegramPollTask as unknown as Record<string, () => Promise<unknown>>).run as () => Promise<unknown>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("telegram-poll run", () => {
  it("does nothing beyond polling when no new messages", async () => {
    mockPoll.mockResolvedValue(0)

    const result = await run()

    expect(result).toEqual({ newMessages: 0 })
    expect(mockSetActivity).not.toHaveBeenCalled()
    expect(mockGetWaitToken).not.toHaveBeenCalled()
  })

  it("sets operator last activity when messages found", async () => {
    mockPoll.mockResolvedValue(3)
    mockGetWaitToken.mockResolvedValue(null)

    await run()

    expect(mockSetActivity).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}/))
  })

  it("completes wait token instead of triggering handler when token exists", async () => {
    mockPoll.mockResolvedValue(1)
    mockGetWaitToken.mockResolvedValue("token-abc")

    await run()

    const { wait } = await import("@trigger.dev/sdk")
    expect(wait.completeToken).toHaveBeenCalledWith("token-abc", { resumed: true })
    const { conversationHandlerTask } = await import("@/trigger/conversation-handler.ts")
    expect(conversationHandlerTask.trigger).not.toHaveBeenCalled()
  })

  it("triggers conversation handler when no wait token exists", async () => {
    mockPoll.mockResolvedValue(2)
    mockGetWaitToken.mockResolvedValue(null)

    await run()

    const { conversationHandlerTask } = await import("@/trigger/conversation-handler.ts")
    expect(conversationHandlerTask.trigger).toHaveBeenCalledWith({ triggerReason: "new_messages" })
    const { wait } = await import("@trigger.dev/sdk")
    expect(wait.completeToken).not.toHaveBeenCalled()
  })
})
