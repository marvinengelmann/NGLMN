import * as z from "zod"

export const AlertLevel = z.enum(["info", "warning", "critical", "intervention"])
export type AlertLevel = z.infer<typeof AlertLevel>

export const OperatorLocationSource = z.enum(["telegram", "semantic_memory", "env_default"])
export type OperatorLocationSource = z.infer<typeof OperatorLocationSource>

export const OperatorLocation = z.object({
  latitude: z.number(),
  longitude: z.number(),
  cityName: z.string().optional(),
  source: OperatorLocationSource,
  updatedAt: z.string()
})
export type OperatorLocation = z.infer<typeof OperatorLocation>

export const SandboxResult = z.object({
  passed: z.boolean(),
  biomeCheckPassed: z.boolean(),
  tscCheckPassed: z.boolean(),
  testsPassed: z.number(),
  testsFailed: z.number(),
  healthCheckPassed: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number()
})
export type SandboxResult = z.infer<typeof SandboxResult>

export const PendingMessage = z.object({
  updateId: z.number(),
  chatId: z.number(),
  from: z.string().max(256),
  text: z.string().max(10_000),
  date: z.number(),
  messageId: z.number().optional(),
  replyToText: z.string().max(10_000).optional(),
  isVoice: z.boolean().default(false),
  voiceDurationSeconds: z.number().optional(),
  image: z
    .object({
      base64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"])
    })
    .optional()
})
export type PendingMessage = z.infer<typeof PendingMessage>

export const XPost = z.object({
  id: z.string(),
  text: z.string(),
  authorId: z.string(),
  authorName: z.string().optional(),
  authorUsername: z.string().optional(),
  createdAt: z.string(),
  url: z.string(),
  likeCount: z.number().default(0),
  retweetCount: z.number().default(0)
})
export type XPost = z.infer<typeof XPost>

export const WeatherData = z.object({
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  pressure: z.number(),
  windSpeed: z.number(),
  condition: z.string(),
  description: z.string(),
  cloudPercent: z.number(),
  isDay: z.boolean(),
  locationName: z.string().optional(),
  fetchedAt: z.string()
})
export type WeatherData = z.infer<typeof WeatherData>
