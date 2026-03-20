import { getHours } from "date-fns"
import type { SimulationClock } from "./clock.ts"
import type { SimulationState } from "./state.ts"

export type SimulatedAction = "idle" | "reflect" | "dream" | "morning"

export interface SimulatedDecision {
  action: SimulatedAction
  reasoning: string
  responseSent: boolean
  hasMessages: boolean
}

export function generateDecision(
  state: SimulationState,
  hasMessages: boolean,
  clock: SimulationClock
): SimulatedDecision {
  const hour = getHours(clock.nowLocal())
  const isNight = hour >= 0 && hour < 6
  const isMorning = hour >= 6 && hour < 9

  if (hasMessages) {
    return {
      action: "idle",
      reasoning: "Responding to operator messages",
      responseSent: true,
      hasMessages: true
    }
  }

  if (isNight && state.consecutiveIdleTicks > 3 && Math.random() < 0.15) {
    return {
      action: "dream",
      reasoning: "Night time dream cycle",
      responseSent: false,
      hasMessages: false
    }
  }

  if (isMorning && state.recentActions.every((a) => a !== "morning") && Math.random() < 0.3) {
    return {
      action: "morning",
      reasoning: "Morning routine",
      responseSent: false,
      hasMessages: false
    }
  }

  if (state.consecutiveIdleTicks > 10 && Math.random() < 0.08) {
    return {
      action: "reflect",
      reasoning: "Idle reflection",
      responseSent: false,
      hasMessages: false
    }
  }

  return {
    action: "idle",
    reasoning: "No action needed",
    responseSent: false,
    hasMessages: false
  }
}
