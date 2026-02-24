import { ok } from "neverthrow"

vi.mock("@/integrations/anthropic.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/integrations/anthropic.ts")>()),
  callClaude: vi.fn()
}))

vi.mock("./evolution.ts", () => ({
  updateAdaptiveLayer: vi.fn().mockResolvedValue({
    directness: 0.6,
    curiosity: 0.8,
    humor: 0.7,
    caution: 0.5,
    proactivity: 0.7,
    verbosity: 0.4,
    warmth: 0.82,
    structure: 0.5,
    empathy: 0.7,
    abstraction: 0.6
  })
}))

import { callClaude } from "@/integrations/anthropic.ts"
import { updateAdaptiveLayer } from "./evolution.ts"
import { analyzeOperatorFeedback, applyFeedback } from "./feedback.ts"

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>
const mockUpdateAdaptiveLayer = updateAdaptiveLayer as ReturnType<typeof vi.fn>

describe("analyzeOperatorFeedback", () => {
  it("parses positive sentiment", async () => {
    mockCallClaude.mockResolvedValue(ok('{"sentiment": "positive", "confidence": 0.85}'))
    const result = await analyzeOperatorFeedback(["Great job!"], "Here's the summary.")
    expect(result.sentiment).toBe("positive")
    expect(result.confidence).toBe(0.85)
  })

  it("parses negative sentiment", async () => {
    mockCallClaude.mockResolvedValue(ok('{"sentiment": "negative", "confidence": 0.7, "dimension": "verbosity"}'))
    const result = await analyzeOperatorFeedback(["Too long."], "Here's a detailed explanation...")
    expect(result.sentiment).toBe("negative")
    expect(result.dimension).toBe("verbosity")
  })

  it("returns neutral for unparseable response", async () => {
    mockCallClaude.mockResolvedValue(ok("I cannot analyze this."))
    const result = await analyzeOperatorFeedback(["hmm"], "response")
    expect(result.sentiment).toBe("neutral")
    expect(result.confidence).toBe(0)
  })
})

describe("applyFeedback", () => {
  beforeEach(() => {
    mockUpdateAdaptiveLayer.mockClear()
  })

  it("applies positive feedback", async () => {
    await applyFeedback({ sentiment: "positive", confidence: 0.8 })
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ warmth: 0.02 }, expect.stringContaining("positive"))
  })

  it("skips when confidence is too low", async () => {
    await applyFeedback({ sentiment: "positive", confidence: 0.3 })
    expect(mockUpdateAdaptiveLayer).not.toHaveBeenCalled()
  })

  it("applies negative feedback", async () => {
    await applyFeedback({ sentiment: "negative", confidence: 0.7 })
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ warmth: -0.01 }, expect.stringContaining("negative"))
  })

  it("applies negative-structure feedback", async () => {
    await applyFeedback({ sentiment: "negative", confidence: 0.8, dimension: "structure" })
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ structure: -0.02 }, expect.stringContaining("negative"))
  })

  it("applies negative-empathy feedback", async () => {
    await applyFeedback({ sentiment: "negative", confidence: 0.8, dimension: "empathy" })
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ empathy: -0.02 }, expect.stringContaining("negative"))
  })

  it("applies negative-abstraction feedback", async () => {
    await applyFeedback({ sentiment: "negative", confidence: 0.8, dimension: "abstraction" })
    expect(mockUpdateAdaptiveLayer).toHaveBeenCalledWith({ abstraction: -0.02 }, expect.stringContaining("negative"))
  })

  it("skips neutral feedback", async () => {
    await applyFeedback({ sentiment: "neutral", confidence: 0.9 })
    expect(mockUpdateAdaptiveLayer).not.toHaveBeenCalled()
  })
})
