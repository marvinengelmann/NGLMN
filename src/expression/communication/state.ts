import * as z from "zod"
import { HEARTBEAT } from "@/infra/config/constants.ts"
import { getValidatedRedis, getValidatedRedisOr, redis } from "@/infra/integrations/redis.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { CONVERSATION } from "./constants.ts"
import { CommunicationRegister, type ConversationMessage, ConversationSlot } from "./types.ts"

const KEYS = {
  REGISTER: "working:communication:register"
} as const

/**
 * Get the current communication register from Redis.
 */
export async function getCommunicationRegister(): Promise<CommunicationRegister | null> {
  return getValidatedRedis(KEYS.REGISTER, CommunicationRegister)
}

const CONV_KEYS = {
  CONVERSATION_BUFFER: "working:conversation:buffer",
  CONVERSATION_WAITING_SINCE: "working:conversation:waitingSince"
} as const

export async function getConversationBuffer(): Promise<ConversationSlot[]> {
  return getValidatedRedisOr(CONV_KEYS.CONVERSATION_BUFFER, z.array(ConversationSlot), [])
}

async function setConversationBuffer(slots: ConversationSlot[]): Promise<void> {
  await redis.set(CONV_KEYS.CONVERSATION_BUFFER, JSON.stringify(slots), { ex: 86400 })
}

export async function getActiveConversation(): Promise<ConversationSlot | null> {
  const buffer = await getConversationBuffer()
  return buffer.length > 0 ? (buffer[buffer.length - 1] ?? null) : null
}

export async function pushToActiveConversation(messages: ConversationMessage[]): Promise<void> {
  if (messages.length === 0) return
  const buffer = await getConversationBuffer()
  if (buffer.length === 0) {
    const now = nowISO()
    buffer.push({ id: crypto.randomUUID(), messages: [], startedAt: now, lastActivityAt: now })
  }
  const active = buffer[buffer.length - 1]
  if (!active) return
  messages.forEach((message) => {
    active.messages.push(message)
    active.lastActivityAt = message.timestamp
  })
  await setConversationBuffer(buffer)
}

export async function startNewConversation(): Promise<ConversationSlot | null> {
  const buffer = await getConversationBuffer()
  let evicted: ConversationSlot | null = null
  if (buffer.length >= CONVERSATION.MAX_BUFFER_SLOTS) {
    evicted = buffer.shift() ?? null
  }
  const now = nowISO()
  buffer.push({ id: crypto.randomUUID(), messages: [], startedAt: now, lastActivityAt: now })
  await setConversationBuffer(buffer)
  return evicted
}

export async function getConversationWaitingSince(): Promise<string | null> {
  return redis.get<string>(CONV_KEYS.CONVERSATION_WAITING_SINCE)
}

export async function setConversationWaitingSince(isoTimestamp: string): Promise<void> {
  await redis.set(CONV_KEYS.CONVERSATION_WAITING_SINCE, isoTimestamp, { ex: HEARTBEAT.MAX_CONVERSATION_WAIT + 60 })
}

export async function clearConversationWaitingSince(): Promise<void> {
  await redis.del(CONV_KEYS.CONVERSATION_WAITING_SINCE)
}
