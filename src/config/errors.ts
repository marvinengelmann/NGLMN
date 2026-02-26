export type AnimaErrorTag =
  | "REDIS_ERROR"
  | "DB_ERROR"
  | "ANTHROPIC_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "GUARDIAN_BLOCKED"
  | "TRUST_BLOCKED"
  | "WORKFLOW_ERROR"
  | "TELEGRAM_ERROR"
  | "EMAIL_ERROR"
  | "VECTOR_ERROR"
  | "PERCEPTION_ERROR"
  | "EMOTION_ERROR"
  | "MEMORY_ERROR"
  | "X_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR"

export interface AnimaError {
  tag: AnimaErrorTag
  message: string
  cause?: unknown
}

export function animaError(tag: AnimaErrorTag, message: string, cause?: unknown): AnimaError {
  return { tag, message, cause }
}

export function fromCatch(tag: AnimaErrorTag, e: unknown): AnimaError {
  if (e instanceof Error) {
    return { tag, message: e.message, cause: e }
  }
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return { tag, message: (e as { message: string }).message, cause: e }
  }
  return { tag, message: String(e), cause: e }
}
