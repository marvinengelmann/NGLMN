export interface HabituationMetadata {
  [key: string]: unknown
  exposureCount: number
  firstSeenAt: string
  lastSeenAt: string
}

export const HABITUATION_NAMESPACE = "habituation"
