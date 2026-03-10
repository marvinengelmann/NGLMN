import { nowISO } from "@/infra/lib/time.ts"
import { HABIT } from "./constants.ts"
import type { Habit, HabitState, HabitType } from "./types.ts"

/**
 * Detect habit patterns from recent actions.
 */
export function detectHabitPatterns(recentActions: string[], existingHabits: Habit[]): Habit | null {
  const actionCounts = new Map<string, number>()
  for (const action of recentActions) {
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1)
  }

  for (const [pattern, count] of actionCounts) {
    if (count >= HABIT.DETECTION_MIN_REPETITIONS) {
      const exists = existingHabits.some((h) => h.pattern === pattern)
      if (!exists) {
        const type = inferHabitType(pattern)
        return {
          id: `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          pattern,
          type,
          strength: HABIT.STRENGTH_INCREMENT * count,
          repetitions: count,
          lastActivatedAt: nowISO(),
          isAutomatic: false
        }
      }
    }
  }

  return null
}

function inferHabitType(pattern: string): HabitType {
  if (pattern.includes("message") || pattern.includes("reply")) return "communication"
  if (pattern.includes("reflect") || pattern.includes("dream")) return "emotional"
  if (pattern.includes("social") || pattern.includes("connection")) return "relational"
  return "behavioral"
}

/**
 * Strengthen an existing habit after activation.
 */
export function strengthenHabit(habit: Habit): Habit {
  const newStrength = Math.min(1, habit.strength + HABIT.STRENGTH_INCREMENT)
  return {
    ...habit,
    strength: newStrength,
    repetitions: habit.repetitions + 1,
    lastActivatedAt: nowISO(),
    isAutomatic: newStrength >= HABIT.AUTOMATIC_STRENGTH_THRESHOLD
  }
}

/**
 * Apply decay to habit strength.
 */
export function decayHabitStrength(habit: Habit): Habit {
  const decayed = habit.strength * HABIT.DECAY_PER_TICK
  return {
    ...habit,
    strength: decayed,
    isAutomatic: decayed >= HABIT.AUTOMATIC_STRENGTH_THRESHOLD
  }
}

/**
 * Find a habit strong enough to bypass deliberation.
 */
export function findAutomaticHabit(habits: Habit[], currentContext: string): Habit | null {
  return (
    habits.find(
      (h) => h.isAutomatic && h.strength >= HABIT.AUTOMATIC_STRENGTH_THRESHOLD && currentContext.includes(h.pattern)
    ) ?? null
  )
}

/**
 * Update the full habit state with detection, strengthening, and decay.
 */
export function updateHabitState(current: HabitState, recentActions: string[], currentAction: string): HabitState {
  let habits = current.habits.map(decayHabitStrength).filter((h) => h.strength > 0.01)

  const matchingHabit = habits.find((h) => h.pattern === currentAction)
  if (matchingHabit) {
    habits = habits.map((h) => (h.id === matchingHabit.id ? strengthenHabit(h) : h))
  }

  const newHabit = detectHabitPatterns(recentActions, habits)
  if (newHabit && habits.length < HABIT.MAX_HABITS) {
    habits.push(newHabit)
  }

  const recentActivations = matchingHabit
    ? [...current.recentActivations, { habitId: matchingHabit.id, timestamp: nowISO() }].slice(
        -HABIT.MAX_RECENT_ACTIVATIONS
      )
    : current.recentActivations

  return { habits, recentActivations }
}
