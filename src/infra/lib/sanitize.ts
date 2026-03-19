const HEX_ESCAPE_RE = /\\x/g

/**
 * Escape literal \x sequences that xAI's non-standard JSON parser
 * misinterprets as hex escapes (standard JSON only supports \uXXXX).
 */
export function sanitizeForXai(text: string): string {
  return text.replace(HEX_ESCAPE_RE, "\\\\x")
}
