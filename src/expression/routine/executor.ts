import { saveEmotionalState } from "@/affect/emotion/state.ts"
import { sendMorningMessage } from "@/expression/routine/morning.ts"
import { applyReflectionResult } from "@/expression/routine/reflection.ts"
import type { MorningThinkResult, ReflectionOutput } from "@/expression/routine/types.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { setReflectionLastAt } from "@/memory/working.ts"

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
