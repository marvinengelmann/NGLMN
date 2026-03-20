import { describe, expect, it } from "vitest"
import { computeDriveEmotionTriggers, computeDriveUpdate, inferBlockedDrives, inferSatisfiedDrives } from "./compute.ts"
import { DEFAULT_DRIVE_STATE, type DriveState } from "./types.ts"

function makeTestDriveState(overrides?: Partial<DriveState>): DriveState {
  return { ...DEFAULT_DRIVE_STATE, ...overrides }
}

describe("computeDriveUpdate", () => {
  it("should decay satiation over time", () => {
    const state = makeTestDriveState()
    const result = computeDriveUpdate({
      current: state,
      elapsedMinutes: 120,
      blocked: new Set(),
      satisfied: new Set()
    })

    expect(result.curiosity.satiation).toBeLessThan(0.5)
  })

  it("should increase frustration for blocked drives", () => {
    const state = makeTestDriveState()
    const result = computeDriveUpdate({
      current: state,
      elapsedMinutes: 5,
      blocked: new Set(["connection"]),
      satisfied: new Set()
    })

    expect(result.connection.frustration).toBeGreaterThan(0)
    expect(result.connection.consecutiveBlockedTicks).toBe(1)
  })

  it("should satisfy drives and reduce frustration", () => {
    const state = makeTestDriveState({
      curiosity: {
        satiation: 0.2,
        frustration: 0.5,
        salience: 0.8,
        lastSatisfiedAt: "2026-03-06T12:00:00Z",
        consecutiveBlockedTicks: 3
      }
    })

    const result = computeDriveUpdate({
      current: state,
      elapsedMinutes: 5,
      blocked: new Set(),
      satisfied: new Set(["curiosity"])
    })

    expect(result.curiosity.satiation).toBeGreaterThan(0.2)
    expect(result.curiosity.frustration).toBeLessThan(0.5)
    expect(result.curiosity.consecutiveBlockedTicks).toBe(0)
  })

  it("should detect dominant drive when salience is high", () => {
    const state = makeTestDriveState({
      curiosity: {
        satiation: 0.1,
        frustration: 0.5,
        salience: 0.9,
        lastSatisfiedAt: "2026-03-06T12:00:00Z",
        consecutiveBlockedTicks: 0
      }
    })

    const result = computeDriveUpdate({
      current: state,
      elapsedMinutes: 5,
      blocked: new Set(),
      satisfied: new Set()
    })

    expect(result.dominantDrive).toBe("curiosity")
  })

  it("should detect conflicting drives", () => {
    const highSalienceLevel = {
      satiation: 0.1,
      frustration: 0.3,
      salience: 0.8,
      lastSatisfiedAt: "2026-03-06T12:00:00Z",
      consecutiveBlockedTicks: 0
    }

    const state = makeTestDriveState({
      curiosity: highSalienceLevel,
      connection: highSalienceLevel
    })

    const result = computeDriveUpdate({
      current: state,
      elapsedMinutes: 5,
      blocked: new Set(),
      satisfied: new Set()
    })

    expect(result.conflicting.length).toBeGreaterThan(0)
  })
})

describe("computeDriveEmotionTriggers", () => {
  it("should generate triggers for frustrated drives", () => {
    const state = makeTestDriveState({
      connection: {
        satiation: 0.1,
        frustration: 0.8,
        salience: 0.9,
        lastSatisfiedAt: "2026-03-06T12:00:00Z",
        consecutiveBlockedTicks: 5
      }
    })

    const triggers = computeDriveEmotionTriggers(state)
    expect(triggers.length).toBeGreaterThan(0)
    expect(triggers[0]?.trigger).toBe("drive_frustrated")
  })

  it("should generate no triggers when drives are satisfied", () => {
    const triggers = computeDriveEmotionTriggers(DEFAULT_DRIVE_STATE)
    expect(triggers.length).toBe(0)
  })

  it("should generate conflict triggers", () => {
    const state = makeTestDriveState({
      conflicting: [["curiosity", "connection"]]
    })

    const triggers = computeDriveEmotionTriggers(state)
    const conflictTrigger = triggers.find((t) => t.trigger === "drive_conflict")
    expect(conflictTrigger).toBeDefined()
  })
})

describe("inferSatisfiedDrives", () => {
  it("should satisfy connection when in conversation", () => {
    const satisfied = inferSatisfiedDrives(true, 0, "idle")
    expect(satisfied.has("connection")).toBe(true)
  })

  it("should satisfy mastery and curiosity for reflect action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "reflect")
    expect(satisfied.has("curiosity")).toBe(true)
    expect(satisfied.has("mastery")).toBe(true)
  })

  it("should satisfy expression and autonomy for create action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "create")
    expect(satisfied.has("expression")).toBe(true)
    expect(satisfied.has("autonomy")).toBe(true)
  })

  it("should satisfy autonomy and expression for life_event action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "life_event")
    expect(satisfied.has("autonomy")).toBe(true)
    expect(satisfied.has("expression")).toBe(true)
  })

  it("should satisfy autonomy and expression for social_media action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "social_media")
    expect(satisfied.has("autonomy")).toBe(true)
    expect(satisfied.has("expression")).toBe(true)
  })

  it("should satisfy curiosity for check_email action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "check_email")
    expect(satisfied.has("curiosity")).toBe(true)
  })

  it("should satisfy connection for morning action", () => {
    const satisfied = inferSatisfiedDrives(false, 0, "morning")
    expect(satisfied.has("connection")).toBe(true)
  })

  it("should satisfy expression when sharing emotions in conversation", () => {
    const satisfied = inferSatisfiedDrives(true, 1, "idle", ["reflect", "idle"])
    expect(satisfied.has("expression")).toBe(true)
  })
})

describe("inferBlockedDrives", () => {
  it("should block connection during long silence", () => {
    const blocked = inferBlockedDrives(180, 0, false)
    expect(blocked.has("connection")).toBe(true)
  })

  it("should block curiosity during long idle", () => {
    const blocked = inferBlockedDrives(0, 70, false)
    expect(blocked.has("curiosity")).toBe(true)
  })

  it("should block expression during long idle without creative actions", () => {
    const blocked = inferBlockedDrives(0, 100, false, ["idle", "idle"])
    expect(blocked.has("expression")).toBe(true)
  })

  it("should not block expression if recent create action exists", () => {
    const blocked = inferBlockedDrives(0, 8, false, ["create", "idle"])
    expect(blocked.has("expression")).toBe(false)
  })

  it("should block connection when idle beyond threshold without social activity", () => {
    const blocked = inferBlockedDrives(150, 130, false, ["idle", "idle"])
    expect(blocked.has("connection")).toBe(true)
  })

  it("should block autonomy when all recent actions are idle", () => {
    const blocked = inferBlockedDrives(0, 0, false, ["idle", "idle", "idle"])
    expect(blocked.has("autonomy")).toBe(true)
  })

  it("should not block autonomy when recent actions include non-idle", () => {
    const blocked = inferBlockedDrives(0, 0, false, ["idle", "reflect", "idle"])
    expect(blocked.has("autonomy")).toBe(false)
  })
})
