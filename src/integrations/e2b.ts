import { Sandbox } from "e2b"
import * as z from "zod"
import { log } from "@/lib/logger.ts"

export const SandboxResult = z.object({
  passed: z.boolean(),
  testsPassed: z.number(),
  testsFailed: z.number(),
  healthCheckPassed: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number()
})
export type SandboxResult = z.infer<typeof SandboxResult>

export async function createSandbox(templateId?: string): Promise<Sandbox> {
  const template = templateId ?? process.env.E2B_TEMPLATE_ID ?? "base"
  return Sandbox.create(template, { timeoutMs: 5 * 60 * 1000 })
}

export async function runInSandbox(
  sandbox: Sandbox,
  cmd: string,
  timeoutMs: number = 120_000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await sandbox.commands.run(cmd, { timeoutMs })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode
  }
}

export async function destroySandbox(sandbox: Sandbox): Promise<void> {
  await sandbox.kill()
}

export async function validateInSandbox(branch: string): Promise<SandboxResult> {
  const repoUrl = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`
  const start = Date.now()
  let sandbox: Sandbox | null = null

  try {
    sandbox = await createSandbox()

    await runInSandbox(sandbox, `git clone --branch ${branch} --single-branch ${repoUrl} /app/anima`, 60_000)

    await runInSandbox(sandbox, "cd /app/anima && bun install", 120_000)

    const testResult = await runInSandbox(sandbox, "cd /app/anima && bun run test:run 2>&1", 180_000)

    const passMatch = testResult.stdout.match(/Tests\s+(\d+) passed/)
    const failMatch = testResult.stdout.match(/(\d+) failed/)
    const testsPassed = passMatch?.[1] ? parseInt(passMatch[1], 10) : 0
    const testsFailed = failMatch?.[1] ? parseInt(failMatch[1], 10) : 0
    const passed = testResult.exitCode === 0 && testsFailed === 0

    return {
      passed,
      testsPassed,
      testsFailed,
      healthCheckPassed: passed,
      stdout: testResult.stdout.slice(-5000),
      stderr: testResult.stderr.slice(-2000),
      durationMs: Date.now() - start
    }
  } catch (error) {
    return {
      passed: false,
      testsPassed: 0,
      testsFailed: 0,
      healthCheckPassed: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start
    }
  } finally {
    if (sandbox) {
      await destroySandbox(sandbox).catch((e) => {
        log.error("Failed to destroy sandbox", { error: e instanceof Error ? e.message : String(e) })
      })
    }
  }
}
