import * as z from "zod"
import { callIntelligence, FAST, REASONING } from "@/core/intelligence.ts"
import { validateInSandbox } from "@/integrations/e2b.ts"
import {
  createBranch,
  createOrUpdateFile,
  createPullRequest,
  deleteBranch,
  getFileContent,
  getRef,
  getRepoTree,
  mergePullRequest
} from "@/integrations/github.ts"
import { log } from "@/lib/logger.ts"
import { estimateTokens } from "@/lib/math.ts"
import { logAndCaptureError } from "@/lib/result.ts"
import { nowFilename } from "@/lib/time.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { getNextEvolutionNumber } from "@/memory/working.ts"
import { CODE_EVOLUTION_SYSTEM_PROMPT } from "@/prompts/evolution.ts"
import { validateEvolution } from "@/security/guardian.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import { writeChangelogEntry } from "./changelog.ts"

const SOURCE_CONTEXT_TOKEN_BUDGET = 20_000
const MAX_RELEVANT_FILES = 5

const FILE_SELECTION_SYSTEM_PROMPT = `You select relevant source code files for a code evolution task.
You receive a repository file tree and a description of the change needed.
Select the most relevant file paths (max ${MAX_RELEVANT_FILES}).`

export const FileSelectionOutput = z.object({
  paths: z.array(z.string()).max(MAX_RELEVANT_FILES)
})
export type FileSelectionOutput = z.infer<typeof FileSelectionOutput>

export const CodeProposalOutput = z.object({
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

export interface SourceFileContext {
  path: string
  content: string
  truncated: boolean
}

/**
 * Use LLM to select relevant files from the repo tree, then load their contents within a token budget.
 */
export async function selectRelevantFiles(insight: string, capabilityGap: string): Promise<SourceFileContext[]> {
  const tree = await getRepoTree()

  const treeListing = tree.join("\n")

  const selectionResult = await callIntelligence({
    model: FAST,
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

  const sourceFiles: SourceFileContext[] = []
  let tokensUsed = 0

  for (const path of validPaths) {
    if (tokensUsed >= SOURCE_CONTEXT_TOKEN_BUDGET) break

    try {
      const { content } = await getFileContent(path)
      const fileTokens = estimateTokens(content)
      const remainingBudget = SOURCE_CONTEXT_TOKEN_BUDGET - tokensUsed

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
        tokensUsed = SOURCE_CONTEXT_TOKEN_BUDGET
      }
    } catch (e) {
      log.warn("Failed to read source file for evolution context", { path, error: String(e) })
    }
  }

  return sourceFiles
}

export interface CodeProposal {
  shouldEvolve: boolean
  files: Array<{ path: string; content: string; description: string }>
  commitSubject: string
  commitBody: string
  testExpectations: string[]
  reasoning: string
  autonomous: boolean
}

export async function proposeCodeChange(insight: string, capabilityGap: string): Promise<CodeProposal> {
  const [trust, sourceFiles] = await Promise.all([
    canActAutonomously("code_modification"),
    selectRelevantFiles(insight, capabilityGap)
  ])

  const sourceContext =
    sourceFiles.length > 0
      ? sourceFiles.map((f) => `--- ${f.path}${f.truncated ? " (truncated)" : ""} ---\n${f.content}`).join("\n\n")
      : "No source files could be loaded."

  const responseResult = await callIntelligence({
    model: REASONING,
    system: CODE_EVOLUTION_SYSTEM_PROMPT,
    userMessage: JSON.stringify({
      insight,
      capabilityGap,
      sourceContext
    }),
    schema: CodeProposalOutput,
    maxTokens: 8192
  })

  if (responseResult.isErr()) {
    log.warn("Failed to propose code change", { error: responseResult.error.message })
    return {
      shouldEvolve: false,
      files: [],
      commitSubject: "",
      commitBody: "",
      testExpectations: [],
      reasoning: responseResult.error.message,
      autonomous: false
    }
  }

  return {
    ...responseResult.value,
    autonomous: trust.canAct
  }
}

export async function executeCodeEvolution(proposal: CodeProposal): Promise<{
  success: boolean
  prUrl?: string
  error?: string
}> {
  const guardianResult = validateEvolution(proposal.files)
  if (guardianResult.verdict === "blocked") {
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

    for (const file of proposal.files) {
      let existingSha: string | undefined
      try {
        const existing = await getFileContent(file.path, branchName)
        existingSha = existing.sha
      } catch {
        existingSha = undefined
      }

      await createOrUpdateFile(file.path, file.content, `${commitPrefix}: ${file.description}`, branchName, existingSha)
    }

    const sandboxResult = await validateInSandbox(branchName)

    if (sandboxResult.passed) {
      const prTitle = `${commitPrefix}: ${proposal.commitSubject}`
      const prBody = `${proposal.commitBody}\n\n### Files Changed\n${proposal.files.map((f) => `- \`${f.path}\`: ${f.description}`).join("\n")}\n\n### Test Results\n- Passed: ${sandboxResult.testsPassed}\n- Failed: ${sandboxResult.testsFailed}\n- Duration: ${sandboxResult.durationMs}ms`

      const pr = await createPullRequest(prTitle, prBody, branchName, "master")

      await mergePullRequest(pr.number)
      ;(await recordSuccess("code_modification")).mapErr(logAndCaptureError)
      ;(await writeChangelogEntry("code", `${commitPrefix}: ${proposal.commitSubject}`, "success")).mapErr(
        logAndCaptureError
      )
      await storeEpisode(`${commitPrefix}: ${proposal.commitSubject}\n${proposal.commitBody}`, "evolution", {
        relevanceScore: 0.95
      })

      return { success: true, prUrl: pr.url }
    } else {
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

      return { success: false, error: `Tests failed: ${sandboxResult.testsFailed} failures` }
    }
  } catch (error) {
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
