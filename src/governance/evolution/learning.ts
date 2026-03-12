import { addLesson, getLessons } from "@/cognition/learning/lessons.ts"
import type { Lesson } from "@/cognition/learning/types.ts"

/**
 * Store a lesson from a failed code evolution attempt.
 */
export async function addEvolutionLesson(
  filePaths: string[],
  errorType: "biome" | "tsc" | "test" | "sandbox",
  errorSample: string
): Promise<void> {
  const truncatedError = errorSample.slice(0, 200)
  const pathSummary = filePaths.slice(0, 3).join(", ")
  const insight = `Code evolution ${errorType} failure in [${pathSummary}]: ${truncatedError}`

  await addLesson(insight, { register: "evolution", dominantDrive: "mastery" }, "evolution")
}

/**
 * Get the most relevant evolution lessons for context injection.
 */
export async function getRelevantEvolutionLessons(): Promise<Lesson[]> {
  const lessons = await getLessons()
  return lessons
    .filter((l) => l.source === "evolution")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}
