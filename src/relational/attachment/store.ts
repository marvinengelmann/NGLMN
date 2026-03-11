import { redis } from "@/infra/integrations/redis.ts"

const VULNERABILITY_PREV_LEVEL = "working:vulnerability:prevLevel"

export async function getVulnerabilityPrevLevel(): Promise<number | null> {
  try {
    return await redis.get<number>(VULNERABILITY_PREV_LEVEL)
  } catch {
    return null
  }
}
