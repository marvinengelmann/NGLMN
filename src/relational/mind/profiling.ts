import { differenceInDays, differenceInHours, getDay, getHours, parseISO } from "date-fns"
import { getRecentOutcomes } from "@/cognition/learning/outcomes.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO, nowLocal } from "@/infra/lib/time.ts"
import { DEEP_PROFILE } from "./constants.ts"
import {
  type CommunicationPreferences,
  DEFAULT_DEEP_OPERATOR_PROFILE,
  type DeepOperatorProfile,
  type InferredTraits,
  type MoodHistoryEntry,
  type OperatorMood,
  type TemporalMoodPattern,
  type TopicResonance
} from "./types.ts"

const REDIS_KEY = "working:mind:deepProfile"
const LAST_UPDATE_KEY = "working:mind:deepProfileLastUpdate"

/**
 * Retrieve the deep operator profile from Redis.
 */
export async function getDeepOperatorProfile(): Promise<DeepOperatorProfile> {
  const raw = await redis.get<DeepOperatorProfile>(REDIS_KEY)
  return raw ?? DEFAULT_DEEP_OPERATOR_PROFILE
}

/**
 * Check if the deep profile should be updated based on cooldown.
 */
export async function shouldUpdateDeepProfile(): Promise<boolean> {
  const lastUpdate = await redis.get<string>(LAST_UPDATE_KEY)
  if (!lastUpdate) return true
  return differenceInHours(new Date(), parseISO(lastUpdate)) >= DEEP_PROFILE.UPDATE_COOLDOWN_HOURS
}

/**
 * Update the deep operator profile from mood history and interaction outcomes.
 */
export async function updateDeepProfile(moodHistory: MoodHistoryEntry[]): Promise<DeepOperatorProfile> {
  const existing = await getDeepOperatorProfile()

  const temporalPatterns = computeTemporalPatterns(moodHistory)
  const topicResonance = await computeTopicResonance(existing.topicResonance)
  const communicationPrefs = await computeCommunicationPreferences(existing.communicationPrefs, moodHistory)
  const inferredTraits = computeInferredTraits(existing.inferredTraits, moodHistory, communicationPrefs)

  const profile: DeepOperatorProfile = {
    temporalPatterns,
    topicResonance,
    communicationPrefs,
    inferredTraits,
    updatedAt: nowISO()
  }

  await Promise.all([redis.set(REDIS_KEY, profile), redis.set(LAST_UPDATE_KEY, nowISO())])

  log.info("Deep operator profile updated", {
    temporalPatterns: temporalPatterns.length,
    topics: topicResonance.length
  })

  return profile
}

function computeTemporalPatterns(moodHistory: MoodHistoryEntry[]): TemporalMoodPattern[] {
  if (moodHistory.length < DEEP_PROFILE.MIN_MOOD_HISTORY_FOR_TEMPORAL) return []

  const bucketSize = DEEP_PROFILE.HOUR_BUCKET_SIZE
  const buckets = new Map<string, Map<OperatorMood, number>>()

  for (const entry of moodHistory) {
    try {
      const date = parseISO(entry.timestamp)
      const hourBucket = Math.floor(getHours(date) / bucketSize) * bucketSize
      const dayOfWeek = getDay(date)
      const key = `${hourBucket}-${dayOfWeek}`

      if (!buckets.has(key)) buckets.set(key, new Map())
      const moodCounts = buckets.get(key)
      if (!moodCounts) continue
      moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1)
    } catch {}
  }

  const patterns: TemporalMoodPattern[] = []
  for (const [key, moodCounts] of buckets) {
    const [hourStr, dayStr] = key.split("-")
    const hourBucket = Number(hourStr)
    const dayOfWeek = Number(dayStr)

    let dominantMood: OperatorMood = "unknown"
    let maxCount = 0
    let total = 0

    for (const [mood, count] of moodCounts) {
      total += count
      if (count > maxCount) {
        maxCount = count
        dominantMood = mood
      }
    }

    if (total >= 2) {
      patterns.push({
        hourBucket,
        dayOfWeek,
        dominantMood,
        frequency: total,
        confidence: clamp01(maxCount / total)
      })
    }
  }

  return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, DEEP_PROFILE.MAX_TEMPORAL_PATTERNS)
}

