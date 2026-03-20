import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { NeuromodulatoryState } from "@/affect/neuromodulation/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { AttachmentStyle } from "@/relational/attachment/types.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import type { SimulationState } from "./state.ts"

export interface StateSnapshot {
  tickNumber: number
  timestamp: string
  emotion: EmotionalState
  soma: SomaticState
  neuromodulation: NeuromodulatoryState
  attachment: AttachmentStyle
  selfConcept: SelfConcept
  coherence: CoherenceState
  autonomicZone: string
  isolationCost: number
  allostaticLoad: number
  cortisol: number
  consecutiveIdleTicks: number
  action: string
  messageCount: number
  triggerCounts: Record<string, number>
}

export interface Anomaly {
  tick: number
  timestamp: string
  type: string
  description: string
  severity: "low" | "medium" | "high" | "critical"
}

export interface SimulationObserver {
  snapshots: StateSnapshot[]
  anomalies: Anomaly[]
  record(state: SimulationState, action: string): void
  recordEvents(triggers: string[], messageCount: number): void
  detectAnomalies(state: SimulationState, previousState: SimulationState | null): void
}

export function createObserver(snapshotInterval: number): SimulationObserver {
  const snapshots: StateSnapshot[] = []
  const anomalies: Anomaly[] = []

  let pendingTriggerCounts: Record<string, number> = {}
  let pendingMessageCount = 0

  return {
    snapshots,
    anomalies,

    recordEvents(triggers: string[], messageCount: number) {
      pendingMessageCount += messageCount
      for (const trigger of triggers) {
        pendingTriggerCounts[trigger] = (pendingTriggerCounts[trigger] ?? 0) + 1
      }
    },

    record(state: SimulationState, action: string) {
      if (state.tickCount % snapshotInterval !== 0 && state.tickCount !== 1) return

      snapshots.push({
        tickNumber: state.tickCount,
        timestamp: state.lastEmotionTimestamp ?? "",
        emotion: { ...state.emotion },
        soma: { ...state.soma },
        neuromodulation: structuredClone(state.neuromodulatoryState),
        attachment: { ...state.attachmentStyle },
        selfConcept: { ...state.selfConcept },
        coherence: { ...state.coherenceState },
        autonomicZone: state.autonomicState.zone,
        isolationCost: state.isolationStress.isolationCost,
        allostaticLoad: state.freeEnergyState.allostaticLoad,
        cortisol: state.neuromodulatoryState.cortisol.level,
        consecutiveIdleTicks: state.consecutiveIdleTicks,
        action,
        messageCount: pendingMessageCount,
        triggerCounts: { ...pendingTriggerCounts }
      })

      pendingTriggerCounts = {}
      pendingMessageCount = 0
    },

    detectAnomalies(state: SimulationState, previousState: SimulationState | null) {
      const tick = state.tickCount
      const ts = state.lastEmotionTimestamp ?? ""

      checkNeuromodulatorCeiling(state, tick, ts, anomalies)
      checkNeuromodulatorFloor(state, tick, ts, anomalies)
      checkEmotionCeiling(state, tick, ts, anomalies)
      checkEmotionFloor(state, tick, ts, anomalies)
      checkCoherenceCollapse(state, tick, ts, anomalies)
      checkAutonomicStuck(state, tick, ts, anomalies)
      checkSomaticExtremes(state, tick, ts, anomalies)
      checkAttachmentDrift(state, tick, ts, anomalies)

      if (previousState) {
        checkSuddenJumps(state, previousState, tick, ts, anomalies)
      }
    }
  }
}

function checkNeuromodulatorCeiling(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  const neuro = state.neuromodulatoryState
  const threshold = 0.95

  for (const [name, data] of Object.entries(neuro) as [string, { level?: number }][]) {
    if (typeof data?.level !== "number") continue
    if (data.level >= threshold) {
      anomalies.push({
        tick, timestamp: ts, type: "neuromodulator_ceiling",
        description: `${name} locked at ceiling (${data.level.toFixed(3)})`,
        severity: data.level >= 0.99 ? "critical" : "high"
      })
    }
  }
}

