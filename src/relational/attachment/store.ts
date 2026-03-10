import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"
import { VulnerabilityState, VulnerableMessageStyle } from "./types.ts"

const VULNERABILITY_CURRENT = "working:vulnerability:current"
const VULNERABILITY_PREV_LEVEL = "working:vulnerability:prevLevel"
const VULNERABILITY_MESSAGE_STYLE = "working:vulnerability:messageStyle"

export async function getVulnerability(): Promise<VulnerabilityState | null> {
  return getValidatedRedis(VULNERABILITY_CURRENT, VulnerabilityState)
}

export async function getVulnerabilityPrevLevel(): Promise<number | null> {
  try {
    return await redis.get<number>(VULNERABILITY_PREV_LEVEL)
  } catch {
    return null
  }
}

export async function saveVulnerability(state: VulnerabilityState): Promise<void> {
  try {
    await Promise.all([redis.set(VULNERABILITY_CURRENT, state), redis.set(VULNERABILITY_PREV_LEVEL, state.level)])
  } catch {
    log.warn("Failed to save vulnerability state to Redis")
  }
}

export async function saveVulnerableMessageStyle(style: VulnerableMessageStyle): Promise<void> {
  await redis.set(VULNERABILITY_MESSAGE_STYLE, style)
}

export async function getVulnerableMessageStyle(): Promise<VulnerableMessageStyle | null> {
  return getValidatedRedis(VULNERABILITY_MESSAGE_STYLE, VulnerableMessageStyle)
}
