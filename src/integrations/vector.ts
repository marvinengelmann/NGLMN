import { Index } from "@upstash/vector"
import { env } from "@/config/env.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"

export const vectorIndex = new Index<EpisodeMetadata>({
  url: env().UPSTASH_VECTOR_REST_URL,
  token: env().UPSTASH_VECTOR_REST_TOKEN
})
