import type { PgTable } from "drizzle-orm/pg-core"
import { db } from "@/infra/db/client.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"

export type WriteBuffer = ReturnType<typeof createWriteBuffer>

export function createWriteBuffer() {
  const redisWrites = new Map<string, unknown>()
  const redisExpiry = new Map<string, number>()
  const redisDeletions = new Set<string>()
  let postgresWrites: Array<{ table: PgTable; values: Record<string, unknown> }> = []

  return {
    stage(key: string, value: unknown): void {
      redisDeletions.delete(key)
      redisWrites.set(key, value)
    },

    stageWithExpiry(key: string, value: unknown, ttlSeconds: number): void {
      redisDeletions.delete(key)
      redisWrites.set(key, value)
      redisExpiry.set(key, ttlSeconds)
    },

    stageDel(key: string): void {
      redisWrites.delete(key)
      redisExpiry.delete(key)
      redisDeletions.add(key)
    },

    stagePostgres(table: PgTable, values: Record<string, unknown>): void {
      postgresWrites.push({ table, values })
    },

    get stagedRedisCount(): number {
      return redisWrites.size + redisDeletions.size
    },

    get stagedPostgresCount(): number {
      return postgresWrites.length
    },

    async flushRedis(): Promise<void> {
      if (redisWrites.size === 0 && redisDeletions.size === 0) return

      const pipeline = redis.pipeline()
      redisWrites.forEach((value, key) => {
        const ttl = redisExpiry.get(key)
        if (ttl != null) {
          pipeline.set(key, value, { ex: ttl })
        } else {
          pipeline.set(key, value)
        }
      })
      redisDeletions.forEach((key) => {
        pipeline.del(key)
      })
      await pipeline.exec()
      log.debug("WriteBuffer: flushed Redis", { sets: redisWrites.size, deletes: redisDeletions.size })
      redisWrites.clear()
      redisExpiry.clear()
      redisDeletions.clear()
    },

    async flushPostgres(): Promise<void> {
      if (postgresWrites.length === 0) return

      const queries = postgresWrites.map(({ table, values }) => db.insert(table).values(values))
      await db.batch(queries as [(typeof queries)[0], ...typeof queries])
      log.debug("WriteBuffer: flushed Postgres", { rows: postgresWrites.length })
      postgresWrites = []
    },

    async flush(): Promise<void> {
      await Promise.all([this.flushRedis(), this.flushPostgres()])
    },

    discard(): void {
      redisWrites.clear()
      redisExpiry.clear()
      redisDeletions.clear()
      postgresWrites = []
      log.debug("WriteBuffer: discarded all staged writes")
    }
  }
}
