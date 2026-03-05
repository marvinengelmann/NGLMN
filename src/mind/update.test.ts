import { describe, expect, it, vi } from "vitest"
import { DEFAULT_OPERATOR_MODEL } from "./types.ts"
import { detectModelCorrection, updateOperatorModel } from "./update.ts"

vi.mock("@/core/intelligence.ts", () => ({
  callIntelligence: vi.fn().mockResolvedValue({
    isOk: () => true,
    isErr: () => false,
    value: {
      mood: "happy",
      intent: "chatting",
      expectation: "friendly reply",
      confidence: 0.7
    }
  })
}))

vi.mock("@/lib/logger.ts", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

vi.mock("@/lib/time.ts", () => ({
  nowISO: vi.fn(() => "2025-06-15T10:00:00.000Z")
}))

describe("updateOperatorModel", () => {
  it("decrements correctionDelay when > 0", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    const model = { ...DEFAULT_OPERATOR_MODEL, correctionDelay: 2, lastUpdated: "2025-06-15T09:00:00.000Z" }
    const result = await updateOperatorModel({
      messageTexts: [],
      messageTimestamps: [],
      silenceMinutes: 5,
      previousModel: model
    })
    expect(result.correctionDelay).toBe(1)
    vi.restoreAllMocks()
  })

  it("keeps old mood estimate during correction delay", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    const model = {
      ...DEFAULT_OPERATOR_MODEL,
      estimatedMood: "sad" as const,
      correctionDelay: 2,
      lastUpdated: "2025-06-15T09:00:00.000Z"
    }
    const result = await updateOperatorModel({
      messageTexts: ["hello!"],
      messageTimestamps: ["10:00"],
      silenceMinutes: 5,
      previousModel: model
    })
    expect(result.estimatedMood).toBe("sad")
    vi.restoreAllMocks()
  })

  it("applies confidence dip with correct range", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5)

    const model = { ...DEFAULT_OPERATOR_MODEL, modelConfidence: 0.8, lastUpdated: "2025-06-15T09:00:00.000Z" }
    const result = await updateOperatorModel({
      messageTexts: [],
      messageTimestamps: [],
      silenceMinutes: 5,
      previousModel: model
    })

    const dip = model.modelConfidence - result.modelConfidence
    expect(dip).toBeGreaterThanOrEqual(0.15)
    expect(dip).toBeLessThanOrEqual(0.3)
    vi.restoreAllMocks()
  })
})

describe("detectModelCorrection", () => {
  it("returns null when previous mood is unknown", () => {
    const prev = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "unknown" as const }
    const next = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "happy" as const }
    expect(detectModelCorrection(prev, next)).toBeNull()
  })

  it("returns null when mood unchanged", () => {
    const prev = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "happy" as const }
    const next = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "happy" as const }
    expect(detectModelCorrection(prev, next)).toBeNull()
  })

  it("detects mood shift as correction", () => {
    const prev = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "happy" as const, lastUpdated: "2025-06-15T09:00:00.000Z" }
    const next = { ...DEFAULT_OPERATOR_MODEL, estimatedMood: "sad" as const, lastUpdated: "2025-06-15T10:00:00.000Z" }
    const correction = detectModelCorrection(prev, next)
    expect(correction).not.toBeNull()
    expect(correction?.previousEstimate).toBe("happy")
    expect(correction?.correctedTo).toBe("sad")
    expect(correction?.source).toBe("behavioral")
  })
})
