import { estimateTokenCount, sliceByTokens } from "tokenx"
import { callIntelligence } from "@/core/intelligence.ts"
import { addEvolutionLesson, getRelevantEvolutionLessons } from "@/governance/evolution/learning.ts"
import { getNextEvolutionNumber } from "@/governance/evolution/state.ts"
import {
  type CodeProposal,
  CodeProposalOrFileRequest,
  CodeProposalOutput,
  FileSelectionOutput,
  type PreviousAttempt
} from "@/governance/evolution/types.ts"
import { validateEvolution } from "@/governance/security/guardian.ts"
import { fetchLibraryDocs } from "@/infra/integrations/context7.ts"
import {
  createBranch,
  createOrUpdateFile,
  deleteBranch,
  getFileContent,
  getRef,
  getRepoTree,
  mergeBranch
} from "@/infra/integrations/github.ts"
import { validateInSandbox } from "@/infra/integrations/sandbox.ts"
import { log } from "@/infra/lib/logger.ts"
import { extractErrorMessage, logAndCaptureError } from "@/infra/lib/result.ts"
import { nowFilename } from "@/infra/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { CODE_EVOLUTION_SYSTEM_PROMPT, FILE_SELECTION_SYSTEM_PROMPT } from "@/prompts/evolution.ts"
import { canActAutonomously, recordOutcome } from "@/relational/trust/compute.ts"
import { writeChangelogEntry } from "./changelog.ts"

const SOURCE_CONTEXT_TOKEN_BUDGET = 50_000
const PROPOSAL_MAX_TOKENS = 50_000
const MAX_RELEVANT_FILES = 15
const MAX_REQUEST_ROUNDS = 10
const FACTORIES_PATH = "src/test/factories.ts"

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

  paths.forEach((p) => {
    const testPath = testPathFor(p)
    if (testPath && tree.includes(testPath)) {
      expanded.add(testPath)
    }
  })

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
  let tokensUsed = sourceFiles.reduce((sum, f) => sum + estimateTokenCount(f.content), 0)

  await paths
    .filter((path) => !alreadyLoaded.has(path))
    .reduce(async (chain, path) => {
      await chain
      if (tokensUsed >= tokenBudget) return

      try {
        const { content } = await getFileContent(path)
        const fileTokens = estimateTokenCount(content)
        const remainingBudget = tokenBudget - tokensUsed

        if (fileTokens <= remainingBudget) {
          sourceFiles.push({ path, content, truncated: false })
          tokensUsed += fileTokens
        } else {
          sourceFiles.push({
            path,
            content: `${sliceByTokens(content, 0, remainingBudget)}\n// ... truncated ...`,
            truncated: true
          })
          tokensUsed = tokenBudget
        }
      } catch (e) {
        log.warn("Failed to read source file for evolution context", { path, error: String(e) })
      }
    }, Promise.resolve())

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

function failedProposal(reasoning: string): CodeProposalOrFileRequest {
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
  context: ProposalContext,
  files: SourceFileContext[],
  round: number,
  failedPaths: Set<string> = new Set()
): Promise<CodeProposalOrFileRequest> {
  const tokensUsed = files.reduce((sum, f) => sum + estimateTokenCount(f.content), 0)
  const budgetExhausted = tokensUsed >= SOURCE_CONTEXT_TOKEN_BUDGET
  const forceProposal = budgetExhausted || round >= MAX_REQUEST_ROUNDS

  const userPayload: Record<string, unknown> = {
    insight: context.insight,
    capabilityGap: context.capabilityGap,
    sourceContext: formatSourceContext(files),
    availableFiles: context.tree.join("\n"),
    remainingTokenBudget: Math.max(0, SOURCE_CONTEXT_TOKEN_BUDGET - tokensUsed)
  }

  if (failedPaths.size > 0) userPayload.unavailablePaths = [...failedPaths]
  if (context.libraryDocs) userPayload.libraryDocumentation = context.libraryDocs
  if (context.previousAttempt) {
    userPayload.previousAttemptFailed = {
      error: context.previousAttempt.error,
      stderr: context.previousAttempt.sandboxStderr.slice(0, 3000)
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
  const validPaths = requestedPaths.filter((p) => context.tree.includes(p))
  const expandedPaths = expandWithTestFiles(validPaths, context.tree)

  const newFailedPaths = new Set(failedPaths)
  for (const p of requestedPaths.filter((p) => !context.tree.includes(p))) {
    newFailedPaths.add(p)
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
    return resolveFileRequests(context, files, MAX_REQUEST_ROUNDS, newFailedPaths)
  }

  return resolveFileRequests(context, expandedFiles, round + 1, newFailedPaths)
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
  const [libraryDocs, evolutionLessons] = await Promise.all([
    fetchLibraryDocs(allSourceCode, capabilityGap).catch(() => ""),
    getRelevantEvolutionLessons().catch(() => [])
  ])

  const lessonsContext =
    evolutionLessons.length > 0
      ? `\n\nPrevious evolution lessons (avoid these mistakes):\n${evolutionLessons.map((l) => `- ${l.insight}`).join("\n")}`
      : ""

  const proposalContext: ProposalContext = {
    insight: insight + lessonsContext,
    capabilityGap,
    tree,
    libraryDocs,
    previousAttempt
  }
  const response = await resolveFileRequests(proposalContext, sourceFiles, 0)

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
    await recordOutcome("code_modification", 0)
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
          log.debug("No existing file found, will create new", { path: file.path })
        }
      })
    )

    await proposal.files.reduce(async (chain, file) => {
      await chain
      await createOrUpdateFile(
        file.path,
        file.content,
        `${commitPrefix}: ${file.description}`,
        branchName,
        existingShas.get(file.path)
      )
    }, Promise.resolve())
    log.info("Evolution files pushed", { branchName, fileCount: proposal.files.length })

    log.info("Starting sandbox validation", { branchName })
    const sandboxResult = await validateInSandbox(branchName)

    if (sandboxResult.passed) {
      await mergeBranch(branchName)
      log.info("Evolution merged", { branchName, commitSubject: proposal.commitSubject })
      await recordOutcome("code_modification", 1)
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
      await recordOutcome("code_modification", 0)

      const errorType = !sandboxResult.tscCheckPassed
        ? "tsc"
        : !sandboxResult.biomeCheckPassed
          ? "biome"
          : sandboxResult.testsFailed > 0
            ? "test"
            : "sandbox"
      await addEvolutionLesson(
        proposal.files.map((f) => f.path),
        errorType,
        sandboxResult.stderr
      ).catch((e) => log.debug("Evolution lesson storage failed", { error: String(e) }))
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
      error: extractErrorMessage(error)
    })
    try {
      await deleteBranch(branchName)
    } catch (e) {
      log.warn("Failed to clean up evolution branch", { branchName, error: String(e) })
    }

    await recordOutcome("code_modification", 0)
    const errorMsg = extractErrorMessage(error)
    return { success: false, error: errorMsg }
  }
}
