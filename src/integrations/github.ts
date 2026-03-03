const GITHUB_API_BASE = "https://api.github.com"

const ANIMA_IDENTITY = {
  name: "ANIMA",
  email: "github@anima.engelmann.technology"
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
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

/**
 * Get a Git reference (e.g. "heads/main").
 */
export async function getRef(ref: string): Promise<{ sha: string; ref: string }> {
  const { token, owner, repo } = getConfig()

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/${ref}`, {
    headers: headers(token)
  })

  if (!res.ok) {
    throw new Error(`GitHub getRef failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { object: { sha: string }; ref: string }
  return { sha: data.object.sha, ref: data.ref }
}

/**
 * Update a Git reference to a new SHA (used for reverting).
 */
export async function updateRef(ref: string, sha: string, force: boolean = true): Promise<void> {
  const { token, owner, repo } = getConfig()

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/${ref}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ sha, force })
  })

  if (!res.ok) {
    throw new Error(`GitHub updateRef failed: ${res.status} ${await res.text()}`)
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

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`, {
    headers: headers(token)
  })

  if (!res.ok) {
    throw new Error(`GitHub listCommits failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return (data as Array<Record<string, unknown>>).map((c) => ({
    sha: c.sha as string,
    message: (c.commit as Record<string, unknown>).message as string,
    date: ((c.commit as Record<string, unknown>).committer as Record<string, unknown>).date as string
  }))
}

/**
 * Create a new Git reference (e.g. a tag like "tags/last-stable").
 */
export async function createRef(ref: string, sha: string): Promise<void> {
  const { token, owner, repo } = getConfig()

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ ref: `refs/${ref}`, sha })
  })

  if (!res.ok) {
    throw new Error(`GitHub createRef failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Delete a Git reference.
 */
export async function deleteRef(ref: string): Promise<void> {
  const { token, owner, repo } = getConfig()

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/${ref}`, {
    method: "DELETE",
    headers: headers(token)
  })

  if (!res.ok) {
    throw new Error(`GitHub deleteRef failed: ${res.status} ${await res.text()}`)
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

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: headers(token)
  })

  if (!res.ok) {
    throw new Error(`GitHub getFileContent failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { content: string; sha: string }
  const content = Buffer.from(data.content, "base64").toString("utf-8")
  return { content, sha: data.sha }
}

/**
 * Get all TypeScript file paths in src/ using the Git Trees API (recursive, single API call).
 */
export async function getRepoTree(branch: string = "master"): Promise<string[]> {
  const { token, owner, repo } = getConfig()

  const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers: headers(token)
  })

  if (!refRes.ok) {
    throw new Error(`GitHub getRepoTree ref failed: ${refRes.status} ${await refRes.text()}`)
  }

  const refData = (await refRes.json()) as { object: { sha: string } }
  const treeSha = refData.object.sha

  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
    headers: headers(token)
  })

  if (!treeRes.ok) {
    throw new Error(`GitHub getRepoTree tree failed: ${treeRes.status} ${await treeRes.text()}`)
  }

  const treeData = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string }>
  }

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

  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(`GitHub createOrUpdateFile failed: ${res.status} ${await res.text()}`)
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
 * Fast-forward merge a branch into master by updating the master ref.
 * Only succeeds if master hasn't moved since the branch was created (force: false).
 */
export async function mergeBranch(branchName: string): Promise<void> {
  const { sha } = await getRef(`heads/${branchName}`)
  await updateRef("heads/master", sha, false)
  await deleteBranch(branchName)
}
