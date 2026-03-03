import { log } from "@/lib/logger.ts"
import { estimateTokens } from "@/lib/math.ts"

const CONTEXT7_BASE_URL = "https://context7.com"
const DOCS_TOKEN_BUDGET = 5000
const FETCH_TIMEOUT_MS = 10_000

const LIBRARY_IDS: Record<string, string> = {
  "drizzle-orm": "/drizzle-team/drizzle-orm-docs",
  zod: "/websites/zod_dev_v4",
  "date-fns": "/date-fns/date-fns",
  neverthrow: "/supermacro/neverthrow",
  "@trigger.dev/sdk": "/triggerdotdev/trigger.dev",
  "@upstash/redis": "/upstash/redis-js",
  "@upstash/vector": "/upstash/vector-js",
  grammy: "/grammyjs/website",
  ai: "/vercel/ai"
}

/**
 * Fetch documentation for a library ID and topic from Context7.
 */
export async function queryLibraryDocs(libraryId: string, topic: string): Promise<string> {
  try {
    const path = `/api/v2/docs/code${libraryId}`
    const url = new URL(path, CONTEXT7_BASE_URL)
    url.searchParams.set("topic", topic)

    const response = await fetchWithTimeout(url.toString())
    if (!response.ok) return ""

    const text = await response.text()
    if (!text.trim()) return ""

    const tokens = estimateTokens(text)
    if (tokens > DOCS_TOKEN_BUDGET) {
      return text.slice(0, DOCS_TOKEN_BUDGET * 4)
    }

    return text
  } catch (error) {
    log.warn("Context7 docs fetch failed", { libraryId, topic, error: String(error) })
    return ""
  }
}

/**
 * Extract library names from import statements in source code.
 */
export function extractImportedLibraries(sourceCode: string): string[] {
  const importRegex = /from\s+["']([^./][^"']*)["']/g
  const libraries = new Set<string>()

  let match = importRegex.exec(sourceCode)
  while (match) {
    const pkg = match[1] as string | undefined
    if (pkg && pkg in LIBRARY_IDS) {
      libraries.add(pkg)
    }
    match = importRegex.exec(sourceCode)
  }

  return [...libraries]
}

/**
 * Fetch documentation for all libraries found in source files.
 * Best-effort: failures are silently ignored.
 */
export async function fetchLibraryDocs(sourceCode: string, topic: string): Promise<string> {
  const libraries = extractImportedLibraries(sourceCode)
  if (libraries.length === 0) return ""
  log.debug("Fetching library docs", { libraries, topic })

  const results = await Promise.allSettled(
    libraries.slice(0, 3).map((pkg) => {
      const libraryId = LIBRARY_IDS[pkg]
      if (!libraryId) return Promise.resolve("")
      return queryLibraryDocs(libraryId, topic)
    })
  )

  const docs = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter(Boolean)

  if (docs.length === 0) return ""

  const combined = docs.join("\n\n---\n\n")
  log.debug("Library docs fetched", { libraryCount: docs.length, combinedTokens: estimateTokens(combined) })
  const tokens = estimateTokens(combined)
  if (tokens > DOCS_TOKEN_BUDGET) {
    return combined.slice(0, DOCS_TOKEN_BUDGET * 4)
  }

  return combined
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const headers: Record<string, string> = {}
  const apiKey = process.env.CONTEXT7_API_KEY
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    return await fetch(url, { signal: controller.signal, headers })
  } finally {
    clearTimeout(timeout)
  }
}
