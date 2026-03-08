import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_HELD_BACK_BUFFER, HeldBackBuffer } from "./types.ts"

const KEY = "working:psyche:heldback"

export async function getHeldBackBuffer(): Promise<HeldBackBuffer> {
  return (await getValidatedRedis(KEY, HeldBackBuffer)) ?? DEFAULT_HELD_BACK_BUFFER
}

export async function saveHeldBackBuffer(buffer: HeldBackBuffer): Promise<void> {
  await redis.set(KEY, buffer)
}
