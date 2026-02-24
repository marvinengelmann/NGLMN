/**
 * Parse a human-readable interval string (e.g. "30s", "5m", "1h") to milliseconds.
 * Returns 5 minutes as default if the format is invalid.
 */
export function parseIntervalMs(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h)$/)
  if (!match) return 5 * 60 * 1000

  const rawValue = match[1]
  const unit = match[2]
  if (!rawValue || !unit) return 5 * 60 * 1000

  const value = parseInt(rawValue, 10)
  switch (unit) {
    case "s":
      return value * 1000
    case "m":
      return value * 60 * 1000
    case "h":
      return value * 60 * 60 * 1000
    default:
      return 5 * 60 * 1000
  }
}

/**
 * Parse a human-readable interval string to seconds.
 */
export function parseIntervalSeconds(interval: string): number {
  return parseIntervalMs(interval) / 1000
}
