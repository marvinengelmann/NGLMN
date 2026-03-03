import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { fetchLibraryDocs } from "@/integrations/context7.ts"
import {
  createBranch,
  createOrUpdateFile,
  deleteBranch,
  getFileContent,
  getRef,
  getRepoTree,
  mergeBranch
} from "@/integrations/github.ts"
import { validateInSandbox } from "@/integrations/sandbox.ts"
import { log } from "@/lib/logger.ts"
import { estimateTokens } from "@/lib/math.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { nowFilename } from "@/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getNextEvolutionNumber } from "@/memory/working.ts"
import { CODE_EVOLUTION_SYSTEM_PROMPT, FILE_SELECTION_SYSTEM_PROMPT } from "@/prompts/evolution.ts"
import { validateEvolution } from "@/security/guardian.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"
import type { CodeProposal, PreviousAttempt } from "./types.ts"

const SOURCE_CONTEXT_TOKEN_BUDGET = 50_000
const PROPOSAL_MAX_TOKENS = 50_000
const MAX_RELEVANT_FILES = 15
const MAX_REQUEST_ROUNDS = 10
const FILES_PER_REQUEST = 10
const FACTORIES_PATH = "src/test/factories.ts"

export const FileSelectionOutput = z.object({
  paths: z.array(z.string()).max(MAX_RELEVANT_FILES)
})
export type FileSelectionOutput = z.infer<typeof FileSelectionOutput>

export const CodeProposalOutput = z.object({
  type: z.literal("proposal").default("proposal"),
  shouldEvolve: z.boolean(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      description: z.string()
    })
  ),
  commitSubject: z.string(),
  commitBody: z.string(),
  testExpectations: z.array(z.string()),
  reasoning: z.string()
})
export type CodeProposalOutput = z.infer<typeof CodeProposalOutput>

export const FileRequestOutput = z.object({
  type: z.literal("request_files"),
  paths: z.array(z.string()).max(FILES_PER_REQUEST),
  reason: z.string()
})
export type FileRequestOutput = z.infer<typeof FileRequestOutput>

export const CodeProposalOrFileRequest = z.object({
  type: z.enum(["proposal", "request_files"]),
  shouldEvolve: z.boolean().optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        description: z.string()
      })
    )
    .optional(),
  commitSubject: z.string().optional(),
  commitBody: z.string().optional(),
  testExpectations: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  paths: z.array(z.string()).max(FILES_PER_REQUEST).optional(),
  reason: z.string().optional()
})

interface SourceFileContext {
  path: string
  content: string
  truncated: boolean
}

/**
 * Derive the test file path for a given source file.
 */
function testPathFor(filePath: string): string | null {
  if (filePath.endsWith(".test.ts") || !filePath.endsWith(".ts")) return null
  return filePath.replace(/\.ts$/, ".test.ts")
}

/**
 * Expand file list with associated test files and factories.
 */
export function expandWithTestFiles(paths: string[], tree: string[]): string[] {
  const expanded = new Set(paths)

  for (const p of paths) {
    const testPath = testPathFor(p)
    if (testPath && tree.includes(testPath)) {
      expanded.add(testPath)
    }
  }

  if (tree.includes(FACTORIES_PATH)) {
    expanded.add(FACTORIES_PATH)
  }

  return [...expanded]
}

/**
 * Load file contents within a token budget.
 */
export async function loadFileContents(
  paths: string[],
  tokenBudget: number,
  existing?: SourceFileContext[]
): Promise<SourceFileContext[]> {
  const alreadyLoaded = new Set(existing?.map((f) => f.path) ?? [])
  const sourceFiles: SourceFileContext[] = [...(existing ?? [])]
  let tokensUsed = sourceFiles.reduce((sum, f) => sum + estimateTokens(f.content), 0)

  for (const path of paths) {
    if (alreadyLoaded.has(path)) continue
    if (tokensUsed >= tokenBudget) break

    try {
      const { content } = await getFileContent(path)
      const fileTokens = estimateTokens(content)
      const remainingBudget = tokenBudget - tokensUsed

      if (fileTokens <= remainingBudget) {
        sourceFiles.push({ path, content, truncated: false })
        tokensUsed += fileTokens
      } else {
        const charLimit = remainingBudget * 4
        sourceFiles.push({
          path,
          content: `${content.slice(0, charLimit)}\n// ... truncated ...`,
          truncated: true
        })
        tokensUsed = tokenBudget
      }
    } catch (e) {
      log.warn("Failed to read source file for evolution context", { path, error: String(e) })
    }
  }

  const truncatedCount = sourceFiles.filter((f) => f.truncated).length
  log.debug("Source files loaded", {
    filesLoaded: sourceFiles.length - (existing?.length ?? 0),
    totalFiles: sourceFiles.length,
    tokensUsed,
    truncatedCount
  })

  return sourceFiles
}

/**
 * Use LLM to select relevant files from the repo tree, then load their contents within a token budget.
 * Automatically includes associated test files and factories.ts.
 */
