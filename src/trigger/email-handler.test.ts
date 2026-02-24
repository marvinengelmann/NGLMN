import { describe, expect, it, vi } from "vitest"

vi.mock("@trigger.dev/sdk", () => ({
  task: vi.fn((config: Record<string, unknown>) => ({ ...config, trigger: vi.fn() }))
}))

vi.mock("@/core/model-router.ts", () => ({
  getMaxTokensForTier: vi.fn(() => 2048),
  selectModel: vi.fn(() => "haiku")
}))

vi.mock("@/emotion/state.ts", () => ({
  getEmotionalState: vi.fn(() => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.1,
    boredom: 0.3,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  })),
  saveEmotionalState: vi.fn()
}))

vi.mock("@/emotion/update.ts", () => ({
  computeEmotionalUpdate: vi.fn((_state: unknown) => ({
    curiosity: 0.5,
    satisfaction: 0.5,
    frustration: 0.1,
    boredom: 0.3,
    excitement: 0.5,
    caution: 0.5,
    connection: 0.5
  }))
}))

vi.mock("@/evolution/prompt-loader.ts", () => ({
  loadPrompt: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("@/integrations/resend.ts", () => ({
  sendEmail: vi.fn()
}))

vi.mock("@/integrations/telegram.ts", () => ({
  sendGuardianAlert: vi.fn(),
  sendToOperator: vi.fn()
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

vi.mock("@/memory/episodic.ts", () => ({
  storeEpisode: vi.fn()
}))

vi.mock("@/memory/working.ts", () => ({
  clearPendingEmails: vi.fn(),
  peekAllPendingEmails: vi.fn(),
  pushPendingEmails: vi.fn()
}))

vi.mock("@/memory/semantic.ts", () => ({
  getOperatorLanguage: vi.fn(() => "German")
}))

vi.mock("@/personality/dna.ts", () => ({
  getEffectivePersonality: vi.fn()
}))

vi.mock("@/personality/expression.ts", () => ({
  buildPersonalityPrompt: vi.fn(() => "personality prompt")
}))

vi.mock("@/prompts/responder.ts", () => ({
  RESPONDER_SYSTEM_PROMPT: "mock responder prompt"
}))

vi.mock("@/security/guardian.ts", () => ({
  validateOutput: vi.fn()
}))

vi.mock("@/security/injection-defense.ts", () => ({
  wrapExternalData: vi.fn((text: string) => text)
}))

vi.mock("@/trust/assessment.ts", () => ({
  canActAutonomously: vi.fn()
}))

vi.mock("@/trust/history.ts", () => ({
  recordFailure: vi.fn(),
  recordSuccess: vi.fn()
}))

import { emailHandlerTask } from "./email-handler.ts"

describe("email-handler", () => {
  it("exports a task with the email-handler id", () => {
    expect(emailHandlerTask).toBeDefined()
    expect((emailHandlerTask as unknown as Record<string, unknown>).id).toBe("email-handler")
  })

  it("uses concurrency limit of 1", () => {
    expect((emailHandlerTask as unknown as Record<string, unknown>).queue).toEqual({ concurrencyLimit: 1 })
  })

  it("has a run function", () => {
    expect(typeof (emailHandlerTask as unknown as Record<string, unknown>).run).toBe("function")
  })
})
