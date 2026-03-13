import type { Sandbox } from "@daytonaio/sdk"
import { Daytona, Image } from "@daytonaio/sdk"
import { env } from "@/infra/config/env.ts"
import type { SandboxResult } from "@/infra/integrations/types.ts"
import { log } from "@/infra/lib/logger.ts"
import { extractErrorMessage } from "@/infra/lib/result.ts"

const SANDBOX_IMAGE = Image.base("ubuntu:22.04")
  .runCommands("apt-get update && apt-get install -y git curl unzip")
  .runCommands("curl -fsSL https://bun.sh/install | bash")
  .runCommands("ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && ln -sf $HOME/.bun/bin/bunx /usr/local/bin/bunx")

const daytona = new Daytona()

export async function createSandbox(): Promise<Sandbox> {
  return daytona.create(
    {
      image: SANDBOX_IMAGE,
      resources: { cpu: 2, memory: 4 },
      autoStopInterval: 0,
      autoDeleteInterval: 0
    },
    { timeout: 300 }
  )
}

interface RunInSandboxOptions {
  sandbox: Sandbox
  command: string
  cwd?: string
  timeoutSec?: number
}

export async function runInSandbox({
  sandbox,
  command,
  cwd,
  timeoutSec = 120
}: RunInSandboxOptions): Promise<{ result: string; exitCode: number }> {
  const response = await sandbox.process.executeCommand(command, cwd, undefined, timeoutSec)
  return { result: response.result, exitCode: response.exitCode }
}

export async function destroySandbox(sandbox: Sandbox): Promise<void> {
  await sandbox.delete()
}

function sanitizeBranchName(branch: string): string {
  if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
    throw new Error(`Invalid branch name: ${branch}`)
  }
  return branch
}

export async function validateInSandbox(branch: string): Promise<SandboxResult> {
  const safeBranch = sanitizeBranchName(branch)
  const repoUrl = `https://github.com/${env().GITHUB_OWNER}/${env().GITHUB_REPO}.git`
  const appDir = "/app/anima"
  const start = Date.now()
  let sandbox: Sandbox | null = null

  try {
    sandbox = await createSandbox()
    log.info("Sandbox created", { branch: safeBranch })

    await runInSandbox({
      sandbox,
      command: `mkdir -p /app && git clone --branch '${safeBranch}' --single-branch '${repoUrl}' '${appDir}'`,
      timeoutSec: 60
    })

    await runInSandbox({ sandbox, command: "bun install", cwd: appDir })
    log.info("Sandbox setup complete", { branch })

    const biomeResult = await runInSandbox({ sandbox, command: "bunx biome check src/ 2>&1", cwd: appDir })
    const biomeCheckPassed = biomeResult.exitCode === 0

    if (!biomeCheckPassed) {
      log.warn("Sandbox biome check failed", {
        branch,
        durationMs: Date.now() - start,
        stdout: biomeResult.result.slice(-2000)
      })
      return {
        passed: false,
        biomeCheckPassed: false,
        tscCheckPassed: false,
        testsPassed: 0,
        testsFailed: 0,
        healthCheckPassed: false,
        stdout: biomeResult.result.slice(-5000),
        stderr: biomeResult.result.slice(-2000),
        durationMs: Date.now() - start
      }
    }

    const tscResult = await runInSandbox({ sandbox, command: "bunx tsc --noEmit 2>&1", cwd: appDir })
    const tscCheckPassed = tscResult.exitCode === 0

    if (!tscCheckPassed) {
      log.warn("Sandbox tsc check failed", {
        branch,
        durationMs: Date.now() - start,
        stdout: tscResult.result.slice(-2000)
      })
      return {
        passed: false,
        biomeCheckPassed: true,
        tscCheckPassed: false,
        testsPassed: 0,
        testsFailed: 0,
        healthCheckPassed: false,
        stdout: tscResult.result.slice(-5000),
        stderr: tscResult.result.slice(-2000),
        durationMs: Date.now() - start
      }
    }

    const testResult = await runInSandbox({ sandbox, command: "bun run test:run 2>&1", cwd: appDir, timeoutSec: 180 })

    const passMatch = testResult.result.match(/Tests\s+(\d+) passed/)
    const failMatch = testResult.result.match(/(\d+) failed/)
    const testsPassed = passMatch?.[1] ? parseInt(passMatch[1], 10) : 0
    const testsFailed = failMatch?.[1] ? parseInt(failMatch[1], 10) : 0
    const passed = testResult.exitCode === 0 && testsFailed === 0
    log.info("Sandbox validation complete", {
      branch,
      passed,
      testsPassed,
      testsFailed,
      durationMs: Date.now() - start
    })

    return {
      passed,
      biomeCheckPassed: true,
      tscCheckPassed: true,
      testsPassed,
      testsFailed,
      healthCheckPassed: passed,
      stdout: testResult.result.slice(-5000),
      stderr: "",
      durationMs: Date.now() - start
    }
  } catch (error) {
    log.error("Sandbox validation crashed", {
      branch,
      error: extractErrorMessage(error),
      durationMs: Date.now() - start
    })
    return {
      passed: false,
      biomeCheckPassed: false,
      tscCheckPassed: false,
      testsPassed: 0,
      testsFailed: 0,
      healthCheckPassed: false,
      stdout: "",
      stderr: extractErrorMessage(error),
      durationMs: Date.now() - start
    }
  } finally {
    if (sandbox) {
      await destroySandbox(sandbox)
        .then(() => log.debug("Sandbox destroyed", { branch }))
        .catch((e) => {
          log.error("Failed to destroy sandbox", { branch, error: extractErrorMessage(e) })
        })
    }
  }
}
