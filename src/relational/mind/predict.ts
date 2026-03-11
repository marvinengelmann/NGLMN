import { differenceInMinutes, getDay, getHours, parseISO } from "date-fns"
import { nowISO, nowLocal } from "@/infra/lib/time.ts"
import type { MoodHistoryEntry, OperatorModel, OperatorMood, OperatorPrediction, PredictionAccuracy } from "./types.ts"

const MAX_RECENT_SCORES = 20
const PREDICTION_SCORE_WEIGHTS = {
  responseTime: 0.3,
  mood: 0.4,
  engagement: 0.3
}

function medianResponseMinutes(moodHistory: MoodHistoryEntry[]): number | null {
  if (moodHistory.length < 2) return null

  const currentHour = getHours(nowLocal())
  const hourWindow = 4

  const relevantEntries = moodHistory.filter((entry) => {
    try {
      const entryHour = getHours(parseISO(entry.timestamp))
      const diff = Math.abs(entryHour - currentHour)
      return Math.min(diff, 24 - diff) <= hourWindow
    } catch {
      return false
    }
  })

  if (relevantEntries.length < 2) return null

  const intervals = relevantEntries.slice(1).reduce<number[]>((acc, curr, idx) => {
    const prev = relevantEntries[idx]
    if (!prev || !curr) return acc
    try {
      const diff = differenceInMinutes(parseISO(curr.timestamp), parseISO(prev.timestamp))
      if (diff > 0 && diff < 1440) acc.push(diff)
    } catch {}
    return acc
  }, [])

  if (intervals.length === 0) return null

  intervals.sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  return intervals.length % 2 === 0 ? ((intervals[mid - 1] ?? 0) + (intervals[mid] ?? 0)) / 2 : (intervals[mid] ?? 0)
}

function mostFrequentMoodAtTime(moodHistory: MoodHistoryEntry[]): OperatorMood | null {
  if (moodHistory.length === 0) return null

  const currentHour = getHours(nowLocal())
  const currentDay = getDay(nowLocal())
  const hourWindow = 3

  const relevant = moodHistory.filter((entry) => {
    try {
      const date = parseISO(entry.timestamp)
      const entryHour = getHours(date)
      const entryDay = getDay(date)
      const hourDiff = Math.abs(entryHour - currentHour)
      const hourMatch = Math.min(hourDiff, 24 - hourDiff) <= hourWindow
      const dayMatch = entryDay === currentDay
      return hourMatch || dayMatch
    } catch {
      return false
    }
  })

  if (relevant.length === 0) return null

  const counts = relevant.reduce((map, entry) => {
    map.set(entry.mood, (map.get(entry.mood) ?? 0) + 1)
    return map
  }, new Map<OperatorMood, number>())

  return [...counts.entries()].reduce<{ mood: OperatorMood | null; count: number }>(
    (best, [mood, count]) => (count > best.count ? { mood, count } : best),
    { mood: null, count: 0 }
  ).mood
}

function predictEngagement(moodHistory: MoodHistoryEntry[]): "high" | "low" | null {
  if (moodHistory.length < 3) return null

  const currentDay = getDay(nowLocal())
  const currentHour = getHours(nowLocal())

  const sameDayEntries = moodHistory.filter((entry) => {
    try {
      return getDay(parseISO(entry.timestamp)) === currentDay
    } catch {
      return false
    }
  })

  if (sameDayEntries.length === 0) return null

  const activeMoods: OperatorMood[] = ["happy", "excited", "frustrated"]
  const activeCount = sameDayEntries.filter((e) => activeMoods.includes(e.mood)).length
  const activeRatio = activeCount / sameDayEntries.length

  const isWorkHours = currentHour >= 9 && currentHour <= 17
  const isWeekday = currentDay >= 1 && currentDay <= 5

  if (isWeekday && isWorkHours) return "low"
  if (activeRatio > 0.5) return "high"
  return activeRatio > 0.3 ? "high" : "low"
}

/**
 * Generate a prediction for the operator's next interaction based on historical patterns.
 */
export function makePrediction(model: OperatorModel): OperatorPrediction {
  const { moodHistory, predictionAccuracy } = model

  const expectedResponseMinutes = medianResponseMinutes(moodHistory)
  const expectedMood = mostFrequentMoodAtTime(moodHistory)
  const expectedEngagement = predictEngagement(moodHistory)

  const patternStrength = Math.min(1, moodHistory.length / 10)
  const confidence = predictionAccuracy.runningAverage * 0.7 + patternStrength * 0.3

  return {
    expectedResponseMinutes,
    expectedMood,
    expectedEngagement,
    confidence: Math.min(1, confidence),
    madeAt: nowISO()
  }
}

function scoreMoodPrediction(expected: OperatorMood | null, actual: OperatorMood): number {
  if (!expected) return 0.5
  if (expected === actual) return 1.0

  const positiveGroup: OperatorMood[] = ["happy", "excited"]
  const negativeGroup: OperatorMood[] = ["stressed", "sad", "frustrated", "tired"]
  const bothPositive = positiveGroup.includes(expected) && positiveGroup.includes(actual)
  const bothNegative = negativeGroup.includes(expected) && negativeGroup.includes(actual)
  if (bothPositive || bothNegative) return 0.6

  return 0.0
}

function scoreResponseTime(expected: number | null, actualMinutes: number): number {
  if (expected == null) return 0.5
  const maxVal = Math.max(expected, actualMinutes)
  if (maxVal === 0) return 1.0
  return Math.min(expected, actualMinutes) / maxVal
}

function scoreEngagement(expected: "high" | "low" | null, messageCount: number): number {
  if (!expected) return 0.5
  const isHighEngagement = messageCount >= 3
  if (expected === "high" && isHighEngagement) return 1.0
  if (expected === "low" && !isHighEngagement) return 1.0
  return 0.2
}

/**
 * Evaluate a previous prediction against actual outcomes.
 * Returns a composite score (0-1) and the updated accuracy tracking.
 */
export function evaluatePrediction(
  prediction: OperatorPrediction,
  actual: {
    mood: OperatorMood
    responseMinutes: number
    messageCount: number
  },
  currentAccuracy: PredictionAccuracy
): { score: number; updatedAccuracy: PredictionAccuracy } {
  if (!prediction.madeAt) {
    return { score: 0.5, updatedAccuracy: currentAccuracy }
  }

  const moodScore = scoreMoodPrediction(prediction.expectedMood, actual.mood)
  const timeScore = scoreResponseTime(prediction.expectedResponseMinutes, actual.responseMinutes)
  const engagementScore = scoreEngagement(prediction.expectedEngagement, actual.messageCount)

  const score =
    moodScore * PREDICTION_SCORE_WEIGHTS.mood +
    timeScore * PREDICTION_SCORE_WEIGHTS.responseTime +
    engagementScore * PREDICTION_SCORE_WEIGHTS.engagement

  const recentScores = [...currentAccuracy.recentScores, score].slice(-MAX_RECENT_SCORES)
  const runningAverage = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length

  return {
    score,
    updatedAccuracy: {
      recentScores,
      runningAverage,
      totalPredictions: currentAccuracy.totalPredictions + 1
    }
  }
}

/**
 * Compute overall prediction score from individual components.
 */
export function computePredictionScore(moodScore: number, timeScore: number, engagementScore: number): number {
  return (
    moodScore * PREDICTION_SCORE_WEIGHTS.mood +
    timeScore * PREDICTION_SCORE_WEIGHTS.responseTime +
    engagementScore * PREDICTION_SCORE_WEIGHTS.engagement
  )
}
