import { redis } from "@/infra/integrations/redis.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { DEFAULT_MENTALIZING_STATE, type MentalizingState } from "./mentalizing.ts"

const REDIS_KEY = "working:mind:mentalizing"

export async function getMentalizingState(): Promise<MentalizingState> {
  const raw = await redis.get(REDIS_KEY)
  if (!raw || typeof raw !== "object") return DEFAULT_MENTALIZING_STATE
  return { ...DEFAULT_MENTALIZING_STATE, ...(raw as Partial<MentalizingState>) }
}

export function saveMentalizingState(state: MentalizingState, buffer?: WriteBuffer): void {
  if (buffer) {
    buffer.stage(REDIS_KEY, state)
  }
}