export async function selectRelevantFiles(insight: string, capabilityGap: string): Promise<SourceFileContext[]> {
  const tree = await getRepoTree()

  const treeListing = tree.join("\n")

  const selectionResult = await callIntelligence({
    system: FILE_SELECTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify({
      insight,
      capabilityGap,
      files: treeListing
    }),
    schema: FileSelectionOutput,
    maxTokens: 512
  })

  if (selectionResult.isErr()) {
    log.warn("Failed to select relevant files", { error: selectionResult.error.message })
    return []
  }

  const selectedPaths = selectionResult.value.paths
  const validPaths = selectedPaths.filter((p) => tree.includes(p)).slice(0, MAX_RELEVANT_FILES)
  const expandedPaths = expandWithTestFiles(validPaths, tree)
  log.info("Files selected for evolution", {
    selectedByLLM: selectedPaths.length,
    validInTree: validPaths.length,
    afterExpansion: expandedPaths.length
  })

  return loadFileContents(expandedPaths, SOURCE_CONTEXT_TOKEN_BUDGET)
}

interface ProposalContext {
  insight: string
  capabilityGap: string
  tree: string[]
  libraryDocs: string
  previousAttempt?: PreviousAttempt
}

function formatSourceContext(files: SourceFileContext[]): string {
  if (files.length === 0) return "No source files could be loaded."
  return files.map((f) => `--- ${f.path}${f.truncated ? " (truncated)" : ""} ---\n${f.content}`).join("\n\n")
}

function emptyProposal(reasoning: string): CodeProposal {
  return {
    shouldEvolve: false,
    files: [],
    commitSubject: "",
    commitBody: "",
    testExpectations: [],
    reasoning,
    autonomous: false
  }
}

function failedProposal(reasoning: string): z.infer<typeof CodeProposalOrFileRequest> & { failed: true } {
  return {
    type: "proposal" as const,
    shouldEvolve: false,
    failed: true,
    files: [],
    commitSubject: "",
    commitBody: "",
    testExpectations: [],
    reasoning
  }
}

async function resolveFileRequests(
  ctx: ProposalContext,
  files: SourceFileContext[],
  round: number,
  failedPaths: Set<string> = new Set()
): Promise<z.infer<typeof CodeProposalOrFileRequest> & { failed?: boolean }> {
  const tokensUsed = files.reduce((sum, f) => sum + estimateTokens(f.content), 0)
  const budgetExhausted = tokensUsed >= SOURCE_CONTEXT_TOKEN_BUDGET
  const forceProposal = budgetExhausted || round >= MAX_REQUEST_ROUNDS

  const userPayload: Record<string, unknown> = {
    insight: ctx.insight,
    capabilityGap: ctx.capabilityGap,
    sourceContext: formatSourceContext(files),
    availableFiles: ctx.tree.join("\n"),
    remainingTokenBudget: Math.max(0, SOURCE_CONTEXT_TOKEN_BUDGET - tokensUsed)
  }

  if (failedPaths.size > 0) userPayload.unavailablePaths = [...failedPaths]
  if (ctx.libraryDocs) userPayload.libraryDocumentation = ctx.libraryDocs
  if (ctx.previousAttempt) {
    userPayload.previousAttemptFailed = {
      error: ctx.previousAttempt.error,
      stderr: ctx.previousAttempt.sandboxStderr.slice(0, 3000)
    }
  }

  if (forceProposal) {
    const result = await callIntelligence({
      system: CODE_EVOLUTION_SYSTEM_PROMPT,
      userMessage: JSON.stringify(userPayload),
      schema: CodeProposalOutput,
      maxTokens: PROPOSAL_MAX_TOKENS
    })

    if (result.isErr()) return failedProposal(result.error.message)
    return result.value
  }

  const result = await callIntelligence({
    system: CODE_EVOLUTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify(userPayload),
    schema: CodeProposalOrFileRequest,
    maxTokens: PROPOSAL_MAX_TOKENS
  })

  if (result.isErr()) return failedProposal(result.error.message)

  const response = result.value

  if (response.type !== "request_files") return response

  const requestedPaths = response.paths ?? []
  const validPaths = requestedPaths.filter((p) => ctx.tree.includes(p))
  const expandedPaths = expandWithTestFiles(validPaths, ctx.tree)

  const newFailedPaths = new Set(failedPaths)
  for (const p of requestedPaths) {
    if (!ctx.tree.includes(p)) newFailedPaths.add(p)
  }

  log.info("Evolution LLM requested additional files", {
    round,
    requested: requestedPaths.length,
    validInTree: validPaths.length,
    reason: response.reason
  })

  const expandedFiles = await loadFileContents(expandedPaths, SOURCE_CONTEXT_TOKEN_BUDGET, files)

  if (expandedFiles.length === files.length) {
    log.warn("File request round yielded no new files, forcing proposal", { round })
    return resolveFileRequests(ctx, files, MAX_REQUEST_ROUNDS, newFailedPaths)
  }

  return resolveFileRequests(ctx, expandedFiles, round + 1, newFailedPaths)
}

