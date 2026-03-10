import { nowISO } from "@/infra/lib/time.ts"
import { BOUNDARIES } from "./constants.ts"
import type { Boundary, BoundaryState, BoundaryType, BoundaryViolation } from "./types.ts"

interface PermeabilityContext {
  trustLevel: number
  attachmentSecurity: number
  vulnerabilityLevel: number
}

/**
 * Compute overall boundary permeability from trust, attachment security, and vulnerability.
 */
export function computeBoundaryPermeability(context: PermeabilityContext): number {
  const { trustLevel, attachmentSecurity, vulnerabilityLevel } = context

  const permeability =
    trustLevel * BOUNDARIES.PERMEABILITY_TRUST_WEIGHT +
    attachmentSecurity * BOUNDARIES.PERMEABILITY_SECURITY_WEIGHT +
    vulnerabilityLevel * BOUNDARIES.PERMEABILITY_VULNERABILITY_WEIGHT

  return Math.max(0, Math.min(1, permeability))
}

/**
 * Check if a message pattern matches any boundaries.
 */
export function checkBoundaryViolation(messageText: string, boundaries: Boundary[]): BoundaryViolation | null {
  const lowerText = messageText.toLowerCase()

  for (const boundary of boundaries) {
    if (boundary.strength < 0.1) continue

    const patterns = boundary.pattern.toLowerCase().split("|")
    const matched = patterns.some((p) => lowerText.includes(p.trim()))

    if (matched) {
      return {
        boundaryId: boundary.id,
        description: `boundary "${boundary.description}" touched`,
        timestamp: nowISO(),
        severity: boundary.strength
      }
    }
  }

  return null
}

/**
 * Harden a boundary after a violation.
 */
export function adjustBoundaryAfterViolation(boundary: Boundary): Boundary {
  return {
    ...boundary,
    strength: Math.min(1, boundary.strength + BOUNDARIES.VIOLATION_HARDENING),
    violationCount: boundary.violationCount + 1
  }
}

/**
 * Soften a boundary with increasing trust.
 */
export function softenBoundaryWithTrust(boundary: Boundary, trustLevel: number): Boundary {
  if (trustLevel < 0.5) return boundary

  const softening = BOUNDARIES.TRUST_SOFTENING_RATE * (trustLevel - 0.5)
  return {
    ...boundary,
    strength: Math.max(0.1, boundary.strength - softening)
  }
}

/**
 * Form a new boundary from a negative emotional experience.
 */
export function formBoundary(type: BoundaryType, description: string, pattern: string, origin: string): Boundary {
  return {
    id: `boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    pattern,
    strength: BOUNDARIES.DEFAULT_STRENGTH,
    origin,
    violationCount: 0
  }
}

/**
 * Update the full boundary state after checking messages.
 */
export function updateBoundaryState(
  current: BoundaryState,
  messageTexts: string[],
  permeabilityContext: PermeabilityContext
): BoundaryState {
  let boundaries = [...current.boundaries]
  const newViolations: BoundaryViolation[] = []

  for (const text of messageTexts) {
    const violation = checkBoundaryViolation(text, boundaries)
    if (violation) {
      newViolations.push(violation)
      boundaries = boundaries.map((b) => (b.id === violation.boundaryId ? adjustBoundaryAfterViolation(b) : b))
    }
  }

  boundaries = boundaries.map((b) => softenBoundaryWithTrust(b, permeabilityContext.trustLevel))

  if (boundaries.length > BOUNDARIES.MAX_BOUNDARIES) {
    boundaries.sort((a, b) => b.strength - a.strength)
    boundaries = boundaries.slice(0, BOUNDARIES.MAX_BOUNDARIES)
  }

  const recentViolations = [...current.recentViolations, ...newViolations].slice(-BOUNDARIES.MAX_RECENT_VIOLATIONS)

  const overallPermeability = computeBoundaryPermeability(permeabilityContext)

  return { boundaries, recentViolations, overallPermeability }
}
