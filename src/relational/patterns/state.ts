import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_RELATIONAL_PATTERN_STATE, RelationalPatternState } from "./types.ts"

const KEY = "working:relational:patterns"

export async function getRelationalPatternState(): Promise<RelationalPatternState> {
  const fromRedis = await getValidatedRedis(KEY, RelationalPatternState)
  return fromRedis ?? DEFAULT_RELATIONAL_PATTERN_STATE
}

export async function saveRelationalPatternState(state: RelationalPatternState): Promise<void> {
  await redis.set(KEY, state)
}
