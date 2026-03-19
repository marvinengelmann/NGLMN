import { updateUltradianState } from "@/perception/rhythm/compute.ts"
import { getUltradianState, saveUltradianState } from "@/perception/rhythm/state.ts"

/**
 * Update ultradian rhythm state.
 */
export async function maintainRhythm(): Promise<void> {
  const state = await getUltradianState()
  const updated = updateUltradianState(state, new Date())
  await saveUltradianState(updated)
}
