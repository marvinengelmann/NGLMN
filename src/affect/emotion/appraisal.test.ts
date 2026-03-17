import { describe, expect, it } from "vitest"
import {
  appraiseCopingPotential,
  appraiseGoalRelevance,
  appraiseNovelty,
  appraisePleasantness,
  computeAppraisal,
  createNeutralAppraisalContext
} from "./appraisal.ts"
import type { AppraisalContext, EmotionUpdateEvent } from "./types.ts"

const baseContext: AppraisalContext = {
  noveltyLevel: 0.5,
  hasActiveGoals: true,
  confidence: 0.5,
  energy: 0.5,
  vagalZone: "ventral",
  selfConcept: { selfEfficacy: 0.5, selfWorth: 0.5, selfContinuity: 0.7, agency: 0.5, authenticity: 0.6 }
}

describe("appraiseNovelty", () => {
  it("returns higher novelty for longer time since last similar", () => {
    const recent = appraiseNovelty(0.5, 5)
    const distant = appraiseNovelty(0.5, 2880)
    expect(distant).toBeGreaterThan(recent)
  })

  it("returns novelty level directly when no timestamp available", () => {
    expect(appraiseNovelty(0.7, undefined)).toBe(0.7)
  })
})

describe("appraisePleasantness", () => {
  it("returns positive for pleasant triggers", () => {
    const event: EmotionUpdateEvent = { trigger: "message_received", intensity: 1.0 }
    expect(appraisePleasantness(event)).toBeGreaterThan(0)
  })

  it("returns negative for unpleasant triggers", () => {
    const event: EmotionUpdateEvent = { trigger: "guardian_block", intensity: 1.0 }
    expect(appraisePleasantness(event)).toBeLessThan(0)
  })

  it("returns zero for neutral triggers", () => {
    const event: EmotionUpdateEvent = { trigger: "ambient", intensity: 1.0 }
    expect(appraisePleasantness(event)).toBe(0)
  })

  it("scales by intensity", () => {
    const low: EmotionUpdateEvent = { trigger: "task_success", intensity: 0.3 }
    const high: EmotionUpdateEvent = { trigger: "task_success", intensity: 1.0 }
    expect(appraisePleasantness(high)).toBeGreaterThan(appraisePleasantness(low))
  })
})

describe("appraiseGoalRelevance", () => {
  it("returns high relevance for goal-related triggers", () => {
    const event: EmotionUpdateEvent = { trigger: "goal_completed", intensity: 0.8 }
    expect(appraiseGoalRelevance(event, true)).toBeGreaterThan(0.5)
  })

  it("returns lower relevance when no active goals", () => {
    const event: EmotionUpdateEvent = { trigger: "message_received", intensity: 0.5 }
    expect(appraiseGoalRelevance(event, false)).toBeLessThan(appraiseGoalRelevance(event, true))
  })
})

describe("appraiseCopingPotential", () => {
  it("returns high coping in ventral vagal with high confidence", () => {
    expect(appraiseCopingPotential(0.8, 0.7, "ventral")).toBeGreaterThan(0.7)
  })

  it("returns low coping in dorsal vagal", () => {
    expect(appraiseCopingPotential(0.5, 0.5, "dorsal")).toBeLessThan(0.4)
  })

  it("sympathetic is between ventral and dorsal", () => {
    const ventral = appraiseCopingPotential(0.5, 0.5, "ventral")
    const sympathetic = appraiseCopingPotential(0.5, 0.5, "sympathetic")
    const dorsal = appraiseCopingPotential(0.5, 0.5, "dorsal")
    expect(sympathetic).toBeLessThan(ventral)
    expect(sympathetic).toBeGreaterThan(dorsal)
  })
})

describe("computeAppraisal", () => {
  it("amplifies threat response for low coping + negative event", () => {
    const event: EmotionUpdateEvent = { trigger: "task_failure", intensity: 0.8 }
    const lowCoping: AppraisalContext = { ...baseContext, confidence: 0.2, energy: 0.2, vagalZone: "sympathetic" }
    const highCoping: AppraisalContext = { ...baseContext, confidence: 0.8, energy: 0.8, vagalZone: "ventral" }

    const lowResult = computeAppraisal(event, lowCoping)
    const highResult = computeAppraisal(event, highCoping)

    expect(lowResult.overallModulation).toBeGreaterThan(highResult.overallModulation)
  })

  it("modulation stays within [0.3, 2.0]", () => {
    const event: EmotionUpdateEvent = { trigger: "boundary_violated", intensity: 1.0 }
    const extremeContext: AppraisalContext = {
      ...baseContext,
      confidence: 0.05,
      energy: 0.05,
      vagalZone: "dorsal",
      noveltyLevel: 1.0
    }
    const result = computeAppraisal(event, extremeContext)
    expect(result.overallModulation).toBeGreaterThanOrEqual(0.3)
    expect(result.overallModulation).toBeLessThanOrEqual(2.0)
  })

  it("same trigger produces different appraisals with different context", () => {
    const event: EmotionUpdateEvent = { trigger: "message_received", intensity: 0.7 }
    const safeContext: AppraisalContext = { ...baseContext, vagalZone: "ventral", confidence: 0.8 }
    const stressedContext: AppraisalContext = { ...baseContext, vagalZone: "sympathetic", confidence: 0.2 }

    const safeResult = computeAppraisal(event, safeContext)
    const stressedResult = computeAppraisal(event, stressedContext)

    expect(safeResult.copingPotential).not.toBe(stressedResult.copingPotential)
  })

  it("norm violations amplify modulation", () => {
    const event: EmotionUpdateEvent = { trigger: "boundary_violated", intensity: 0.9 }
    const result = computeAppraisal(event, baseContext)
    expect(result.normCompatibility).toBeLessThan(0)
  })
})

describe("createNeutralAppraisalContext", () => {
  it("returns a context with moderate values", () => {
    const ctx = createNeutralAppraisalContext()
    expect(ctx.vagalZone).toBe("ventral")
    expect(ctx.confidence).toBe(0.5)
    expect(ctx.energy).toBe(0.5)
  })
})
