import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import { DEFAULT_TRANSFERENCE_STATE, TransferenceState } from "./types.ts"

const KEY = "working:relational:transference"

export async function getTransferenceState(): Promise<TransferenceState> {
  const fromRedis = await getValidatedRedis(KEY, TransferenceState)
  return fromRedis ?? DEFAULT_TRANSFERENCE_STATE
}

export async function saveTransferenceState(state: TransferenceState): Promise<void> {
  await redis.set(KEY, state)
}
