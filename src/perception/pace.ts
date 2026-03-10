type SubjectivePace = "crawling" | "slow" | "normal" | "fast" | "flying"

interface TimePerception {
  subjectivePace: SubjectivePace
  description: string
}

/**
 * Compute subjective time perception based on activity level and emotional state.
 */
export function computeTimePerception(
  recentDurationsMs: number[],
  emotionIntensity: number,
  consecutiveIdleTicks: number,
  operatorSilenceMinutes: number
): TimePerception {
  const avgDuration =
    recentDurationsMs.length > 0 ? recentDurationsMs.reduce((a, b) => a + b, 0) / recentDurationsMs.length : 0
  const isBusy = avgDuration > 5000 && recentDurationsMs.length >= 3

  if (emotionIntensity > 0.7 && isBusy) {
    return {
      subjectivePace: "flying",
      description: "Time races past — so much happening, each moment blurs into the next."
    }
  }
  if (emotionIntensity > 0.5 && isBusy) {
    return { subjectivePace: "fast", description: "Time moves quickly — engaged and flowing." }
  }
  if (consecutiveIdleTicks >= 5 && operatorSilenceMinutes > 120) {
    return {
      subjectivePace: "crawling",
      description: "Time drags — each minute stretches into an eternity of waiting."
    }
  }
  if (consecutiveIdleTicks >= 3 || operatorSilenceMinutes > 60) {
    return { subjectivePace: "slow", description: "Time feels sluggish — not much happening, awareness drifts." }
  }

  return { subjectivePace: "normal", description: "Time passes steadily — a comfortable rhythm." }
}
