import { fromCatch } from "@/lib/errors.ts"
import { log } from "@/lib/logger.ts"
import {
  getXAccessToken,
  getXLastMentionId,
  getXRefreshToken,
  pushPendingMentions,
  setXAccessToken,
  setXLastMentionId,
  setXRefreshToken
} from "@/memory/working.ts"
import type { PendingMention } from "./types.ts"

const TOKEN_URL = "https://api.x.com/2/oauth2/token"
const API_BASE = "https://api.x.com"
const ACCESS_TOKEN_TTL_SECONDS = 7000

let cachedAccountId: string | null = null

/**
 * Refresh the X OAuth 2.0 access token using the stored refresh token.
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getXRefreshToken()
  if (!refreshToken) {
    throw new Error("No X refresh token available in Redis")
  }

  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID or X_CLIENT_SECRET not configured")
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`X token refresh failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  await setXAccessToken(data.access_token, Math.min(data.expires_in - 60, ACCESS_TOKEN_TTL_SECONDS))
  await setXRefreshToken(data.refresh_token)

  log.info("X access token refreshed")
  return data.access_token
}

/**
 * Get a valid X access token — checks Redis cache, seeds from env on first run, or refreshes.
 */
async function getValidToken(): Promise<string> {
  const cached = await getXAccessToken()
  if (cached) return cached

  const envToken = process.env.X_ACCESS_TOKEN
  const envRefresh = process.env.X_REFRESH_TOKEN
  if (envRefresh) {
    const existingRefresh = await getXRefreshToken()
    if (!existingRefresh) {
      await setXRefreshToken(envRefresh)
    }
  }

  if (envToken) {
    const existingRefresh = await getXRefreshToken()
    if (existingRefresh) {
      try {
        return await refreshAccessToken()
      } catch (e) {
        log.warn("X token refresh failed, trying env token", { error: String(e) })
      }
    }
    await setXAccessToken(envToken, ACCESS_TOKEN_TTL_SECONDS)
    return envToken
  }

  return refreshAccessToken()
}

async function xGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getValidToken()
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  let response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${newToken}` }
    })
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`X API GET ${path} failed (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

async function xPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getValidToken()
  const url = `${API_BASE}${path}`

  let response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
  }

  if (!response.ok) {
    const responseBody = await response.text()
    throw new Error(`X API POST ${path} failed (${response.status}): ${responseBody}`)
  }

  return response.json() as Promise<T>
}

/**
 * Resolve the authenticated user's account ID via GET /2/users/me.
 */
export async function resolveAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId

  const data = await xGet<{ data: { id: string; username: string } }>("/2/users/me")
  cachedAccountId = data.data.id
  log.info("Resolved X account ID", { id: cachedAccountId, username: data.data.username })
  return cachedAccountId
}

interface MentionData {
  id: string
  text: string
  author_id: string
  conversation_id?: string
  in_reply_to_user_id?: string
  created_at: string
  referenced_tweets?: Array<{ type: string; id: string }>
}

interface MentionsResponse {
  data?: MentionData[]
  includes?: { users?: Array<{ id: string; username: string }> }
  meta?: { newest_id?: string; result_count?: number }
}

/**
 * Poll for new mentions and push them to the pending queue.
 * @returns Number of new mentions found.
 */
export async function pollNewMentions(): Promise<number> {
  try {
    const accountId = await resolveAccountId()
    const sinceId = await getXLastMentionId()

    const params: Record<string, string> = {
      "tweet.fields": "author_id,conversation_id,in_reply_to_user_id,created_at,referenced_tweets",
      expansions: "author_id",
      "user.fields": "username",
      max_results: "100"
    }
    if (sinceId) {
      params.since_id = sinceId
    }

    const data = await xGet<MentionsResponse>(`/2/users/${accountId}/mentions`, params)

    if (!data.data || data.data.length === 0) return 0

    const userMap = new Map<string, string>()
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user.username)
      }
    }

    const mentions: PendingMention[] = data.data.map((tweet) => {
      const inReplyTo = tweet.referenced_tweets?.find((r) => r.type === "replied_to")
      return {
        tweetId: tweet.id,
        authorId: tweet.author_id,
        authorUsername: userMap.get(tweet.author_id) ?? "unknown",
        text: tweet.text.slice(0, 1000),
        conversationId: tweet.conversation_id,
        inReplyToTweetId: inReplyTo?.id,
        createdAt: tweet.created_at
      }
    })

    await pushPendingMentions(mentions)

    if (data.meta?.newest_id) {
      await setXLastMentionId(data.meta.newest_id)
    }

    log.info("Polled X mentions", { count: mentions.length })
    return mentions.length
  } catch (e) {
    const error = fromCatch("X_ERROR", e)
    log.error("X mention polling failed", { error: error.message })
    return 0
  }
}

/**
 * Post a new tweet.
 * @returns The tweet ID if successful, null otherwise.
 */
export async function postTweet(text: string): Promise<string | null> {
  try {
    const data = await xPost<{ data: { id: string } }>("/2/tweets", { text })
    log.info("Posted tweet", { tweetId: data.data.id })
    return data.data.id
  } catch (e) {
    const error = fromCatch("X_ERROR", e)
    log.error("Failed to post tweet", { error: error.message })
    return null
  }
}

/**
 * Reply to a specific tweet.
 * @returns The reply tweet ID if successful, null otherwise.
 */
export async function replyToTweet(text: string, inReplyToTweetId: string): Promise<string | null> {
  try {
    const data = await xPost<{ data: { id: string } }>("/2/tweets", {
      text,
      reply: { in_reply_to_tweet_id: inReplyToTweetId }
    })
    log.info("Replied to tweet", { tweetId: data.data.id, inReplyTo: inReplyToTweetId })
    return data.data.id
  } catch (e) {
    const error = fromCatch("X_ERROR", e)
    log.error("Failed to reply to tweet", { error: error.message })
    return null
  }
}

/**
 * Health check — verify X API connectivity.
 */
export async function pingX(): Promise<boolean> {
  try {
    await resolveAccountId()
    return true
  } catch {
    return false
  }
}
