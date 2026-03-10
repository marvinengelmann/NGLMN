import { describe, expect, it } from "vitest"
import * as z from "zod"
import { EmotionTrigger } from "./types.ts"

const MessageSentimentOutput = z.object({
  triggers: z.array(
    z.object({
      trigger: EmotionTrigger,
      intensity: z.number().min(0).max(1),
      detail: z.string().max(100)
    })
  ),
  dominantSentiment: z.enum(["positive", "negative", "neutral", "mixed"])
})

describe("MessageSentimentOutput schema", () => {
  it("validates a correct positive sentiment", () => {
    const data = {
      triggers: [{ trigger: "task_success", intensity: 0.8, detail: "great job" }],
      dominantSentiment: "positive"
    }
    expect(MessageSentimentOutput.parse(data)).toEqual(data)
  })

  it("validates multiple triggers", () => {
    const data = {
      triggers: [
        { trigger: "message_received", intensity: 0.5, detail: "generic" },
        { trigger: "operator_returned", intensity: 0.7, detail: "warm greeting" }
      ],
      dominantSentiment: "mixed"
    }
    expect(MessageSentimentOutput.parse(data)).toEqual(data)
  })

  it("rejects invalid trigger name", () => {
    const data = {
      triggers: [{ trigger: "invalid_trigger", intensity: 0.5, detail: "test" }],
      dominantSentiment: "neutral"
    }
    expect(() => MessageSentimentOutput.parse(data)).toThrow()
  })

  it("rejects intensity above 1", () => {
    const data = {
      triggers: [{ trigger: "message_received", intensity: 1.5, detail: "test" }],
      dominantSentiment: "neutral"
    }
    expect(() => MessageSentimentOutput.parse(data)).toThrow()
  })

  it("rejects intensity below 0", () => {
    const data = {
      triggers: [{ trigger: "message_received", intensity: -0.1, detail: "test" }],
      dominantSentiment: "neutral"
    }
    expect(() => MessageSentimentOutput.parse(data)).toThrow()
  })

  it("rejects invalid dominant sentiment", () => {
    const data = {
      triggers: [{ trigger: "message_received", intensity: 0.5, detail: "test" }],
      dominantSentiment: "angry"
    }
    expect(() => MessageSentimentOutput.parse(data)).toThrow()
  })

  it("validates empty triggers array", () => {
    const data = {
      triggers: [],
      dominantSentiment: "neutral"
    }
    expect(MessageSentimentOutput.parse(data)).toEqual(data)
  })
})
