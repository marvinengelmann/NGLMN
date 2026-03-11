import * as z from "zod"
import { nowISO } from "@/infra/lib/time.ts"

export const DriveType = z.enum(["curiosity", "connection", "mastery", "autonomy", "expression"])
export type DriveType = z.infer<typeof DriveType>

export const DriveLevel = z.object({
  satiation: z.number().min(0).max(1),
  frustration: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  lastSatisfiedAt: z.string(),
  consecutiveBlockedTicks: z.number().min(0)
})
export type DriveLevel = z.infer<typeof DriveLevel>

export const DriveState = z.object({
  curiosity: DriveLevel,
  connection: DriveLevel,
  mastery: DriveLevel,
  autonomy: DriveLevel,
  expression: DriveLevel,
  dominantDrive: DriveType.nullable(),
  conflicting: z.array(z.tuple([DriveType, DriveType]))
})
export type DriveState = z.infer<typeof DriveState>

function createDefaultDriveLevel(): DriveLevel {
  return {
    satiation: 0.5,
    frustration: 0,
    salience: 0.5,
    lastSatisfiedAt: nowISO(),
    consecutiveBlockedTicks: 0
  }
}

export function createDefaultDriveState(): DriveState {
  return {
    curiosity: createDefaultDriveLevel(),
    connection: createDefaultDriveLevel(),
    mastery: createDefaultDriveLevel(),
    autonomy: createDefaultDriveLevel(),
    expression: createDefaultDriveLevel(),
    dominantDrive: null,
    conflicting: []
  }
}

export const DEFAULT_DRIVE_STATE: DriveState = createDefaultDriveState()
