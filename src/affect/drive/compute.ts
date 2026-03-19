import type { EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { halfLifeDecay } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { DRIVES } from "./constants.ts"
import { type DriveLevel, type DriveState, DriveType } from "./types.ts"

const DRIVE_NAMES = DriveType.options

function decaySatiation(level: DriveLevel, driveType: DriveType, elapsedMinutes: number): number {
  const halfLife = DRIVES.HALF_LIVES[driveType]
  const decayFactor = halfLifeDecay(elapsedMinutes, halfLife)
  return Math.max(0, level.satiation * decayFactor)
}

function computeSalience(satiation: number, frustration: number): number {
  return Math.min(1, (1 - satiation) * (1 + frustration * DRIVES.FRUSTRATION_SALIENCE_FACTOR))
}

interface DriveUpdateContext {
  current: DriveState
  elapsedMinutes: number
  blocked: Set<DriveType>
  satisfied: Set<DriveType>
  dopamineModulation?: number
  isolationCost?: number
}

/**
 * Compute updated drive state with half-life decay, frustration buildup, and salience calculation.
 */
export function computeDriveUpdate(context: DriveUpdateContext): DriveState {
  const { current, elapsedMinutes, blocked, satisfied } = context
  const now = nowISO()
  const updated = Object.fromEntries(
    DRIVE_NAMES.map((drive) => {
      const level = current[drive]
      let satiation = decaySatiation(level, drive, elapsedMinutes)
      let frustration = level.frustration
      let consecutiveBlockedTicks = level.consecutiveBlockedTicks
      let lastSatisfiedAt = level.lastSatisfiedAt

      if (satisfied.has(drive)) {
        const dopamineScale = context.dopamineModulation ?? 1.0
        satiation = Math.min(1, satiation + DRIVES.SATISFACTION_AMOUNTS[drive] * dopamineScale)
        frustration = Math.max(0, frustration - DRIVES.SATISFACTION_FRUSTRATION_RELIEF)
        consecutiveBlockedTicks = 0
        lastSatisfiedAt = now
      }

      if (blocked.has(drive)) {
        consecutiveBlockedTicks++
        frustration = Math.min(1, frustration + DRIVES.FRUSTRATION_GROWTH * consecutiveBlockedTicks)
      } else {
        frustration = frustration * DRIVES.FRUSTRATION_DECAY
      }

      if (drive === "connection" && (context.isolationCost ?? 0) > 0.3) {
        frustration = Math.min(1, frustration + (context.isolationCost ?? 0) * DRIVES.FRUSTRATION_GROWTH)
      }

      const salience = computeSalience(satiation, frustration)

      return [
        drive,
        {
          satiation,
          frustration: Math.min(1, frustration),
          salience,
          lastSatisfiedAt,
          consecutiveBlockedTicks
        }
      ]
    })
  ) as Record<DriveType, DriveLevel>

  const salienceEntries = DRIVE_NAMES.map((d) => ({
    drive: d,
    salience: updated[d].salience
  }))
  salienceEntries.sort((a, b) => b.salience - a.salience)

  const dominantDrive =
    salienceEntries[0] && salienceEntries[0].salience > DRIVES.SALIENCE_THRESHOLD ? salienceEntries[0].drive : null

  const conflicting: [DriveType, DriveType][] = salienceEntries.flatMap((a, i) =>
    salienceEntries
      .slice(i + 1)
      .filter((b) => a.salience > DRIVES.CONFLICT_THRESHOLD && b.salience > DRIVES.CONFLICT_THRESHOLD)
      .map((b) => [a.drive, b.drive] as [DriveType, DriveType])
  )

  return {
    curiosity: updated.curiosity,
    connection: updated.connection,
    mastery: updated.mastery,
    autonomy: updated.autonomy,
    expression: updated.expression,
    dominantDrive,
    conflicting
  }
}

/**
 * Generate emotion triggers from frustrated drives.
 */
export function computeDriveEmotionTriggers(state: DriveState): EmotionUpdateEvent[] {
  const triggers: EmotionUpdateEvent[] = DRIVE_NAMES.filter(
    (drive) => state[drive].frustration >= DRIVES.EMOTION_TRIGGER_FRUSTRATION
  ).map((drive) => ({
    trigger: "drive_frustrated" as const,
    intensity: state[drive].frustration * DRIVES.FRUSTRATION_EMOTION_INTENSITY,
    detail: `${drive} drive frustrated (${state[drive].frustration.toFixed(2)})`
  }))

  if (state.conflicting.length > 0) {
    triggers.push({
      trigger: "drive_conflict",
      intensity: DRIVES.CONFLICT_EMOTION_INTENSITY,
      detail: `conflicting drives: ${state.conflicting.map(([a, b]) => `${a}/${b}`).join(", ")}`
    })
  }

  return triggers
}

/**
 * Determine which drives are satisfied by recent actions.
 */
export function inferSatisfiedDrives(
  inConversation: boolean,
  pendingMessageCount: number,
  action: string,
  recentActions: string[] = []
): Set<DriveType> {
  const satisfied = new Set<DriveType>()

  if (pendingMessageCount > 0 || inConversation) {
    satisfied.add("connection")
  }

  if (action === "reflect" || action === "store_knowledge") {
    satisfied.add("curiosity")
    satisfied.add("mastery")
  }

  if (action === "evolve") {
    satisfied.add("mastery")
    satisfied.add("autonomy")
  }

  if (action === "social_media") {
    satisfied.add("expression")
    satisfied.add("autonomy")
  }

  if (action === "create") {
    satisfied.add("expression")
    satisfied.add("autonomy")
  }

  if (action === "life_event") {
    satisfied.add("autonomy")
    satisfied.add("expression")
  }

  if (action === "check_email" || (action === "social_media" && recentActions.includes("social_media"))) {
    satisfied.add("curiosity")
  }

  if (action === "morning") {
    satisfied.add("connection")
  }

  const hasEmotionalSharing = inConversation && recentActions.some((a) => a === "reflect" || a === "store_knowledge")
  if (hasEmotionalSharing) {
    satisfied.add("expression")
  }

  return satisfied
}

/**
 * Determine which drives are blocked by current conditions.
 */
export function inferBlockedDrives(
  operatorSilenceMinutes: number,
  consecutiveIdleTicks: number,
  isDreaming: boolean,
  recentActions: string[] = []
): Set<DriveType> {
  const blocked = new Set<DriveType>()

  if (operatorSilenceMinutes > DRIVES.CONNECTION_BLOCKED_SILENCE_MINUTES) {
    blocked.add("connection")
  }

  if (consecutiveIdleTicks > 10 && !recentActions.some((a) => a === "social_media" || a === "check_email")) {
    blocked.add("connection")
  }

  if (consecutiveIdleTicks > DRIVES.CURIOSITY_BLOCKED_IDLE_TICKS) {
    blocked.add("curiosity")
  }

  if (
    consecutiveIdleTicks > DRIVES.EXPRESSION_BLOCKED_IDLE_TICKS &&
    !recentActions.some((a) => a === "create" || a === "social_media")
  ) {
    blocked.add("expression")
  }

  if (recentActions.length > 0 && recentActions.every((a) => a === "idle")) {
    blocked.add("autonomy")
  }

  if (isDreaming) {
    blocked.add("mastery")
    blocked.add("autonomy")
  }

  return blocked
}
