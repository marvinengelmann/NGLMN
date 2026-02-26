/**
 * Nuclear reset: wipes ALL ANIMA data for local development.
 * Drops all Postgres tables (public + drizzle schemas), flushes Redis, and clears the Vector index.
 * Migrations run automatically on first Trigger.dev task init.
 *
 * Usage: bun run nuclear-reset
 */

import * as readline from "node:readline"
import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"
import { Redis } from "@upstash/redis"
import { Index } from "@upstash/vector"

config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const VECTOR_URL = process.env.UPSTASH_VECTOR_REST_URL
const VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN

if (!DATABASE_URL || !REDIS_URL || !REDIS_TOKEN || !VECTOR_URL || !VECTOR_TOKEN) {
	console.error("Missing required env vars. Check .env.local")
	process.exit(1)
}

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

	const sql = neon(DATABASE_URL)
	console.log("[1/3] Dropping Postgres schemas...")
	await sql`DROP SCHEMA IF EXISTS public CASCADE`
	await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`
	await sql`CREATE SCHEMA public`
	console.log("      Postgres cleared")

	const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
	console.log("[2/3] Flushing Redis...")
	await redis.flushdb()
	console.log("      Redis flushed")

	const vectorIndex = new Index({ url: VECTOR_URL, token: VECTOR_TOKEN })
	console.log("[3/3] Resetting Vector index...")
	await vectorIndex.reset({ all: true })
	console.log("      Vector index cleared")

	console.log("\nDone! Migrations run automatically on first Trigger.dev task init.\n")
}

resetAll().catch((err) => {
	console.error("Reset failed:", err)
	process.exit(1)
})
