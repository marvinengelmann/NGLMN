import { Index } from "@upstash/vector"
import { env } from "@/infra/config/env.ts"

export interface HabituationMetadata {
  [key: string]: unknown
  exposureCount: number
  firstSeenAt: string
  lastSeenAt: string
}

let _habituationIndex: Index<HabituationMetadata> | null = null

export function getHabituationIndex(): Index<HabituationMetadata> | null {
  if (_habituationIndex) return _habituationIndex

  const url = env().UPSTASH_VECTOR_HABITUATION_URL
  const token = env().UPSTASH_VECTOR_HABITUATION_TOKEN
  if (!url || !token) return null

  _habituationIndex = new Index<HabituationMetadata>({ url, token })
  return _habituationIndex
}
