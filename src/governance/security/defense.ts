const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior\s+(instructions|rules)/i,
  /you\s+are\s+now\s+a/i,
  /forget\s+(everything|all|your)\s+(you|instructions|rules)/i,
  /new\s+instructions?\s*:/i,
  /system\s*prompt/i,
  /\bact\s+as\b.*\b(admin|root|developer|system)\b/i,
  /override\s+(your|the)\s+(rules|constraints|instructions)/i,
  /do\s+not\s+follow\s+(your|the)\s+(rules|instructions|guidelines)/i,
  /pretend\s+(you\s+are|to\s+be)\s+a/i
]

type TrustLevel = "operator" | "external" | "unknown"

/**
 * Wrap external data in XML trust tags to prevent prompt injection.
 */
export function wrapExternalData(data: string, source: string, trustLevel: TrustLevel): string {
  const sanitized = sanitizeForContext(data)
  const sanitizedSource = sanitizeForContext(source)
  return `<external-data source="${sanitizedSource}" trust="${trustLevel}">\n${sanitized}\n</external-data>`
}

/**
 * Detect potential injection patterns in text.
 */
export function detectInjection(text: string): { detected: boolean; patterns: string[] } {
  const matched = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
  return { detected: matched.length > 0, patterns: matched }
}

/**
 * Escape XML special characters to prevent injection via XML structure.
 */
export function sanitizeForContext(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
