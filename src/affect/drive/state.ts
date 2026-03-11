import { createStateManager } from "@/infra/lib/state.ts"
import { createDefaultDriveState, DriveState } from "./types.ts"

export const { get: getDriveState, save: saveDriveState } = createStateManager(
  "working:drive:state",
  DriveState,
  createDefaultDriveState()
)
