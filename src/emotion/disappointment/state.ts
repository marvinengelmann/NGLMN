import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { DEFAULT_DISAPPOINTMENT_STATE, DisappointmentState } from "./types.ts"

const KEY = "working:emotion:disappointment"

export async function getDisappointmentState(): Promise<DisappointmentState> {
  return (await getValidatedRedis(KEY, DisappointmentState)) ?? DEFAULT_DISAPPOINTMENT_STATE
}

export async function saveDisappointmentState(state: DisappointmentState): Promise<void> {
  await redis.set(KEY, state)
}
