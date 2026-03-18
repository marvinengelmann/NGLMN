import * as z from "zod"
import { redis } from "@/infra/integrations/redis.ts"

const KEY = "working:altered:flow_qualifying_ticks"
const FlowTicksSchema = z.number().int().min(0)

export async function getFlowQualifyingTicks(): Promise<number> {
  const raw = await redis.get(KEY)
  if (raw == null) return 0
  const result = FlowTicksSchema.safeParse(raw)
  return result.success ? result.data : 0
}

export async function saveFlowQualifyingTicks(count: number): Promise<void> {
  await redis.set(KEY, count)
}