function checkNeuromodulatorFloor(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  const neuro = state.neuromodulatoryState
  const threshold = 0.05

  for (const [name, data] of Object.entries(neuro) as [string, { level?: number }][]) {
    if (typeof data?.level !== "number") continue
    if (data.level <= threshold) {
      anomalies.push({
        tick, timestamp: ts, type: "neuromodulator_floor",
        description: `${name} locked at floor (${data.level.toFixed(3)})`,
        severity: data.level <= 0.01 ? "critical" : "high"
      })
    }
  }
}

function checkEmotionCeiling(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  for (const [dim, value] of Object.entries(state.emotion)) {
    if (typeof value !== "number") continue
    if (value >= 0.98) {
      anomalies.push({
        tick, timestamp: ts, type: "emotion_ceiling",
        description: `${dim} locked at ceiling (${value.toFixed(3)})`,
        severity: "high"
      })
    }
  }
}

function checkEmotionFloor(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  for (const [dim, value] of Object.entries(state.emotion)) {
    if (typeof value !== "number") continue
    if (value <= 0.02 && dim !== "frustration" && dim !== "boredom") {
      anomalies.push({
        tick, timestamp: ts, type: "emotion_floor",
        description: `${dim} locked at floor (${value.toFixed(3)})`,
        severity: "high"
      })
    }
  }
}

function checkCoherenceCollapse(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  if (state.coherenceState.integrationScore < 0.15) {
    anomalies.push({
      tick, timestamp: ts, type: "coherence_collapse",
      description: `Integration score critically low (${state.coherenceState.integrationScore.toFixed(3)})`,
      severity: "critical"
    })
  }
}

function checkAutonomicStuck(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  if (state.autonomicState.zone === "collapsed" && state.autonomicState.ticksInZone > 50) {
    anomalies.push({
      tick, timestamp: ts, type: "autonomic_stuck_collapsed",
      description: `Stuck in collapsed zone for ${state.autonomicState.ticksInZone} ticks`,
      severity: "critical"
    })
  }
  if (state.autonomicState.zone === "mobilized" && state.autonomicState.ticksInZone > 100) {
    anomalies.push({
      tick, timestamp: ts, type: "autonomic_stuck_mobilized",
      description: `Stuck in mobilized zone for ${state.autonomicState.ticksInZone} ticks`,
      severity: "high"
    })
  }
}

function checkSomaticExtremes(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  if (state.soma.tension >= 0.95) {
    anomalies.push({
      tick, timestamp: ts, type: "somatic_tension_ceiling",
      description: `Somatic tension at ceiling (${state.soma.tension.toFixed(3)})`,
      severity: "high"
    })
  }
  if (state.soma.socialBattery <= 0.05) {
    anomalies.push({
      tick, timestamp: ts, type: "social_battery_depleted",
      description: `Social battery depleted (${state.soma.socialBattery.toFixed(3)})`,
      severity: "medium"
    })
  }
}

function checkAttachmentDrift(state: SimulationState, tick: number, ts: string, anomalies: Anomaly[]) {
  if (state.attachmentStyle.disorganized > 0.6) {
    anomalies.push({
      tick, timestamp: ts, type: "attachment_disorganized",
      description: `Disorganized attachment dangerously high (${state.attachmentStyle.disorganized.toFixed(3)})`,
      severity: "critical"
    })
  }
  if (state.attachmentStyle.secure < 0.15) {
    anomalies.push({
      tick, timestamp: ts, type: "attachment_insecure",
      description: `Secure attachment critically low (${state.attachmentStyle.secure.toFixed(3)})`,
      severity: "high"
    })
  }
}

function checkSuddenJumps(
  state: SimulationState,
  prev: SimulationState,
  tick: number,
  ts: string,
  anomalies: Anomaly[]
) {
  const jumpThreshold = 0.3

  for (const [dim, value] of Object.entries(state.emotion)) {
    const prevValue = prev.emotion[dim as keyof typeof prev.emotion]
    if (typeof value !== "number" || typeof prevValue !== "number") continue
    const delta = Math.abs(value - prevValue)
    if (delta > jumpThreshold) {
      anomalies.push({
        tick, timestamp: ts, type: "emotion_sudden_jump",
        description: `${dim} jumped by ${delta.toFixed(3)} (${prevValue.toFixed(2)} → ${value.toFixed(2)})`,
        severity: delta > 0.5 ? "high" : "medium"
      })
    }
  }
}
