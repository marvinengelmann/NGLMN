import type { EmotionalState } from "@/affect/emotion/types.ts"
import {
  applyIdiolectDrift,
  computeIdiolectModifiers,
  detectOperatorAdoption,
  extractPatterns,
  getIdiolectState,
  mergePatterns
} from "@/expression/communication/idiolect.ts"
import { analyzeConversationPatterns } from "@/expression/communication/patterns.ts"
import { createExplorationGoal, generateInterests, shouldExplore } from "@/governance/evolution/curiosity.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { runProbabilisticTasks } from "@/infra/lib/probabilistic.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { applyOpinionDrift } from "@/memory/semantic.ts"

const REDIS_IDIOLECT = "working:communication:idiolect"

const PROBABILITIES = {
  OPINION_DRIFT: 0.05,
  IDIOLECT_DRIFT: 0.05,
  CONVERSATION_PATTERN: 0.1,
  CURIOSITY_EXPLORE: 0.03
} as const

/**
 * Maintain idiolect patterns, opinion drift, curiosity exploration, and conversation patterns.
 */
export async function maintainCommunication(
  emotion: EmotionalState,
  operatorTexts: string[],
  animaTexts: string[],
  buffer: WriteBuffer
): Promise<void> {
  await runProbabilisticTasks([
    {
      name: "opinion_drift",
      probability: PROBABILITIES.OPINION_DRIFT,
      execute: async () => {
        const driftResult = await applyOpinionDrift()
        if (driftResult.isErr()) logAndCaptureError(driftResult.error)
      }
    },
    {
      name: "curiosity_explore",
      probability: PROBABILITIES.CURIOSITY_EXPLORE,
      condition: shouldExplore(emotion),
      execute: async () => {
        const interests = await generateInterests(emotion, [], [])
        const topInterest = interests[0]
        if (topInterest) {
          await createExplorationGoal(topInterest.topic, topInterest.reason, emotion.curiosity)
        }
      }
    },
    {
      name: "conversation_pattern",
      probability: PROBABILITIES.CONVERSATION_PATTERN,
      execute: async () => {
        const patterns = await analyzeConversationPatterns()
        buffer.stageWithExpiry("working:conversation:patterns", patterns, 3600)
      }
    }
  ])

  const idiolectState = await getIdiolectState()

  const selfPatterns = animaTexts.length > 0 ? extractPatterns(animaTexts) : []
  const adoptedPatterns = operatorTexts.length > 0 ? detectOperatorAdoption(operatorTexts, idiolectState) : []
  const allNewPatterns = [...selfPatterns, ...adoptedPatterns]

  const { mergeModifier, driftModifier } = computeIdiolectModifiers(emotion)

  if (allNewPatterns.length > 0) {
    buffer.stage(REDIS_IDIOLECT, mergePatterns(idiolectState, allNewPatterns, mergeModifier))
  } else if (Math.random() < PROBABILITIES.IDIOLECT_DRIFT) {
    buffer.stage(REDIS_IDIOLECT, applyIdiolectDrift(idiolectState, driftModifier))
  }
}