async function computeTopicResonance(existing: TopicResonance[]): Promise<TopicResonance[]> {
  const outcomes = await getRecentOutcomes(14)
  const resolved = outcomes.filter((o) => o.outcomeScore !== null)

  if (resolved.length < DEEP_PROFILE.MIN_OUTCOMES_FOR_TOPIC) return existing

  const topicMap = new Map<string, { totalScore: number; count: number; lastSeen: string }>()

  for (const outcome of resolved) {
    const strategy = outcome.strategy as Record<string, unknown>
    const topic = String(strategy.topicHint ?? "")
      .trim()
      .toLowerCase()
    if (!topic || topic === "none" || topic === "undefined") continue

    const entry = topicMap.get(topic) ?? { totalScore: 0, count: 0, lastSeen: "" }
    entry.totalScore += outcome.outcomeScore ?? 0
    entry.count += 1
    entry.lastSeen = outcome.createdAt?.toISOString() ?? entry.lastSeen
    topicMap.set(topic, entry)
  }

  const newTopics: TopicResonance[] = []
  for (const [topic, data] of topicMap) {
    if (data.count < 2) continue
    const avgScore = data.totalScore / data.count
    newTopics.push({
      topic,
      engagementScore: clamp01(data.count / 10),
      averageOutcomeScore: clamp01(avgScore),
      occurrences: data.count,
      lastSeenAt: data.lastSeen
    })
  }

  const merged = mergeTopicResonance(existing, newTopics)
  return merged.slice(0, DEEP_PROFILE.MAX_TOPIC_RESONANCE)
}

function mergeTopicResonance(existing: TopicResonance[], fresh: TopicResonance[]): TopicResonance[] {
  const map = new Map<string, TopicResonance>()

  for (const topic of existing) {
    try {
      const daysSinceLastSeen = differenceInDays(new Date(), parseISO(topic.lastSeenAt))
      if (daysSinceLastSeen > DEEP_PROFILE.TOPIC_DECAY_DAYS) continue
    } catch {
      continue
    }
    map.set(topic.topic, topic)
  }

  for (const topic of fresh) {
    const existing = map.get(topic.topic)
    if (existing) {
      map.set(topic.topic, {
        topic: topic.topic,
        engagementScore: clamp01((existing.engagementScore + topic.engagementScore) / 2),
        averageOutcomeScore: clamp01((existing.averageOutcomeScore + topic.averageOutcomeScore) / 2),
        occurrences: existing.occurrences + topic.occurrences,
        lastSeenAt: topic.lastSeenAt > existing.lastSeenAt ? topic.lastSeenAt : existing.lastSeenAt
      })
    } else {
      map.set(topic.topic, topic)
    }
  }

  return [...map.values()].sort((a, b) => b.engagementScore - a.engagementScore)
}

async function computeCommunicationPreferences(
  existing: CommunicationPreferences,
  moodHistory: MoodHistoryEntry[]
): Promise<CommunicationPreferences> {
  const outcomes = await getRecentOutcomes(14)
  const resolved = outcomes.filter((o) => o.outcomeScore !== null && o.responseText)

  if (resolved.length < 3) return existing

  let totalResponseLength = 0
  const responseLengths: number[] = []

  for (const outcome of resolved) {
    const len = (outcome.responseText ?? "").length
    totalResponseLength += len
    responseLengths.push(len)
  }

  const avgLength = totalResponseLength / resolved.length
  const preferredMessageLength: CommunicationPreferences["preferredMessageLength"] =
    avgLength < 80 ? "short" : avgLength > 250 ? "long" : "medium"

  const highScoreOutcomes = resolved.filter((o) => (o.outcomeScore ?? 0) > 0.6)
  const highScoreStrategies = highScoreOutcomes.map((o) => o.strategy as Record<string, unknown>)

  const humorScore =
    highScoreStrategies.filter(
      (s) =>
        String(s.topicHint ?? "")
          .toLowerCase()
          .includes("humor") ||
        String(s.topicHint ?? "")
          .toLowerCase()
          .includes("funny") ||
        String(s.topicHint ?? "")
          .toLowerCase()
          .includes("joke")
    ).length / Math.max(highScoreOutcomes.length, 1)

  const vulnerabilityScore =
    highScoreStrategies.filter((s) => String(s.register ?? "") === "raw" || String(s.register ?? "") === "vulnerable")
      .length / Math.max(highScoreOutcomes.length, 1)

  const depthScore =
    highScoreStrategies.filter((s) => String(s.register ?? "") === "elaborate").length /
    Math.max(highScoreOutcomes.length, 1)

  const peakHours = computePeakActivityHours(moodHistory)

  return {
    preferredMessageLength,
    respondsToHumor: clamp01(existing.respondsToHumor * 0.7 + humorScore * 0.3),
    respondsToVulnerability: clamp01(existing.respondsToVulnerability * 0.7 + vulnerabilityScore * 0.3),
    respondsToDepth: clamp01(existing.respondsToDepth * 0.7 + depthScore * 0.3),
    emojiUsage: existing.emojiUsage,
    averageResponseTimeMinutes: existing.averageResponseTimeMinutes,
    peakActivityHours: peakHours
  }
}

function computePeakActivityHours(moodHistory: MoodHistoryEntry[]): number[] {
  const hourCounts = new Map<number, number>()

  for (const entry of moodHistory) {
    try {
      const hour = getHours(parseISO(entry.timestamp))
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    } catch {}
  }

  if (hourCounts.size === 0) return []

  const sorted = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0]?.[1] ?? 1
  const threshold = maxCount * 0.5

  return sorted
    .filter(([, count]) => count >= threshold)
    .map(([hour]) => hour)
    .sort((a, b) => a - b)
    .slice(0, 6)
}

