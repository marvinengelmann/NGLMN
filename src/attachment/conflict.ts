interface ConflictContext {
  operatorMood: string
  modelConfidence: number
  dissonanceScore: number
  guardianBlocked: boolean
}

/**
 * Detect whether the current interaction state constitutes a relational conflict.
 */
export function detectConflict(context: ConflictContext): boolean {
  const stressedOperator =
    (context.operatorMood === "frustrated" || context.operatorMood === "stressed") && context.modelConfidence > 0.5

  return stressedOperator || context.dissonanceScore > 0.6 || context.guardianBlocked
}
