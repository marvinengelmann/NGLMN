import { differenceInMinutes, parseISO } from "date-fns"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { Lesson, LessonContext } from "./types.ts"

const REDIS_KEY = "working:learning:lessons"
const LAST_ANALYSIS_KEY = "working:learning:lastAnalysis"

const MAX_LESSONS = 12
const POSITIVE_THRESHOLD = 0.6
const NEGATIVE_THRESHOLD = 0.3
const POSITIVE_BOOST = 0.05
const NEGATIVE_PENALTY = 0.03
const DECAY_PER_VALIDATION = 0.002
const MIN_CONFIDENCE_TO_SURFACE = 0.3

/**
 * Retrieve all stored lessons from Redis.
 */
export async function getLessons(): Promise<Lesson[]> {
  const raw = await redis.get<Lesson[]>(REDIS_KEY)
  if (!raw || !Array.isArray(raw)) return []
  return raw
}

/**
 * Get lessons relevant to the current interaction context.
 */
export async function getRelevantLessons(context: {
  register?: string
  timeOfDay?: string
  dominantDrive?: string
  operatorMood?: string
}): Promise<Lesson[]> {
  const lessons = await getLessons()
  return lessons
    .filter((l) => l.confidence >= MIN_CONFIDENCE_TO_SURFACE)
    .filter((l) => matchesContext(l.context, context))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}

/**
 * Store a new lesson derived from strategy analysis.
 */
export async function addLesson(insight: string, context: LessonContext): Promise<Lesson> {
  const existing = await getLessons()

  const duplicate = existing.find(
    (l) =>
      l.insight.toLowerCase().includes(insight.toLowerCase().slice(0, 40)) ||
      insight.toLowerCase().includes(l.insight.toLowerCase().slice(0, 40))
  )
  if (duplicate) {
    duplicate.confidence = clamp01(duplicate.confidence + POSITIVE_BOOST)
    duplicate.validationCount += 1
    duplicate.lastValidatedAt = nowISO()
    await persistLessons(existing)
    log.info("Existing lesson reinforced", { id: duplicate.id })
    return duplicate
  }

  const lesson: Lesson = {
    id: crypto.randomUUID(),
    insight,
    context,
    confidence: 0.5,
    validationCount: 0,
    createdAt: nowISO()
  }

  await persistLessons([...existing, lesson])
  log.info("Lesson stored", { insight: insight.slice(0, 80) })
  return lesson
}

/**
 * Reinforce or weaken lessons that match the given strategy based on outcome score.
 */
export async function reinforceLessons(
  outcomeScore: number,
  strategy: { register?: string; dominantDrive?: string; timeOfDay?: string }
): Promise<number> {
  const lessons = await getLessons()
  if (lessons.length === 0) return 0

  let reinforced = 0
  const updated = lessons.map((lesson) => {
    if (!matchesContext(lesson.context, strategy)) return lesson

    let delta: number
    if (outcomeScore > POSITIVE_THRESHOLD) {
      delta = POSITIVE_BOOST
    } else if (outcomeScore < NEGATIVE_THRESHOLD) {
      delta = -NEGATIVE_PENALTY
    } else {
      return lesson
    }

    delta -= DECAY_PER_VALIDATION * lesson.validationCount

    reinforced++
    return {
      ...lesson,
      confidence: clamp01(lesson.confidence + delta),
      validationCount: lesson.validationCount + 1,
      lastValidatedAt: nowISO()
    }
  })

  if (reinforced > 0) {
    await persistLessons(updated)
    log.debug("Lessons reinforced", { count: reinforced, outcomeScore })
  }

  return reinforced
}

/**
 * Get the timestamp of the last strategy analysis run.
 */
export async function getLastAnalysisTimestamp(): Promise<string | null> {
  return redis.get<string>(LAST_ANALYSIS_KEY)
}

/**
 * Record that strategy analysis just ran.
 */
export async function setLastAnalysisTimestamp(): Promise<void> {
  await redis.set(LAST_ANALYSIS_KEY, nowISO())
}

function matchesContext(lessonCtx: LessonContext, strategy: Record<string, string | undefined>): boolean {
  const fields: (keyof LessonContext)[] = ["register", "timeOfDay", "dominantDrive", "operatorMood"]
  return fields.every((field) => {
    const lessonVal = lessonCtx[field]
    const strategyVal = strategy[field]
    if (!lessonVal || !strategyVal) return true
    return lessonVal === strategyVal
  })
}

async function persistLessons(lessons: Lesson[]): Promise<void> {
  const sorted = lessons.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_LESSONS)
  await redis.set(REDIS_KEY, sorted)
}

const ANALYSIS_COOLDOWN_HOURS = 4

/**
 * Reinforce lessons from the most recent resolved outcome.
 * Called from MAINTAIN — extracts strategy context and delegates to reinforceLessons.
 */
export async function reinforceFromLatestOutcome(): Promise<void> {
  const { getUnresolvedOutcome } = await import("./outcomes.ts")
  const unresolved = await getUnresolvedOutcome()
  if (!unresolved || unresolved.outcomeScore === null) return

  const strategy = unresolved.strategy as Record<string, unknown>
  await reinforceLessons(unresolved.outcomeScore, {
    register: String(strategy.register ?? ""),
    dominantDrive: String(strategy.dominantDrive ?? ""),
    timeOfDay: String(strategy.timeOfDay ?? "")
  })
}

/**
 * Run strategy analysis if enough time has passed since the last run.
 * Returns the number of lessons created, or 0 if skipped.
 */
export async function maybeRunAnalysis(): Promise<number> {
  const lastAnalysis = await getLastAnalysisTimestamp()
  const hoursSinceAnalysis = lastAnalysis
    ? differenceInMinutes(new Date(), parseISO(lastAnalysis)) / 60
    : ANALYSIS_COOLDOWN_HOURS + 1

  if (hoursSinceAnalysis < ANALYSIS_COOLDOWN_HOURS) return 0

  const { analyzeAndLearn } = await import("./analysis.ts")
  const lessonsCreated = await analyzeAndLearn(7)
  if (lessonsCreated > 0) {
    log.info("Strategy analysis produced lessons", { count: lessonsCreated })
  }
  return lessonsCreated
}
