import { createStateManager } from "@/infra/lib/state.ts"
import { DEFAULT_DRIVE_STATE, DriveState } from "./types.ts"

export const { get: getDriveState, save: saveDriveState } = createStateManager(
  "working:drive:state",
  DriveState,
  DEFAULT_DRIVE_STATE
)
