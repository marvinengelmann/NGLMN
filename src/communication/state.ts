import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { CommunicationRegister } from "./types.ts"

const KEYS = {
  REGISTER: "working:communication:register"
} as const

/**
 * Get the current communication register from Redis.
 */
export async function getCommunicationRegister(): Promise<CommunicationRegister | null> {
  return getValidatedRedis(KEYS.REGISTER, CommunicationRegister)
}

/**
 * Save the current communication register to Redis.
 */
export async function saveCommunicationRegister(register: CommunicationRegister): Promise<void> {
  await redis.set(KEYS.REGISTER, register)
}
