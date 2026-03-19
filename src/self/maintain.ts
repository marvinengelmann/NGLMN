import { differenceInDays, differenceInSeconds, parseISO } from "date-fns"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { summarizeEmotions } from "@/affect/emotion/update.ts"
import type { TickSummary } from "@/core/types.ts"
import { refreshPortraitReference } from "@/expression/image/references.ts"
import { setBotProfilePhoto } from "@/infra/integrations/telegram.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"
import { runProbabilisticTasks } from "@/infra/lib/probabilistic.ts"
import { getRecentActions } from "@/memory/working.ts"
import { evaluateProfilePhotoTrigger, growHair } from "@/self/appearance/compute.ts"
import { getAppearanceState, saveAppearanceState } from "@/self/appearance/state.ts"
import { formBoundary, maybeFormNegativeBoundary } from "@/self/boundaries/compute.ts"
import { detectBoundaryFormation } from "@/self/boundaries/detect.ts"
import { getBoundaryState } from "@/self/boundaries/state.ts"
import { saveDissociativeState } from "@/self/coherence/dissociation/state.ts"
import type { DissociativeState } from "@/self/coherence/dissociation/types.ts"
import { maybeDriftBigFive } from "@/self/genesis/drift.ts"

const REDIS_BOUNDARY_STATE = "working:boundaries:state"

const THRESHOLDS = {
  FRUSTRATION_BOUNDARY: 0.5,
  CAUTION_BOUNDARY: 0.4,
  MAX_BOUNDARIES: 10
} as const

const PROBABILITIES = {
  BIGFIVE_DRIFT: 0.01,
  PROFILE_PHOTO_UPDATE: 0.005
} as const

/**
 * Maintain boundaries, dissociation, personality drift, appearance, and profile photo.
 */
export async function maintainSelf(
  emotion: EmotionalState,
  messageTexts: string[],
  reasoning: string,
  dissociativeState: DissociativeState | undefined,
  lastTick: TickSummary | null,
  buffer: WriteBuffer
): Promise<void> {
  if (messageTexts.length > 0) {
    await maintainBoundaries(emotion, messageTexts, buffer)
  }

  await runProbabilisticTasks([
    {
      name: "dissociation_persist",
      probability: 1,
      condition: dissociativeState !== undefined,
      execute: async () => {
        if (dissociativeState) {
          await saveDissociativeState(dissociativeState, buffer)
        }
      }
    },
    {
      name: "bigfive_drift",
      probability: PROBABILITIES.BIGFIVE_DRIFT,
      execute: async () => {
        const recentActions = await getRecentActions()
        await maybeDriftBigFive(recentActions, [reasoning])
      }
    },
    {
      name: "appearance_hair_growth",
      probability: 1,
      execute: async () => {
        const daysSinceLastTick = lastTick ? differenceInSeconds(new Date(), parseISO(lastTick.timestamp)) / 86400 : 0
        if (daysSinceLastTick <= 0) return

        const appearance = await getAppearanceState()
        const updated = growHair(appearance, daysSinceLastTick)
        if (updated.hairLengthCm !== appearance.hairLengthCm) {
          await saveAppearanceState(updated)
        }
      }
    },
    {
      name: "profile_photo_update",
      probability: PROBABILITIES.PROFILE_PHOTO_UPDATE,
      execute: async () => {
        const appearance = await getAppearanceState()
        const recentlyCompletedHaircut = appearance.lastHaircutAt
          ? differenceInDays(new Date(), parseISO(appearance.lastHaircutAt)) < 1
          : false

        const trigger = evaluateProfilePhotoTrigger(appearance, recentlyCompletedHaircut)
        if (!trigger) return

        log.info("Profile photo update triggered", { reason: trigger })

        const portraitBuffer = await refreshPortraitReference()
        if (!portraitBuffer) return

        const success = await setBotProfilePhoto(portraitBuffer)
        if (!success) return

        await saveAppearanceState({
          ...appearance,
          lastProfilePhotoAt: new Date().toISOString(),
          profilePhotoReason: trigger
        })
        log.info("Profile photo updated", { reason: trigger })
      }
    }
  ])
}

async function maintainBoundaries(emotion: EmotionalState, messageTexts: string[], buffer: WriteBuffer): Promise<void> {
  const boundaryState = await getBoundaryState()
  const updatedBoundaryState = maybeFormNegativeBoundary(emotion, boundaryState, messageTexts)

  if (updatedBoundaryState) {
    buffer.stage(REDIS_BOUNDARY_STATE, updatedBoundaryState)
    log.info("Boundary formed from negative pattern")
    return
  }

  if (emotion.frustration > THRESHOLDS.FRUSTRATION_BOUNDARY && emotion.caution > THRESHOLDS.CAUTION_BOUNDARY) {
    const detected = await detectBoundaryFormation(messageTexts.join(". "), summarizeEmotions(emotion))
    if (detected && boundaryState.boundaries.length < THRESHOLDS.MAX_BOUNDARIES) {
      const newBoundary = formBoundary(detected.type, detected.description, detected.pattern, "llm_detection")
      buffer.stage(REDIS_BOUNDARY_STATE, {
        ...boundaryState,
        boundaries: [...boundaryState.boundaries, newBoundary]
      })
      log.info("Boundary formed via LLM detection", { type: detected.type })
    }
  }
}
