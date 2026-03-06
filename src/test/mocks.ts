import { vi } from "vitest"

export function mockRedis() {
  const redisMock = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incrbyfloat: vi.fn().mockResolvedValue("0"),
    expire: vi.fn().mockResolvedValue(1),
    lpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    eval: vi.fn().mockResolvedValue(null)
  }
  return redisMock
}

export function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

export function mockTime(iso = "2026-03-06T12:00:00Z") {
  return {
    nowISO: vi.fn().mockReturnValue(iso),
    nowLocal: vi.fn().mockReturnValue(new Date(iso)),
    elapsedMinutesSince: vi.fn().mockReturnValue(0)
  }
}

export function mockSentry() {
  return {
    captureError: vi.fn(),
    addBreadcrumb: vi.fn(),
    setTickContext: vi.fn(),
    setEmotionContext: vi.fn(),
    setupSentry: vi.fn()
  }
}

export function mockWorkingMemory() {
  return {
    getRecentResponses: vi.fn().mockResolvedValue([]),
    getRecentActions: vi.fn().mockResolvedValue([]),
    getRecentTickDurations: vi.fn().mockResolvedValue([]),
    getCurrentEmotion: vi.fn().mockResolvedValue(null),
    setCurrentEmotion: vi.fn().mockResolvedValue(undefined)
  }
}
