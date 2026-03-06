import { redis } from "@/integrations/redis.ts"
import { CommunicationRegister } from "./types.ts"

const KEYS = {
  REGISTER: "working:communication:register"
} as const

/**
 * Get the current communication register from Redis.
 */
export async function getCommunicationRegister(): Promise<CommunicationRegister | null> {
  const raw = await redis.get(KEYS.REGISTER)
  if (raw == null) return null
  const parsed = CommunicationRegister.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
  return parsed.success ? parsed.data : null
}

/**
 * Save the current communication register to Redis.
 */
export async function saveCommunicationRegister(register: CommunicationRegister): Promise<void> {
  await redis.set(KEYS.REGISTER, register)
}
