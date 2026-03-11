import { type TweetV2, TwitterApi, type UserV2 } from "twitter-api-v2"
import { env } from "@/infra/config/env.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"

const USER_ID_CACHE_KEY = "working:x:userId"

export interface EnrichedTweet {
  id: string
  text: string
  authorId: string
  authorName?: string
  authorUsername?: string
  createdAt: string
  url: string
  likeCount: number
  retweetCount: number
}

/**
 * Check if X credentials are configured.
 */
export function isXEnabled(): boolean {
  const e = env()
  return !!(e.X_API_KEY && e.X_API_SECRET && e.X_ACCESS_TOKEN && e.X_ACCESS_TOKEN_SECRET)
}

function getXConfig() {
  const e = env()
  if (!e.X_API_KEY || !e.X_API_SECRET || !e.X_ACCESS_TOKEN || !e.X_ACCESS_TOKEN_SECRET) {
    throw new Error("X not configured: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET required")
  }
  return {
    appKey: e.X_API_KEY,
    appSecret: e.X_API_SECRET,
    accessToken: e.X_ACCESS_TOKEN,
    accessSecret: e.X_ACCESS_TOKEN_SECRET
  }
}

/**
 * Get a configured TwitterApi client with OAuth 1.0a user authentication.
 */
export function getClient(): TwitterApi {
  return new TwitterApi(getXConfig())
}

/**
 * Get the authenticated user's ID (cached in Redis for 24h).
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const cached = await redis.get<string>(USER_ID_CACHE_KEY)
  if (cached) return cached

  const client = getClient()
  const me = await client.v2.me()

  await redis.set(USER_ID_CACHE_KEY, me.data.id, { ex: 86400 })
  log.info("X user ID cached", { userId: me.data.id, username: me.data.username })

  return me.data.id
}

/**
 * Post a tweet and return its ID and URL.
 */
export async function postToX(text: string): Promise<{ id: string; url: string }> {
  const client = getClient()
  const result = await client.v2.tweet(text)

  log.info("Posted to X", { tweetId: result.data.id })
  return {
    id: result.data.id,
    url: `https://x.com/i/status/${result.data.id}`
  }
}

/**
 * Delete a tweet by ID.
 */
export async function deletePost(id: string): Promise<void> {
  const client = getClient()
  await client.v2.deleteTweet(id)
  log.info("Deleted X post", { tweetId: id })
}

/**
 * Enrich raw TweetV2 objects with resolved author info from includes.
 */
function enrichTweets(tweets: TweetV2[], users: UserV2[]): EnrichedTweet[] {
  const userMap = users.reduce((map, user) => {
    map.set(user.id, user)
    return map
  }, new Map<string, UserV2>())

  return tweets.map((tweet) => {
    const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id ?? "",
      authorName: author?.name,
      authorUsername: author?.username,
      createdAt: tweet.created_at ?? new Date().toISOString(),
      url: `https://x.com/${author?.username ?? "i"}/status/${tweet.id}`,
      likeCount: tweet.public_metrics?.like_count ?? 0,
      retweetCount: tweet.public_metrics?.retweet_count ?? 0
    }
  })
}

/**
 * Get the authenticated user's home timeline (reverse chronological).
 */
export async function getHomeTimeline(maxResults = 15): Promise<EnrichedTweet[]> {
  const client = getClient()
  const timeline = await client.v2.homeTimeline({
    max_results: Math.min(maxResults, 100),
    "tweet.fields": ["created_at", "public_metrics", "author_id"],
    expansions: ["author_id"],
    "user.fields": ["name", "username"]
  })

  const tweets = timeline.data.data ?? []
  const users = timeline.data.includes?.users ?? []

  return enrichTweets(tweets, users)
}

/**
 * Search recent posts matching a query.
 */
export async function searchRecentPosts(query: string, maxResults = 10): Promise<EnrichedTweet[]> {
  const client = getClient()
  const result = await client.v2.search(query, {
    max_results: Math.min(Math.max(maxResults, 10), 100),
    "tweet.fields": ["created_at", "public_metrics", "author_id"],
    expansions: ["author_id"],
    "user.fields": ["name", "username"]
  })

  const tweets = result.data.data ?? []
  const users = result.data.includes?.users ?? []

  return enrichTweets(tweets, users)
}
