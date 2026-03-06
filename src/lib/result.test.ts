import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger.ts", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock("@/lib/sentry.ts", () => ({
  captureError: vi.fn()
}))

import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { animaError, fromCatch, logAndCaptureError, trySafe } from "./result.ts"

const mockedLog = vi.mocked(log)
const mockedCaptureError = vi.mocked(captureError)

afterEach(() => {
  vi.clearAllMocks()
})

describe("animaError", () => {
  it("creates an error with tag and message", () => {
    const err = animaError("REDIS_ERROR", "connection failed")
    expect(err.tag).toBe("REDIS_ERROR")
    expect(err.message).toBe("connection failed")
    expect(err.cause).toBeUndefined()
  })

  it("includes cause when provided", () => {
    const cause = new Error("original")
    const err = animaError("DB_ERROR", "query failed", cause)
    expect(err.cause).toBe(cause)
  })
})

describe("fromCatch", () => {
  it("extracts message from Error instances", () => {
    const err = fromCatch("LLM_ERROR", new Error("timeout"))
    expect(err.tag).toBe("LLM_ERROR")
    expect(err.message).toBe("timeout")
    expect(err.cause).toBeInstanceOf(Error)
  })

  it("extracts message from objects with message property", () => {
    const err = fromCatch("PARSE_ERROR", { message: "bad json" })
    expect(err.message).toBe("bad json")
  })

  it("converts primitive values to string", () => {
    const err = fromCatch("UNKNOWN_ERROR", 42)
    expect(err.message).toBe("42")
    expect(err.cause).toBe(42)
  })

  it("handles null cause", () => {
    const err = fromCatch("UNKNOWN_ERROR", null)
    expect(err.message).toBe("null")
  })

  it("handles string cause", () => {
    const err = fromCatch("UNKNOWN_ERROR", "something broke")
    expect(err.message).toBe("something broke")
  })
})

describe("trySafe", () => {
  it("returns ok result for successful operation", async () => {
    const result = await trySafe("LLM_ERROR", async () => "success")
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe("success")
  })

  it("returns err result for thrown error", async () => {
    const result = await trySafe("LLM_ERROR", async () => {
      throw new Error("boom")
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe("LLM_ERROR")
    expect(result._unsafeUnwrapErr().message).toBe("boom")
  })
})

describe("logAndCaptureError", () => {
  it("logs the error and captures in sentry", () => {
    const err = animaError("REDIS_ERROR", "connection lost")
    logAndCaptureError(err)
    expect(mockedLog.error).toHaveBeenCalledWith(
      "[REDIS_ERROR] connection lost",
      expect.objectContaining({ cause: undefined })
    )
    expect(mockedCaptureError).toHaveBeenCalledWith("connection lost", expect.objectContaining({ tag: "REDIS_ERROR" }))
  })

  it("passes cause to sentry when available", () => {
    const cause = new Error("original")
    const err = animaError("DB_ERROR", "failed", cause)
    logAndCaptureError(err)
    expect(mockedCaptureError).toHaveBeenCalledWith(cause, expect.objectContaining({ tag: "DB_ERROR" }))
  })

  it("includes extra context", () => {
    const err = animaError("LLM_ERROR", "timeout")
    logAndCaptureError(err, { model: "claude" })
    expect(mockedLog.error).toHaveBeenCalledWith("[LLM_ERROR] timeout", expect.objectContaining({ model: "claude" }))
    expect(mockedCaptureError).toHaveBeenCalledWith(
      "timeout",
      expect.objectContaining({ model: "claude", tag: "LLM_ERROR" })
    )
  })
})
