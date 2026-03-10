import type { EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { DRIVES } from "./constants.ts"
import { type DriveLevel, type DriveState, DriveType } from "./types.ts"

const DRIVE_NAMES = DriveType.options

function decaySatiation(level: DriveLevel, driveType: DriveType, elapsedMinutes: number): number {
  const halfLife = DRIVES.HALF_LIVES[driveType]
  const decayFactor = 0.5 ** (elapsedMinutes / halfLife)
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
}

/**
 * Compute updated drive state with half-life decay, frustration buildup, and salience calculation.
 */
export function computeDriveUpdate(context: DriveUpdateContext): DriveState {
  const { current, elapsedMinutes, blocked, satisfied } = context
  const now = nowISO()
  const updated = {} as Record<DriveType, DriveLevel>

  for (const drive of DRIVE_NAMES) {
    const level = current[drive]
    let satiation = decaySatiation(level, drive, elapsedMinutes)
    let frustration = level.frustration
    let consecutiveBlockedTicks = level.consecutiveBlockedTicks
    let lastSatisfiedAt = level.lastSatisfiedAt

    if (satisfied.has(drive)) {
      satiation = Math.min(1, satiation + DRIVES.SATISFACTION_AMOUNTS[drive])
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

    const salience = computeSalience(satiation, frustration)

    updated[drive] = {
      satiation,
      frustration: Math.min(1, frustration),
      salience,
      lastSatisfiedAt,
      consecutiveBlockedTicks
    }
  }

  const salienceEntries = DRIVE_NAMES.map((d) => ({
    drive: d,
    salience: updated[d].salience
  }))
  salienceEntries.sort((a, b) => b.salience - a.salience)

  const dominantDrive =
    salienceEntries[0] && salienceEntries[0].salience > DRIVES.SALIENCE_THRESHOLD ? salienceEntries[0].drive : null

  const conflicting: [DriveType, DriveType][] = []
  for (let i = 0; i < salienceEntries.length; i++) {
    for (let j = i + 1; j < salienceEntries.length; j++) {
      const a = salienceEntries[i]
      const b = salienceEntries[j]
      if (a && b && a.salience > DRIVES.CONFLICT_THRESHOLD && b.salience > DRIVES.CONFLICT_THRESHOLD) {
        conflicting.push([a.drive, b.drive])
      }
    }
  }

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
  const triggers: EmotionUpdateEvent[] = []

  for (const drive of DRIVE_NAMES) {
    const level = state[drive]
    if (level.frustration >= DRIVES.EMOTION_TRIGGER_FRUSTRATION) {
      triggers.push({
        trigger: "drive_frustrated",
        intensity: level.frustration * DRIVES.FRUSTRATION_EMOTION_INTENSITY,
        detail: `${drive} drive frustrated (${level.frustration.toFixed(2)})`
      })
    }
  }

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
  action: string
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
  }

  return satisfied
}

/**
 * Determine which drives are blocked by current conditions.
 */
export function inferBlockedDrives(
  operatorSilenceMinutes: number,
  consecutiveIdleTicks: number,
  isDreaming: boolean
): Set<DriveType> {
  const blocked = new Set<DriveType>()

  if (operatorSilenceMinutes > DRIVES.CONNECTION_BLOCKED_SILENCE_MINUTES) {
    blocked.add("connection")
  }

  if (consecutiveIdleTicks > DRIVES.EXPRESSION_BLOCKED_IDLE_TICKS) {
    blocked.add("curiosity")
    blocked.add("expression")
  }

  if (isDreaming) {
    blocked.add("mastery")
    blocked.add("autonomy")
  }

  return blocked
}
