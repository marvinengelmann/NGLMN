import { describe, expect, it } from "vitest"
import { ATTENTION } from "@/config/constants.ts"
import { makeEmotionalState, makeSomaticState } from "@/test/factories.ts"
import { computeAttentionState } from "./flow.ts"

describe("computeAttentionState", () => {
  it("returns hyperfocus when curiosity and energy are high with messages", () => {
    const emotion = makeEmotionalState({
      curiosity: ATTENTION.HYPERFOCUS_CURIOSITY + 0.1,
      energy: ATTENTION.HYPERFOCUS_ENERGY + 0.1
    })
    expect(computeAttentionState(emotion, makeSomaticState(), true, 0)).toBe("hyperfocus")
  })

  it("returns focused (not hyperfocus) without messages", () => {
    const emotion = makeEmotionalState({
      curiosity: ATTENTION.HYPERFOCUS_CURIOSITY + 0.1,
      energy: ATTENTION.HYPERFOCUS_ENERGY + 0.1,
      boredom: 0.1
    })
    expect(computeAttentionState(emotion, makeSomaticState(), false, 0)).toBe("focused")
  })

  it("returns blank when energy is low and gravity is high", () => {
    const emotion = makeEmotionalState({
      energy: ATTENTION.BLANK_ENERGY - 0.05,
      curiosity: 0.3,
      boredom: 0.3
    })
    const soma = makeSomaticState({ gravity: ATTENTION.BLANK_GRAVITY + 0.1 })
    expect(computeAttentionState(emotion, soma, false, 0)).toBe("blank")
  })

  it("returns drifting when boredom is high, energy low, and idle ticks exceeded", () => {
    const emotion = makeEmotionalState({
      boredom: ATTENTION.DRIFT_BOREDOM + 0.1,
      energy: ATTENTION.DRIFT_ENERGY - 0.1,
      curiosity: 0.3
    })
    const soma = makeSomaticState({ gravity: 0.3 })
    expect(computeAttentionState(emotion, soma, false, ATTENTION.DRIFT_IDLE_TICKS + 1)).toBe("drifting")
  })

  it("returns focused as default", () => {
    const emotion = makeEmotionalState({
      curiosity: 0.4,
      energy: 0.5,
      boredom: 0.3
    })
    expect(computeAttentionState(emotion, makeSomaticState(), false, 0)).toBe("focused")
  })
})
