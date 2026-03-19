import { computeGranularityUpdate } from "@/affect/emotion/granularity/compute.ts"
import { getGranularityState, saveGranularityState } from "@/affect/emotion/granularity/state.ts"
import type { EmotionalState, EmotionUpdateEvent } from "@/affect/emotion/types.ts"
import { computeLearningRateModulation } from "@/affect/neuromodulation/compute.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import { decayAnchors, incrementExposure, updateBiasModifiers } from "@/cognition/bias/compute.ts"
import { getBiasState, saveBiasState } from "@/cognition/bias/state.ts"
import {
  generateForecast,
  resolveForecast,
  shouldForecast,
  shouldResolveForecast,
  updateAccuracy,
  updateBiasStrengths
} from "@/cognition/forecasting/compute.ts"
import { FORECASTING } from "@/cognition/forecasting/constants.ts"
import { getForecastingState, saveForecastingState } from "@/cognition/forecasting/state.ts"
import { updateHabitState } from "@/cognition/habit.ts"
import { getHabitState } from "@/cognition/habits.ts"
import {
  extractEmotionLabels,
  processHebbianCycle,
  pruneWeakAssociations
} from "@/cognition/learning/association/compute.ts"
import { HEBBIAN } from "@/cognition/learning/association/constants.ts"
import {
  getRecentStimuliHistory,
  pushStimuliHistory,
  saveActiveAssociations
} from "@/cognition/learning/association/state.ts"
import {
  batchUpsertAssociations,
  deleteWeakAssociations,
  getAllAssociations,
  getRelevantAssociations
} from "@/cognition/learning/association/store.ts"
import { maybeRunAnalysis, pruneOldLessons, reinforceFromLatestOutcome } from "@/cognition/learning/lessons.ts"
import { expireStaleOutcomes } from "@/cognition/learning/outcomes.ts"
import { extractProceduresFromOutcomes, pruneProcedures } from "@/cognition/learning/procedures/store.ts"
import { PROCEDURE_CONSTANTS } from "@/cognition/learning/procedures/types.ts"
import { computeFELearningRate } from "@/fep/dynamics.ts"
import type { FreeEnergyState } from "@/fep/types.ts"
import { habitLog } from "@/infra/db/schema.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { runProbabilisticTasks } from "@/infra/lib/probabilistic.ts"
import { getRecentActions } from "@/memory/working.ts"

const REDIS_HABIT_STATE = "working:cognition:habitState"

const PROBABILITIES = {
  STRATEGY_ANALYSIS: 0.02,
  EXPIRE_OUTCOMES: 0.1,
  PRUNE_LESSONS: 0.05
} as const

/**
 * Maintain habits, learning systems, bias, hebbian associations, forecasting, and granularity.
 */
