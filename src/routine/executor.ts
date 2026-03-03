import { saveEmotionalState } from "@/emotion/state.ts"
import { nowISO } from "@/lib/time.ts"
import { setReflectionLastAt } from "@/memory/working.ts"
import { sendMorningMessage } from "@/routine/morning.ts"
import { applyReflectionResult } from "@/routine/reflection.ts"
import type { MorningThinkResult, ReflectionOutput } from "@/routine/types.ts"

/**
 * Execute morning routine: save recalibrated emotion, apply reflection, send message.
 */
export async function executeMorning(morningResult: MorningThinkResult): Promise<void> {
  await saveEmotionalState(morningResult.recalibratedEmotion, "morning_calibration")
  await applyReflectionResult(morningResult.reflection)
  await sendMorningMessage(morningResult.morningMessage)
}

/**
 * Execute ad-hoc reflection: apply result and update timestamp.
 */
export async function executeReflection(reflectionResult: ReflectionOutput): Promise<void> {
  await applyReflectionResult(reflectionResult)
  await setReflectionLastAt(nowISO())
}
