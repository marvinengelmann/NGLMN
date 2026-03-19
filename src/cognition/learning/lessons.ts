import { differenceInMinutes, parseISO, subDays } from "date-fns"
import { and, desc, eq, lt } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { lessons as lessonsTable } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { isNearDuplicate } from "@/infra/lib/similarity.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { Lesson, LessonContext, LessonSource } from "./types.ts"

const REDIS_KEY = "working:learning:lessons"
const LAST_ANALYSIS_KEY = "working:learning:lastAnalysis"

const MAX_REDIS_LESSONS = 30
const POSITIVE_THRESHOLD = 0.6
const NEGATIVE_THRESHOLD = 0.3
const POSITIVE_BOOST = 0.05
const NEGATIVE_PENALTY = 0.03
const DECAY_PER_VALIDATION = 0.002
const MIN_CONFIDENCE_TO_SURFACE = 0.3

/**
 * Retrieve lessons from Redis cache, falling back to DB.
 */
export async function getLessons(): Promise<Lesson[]> {
  const raw = await redis.get<Lesson[]>(REDIS_KEY)
  if (raw && Array.isArray(raw) && raw.length > 0) return raw

  const dbRows = await db.select().from(lessonsTable).orderBy(desc(lessonsTable.confidence)).limit(MAX_REDIS_LESSONS)

  const lessons: Lesson[] = dbRows.map((row) => ({
    id: row.id,
    insight: row.insight,
    context: row.context as LessonContext,
    confidence: row.confidence,
    validationCount: row.reinforcementCount,
    source: (row.source as LessonSource) ?? "interaction",
    reinforcementCount: row.reinforcementCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }))

  if (lessons.length > 0) {
    await redis.set(REDIS_KEY, lessons)
  }

  return lessons
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
 * Store a new lesson with write-through to DB and Redis.
 */
export async function addLesson(
  insight: string,
  context: LessonContext,
  source: LessonSource = "interaction"
): Promise<Lesson> {
  const existing = await getLessons()

  const duplicate = existing.find((l) => isNearDuplicate(l.insight, insight))
  if (duplicate) {
    duplicate.confidence = clamp01(duplicate.confidence + POSITIVE_BOOST)
    duplicate.validationCount += 1
    duplicate.reinforcementCount = (duplicate.reinforcementCount ?? 0) + 1
    duplicate.lastValidatedAt = nowISO()
    duplicate.updatedAt = nowISO()

    await db
      .update(lessonsTable)
      .set({
        confidence: duplicate.confidence,
        reinforcementCount: duplicate.reinforcementCount,
        updatedAt: new Date()
      })
      .where(eq(lessonsTable.id, duplicate.id))

    await persistLessons(existing)
    log.info("Existing lesson reinforced", { id: duplicate.id })
    return duplicate
  }

  const now = nowISO()
  const rows = await db
    .insert(lessonsTable)
    .values({
      insight,
      context,
      confidence: 0.5,
      source,
      reinforcementCount: 0
    })
    .returning({ id: lessonsTable.id })

  const dbId = rows[0]?.id ?? crypto.randomUUID()

  const lesson: Lesson = {
    id: dbId,
    insight,
    context,
    confidence: 0.5,
    validationCount: 0,
    source,
    reinforcementCount: 0,
    createdAt: now,
    updatedAt: now
  }

  await persistLessons([...existing, lesson])
  log.info("Lesson stored", { insight: insight.slice(0, 80), source })
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

/**
 * Prune lessons with very low confidence that are older than 30 days.
 */
export async function pruneOldLessons(): Promise<number> {
  const thirtyDaysAgo = subDays(new Date(), 30)
  const deleted = await db
    .delete(lessonsTable)
    .where(and(lt(lessonsTable.confidence, 0.1), lt(lessonsTable.createdAt, thirtyDaysAgo)))
    .returning({ id: lessonsTable.id })

  if (deleted.length > 0) {
    const lessons = await getLessons()
    const remaining = lessons.filter((l) => !deleted.some((d) => d.id === l.id))
    await redis.set(REDIS_KEY, remaining)
    log.info("Old lessons pruned", { count: deleted.length })
  }

  return deleted.length
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
  const sorted = lessons.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_REDIS_LESSONS)
  await redis.set(REDIS_KEY, sorted)
}

const ANALYSIS_COOLDOWN_HOURS = 4

/**
 * Reinforce lessons from the most recent resolved outcome.
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
