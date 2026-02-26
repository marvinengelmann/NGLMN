import * as z from "zod"

export const ServiceStatus = z.enum(["ok", "error"])
export type ServiceStatus = z.infer<typeof ServiceStatus>

export const ProcessStatus = z.enum(["ok", "stale", "dead"])
export type ProcessStatus = z.infer<typeof ProcessStatus>

export const OverallStatus = z.enum(["healthy", "degraded", "critical"])
export type OverallStatus = z.infer<typeof OverallStatus>

export const HealthCheckResult = z.object({
  timestamp: z.string(),
  overall: OverallStatus,
  services: z.object({
    redis: ServiceStatus,
    postgres: ServiceStatus,
    telegram: ServiceStatus,
    vector: ServiceStatus,
    resend: ServiceStatus.optional(),
    x: ServiceStatus.optional()
  }),
  process: z.object({
    lastTickRecency: ProcessStatus,
    lastTickAgeSeconds: z.number()
  }),
  budget: z.object({
    consumed: z.number(),
    limit: z.number(),
    compliant: z.boolean()
  }),
  memory: z.object({
    redis: ServiceStatus,
    postgres: ServiceStatus,
    vector: ServiceStatus,
    semantic: z.object({
      status: ServiceStatus,
      entryCount: z.number()
    })
  }),
  errors: z.array(z.string())
})
export type HealthCheckResult = z.infer<typeof HealthCheckResult>

export const ConversationHandlerPayload = z.object({
  triggerReason: z.enum(["new_messages", "follow_up_check"])
})
export type ConversationHandlerPayload = z.infer<typeof ConversationHandlerPayload>