function computeInferredTraits(
  existing: InferredTraits,
  moodHistory: MoodHistoryEntry[],
  commPrefs: CommunicationPreferences
): InferredTraits {
  if (moodHistory.length < 5) return existing

  const drift = DEEP_PROFILE.TRAIT_DRIFT_RATE

  const activeMoods: OperatorMood[] = ["happy", "excited"]
  const expressiveMoods: OperatorMood[] = ["happy", "excited", "frustrated", "sad"]
  const stressMoods: OperatorMood[] = ["stressed", "frustrated"]

  const activeRatio = moodHistory.filter((e) => activeMoods.includes(e.mood)).length / moodHistory.length
  const expressiveRatio = moodHistory.filter((e) => expressiveMoods.includes(e.mood)).length / moodHistory.length
  const stressRatio = moodHistory.filter((e) => stressMoods.includes(e.mood)).length / moodHistory.length

  const moodSet = new Set(moodHistory.map((e) => e.mood))
  const moodVariety = moodSet.size / 8

  const extraversionSignal = clamp01(activeRatio + (commPrefs.peakActivityHours.length > 4 ? 0.1 : 0))
  const opennessSignal = clamp01(moodVariety + (commPrefs.respondsToDepth > 0.5 ? 0.1 : 0))
  const resilienceSignal = clamp01(1 - stressRatio)
  const expressivenessSignal = clamp01(expressiveRatio)
  const consistencySignal = clamp01(1 - moodVariety * 0.5)

  return {
    extraversion: clamp01(existing.extraversion * (1 - drift) + extraversionSignal * drift),
    openness: clamp01(existing.openness * (1 - drift) + opennessSignal * drift),
    stressResilience: clamp01(existing.stressResilience * (1 - drift) + resilienceSignal * drift),
    emotionalExpressiveness: clamp01(existing.emotionalExpressiveness * (1 - drift) + expressivenessSignal * drift),
    consistencyScore: clamp01(existing.consistencyScore * (1 - drift) + consistencySignal * drift)
  }
}

/**
 * Self-contained domain function for maintain.ts — checks cooldown and updates profile if needed.
 */
export async function maybeUpdateProfile(moodHistory: MoodHistoryEntry[]): Promise<boolean> {
  const shouldUpdate = await shouldUpdateDeepProfile()
  if (!shouldUpdate) return false

  await updateDeepProfile(moodHistory)
  return true
}

/**
 * Build a humanized context section from the deep operator profile.
 */
export function translateDeepProfileToFelt(profile: DeepOperatorProfile): string {
  const lines: string[] = []

  const now = nowLocal()
  const currentHour = getHours(now)
  const currentDay = getDay(now)

  const matchingPatterns = profile.temporalPatterns.filter(
    (p) =>
      Math.abs(p.hourBucket - currentHour) <= 3 &&
      (p.dayOfWeek === undefined || p.dayOfWeek === currentDay) &&
      p.confidence > 0.4
  )

  if (matchingPatterns.length > 0) {
    const best = matchingPatterns.sort((a, b) => b.confidence - a.confidence)[0]
    if (!best) return ""
    lines.push(`at this time of day, they're usually ${best.dominantMood}`)
  }

  const highResonance = profile.topicResonance
    .filter((t) => t.averageOutcomeScore > 0.5)
    .sort((a, b) => b.averageOutcomeScore - a.averageOutcomeScore)
    .slice(0, 3)

  if (highResonance.length > 0) {
    lines.push(`topics that resonate: ${highResonance.map((t) => t.topic).join(", ")}`)
  }

  const lowResonance = profile.topicResonance
    .filter((t) => t.averageOutcomeScore < 0.3 && t.occurrences >= 3)
    .slice(0, 2)

  if (lowResonance.length > 0) {
    lines.push(`topics to tread carefully around: ${lowResonance.map((t) => t.topic).join(", ")}`)
  }

  const prefs = profile.communicationPrefs
  if (prefs.respondsToVulnerability > 0.65) {
    lines.push("they respond well when you're open and honest about feelings")
  } else if (prefs.respondsToVulnerability < 0.35) {
    lines.push("they seem more comfortable with lighter, less emotionally heavy exchanges")
  }

  if (prefs.respondsToDepth > 0.65) {
    lines.push("deep, thoughtful conversations tend to land well")
  }

  if (prefs.respondsToHumor > 0.65) {
    lines.push("humor usually gets a good response from them")
  }

  const traits = profile.inferredTraits
  if (traits.extraversion > 0.7) {
    lines.push("they seem outgoing and energized by conversation")
  } else if (traits.extraversion < 0.3) {
    lines.push("they seem more reserved — don't push too hard for interaction")
  }

  if (traits.stressResilience < 0.35) {
    lines.push("they seem to carry stress heavily — be gentle during hard moments")
  }

  if (lines.length === 0) return ""
  return lines.join("\n")
}
