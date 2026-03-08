import * as z from "zod"
import { env } from "@/config/env.ts"
import { redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import type { XPost } from "./types.ts"

const X_API_BASE = "https://api.x.com/2"
const USER_ID_CACHE_KEY = "working:x:userId"

const TweetResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    text: z.string()
  })
})

const UserMeSchema = z.object({
  data: z.object({
    id: z.string(),
    username: z.string()
  })
})

const TimelineTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  author_id: z.string(),
  created_at: z.string().optional()
})

const TimelineUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string()
})

const TimelineMetaSchema = z.object({
  result_count: z.number().optional()
})

const TimelineResponseSchema = z.object({
  data: z.array(TimelineTweetSchema).optional().default([]),
  includes: z
    .object({
      users: z.array(TimelineUserSchema).optional().default([])
    })
    .optional(),
  meta: TimelineMetaSchema.optional()
})

const PublicMetricsSchema = z.object({
  like_count: z.number().default(0),
  retweet_count: z.number().default(0)
})

/**
 * Check if X credentials are configured.
 */
export function isXEnabled(): boolean {
  return !!(
    process.env.X_API_KEY &&
    process.env.X_API_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_ACCESS_TOKEN_SECRET
  )
}

/**
 * Build OAuth 1.0a Authorization header using Web Crypto API (HMAC-SHA1).
 */
async function buildOAuthHeader(method: string, url: string, params?: Record<string, string>): Promise<string> {
  const apiKey = env().X_API_KEY as string
  const apiSecret = env().X_API_SECRET as string
  const accessToken = env().X_ACCESS_TOKEN as string
  const accessTokenSecret = env().X_ACCESS_TOKEN_SECRET as string

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0"
  }

  const allParams: Record<string, string> = { ...oauthParams, ...(params ?? {}) }

  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys.map((k) => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k] ?? "")}`).join("&")

  const baseString = `${method.toUpperCase()}&${encodeRFC3986(url)}&${encodeRFC3986(paramString)}`
  const signingKey = `${encodeRFC3986(apiSecret)}&${encodeRFC3986(accessTokenSecret)}`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, [
    "sign"
  ])
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

  oauthParams.oauth_signature = signatureB64

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k] ?? "")}"`)
    .join(", ")

  return `OAuth ${headerParts}`
}

function encodeRFC3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

async function xFetch(method: string, url: string, body?: unknown): Promise<Response> {
  const urlObj = new URL(url)
  const queryParams: Record<string, string> = {}
  urlObj.searchParams.forEach((v, k) => {
    queryParams[k] = v
  })

  const baseUrl = `${urlObj.origin}${urlObj.pathname}`
  const authHeader = await buildOAuthHeader(method, baseUrl, method === "GET" ? queryParams : undefined)

  const headers: Record<string, string> = {
    Authorization: authHeader
  }
  if (body) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`X API ${method} ${url} failed (${response.status}): ${errorText}`)
  }

  return response
}

/**
 * Get the authenticated user's ID (cached in Redis for 24h).
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const cached = await redis.get<string>(USER_ID_CACHE_KEY)
  if (cached) return cached

  const response = await xFetch("GET", `${X_API_BASE}/users/me`)
  const json = await response.json()
  const parsed = UserMeSchema.parse(json)

  await redis.set(USER_ID_CACHE_KEY, parsed.data.id, { ex: 86400 })
  log.info("X user ID cached", { userId: parsed.data.id, username: parsed.data.username })

  return parsed.data.id
}

/**
 * Post a tweet and return its ID and URL.
 */
export async function postToX(text: string): Promise<{ id: string; url: string }> {
  const response = await xFetch("POST", `${X_API_BASE}/tweets`, { text })
  const json = await response.json()
  const parsed = TweetResponseSchema.parse(json)

  log.info("Posted to X", { tweetId: parsed.data.id })
  return {
    id: parsed.data.id,
    url: `https://x.com/i/status/${parsed.data.id}`
  }
}

/**
 * Delete a tweet by ID.
 */
export async function deletePost(id: string): Promise<void> {
  await xFetch("DELETE", `${X_API_BASE}/tweets/${id}`)
  log.info("Deleted X post", { tweetId: id })
}

/**
 * Get the authenticated user's home timeline (reverse chronological).
 */
export async function getHomeTimeline(maxResults = 15): Promise<XPost[]> {
  const userId = await getAuthenticatedUserId()
  const params = new URLSearchParams({
    max_results: Math.min(maxResults, 100).toString(),
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "name,username"
  })

  const response = await xFetch("GET", `${X_API_BASE}/users/${userId}/reverse_chronological?${params}`)
  const json = await response.json()
  const parsed = TimelineResponseSchema.parse(json)

  const userMap = new Map<string, { name: string; username: string }>()
  for (const user of parsed.includes?.users ?? []) {
    userMap.set(user.id, { name: user.name, username: user.username })
  }

  return parsed.data.map((tweet): XPost => {
    const author = userMap.get(tweet.author_id)
    const metrics = PublicMetricsSchema.safeParse((tweet as Record<string, unknown>).public_metrics)
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      authorName: author?.name,
      authorUsername: author?.username,
      createdAt: tweet.created_at ?? new Date().toISOString(),
      url: `https://x.com/${author?.username ?? "i"}/status/${tweet.id}`,
      likeCount: metrics.success ? metrics.data.like_count : 0,
      retweetCount: metrics.success ? metrics.data.retweet_count : 0
    }
  })
}

/**
 * Search recent posts matching a query.
 */
export async function searchRecentPosts(query: string, maxResults = 10): Promise<XPost[]> {
  const params = new URLSearchParams({
    query,
    max_results: Math.min(Math.max(maxResults, 10), 100).toString(),
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "name,username"
  })

  const response = await xFetch("GET", `${X_API_BASE}/tweets/search/recent?${params}`)
  const json = await response.json()
  const parsed = TimelineResponseSchema.parse(json)

  const userMap = new Map<string, { name: string; username: string }>()
  for (const user of parsed.includes?.users ?? []) {
    userMap.set(user.id, { name: user.name, username: user.username })
  }

  return parsed.data.map((tweet): XPost => {
    const author = userMap.get(tweet.author_id)
    const metrics = PublicMetricsSchema.safeParse((tweet as Record<string, unknown>).public_metrics)
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      authorName: author?.name,
      authorUsername: author?.username,
      createdAt: tweet.created_at ?? new Date().toISOString(),
      url: `https://x.com/${author?.username ?? "i"}/status/${tweet.id}`,
      likeCount: metrics.success ? metrics.data.like_count : 0,
      retweetCount: metrics.success ? metrics.data.retweet_count : 0
    }
  })
}
