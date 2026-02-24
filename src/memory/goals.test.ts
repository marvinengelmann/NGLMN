vi.mock("@/db/client.ts", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    returning: vi.fn()
  }
}))

vi.mock("@/db/schema.ts", () => ({
  goals: {
    id: "id",
    title: "title",
    status: "status",
    priority: "priority",
    source: "source",
    emotionalWeight: "emotional_weight"
  }
}))

import type { GoalSelect } from "@/db/schema.ts"
import { makeEmotionalState } from "@/test/factories.ts"
import { computeEffectiveScore } from "./goals.ts"

function makeGoal(overrides?: Partial<GoalSelect>): GoalSelect {
  return {
    id: "goal-1",
    title: "Test goal",
    description: "A test goal",
    source: "self",
    priority: 0.5,
    status: "open",
    emotionalWeight: 0.5,
    parentGoalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    deadline: null,
    ...overrides
  }
}

describe("computeEffectiveScore", () => {
  it("returns priority when emotional weight is zero", () => {
    const goal = makeGoal({ priority: 0.8, emotionalWeight: 0 })
    const emotion = makeEmotionalState({ frustration: 1.0 })
    expect(computeEffectiveScore(goal, emotion)).toBe(0.8)
  })

  it("adds emotion bonus for curiosity-sourced goals", () => {
    const goal = makeGoal({ source: "curiosity", priority: 0.5, emotionalWeight: 1.0 })
    const emotion = makeEmotionalState({ curiosity: 0.8 })
    const score = computeEffectiveScore(goal, emotion)
    expect(score).toBeCloseTo(0.5 + 0.8 * 1.0 * 0.3)
  })

  it("adds emotion bonus for dream-sourced goals using excitement", () => {
    const goal = makeGoal({ source: "dream", priority: 0.5, emotionalWeight: 0.7 })
    const emotion = makeEmotionalState({ excitement: 0.9 })
    const score = computeEffectiveScore(goal, emotion)
    expect(score).toBeCloseTo(0.5 + 0.9 * 0.7 * 0.3)
  })

  it("adds emotion bonus for self-sourced goals using frustration", () => {
    const goal = makeGoal({ source: "self", priority: 0.6, emotionalWeight: 0.5 })
    const emotion = makeEmotionalState({ frustration: 0.7 })
    const score = computeEffectiveScore(goal, emotion)
    expect(score).toBeCloseTo(0.6 + 0.7 * 0.5 * 0.3)
  })

  it("adds emotion bonus for operator-sourced goals using connection", () => {
    const goal = makeGoal({ source: "operator", priority: 0.4, emotionalWeight: 0.8 })
    const emotion = makeEmotionalState({ connection: 0.6 })
    const score = computeEffectiveScore(goal, emotion)
    expect(score).toBeCloseTo(0.4 + 0.6 * 0.8 * 0.3)
  })

  it("uses defaults when priority and emotionalWeight are null", () => {
    const goal = makeGoal({ priority: null, emotionalWeight: null })
    const emotion = makeEmotionalState({ frustration: 0.5 })
    const score = computeEffectiveScore(goal, emotion)
    expect(score).toBeCloseTo(0.5 + 0.5 * 0.5 * 0.3)
  })

  it("produces higher score for high-emotion matching goals", () => {
    const curiosityGoal = makeGoal({ source: "curiosity", priority: 0.5, emotionalWeight: 0.8 })
    const dreamGoal = makeGoal({ source: "dream", priority: 0.6, emotionalWeight: 0.5 })
    const emotion = makeEmotionalState({ curiosity: 0.9, excitement: 0.2 })

    const curiosityScore = computeEffectiveScore(curiosityGoal, emotion)
    const dreamScore = computeEffectiveScore(dreamGoal, emotion)

    expect(curiosityScore).toBeGreaterThan(dreamScore)
  })
})