export async function proposeCodeChange(
  insight: string,
  capabilityGap: string,
  previousAttempt?: PreviousAttempt
): Promise<CodeProposal> {
  const [trust, sourceFiles, tree] = await Promise.all([
    canActAutonomously("code_modification"),
    selectRelevantFiles(insight, capabilityGap),
    getRepoTree()
  ])

  log.info("Code proposal context assembled", {
    autonomous: trust.canAct,
    sourceFileCount: sourceFiles.length,
    treeSize: tree.length,
    isRetry: !!previousAttempt
  })

  const allSourceCode = sourceFiles.map((f) => f.content).join("\n")
  const libraryDocs = await fetchLibraryDocs(allSourceCode, capabilityGap).catch(() => "")

  const ctx: ProposalContext = { insight, capabilityGap, tree, libraryDocs, previousAttempt }
  const response = await resolveFileRequests(ctx, sourceFiles, 0)

  if (response.type === "request_files")
    return { ...emptyProposal("Exhausted file request rounds without producing a proposal"), failed: true }

  return {
    shouldEvolve: response.shouldEvolve ?? false,
    files: response.files ?? [],
    commitSubject: response.commitSubject ?? "",
    commitBody: response.commitBody ?? "",
    testExpectations: response.testExpectations ?? [],
    reasoning: response.reasoning ?? "",
    autonomous: trust.canAct,
    failed: response.failed
  }
}

export async function executeCodeEvolution(proposal: CodeProposal): Promise<{
  success: boolean
  error?: string
  sandboxStderr?: string
}> {
  const guardianResult = validateEvolution(proposal.files)
  if (guardianResult.verdict === "blocked") {
    log.warn("Guardian blocked code evolution", {
      reasons: guardianResult.reasons,
      fileCount: proposal.files.length,
      commitSubject: proposal.commitSubject
    })
    ;(await recordFailure("code_modification")).mapErr(logAndCaptureError)
    return { success: false, error: `Guardian blocked: ${guardianResult.reasons.join(", ")}` }
  }

  const evolutionNumber = await getNextEvolutionNumber()
  const timestamp = nowFilename()
  const branchName = `evolution/${timestamp}`
  const commitPrefix = `Evolution #${evolutionNumber}`

  try {
    const { sha: masterSha } = await getRef("heads/master")
    await createBranch(branchName, masterSha)
    log.info("Evolution branch created", { branchName, evolutionNumber, commitSubject: proposal.commitSubject })

    const existingShas = new Map<string, string>()
    await Promise.all(
      proposal.files.map(async (file) => {
        try {
          const existing = await getFileContent(file.path)
          existingShas.set(file.path, existing.sha)
        } catch {
          void 0
        }
      })
    )

    for (const file of proposal.files) {
      await createOrUpdateFile(
        file.path,
        file.content,
        `${commitPrefix}: ${file.description}`,
        branchName,
        existingShas.get(file.path)
      )
    }
    log.info("Evolution files pushed", { branchName, fileCount: proposal.files.length })

    log.info("Starting sandbox validation", { branchName })
    const sandboxResult = await validateInSandbox(branchName)

    if (sandboxResult.passed) {
      await mergeBranch(branchName)
      log.info("Evolution merged", { branchName, commitSubject: proposal.commitSubject })
      ;(await recordSuccess("code_modification")).mapErr(logAndCaptureError)
      ;(await writeChangelogEntry("code", `${commitPrefix}: ${proposal.commitSubject}`, "success")).mapErr(
        logAndCaptureError
      )
      await storeEpisode(`${commitPrefix}: ${proposal.commitSubject}\n${proposal.commitBody}`, "evolution", {
        relevanceScore: 0.95
      })

      return { success: true }
    } else {
      log.warn("Sandbox validation failed", {
        branchName,
        commitSubject: proposal.commitSubject,
        biome: sandboxResult.biomeCheckPassed,
        tsc: sandboxResult.tscCheckPassed,
        testsPassed: sandboxResult.testsPassed,
        testsFailed: sandboxResult.testsFailed,
        stderr: sandboxResult.stderr.slice(0, 500)
      })
      await deleteBranch(branchName)
      ;(await recordFailure("code_modification")).mapErr(logAndCaptureError)
      ;(
        await writeChangelogEntry(
          "code",
          `Failed ${commitPrefix}: ${proposal.commitSubject} — ${sandboxResult.stderr.slice(0, 200)}`,
          "failure"
        )
      ).mapErr(logAndCaptureError)
      await storeEpisode(
        `Failed ${commitPrefix}: ${proposal.commitSubject}. Error: ${sandboxResult.stderr.slice(0, 500)}`,
        "evolution",
        { relevanceScore: 0.85 }
      )

      return { success: false, error: `Sandbox validation failed`, sandboxStderr: sandboxResult.stderr }
    }
  } catch (error) {
    log.error("Code evolution failed unexpectedly", {
      branchName,
      commitSubject: proposal.commitSubject,
      error: error instanceof Error ? error.message : String(error)
    })
    try {
      await deleteBranch(branchName)
    } catch (e) {
      log.warn("Failed to clean up evolution branch", { branchName, error: String(e) })
    }

    ;(await recordFailure("code_modification")).mapErr(logAndCaptureError)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMsg }
  }
}
