/**
 * Reset: wipes ALL ANIMA data.
 * Drops all Postgres tables (public + drizzle schemas), flushes Redis, and clears the Vector index.
 * Migrations and seeding run automatically on worker start via init.ts.
 *
 * Usage: bun run reset (local) | bun run reset:prod (production)
 */

import * as readline from "node:readline"
import { neon } from "@neondatabase/serverless"
import { Redis } from "@upstash/redis"
import { Index } from "@upstash/vector"
import { config } from "dotenv"

const envFile = process.argv[2] === "--prod" ? ".env.production" : ".env.local"
config({ path: envFile, override: true })

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const VECTOR_URL = process.env.UPSTASH_VECTOR_REST_URL
const VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN

if (!DATABASE_URL || !REDIS_URL || !REDIS_TOKEN || !VECTOR_URL || !VECTOR_TOKEN) {
  console.error(`Missing required env vars. Check ${envFile}`)
  process.exit(1)
  throw new Error("unreachable")
}

const dbUrl: string = DATABASE_URL
const redisUrl: string = REDIS_URL
const redisToken: string = REDIS_TOKEN
const vectorUrl: string = VECTOR_URL
const vectorToken: string = VECTOR_TOKEN

function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "y")
    })
  })
}

async function resetAll() {
  console.log("\n  ANIMA Full Reset\n")

  const confirmed = await confirm("This will DELETE ALL data (Postgres, Redis, Vector DB). Continue?")
  if (!confirmed) {
    console.log("Aborted.\n")
    process.exit(0)
  }

  console.log()

  const sql = neon(dbUrl)
  console.log("[1/3] Dropping Postgres schemas...")
  await sql`DROP SCHEMA IF EXISTS public CASCADE`
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`
  await sql`CREATE SCHEMA public`
  console.log("      Postgres cleared")

  const redis = new Redis({ url: redisUrl, token: redisToken })
  console.log("[2/3] Flushing Redis...")
  await redis.flushdb()
  console.log("      Redis flushed")

  const vectorIndex = new Index({ url: vectorUrl, token: vectorToken })
  console.log("[3/3] Resetting Vector index...")
  await vectorIndex.reset({ all: true })
  console.log("      Vector index cleared")

  console.log("\nDone!\n")
}

resetAll().catch((err) => {
  console.error("Reset failed:", err)
  process.exit(1)
})
