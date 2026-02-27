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

  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string(),
  RESEND_OPERATOR_EMAIL: z.string(),

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

  E2B_TEMPLATE_ID: z.string().optional(),

  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_REFRESH_TOKEN: z.string().optional(),

  ANIMA_PERSONALITY_TYPE: z.string().regex(/^[EI][SN][TF][JP](-[AT])?$/)
})

type EnvKey = keyof z.infer<typeof EnvSchema>
export type Env = z.infer<typeof EnvSchema>

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
 * Check if all X (Twitter) OAuth 2.0 env vars are configured.
 */
export function hasXConfig(): boolean {
  return !!(
    process.env.X_CLIENT_ID &&
    process.env.X_CLIENT_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_REFRESH_TOKEN
  )
}

/**
 * Reset the validation cache (useful for testing).
 */
export function resetEnvCache(): void {
  validated.clear()
}
