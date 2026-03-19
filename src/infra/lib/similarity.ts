/**
 * Levenshtein distance ratio between two strings (0 = completely different, 1 = identical).
 * Useful for detecting near-duplicate short texts (questions, lessons, phrases).
 */
export function levenshteinRatio(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (longer.length === 0) return 1.0

  const prevRow = Array.from({ length: shorter.length }, (_, i) => i + 1).reduce(
    (prev, i) =>
      Array.from({ length: longer.length }, (_, j) => j + 1).reduce(
        (curr, j) => {
          const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1
          curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
          return curr
        },
        [i] as number[]
      ),
    Array.from({ length: longer.length + 1 }, (_, j) => j)
  )

  const distance = prevRow[longer.length] ?? 0
  return 1 - distance / longer.length
}

/**
 * Jaccard-like word overlap ratio between two texts (0 = no overlap, 1 = identical words).
 * Ignores words shorter than 3 characters. Uses min(setA, setB) as denominator
 * so that a short text fully contained in a longer text scores 1.0.
 */
export function wordOverlapRatio(textA: string, textB: string): number {
  const toWords = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    )

  const wordsA = toWords(textA)
  const wordsB = toWords(textB)

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  return overlap / Math.min(wordsA.size, wordsB.size)
}

/**
 * Check if two strings are semantically near-duplicates using combined heuristics:
 * high levenshtein ratio OR high word overlap. Threshold defaults tuned for
 * LLM-generated text that tends to rephrase with synonyms but keep structure.
 */
export function isNearDuplicate(
  a: string,
  b: string,
  levenshteinThreshold = 0.75,
  wordOverlapThreshold = 0.8
): boolean {
  const normalizedA = a.toLowerCase().trim()
  const normalizedB = b.toLowerCase().trim()

  if (normalizedA === normalizedB) return true

  return (
    levenshteinRatio(normalizedA, normalizedB) >= levenshteinThreshold ||
    wordOverlapRatio(normalizedA, normalizedB) >= wordOverlapThreshold
  )
}
