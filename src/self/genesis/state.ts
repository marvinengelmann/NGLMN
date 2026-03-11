import { desc } from "drizzle-orm"
import { db } from "@/infra/db/client.ts"
import { genesis } from "@/infra/db/schema.ts"
import { getValidatedRedis, redis } from "@/infra/integrations/redis.ts"
import type { PersonalityType } from "@/self/personality/types.ts"
import { type GenesisDNA, GenesisRecord } from "./types.ts"

export const GENESIS_REDIS_KEY = "working:genesis:record"

let memoryCache: GenesisRecord | null | undefined

/**
 * Get the genesis record: memory cache → Redis → DB → null.
 */
export async function getGenesisRecord(): Promise<GenesisRecord | null> {
  if (memoryCache !== undefined) return memoryCache

  const fromRedis = await getValidatedRedis(GENESIS_REDIS_KEY, GenesisRecord)
  if (fromRedis) {
    memoryCache = fromRedis
    return fromRedis
  }

  const rows = await db.select().from(genesis).orderBy(desc(genesis.createdAt)).limit(1)
  if (rows[0]) {
    const record = GenesisRecord.safeParse({
      seed: rows[0].seed,
      dna: rows[0].dna,
      identity: rows[0].identity,
      createdAt: rows[0].createdAt.toISOString()
    })
    if (record.success) {
      memoryCache = record.data
      await redis.set(GENESIS_REDIS_KEY, record.data)
      return record.data
    }
  }

  memoryCache = null
  return null
}

/**
 * Get the genesis-chosen name, falling back to "ANIMA".
 */
export async function getGenesisName(): Promise<string> {
  const record = await getGenesisRecord()
  return record?.identity.chosenName ?? "ANIMA"
}

/**
 * Get the genesis appearance description, falling back to the default.
 */
export async function getGenesisAppearance(): Promise<string | null> {
  const record = await getGenesisRecord()
  return record?.identity.appearanceDescription ?? null
}

/**
 * Get the genesis personality type, falling back to "INFP".
 */
export async function getGenesisPersonalityType(): Promise<PersonalityType> {
  const record = await getGenesisRecord()
  return record?.dna.personalityType ?? "INFP"
}

/**
 * Get the full genesis DNA, or null if no genesis has occurred.
 */
export async function getGenesisDNA(): Promise<GenesisDNA | null> {
  const record = await getGenesisRecord()
  return record?.dna ?? null
}

/**
 * Cache a genesis record after creation.
 */
export function cacheGenesisRecord(record: GenesisRecord): void {
  memoryCache = record
}
