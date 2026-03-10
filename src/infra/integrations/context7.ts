import { estimateTokenCount, sliceByTokens } from "tokenx"
import { env } from "@/infra/config/env.ts"
import { fetchWithTimeout } from "@/infra/lib/fetch.ts"
import { log } from "@/infra/lib/logger.ts"

const CONTEXT7_BASE_URL = "https://context7.com"
const DOCS_TOKEN_BUDGET = 5000

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

    const response = await context7Fetch(url.toString())
    if (!response.ok) return ""

    const text = await response.text()
    if (!text.trim()) return ""

    const tokens = estimateTokenCount(text)
    if (tokens > DOCS_TOKEN_BUDGET) {
      return sliceByTokens(text, 0, DOCS_TOKEN_BUDGET)
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
    const library = match[1] as string | undefined
    if (library && library in LIBRARY_IDS) {
      libraries.add(library)
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
    libraries.slice(0, 3).map((library) => {
      const libraryId = LIBRARY_IDS[library]
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
  log.debug("Library docs fetched", { libraryCount: docs.length, combinedTokens: estimateTokenCount(combined) })
  const tokens = estimateTokenCount(combined)
  if (tokens > DOCS_TOKEN_BUDGET) {
    return sliceByTokens(combined, 0, DOCS_TOKEN_BUDGET)
  }

  return combined
}

function context7Fetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {}
  const apiKey = env().CONTEXT7_API_KEY
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return fetchWithTimeout(url, { headers })
}
