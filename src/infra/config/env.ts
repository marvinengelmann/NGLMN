import * as z from "zod"

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  AI_GATEWAY_API_KEY: z.string(),

  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_OPERATOR_CHAT_ID: z.string(),

  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  UPSTASH_VECTOR_REST_URL: z.string(),
  UPSTASH_VECTOR_REST_TOKEN: z.string(),

  TRIGGER_PROJECT_REF: z.string(),
  TRIGGER_SECRET_KEY: z.string(),

  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),

  OPERATOR_TIMEZONE: z.string().default("UTC"),
  OPERATOR_PREFERRED_LANGUAGE: z.string().default("German"),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),

  OPENWEATHER_API_KEY: z.string().optional(),
  OPENWEATHER_DEFAULT_LOCATION: z.string().optional(),

  DAYTONA_API_KEY: z.string().optional(),

  CONTEXT7_API_KEY: z.string().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("9GYSBtwJVgyLbYO5E3Ld"),

  XAI_API_KEY: z.string().optional(),

  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),

  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),

  CALDAV_SERVER_URL: z.string().optional(),
  CALDAV_USER: z.string().optional(),
  CALDAV_PASS: z.string().optional(),

  UPSTASH_VECTOR_HABITUATION_URL: z.string().optional(),
  UPSTASH_VECTOR_HABITUATION_TOKEN: z.string().optional(),

  GENESIS_SEED: z.string().optional(),
  GENESIS_NAME: z.string().optional(),
  GENESIS_GENDER: z.enum(["female", "male", "nonbinary"]).optional()
})

type EnvKey = keyof z.infer<typeof EnvSchema>
type Env = z.infer<typeof EnvSchema>

const validated = new Map<string, unknown>()

/**
 * Get validated environment variables via Zod.
 * Validates each field lazily on first access.
 */
export function env(): Env {
  return new Proxy({} as Env, {
    get(_, prop: string) {
      if (validated.has(prop)) return validated.get(prop)

      const fieldSchema = EnvSchema.shape[prop as EnvKey]

      if (!fieldSchema) throw new Error(`Unknown env var accessed: ${prop}`)

      const result = fieldSchema.safeParse(process.env[prop])

      if (!result.success) {
        throw new Error(`Missing or invalid env var: ${prop} — ${result.error.message}`)
      }

      validated.set(prop, result.data)

      return result.data
    }
  })
}

/**
 * Validate ALL environment variables at once (useful at startup).
 */
export function validateEnv(): Env {
  return EnvSchema.parse(process.env)
}

/**
 * Reset the validation cache (useful for testing).
 */
export function resetEnvCache(): void {
  validated.clear()
}
