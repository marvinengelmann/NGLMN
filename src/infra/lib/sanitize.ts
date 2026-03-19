const NON_STANDARD_ESCAPE_RE = /\\x[0-9a-fA-F]{0,2}/g

/**
 * Strip non-standard \x escape sequences that xAI's JSON parser
 * misinterprets as hex escapes (standard JSON only supports \uXXXX).
 * Removes the backslash entirely — "\\x1b" becomes "x1b".
 */
export function sanitizeForXai(text: string): string {
  return text.replace(NON_STANDARD_ESCAPE_RE, (match) => match.slice(1))
}