export async function maintainCognition(
  action: string,
  messageTexts: string[],
  responseSent: boolean,
  emotion: EmotionalState,
  freeEnergyState: FreeEnergyState | null,
  neuromodulatoryState: NeuromodulatoryState | null,
  rawTriggers: EmotionUpdateEvent[],
  buffer: WriteBuffer
): Promise<void> {
  await maintainHabits(action, buffer)

  await runProbabilisticTasks([
    {
      name: "lesson_reinforcement",
      probability: 1,
      condition: responseSent,
      execute: reinforceFromLatestOutcome
    },
    {
      name: "strategy_analysis",
      probability: PROBABILITIES.STRATEGY_ANALYSIS,
      execute: maybeRunAnalysis
    },
    {
      name: "outcome_expiry",
      probability: PROBABILITIES.EXPIRE_OUTCOMES,
      execute: expireStaleOutcomes
    },
    {
      name: "lesson_pruning",
      probability: PROBABILITIES.PRUNE_LESSONS,
      execute: pruneOldLessons
    },
    {
      name: "bias_maintenance",
      probability: 1,
      execute: async () => {
        if (!neuromodulatoryState) return
        let biasState = updateBiasModifiers(await getBiasState(), neuromodulatoryState)

        if (Math.random() < 0.1) {
          biasState = { ...biasState, anchorPoints: decayAnchors(biasState.anchorPoints, 0.5) }
        }

        if (responseSent) {
          const entities = messageTexts.flatMap((t) => t.match(/\b[A-Z][a-z]+\b/g) ?? [])
          let counts = biasState.exposureCounts
          for (const entity of entities.slice(0, 5)) {
            counts = incrementExposure(counts, entity)
          }
          biasState = { ...biasState, exposureCounts: counts }
        }

        await saveBiasState(biasState, buffer)
      }
    },
    {
      name: "hebbian_update",
      probability: HEBBIAN.EXTRACTION_PROBABILITY,
      execute: async () => {
        const emotionLabels = extractEmotionLabels(emotion)
        const stimuli = [
          ...emotionLabels.map((l) => `emotion:${l}`),
          ...messageTexts.slice(0, 2).map((t) => `topic:${t.slice(0, 30)}`)
        ]
        if (stimuli.length < 2) return
        const neuroLR = neuromodulatoryState ? computeLearningRateModulation(neuromodulatoryState) : 1.0
        const feLR =
          freeEnergyState && neuromodulatoryState
            ? computeFELearningRate(
                freeEnergyState.precisionDynamics.volatilityEstimate,
                freeEnergyState.allostaticLoad,
                neuromodulatoryState.dopamine.level
              )
            : 1.0
        const effectiveLR = neuroLR * feLR
        const stimuliHistory = await getRecentStimuliHistory()
        const associations = await getRelevantAssociations(stimuli)
        const updated = processHebbianCycle(associations, stimuli, stimuliHistory, effectiveLR)
        await batchUpsertAssociations(updated)
        await pushStimuliHistory(stimuli, buffer)
        await saveActiveAssociations(updated, buffer)
      }
    },
    {
      name: "hebbian_prune",
      probability: HEBBIAN.PRUNE_PROBABILITY,
      execute: async () => {
        await deleteWeakAssociations(HEBBIAN.MIN_STRENGTH)
        const all = await getAllAssociations()
        const pruned = pruneWeakAssociations(all)
        await saveActiveAssociations(pruned, buffer)
      }
    },
    {
      name: "procedure_extraction",
      probability: PROCEDURE_CONSTANTS.EXTRACTION_PROBABILITY,
      execute: async () => {
        await extractProceduresFromOutcomes()
      }
    },
    {
      name: "procedure_pruning",
      probability: PROCEDURE_CONSTANTS.PRUNE_PROBABILITY,
      execute: async () => {
        await pruneProcedures()
      }
    },
    {
      name: "affective_forecast",
      probability: FORECASTING.FORECAST_PROBABILITY,
      execute: async () => {
        const state = await getForecastingState()
        if (state.activeForecast && !state.activeForecast.resolvedAt) {
          if (shouldResolveForecast(state.activeForecast, state.activeForecast.predictedDuration)) {
            const resolved = resolveForecast(state.activeForecast, emotion, state.activeForecast.predictedDuration)
            const accuracy = updateAccuracy(state.accuracy, resolved)
            const biases = updateBiasStrengths(state.biasStrengths, accuracy)
            await saveForecastingState({ ...state, activeForecast: null, accuracy, biasStrengths: biases }, buffer)
          }
          return
        }
        if (shouldForecast(state, 999, rawTriggers)) {
          const trigger = rawTriggers[0]
          if (trigger) {
            const forecast = generateForecast(trigger, emotion, state.biasStrengths)
            await saveForecastingState(
              { ...state, activeForecast: forecast, lastForecastAt: new Date().toISOString() },
              buffer
            )
          }
        }
      }
    },
    {
      name: "granularity_update",
      probability: 1,
      execute: async () => {
        const granularity = await getGranularityState()
        const updated = computeGranularityUpdate(granularity, emotion, messageTexts)
        await saveGranularityState(updated, buffer)
      }
    }
  ])
}

async function maintainHabits(action: string, buffer: WriteBuffer): Promise<void> {
  const previousHabitState = await getHabitState()
  const recentActionsForHabit = await getRecentActions()
  const habitState = updateHabitState(previousHabitState, recentActionsForHabit, action)
  buffer.stage(REDIS_HABIT_STATE, habitState)

  const activatedHabit = habitState.habits.find((h) => h.pattern === action)
  if (activatedHabit) {
    buffer.stagePostgres(habitLog, {
      habitId: activatedHabit.id,
      pattern: activatedHabit.pattern,
      type: activatedHabit.type,
      strength: activatedHabit.strength,
      event: action
    })
  }
}
