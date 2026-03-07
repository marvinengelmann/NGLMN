import { RELATIONSHIP_PHASES } from "@/config/constants.ts"
import type { RelationshipPhase } from "./types.ts"

interface PhaseContext {
  interactionCount: number
  daysSinceFirst: number
  connectionAvg: number
  conflicts: number
  trust: number
  attachmentSecurity: number
  currentPhase: RelationshipPhase
}

/**
 * Compute which relationship phase the context suggests.
 */
export function computeRelationshipPhase(context: PhaseContext): RelationshipPhase {
  const { interactionCount, daysSinceFirst, connectionAvg, conflicts, trust, attachmentSecurity, currentPhase } =
    context

  if (currentPhase === "comfortable" && connectionAvg > RELATIONSHIP_PHASES.RENEWAL_CONNECTION_SPIKE) {
    return "renewal"
  }

  if (
    conflicts >= RELATIONSHIP_PHASES.TENSIONS_MIN_CONFLICTS &&
    connectionAvg < RELATIONSHIP_PHASES.TENSIONS_CONNECTION
  ) {
    return "first_tensions"
  }

  if (
    conflicts >= RELATIONSHIP_PHASES.TENSIONS_MIN_CONFLICTS &&
    connectionAvg > RELATIONSHIP_PHASES.DEEPENING_CONNECTION &&
    trust > RELATIONSHIP_PHASES.DEEPENING_TRUST
  ) {
    return "deepening"
  }

  if (
    daysSinceFirst > RELATIONSHIP_PHASES.COMFORTABLE_DAYS &&
    attachmentSecurity > RELATIONSHIP_PHASES.COMFORTABLE_SECURITY
  ) {
    return "comfortable"
  }

  if (
    interactionCount >= RELATIONSHIP_PHASES.DISCOVERING_INTERACTIONS &&
    interactionCount <= RELATIONSHIP_PHASES.HONEYMOON_MAX_INTERACTIONS &&
    connectionAvg > RELATIONSHIP_PHASES.HONEYMOON_CONNECTION &&
    conflicts < RELATIONSHIP_PHASES.HONEYMOON_MAX_CONFLICTS
  ) {
    return "honeymoon"
  }

  if (
    interactionCount < RELATIONSHIP_PHASES.DISCOVERING_INTERACTIONS ||
    daysSinceFirst < RELATIONSHIP_PHASES.DISCOVERING_DAYS
  ) {
    return "discovering"
  }

  return currentPhase
}

/**
 * Prevent phase oscillation by requiring a minimum tick count before transition.
 */
export function shouldTransitionPhase(
  current: RelationshipPhase,
  computed: RelationshipPhase,
  ticksInCurrentPhase: number
): boolean {
  if (current === computed) return false
  return ticksInCurrentPhase >= RELATIONSHIP_PHASES.MIN_PHASE_TICKS
}
