vi.mock("e2b", () => {
  const mockSandbox = {
    commands: {
      run: vi.fn()
    },
    kill: vi.fn()
  }
  return {
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockSandbox)
    }
  }
})

import { Sandbox } from "e2b"
import { createSandbox, destroySandbox, runInSandbox, validateInSandbox } from "./e2b.ts"

const mockSandboxInstance = {
  commands: { run: vi.fn() },
  kill: vi.fn()
}

beforeEach(() => {
  ;(Sandbox.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSandboxInstance)
  mockSandboxInstance.commands.run.mockReset()
  mockSandboxInstance.kill.mockReset().mockResolvedValue(undefined)
  process.env.E2B_TEMPLATE_ID = "test-template"
  process.env.GITHUB_OWNER = "test-owner"
  process.env.GITHUB_REPO = "test-repo"
})

afterEach(() => {
  delete process.env.E2B_TEMPLATE_ID
  delete process.env.GITHUB_OWNER
  delete process.env.GITHUB_REPO
})

describe("createSandbox", () => {
  it("creates sandbox with template from env", async () => {
    await createSandbox()
    expect(Sandbox.create).toHaveBeenCalledWith("test-template", expect.any(Object))
  })

  it("uses custom templateId when provided", async () => {
    await createSandbox("custom-template")
    expect(Sandbox.create).toHaveBeenCalledWith("custom-template", expect.any(Object))
  })
})

describe("runInSandbox", () => {
  it("executes command and returns output", async () => {
    mockSandboxInstance.commands.run.mockResolvedValue({
      stdout: "success",
      stderr: "",
      exitCode: 0
    })

    const result = await runInSandbox(mockSandboxInstance as unknown as Sandbox, "echo hello")
    expect(result.stdout).toBe("success")
    expect(result.exitCode).toBe(0)
  })
})

describe("destroySandbox", () => {
  it("kills the sandbox", async () => {
    await destroySandbox(mockSandboxInstance as unknown as Sandbox)
    expect(mockSandboxInstance.kill).toHaveBeenCalled()
  })
})

describe("validateInSandbox", () => {
  it("returns passed when all tests pass", async () => {
    mockSandboxInstance.commands.run
      .mockResolvedValueOnce({ stdout: "Cloned", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "Installed", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: " Test Files  5 passed (5)\n      Tests  42 passed (42)",
        stderr: "",
        exitCode: 0
      })

    const result = await validateInSandbox("evolution/test-branch")
    expect(result.passed).toBe(true)
    expect(result.testsPassed).toBe(42)
    expect(result.testsFailed).toBe(0)
  })

  it("returns failed when tests fail", async () => {
    mockSandboxInstance.commands.run
      .mockResolvedValueOnce({ stdout: "Cloned", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "Installed", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "      Tests  10 passed | 2 failed",
        stderr: "Error in test",
        exitCode: 1
      })

    const result = await validateInSandbox("evolution/broken-branch")
    expect(result.passed).toBe(false)
    expect(result.testsFailed).toBe(2)
  })

  it("destroys sandbox even on error", async () => {
    mockSandboxInstance.commands.run.mockRejectedValue(new Error("sandbox error"))

    const result = await validateInSandbox("evolution/error-branch")
    expect(result.passed).toBe(false)
    expect(result.stderr).toContain("sandbox error")
    expect(mockSandboxInstance.kill).toHaveBeenCalled()
  })
})
