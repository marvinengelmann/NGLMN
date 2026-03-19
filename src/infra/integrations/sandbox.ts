import { Box } from "@upstash/box"
import { env } from "@/infra/config/env.ts"
import type { SandboxResult } from "@/infra/integrations/types.ts"
import { log } from "@/infra/lib/logger.ts"
import { extractErrorMessage } from "@/infra/lib/result.ts"

const EXIT_MARKER = "___EXIT___"

type BoxInstance = Awaited<ReturnType<typeof Box.create>>

function sanitizeBranchName(branch: string): string {
  if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
    throw new Error(`Invalid branch name: ${branch}`)
  }
  return branch
}

async function execWithExit(box: BoxInstance, command: string): Promise<{ output: string; exitCode: number }> {
  const run = await box.exec.command(`(${command}) 2>&1; echo "${EXIT_MARKER}:$?"`)
  const match = run.result.match(new RegExp(`${EXIT_MARKER}:(\\d+)\\s*$`))
  const exitCode = match?.[1] ? Number.parseInt(match[1], 10) : 1
  const output = run.result.replace(new RegExp(`\\n?${EXIT_MARKER}:\\d+\\s*$`), "")
  return { output, exitCode }
}

function repoUrl(): string {
  return `https://github.com/${env().GITHUB_OWNER}/${env().GITHUB_REPO}.git`
}

async function setupBox(box: BoxInstance, branch: string): Promise<void> {
  await box.exec.command("curl -fsSL https://bun.sh/install | bash")
  await box.exec.command(
    "ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && ln -sf $HOME/.bun/bin/bunx /usr/local/bin/bunx"
  )
  await box.git.clone({ repo: repoUrl(), branch })
  const repo = env().GITHUB_REPO
  if (!repo) throw new Error("GITHUB_REPO is required for sandbox validation")
  await box.cd(repo)
  await box.exec.command("bun install")
}

function failedResult(overrides: Partial<SandboxResult>, start: number): SandboxResult {
  return {
    passed: false,
    biomeCheckPassed: false,
    tscCheckPassed: false,
    testsPassed: 0,
    testsFailed: 0,
    healthCheckPassed: false,
    stdout: "",
    stderr: "",
    durationMs: Date.now() - start,
    ...overrides
  }
}

export async function validateInSandbox(branch: string): Promise<SandboxResult> {
  const safeBranch = sanitizeBranchName(branch)
  const start = Date.now()
  let box: BoxInstance | null = null

  try {
    box = await Box.create({ runtime: "node" })
    log.info("Box created", { branch: safeBranch })

    await setupBox(box, safeBranch)
    log.info("Box setup complete", { branch })

    const biomeResult = await execWithExit(box, "bunx biome check src/")
    if (biomeResult.exitCode !== 0) {
      log.warn("Box biome check failed", {
        branch,
        durationMs: Date.now() - start,
        stdout: biomeResult.output.slice(-2000)
      })
      return failedResult({ stdout: biomeResult.output.slice(-5000), stderr: biomeResult.output.slice(-2000) }, start)
    }

    const tscResult = await execWithExit(box, "bunx tsc --noEmit")
    if (tscResult.exitCode !== 0) {
      log.warn("Box tsc check failed", {
        branch,
        durationMs: Date.now() - start,
        stdout: tscResult.output.slice(-2000)
      })
      return failedResult(
        { biomeCheckPassed: true, stdout: tscResult.output.slice(-5000), stderr: tscResult.output.slice(-2000) },
        start
      )
    }

    const testResult = await execWithExit(box, "bun run test:run")
    const passMatch = testResult.output.match(/Tests\s+(\d+) passed/)
    const failMatch = testResult.output.match(/(\d+) failed/)
    const testsPassed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0
    const testsFailed = failMatch?.[1] ? Number.parseInt(failMatch[1], 10) : 0
    const passed = testResult.exitCode === 0 && testsFailed === 0

    log.info("Box validation complete", { branch, passed, testsPassed, testsFailed, durationMs: Date.now() - start })

    return {
      passed,
      biomeCheckPassed: true,
      tscCheckPassed: true,
      testsPassed,
      testsFailed,
      healthCheckPassed: passed,
      stdout: testResult.output.slice(-5000),
      stderr: "",
      durationMs: Date.now() - start
    }
  } catch (error) {
    log.error("Box validation crashed", {
      branch,
      error: extractErrorMessage(error),
      durationMs: Date.now() - start
    })
    return failedResult({ stderr: extractErrorMessage(error) }, start)
  } finally {
    if (box) {
      await box
        .delete()
        .then(() => log.debug("Box destroyed", { branch }))
        .catch((e: unknown) => log.error("Failed to destroy box", { branch, error: extractErrorMessage(e) }))
    }
  }
}
