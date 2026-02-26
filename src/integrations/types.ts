import * as z from "zod"

export const AlertLevel = z.enum(["info", "warning", "critical", "intervention"])
export type AlertLevel = z.infer<typeof AlertLevel>

export const PendingMessage = z.object({
  updateId: z.number(),
  chatId: z.number(),
  from: z.string().max(256),
  text: z.string().max(10_000),
  date: z.number(),
  messageId: z.number().optional(),
  replyToText: z.string().max(10_000).optional()
})
export type PendingMessage = z.infer<typeof PendingMessage>

export const PendingEmail = z.object({
  emailId: z.string(),
  from: z.string().max(256),
  to: z.array(z.string().max(256)),
  subject: z.string().max(998),
  text: z.string().max(50_000),
  receivedAt: z.string()
})
export type PendingEmail = z.infer<typeof PendingEmail>

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
