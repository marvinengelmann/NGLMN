import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { updatePrecisionDynamics } from "@/fep/dynamics.ts"
import { getFreeEnergyHistory, pushFreeEnergyHistory, saveFreeEnergyState } from "@/fep/state.ts"
import type { FreeEnergyState } from "@/fep/types.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"

/**
 * Push free energy history and update precision dynamics.
 */
export async function maintainFreeEnergy(
  freeEnergyState: FreeEnergyState | null,
  neuromodulatoryState: NeuromodulatoryState | null,
  buffer: WriteBuffer
): Promise<void> {
  if (!freeEnergyState) return

  await pushFreeEnergyHistory(freeEnergyState.decomposition.total, buffer)

  const history = await getFreeEnergyHistory()
  const dopamineLevel = neuromodulatoryState?.dopamine.level ?? 0.5

  const updatedDynamics = updatePrecisionDynamics(history, dopamineLevel, freeEnergyState.allostaticLoad)

  await saveFreeEnergyState({ ...freeEnergyState, precisionDynamics: updatedDynamics }, buffer)
}
