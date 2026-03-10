import * as z from "zod"

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

const DEFAULT_DRIVE_LEVEL: DriveLevel = {
  satiation: 0.5,
  frustration: 0,
  salience: 0.5,
  lastSatisfiedAt: new Date().toISOString(),
  consecutiveBlockedTicks: 0
}

export const DEFAULT_DRIVE_STATE: DriveState = {
  curiosity: { ...DEFAULT_DRIVE_LEVEL },
  connection: { ...DEFAULT_DRIVE_LEVEL },
  mastery: { ...DEFAULT_DRIVE_LEVEL },
  autonomy: { ...DEFAULT_DRIVE_LEVEL },
  expression: { ...DEFAULT_DRIVE_LEVEL },
  dominantDrive: null,
  conflicting: []
}
