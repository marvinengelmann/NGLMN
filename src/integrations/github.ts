import * as z from "zod"
import { env } from "@/config/env.ts"
import { fetchWithTimeout } from "@/lib/fetch.ts"
import { log } from "@/lib/logger.ts"
import { extractErrorMessage } from "@/lib/result.ts"

const GITHUB_API_BASE = "https://api.github.com"
const GITHUB_TIMEOUT_MS = 15_000

const ANIMA_IDENTITY = {
  name: "ANIMA",
  email: "github@anima.engelmann.technology"
}

const GitRefSchema = z.object({
  object: z.object({ sha: z.string() }),
  ref: z.string()
})

const GitCommitSchema = z.array(
  z.object({
    sha: z.string(),
    commit: z.object({
      message: z.string(),
      committer: z.object({ date: z.string() })
    })
  })
)

const GitFileContentSchema = z.object({
  content: z.string(),
  sha: z.string()
})

const GitTreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() }))
})

function getConfig() {
  const token = env().GITHUB_TOKEN
  const owner = env().GITHUB_OWNER
  const repo = env().GITHUB_REPO
  if (!token || !owner || !repo) {
    throw new Error("GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO must be set")
  }
  return { token, owner, repo }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  }
}

async function githubFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetchWithTimeout(url, { ...init, headers: { ...headers(token), ...init?.headers } }, GITHUB_TIMEOUT_MS)
}

/**
 * Get a Git reference (e.g. "heads/main").
 */
export async function getRef(ref: string): Promise<{ sha: string; ref: string }> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/${ref}`, token)

  if (!response.ok) {
    throw new Error(`GitHub getRef failed: ${response.status} ${await response.text()}`)
  }

  const data = GitRefSchema.parse(await response.json())
  return { sha: data.object.sha, ref: data.ref }
}

/**
 * Update a Git reference to a new SHA (used for reverting).
 */
export async function updateRef(ref: string, sha: string, force: boolean = true): Promise<void> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/${ref}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha, force })
  })

  if (!response.ok) {
    throw new Error(`GitHub updateRef failed: ${response.status} ${await response.text()}`)
  }
}

/**
 * List recent commits on a branch.
 */
export async function listCommits(
  branch: string = "master",
  limit: number = 10
): Promise<Array<{ sha: string; message: string; date: string }>> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`,
    token
  )

  if (!response.ok) {
    throw new Error(`GitHub listCommits failed: ${response.status} ${await response.text()}`)
  }

  const data = GitCommitSchema.parse(await response.json())
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.committer.date
  }))
}

/**
 * Create a new Git reference (e.g. a tag like "tags/last-stable").
 */
export async function createRef(ref: string, sha: string): Promise<void> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/${ref}`, sha })
  })

  if (!response.ok) {
    throw new Error(`GitHub createRef failed: ${response.status} ${await response.text()}`)
  }
}

/**
 * Delete a Git reference.
 */
export async function deleteRef(ref: string): Promise<void> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/${ref}`, token, {
    method: "DELETE"
  })

  if (!response.ok) {
    throw new Error(`GitHub deleteRef failed: ${response.status} ${await response.text()}`)
  }
}

/**
 * Get file content and SHA from a branch.
 */
export async function getFileContent(
  path: string,
  branch: string = "master"
): Promise<{ content: string; sha: string }> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, token)

  if (!response.ok) {
    throw new Error(`GitHub getFileContent failed: ${response.status} ${await response.text()}`)
  }

  const data = GitFileContentSchema.parse(await response.json())
  const content = Buffer.from(data.content, "base64").toString("utf-8")
  return { content, sha: data.sha }
}

/**
 * Get all TypeScript file paths in src/ using the Git Trees API (recursive, single API call).
 */
export async function getRepoTree(branch: string = "master"): Promise<string[]> {
  const { token, owner, repo } = getConfig()

  const refRes = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, token)

  if (!refRes.ok) {
    throw new Error(`GitHub getRepoTree ref failed: ${refRes.status} ${await refRes.text()}`)
  }

  const refData = GitRefSchema.parse(await refRes.json())
  const treeSha = refData.object.sha

  const treeRes = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token)

  if (!treeRes.ok) {
    throw new Error(`GitHub getRepoTree tree failed: ${treeRes.status} ${await treeRes.text()}`)
  }

  const treeData = GitTreeSchema.parse(await treeRes.json())

  return treeData.tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith("src/") && entry.path.endsWith(".ts"))
    .map((entry) => entry.path)
}

/**
 * Create or update a file on a branch.
 */
export async function createOrUpdateFile(
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string
): Promise<void> {
  const { token, owner, repo } = getConfig()

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
    committer: ANIMA_IDENTITY,
    author: ANIMA_IDENTITY
  }
  if (sha) body.sha = sha

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`GitHub createOrUpdateFile failed: ${response.status} ${await response.text()}`)
  }
}

/**
 * Create a new branch from a given SHA.
 */
export async function createBranch(branchName: string, fromSha: string): Promise<void> {
  await createRef(`heads/${branchName}`, fromSha)
}

/**
 * Delete a branch by name.
 */
export async function deleteBranch(branchName: string): Promise<void> {
  await deleteRef(`heads/${branchName}`)
}

/**
 * Merge a branch into master using the GitHub Merge API (atomic operation).
 * Cleans up the branch after successful merge.
 */
export async function mergeBranch(branchName: string): Promise<void> {
  const { token, owner, repo } = getConfig()

  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/merges`, token, {
    method: "POST",
    body: JSON.stringify({
      base: "master",
      head: branchName,
      commit_message: `Merge branch '${branchName}' into master`
    })
  })

  if (!response.ok) {
    throw new Error(`GitHub mergeBranch failed: ${response.status} ${await response.text()}`)
  }

  try {
    await deleteBranch(branchName)
  } catch (e) {
    log.warn("Failed to delete branch after merge", {
      branch: branchName,
      error: extractErrorMessage(e)
    })
  }
}
