import { redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/consciousness/pipeline/persistence.ts"
import { DEFAULT_DMN_STATE, DefaultModeNetworkState, type DefaultModeNetworkState as DMNStateT } from "./types.ts"

const REDIS_KEY = "working:cognition:dmn"

export async function getDMNState(): Promise<DMNStateT> {
  const raw = await redis.get(REDIS_KEY)
  if (!raw) return DEFAULT_DMN_STATE
  const parsed = DefaultModeNetworkState.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_DMN_STATE
}

export function saveDMNState(state: DMNStateT, buffer?: WriteBuffer): void {
  if (buffer) {
    buffer.stage(REDIS_KEY, state)
  }
}
