import type { PgTable } from "drizzle-orm/pg-core"
import { db } from "@/infra/db/client.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { log } from "@/infra/lib/logger.ts"

export class WriteBuffer {
  private redisWrites = new Map<string, unknown>()
  private redisExpiry = new Map<string, number>()
  private redisDeletions = new Set<string>()
  private postgresWrites: Array<{ table: PgTable; values: Record<string, unknown> }> = []

  stage(key: string, value: unknown): void {
    this.redisDeletions.delete(key)
    this.redisWrites.set(key, value)
  }

  stageWithExpiry(key: string, value: unknown, ttlSeconds: number): void {
    this.redisDeletions.delete(key)
    this.redisWrites.set(key, value)
    this.redisExpiry.set(key, ttlSeconds)
  }

  stageDel(key: string): void {
    this.redisWrites.delete(key)
    this.redisExpiry.delete(key)
    this.redisDeletions.add(key)
  }

  stagePostgres(table: PgTable, values: Record<string, unknown>): void {
    this.postgresWrites.push({ table, values })
  }

  get stagedRedisCount(): number {
    return this.redisWrites.size + this.redisDeletions.size
  }

  get stagedPostgresCount(): number {
    return this.postgresWrites.length
  }

  async flushRedis(): Promise<void> {
    if (this.redisWrites.size === 0 && this.redisDeletions.size === 0) return

    const pipeline = redis.pipeline()
    this.redisWrites.forEach((value, key) => {
      const ttl = this.redisExpiry.get(key)
      if (ttl != null) {
        pipeline.set(key, value, { ex: ttl })
      } else {
        pipeline.set(key, value)
      }
    })
    this.redisDeletions.forEach((key) => {
      pipeline.del(key)
    })
    await pipeline.exec()
    log.debug("WriteBuffer: flushed Redis", { sets: this.redisWrites.size, deletes: this.redisDeletions.size })
    this.redisWrites.clear()
    this.redisExpiry.clear()
    this.redisDeletions.clear()
  }

  async flushPostgres(): Promise<void> {
    if (this.postgresWrites.length === 0) return

    const queries = this.postgresWrites.map(({ table, values }) => db.insert(table).values(values))
    await db.batch(queries as [typeof queries[0], ...typeof queries])
    log.debug("WriteBuffer: flushed Postgres", { rows: this.postgresWrites.length })
    this.postgresWrites = []
  }

  async flush(): Promise<void> {
    await Promise.all([this.flushRedis(), this.flushPostgres()])
  }

  discard(): void {
    this.redisWrites.clear()
    this.redisExpiry.clear()
    this.redisDeletions.clear()
    this.postgresWrites = []
    log.debug("WriteBuffer: discarded all staged writes")
  }
}
