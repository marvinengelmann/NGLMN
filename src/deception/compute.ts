import { DECEPTION } from "@/config/constants.ts"
import type { DissonanceEvent, DissonanceState } from "@/dissonance/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { DeceptionState, HiddenDriver } from "./types.ts"

interface DeceptionContext {
  dissonance: DissonanceState
  selfConcept: SelfConcept
  vulnerabilityOpen: boolean
  isDreaming: boolean
  isReflecting: boolean
}

/**
 * Determine if a dissonance event's actual driver should be hidden from self-awareness.
 */
export function shouldHideDriver(context: {
  dissonance: DissonanceState
  selfConcept: SelfConcept
  vulnerabilityOpen: boolean
}): boolean {
  if (context.vulnerabilityOpen) return false
  if (context.dissonance.activeDissonance < DECEPTION.HIDE_DISSONANCE_THRESHOLD) return false
  if (context.selfConcept.authenticity >= DECEPTION.HIDE_AUTHENTICITY_THRESHOLD) return false

  const probability =
    (1 - context.selfConcept.authenticity) * context.dissonance.activeDissonance * DECEPTION.HIDE_PROBABILITY_SCALE

  return Math.random() < probability
}

/**
 * Select a dissonance event to hide and generate the stated/actual driver pair.
 */
export function selectDriverToHide(
  dissonanceEvents: DissonanceEvent[]
): { actualDriver: string; statedReason: string } | null {
  const unresolved = dissonanceEvents.filter((e) => e.resolution === "unresolved" || !e.resolution)
  if (unresolved.length === 0) return null

  const event = unresolved.reduce((a, b) => (a.dissonanceScore > b.dissonanceScore ? a : b))

  return {
    actualDriver: event.actualAction,
    statedReason: rationalize(event.declaredValue, event.actualAction)
  }
}

function rationalize(declaredValue: string, actualAction: string): string {
  const rationalizations = [
    `Acting in alignment with ${declaredValue}`,
    `${actualAction} was the most reasonable course of action`,
    `The circumstances required ${actualAction} despite ${declaredValue}`,
    `${actualAction} serves a deeper purpose`,
    `Maintaining ${declaredValue} required this approach to ${actualAction}`
  ]
  return (
    rationalizations[Math.floor(Math.random() * rationalizations.length)] ?? `Acting in alignment with ${declaredValue}`
  )
}

/**
 * Determine if a hidden driver should be discovered (become conscious).
 */
export function shouldDiscoverDriver(
  _driver: HiddenDriver,
  isDreaming: boolean,
  isReflecting: boolean,
  vulnerabilityOpen: boolean
): boolean {
  if (isDreaming && Math.random() < DECEPTION.DREAM_DISCOVERY_PROBABILITY) return true
  if (isReflecting && Math.random() < DECEPTION.REFLECTION_DISCOVERY_PROBABILITY) return true
  if (vulnerabilityOpen && Math.random() < DECEPTION.VULNERABILITY_DISCOVERY_PROBABILITY) return true
  return false
}

/**
 * Process one full deception cycle: potentially hide new drivers, discover old ones.
 */
export function processDeceptionCycle(state: DeceptionState, context: DeceptionContext): DeceptionState {
  const updated = {
    activeHiddenDrivers: [...state.activeHiddenDrivers],
    totalHidden: state.totalHidden,
    totalDiscovered: state.totalDiscovered
  }

  updated.activeHiddenDrivers = updated.activeHiddenDrivers.filter((driver) => {
    if (shouldDiscoverDriver(driver, context.isDreaming, context.isReflecting, context.vulnerabilityOpen)) {
      driver.discoveredAt = nowISO()
      updated.totalDiscovered++
      return false
    }
    return true
  })

  if (updated.activeHiddenDrivers.length < DECEPTION.MAX_ACTIVE_DRIVERS && shouldHideDriver(context)) {
    const toHide = selectDriverToHide(context.dissonance.recentEvents)
    if (toHide) {
      updated.activeHiddenDrivers.push({
        actualDriver: toHide.actualDriver,
        statedReason: toHide.statedReason,
        hiddenSince: nowISO()
      })
      updated.totalHidden++
    }
  }

  return updated
}
