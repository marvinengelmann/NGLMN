const mockFetch = vi.fn()
global.fetch = mockFetch

import {
  createBranch,
  createOrUpdateFile,
  createPullRequest,
  createRef,
  deleteBranch,
  deleteRef,
  getFileContent,
  getRef,
  listCommits,
  mergePullRequest,
  updateRef
} from "./github.ts"

beforeEach(() => {
  process.env.GITHUB_TOKEN = "test-token"
  process.env.GITHUB_OWNER = "test-owner"
  process.env.GITHUB_REPO = "test-repo"
  mockFetch.mockReset()
})

afterEach(() => {
  delete process.env.GITHUB_TOKEN
  delete process.env.GITHUB_OWNER
  delete process.env.GITHUB_REPO
})

describe("getRef", () => {
  it("returns sha and ref on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ object: { sha: "abc123" }, ref: "refs/heads/master" })
    })
    const result = await getRef("heads/master")
    expect(result).toEqual({ sha: "abc123", ref: "refs/heads/master" })
  })

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" })
    await expect(getRef("heads/nope")).rejects.toThrow("GitHub getRef failed")
  })
})

describe("updateRef", () => {
  it("sends PATCH with sha and force", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await updateRef("heads/master", "abc123", true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/git/refs/heads/master"),
      expect.objectContaining({ method: "PATCH" })
    )
  })
})

describe("listCommits", () => {
  it("returns mapped commits", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ sha: "abc", commit: { message: "test", committer: { date: "2025-01-01" } } }]
    })
    const result = await listCommits("master", 1)
    expect(result).toEqual([{ sha: "abc", message: "test", date: "2025-01-01" }])
  })
})

describe("createRef", () => {
  it("sends POST to create a ref", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await createRef("tags/v1", "abc123")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/git/refs"),
      expect.objectContaining({ method: "POST" })
    )
  })
})

describe("deleteRef", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteRef("heads/old-branch")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/git/refs/heads/old-branch"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})

describe("getFileContent", () => {
  it("returns decoded content and sha", async () => {
    const encoded = Buffer.from("hello world").toString("base64")
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: encoded, sha: "file-sha" })
    })
    const result = await getFileContent("src/index.ts", "master")
    expect(result.content).toBe("hello world")
    expect(result.sha).toBe("file-sha")
  })

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" })
    await expect(getFileContent("nope.ts")).rejects.toThrow("GitHub getFileContent failed")
  })
})

describe("createOrUpdateFile", () => {
  it("sends PUT with base64 content", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await createOrUpdateFile("src/test.ts", "content", "add file", "feature-branch")
    const call = mockFetch.mock.calls[0]
    if (!call) throw new Error("Expected fetch call")
    expect(call[1].method).toBe("PUT")
    const body = JSON.parse(call[1].body)
    expect(body.content).toBe(Buffer.from("content").toString("base64"))
    expect(body.branch).toBe("feature-branch")
  })

  it("includes sha when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await createOrUpdateFile("src/test.ts", "content", "update", "branch", "old-sha")
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1].body)
    expect(body.sha).toBe("old-sha")
  })
})

describe("createBranch", () => {
  it("delegates to createRef with heads/ prefix", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await createBranch("feature-x", "abc123")
    const url = mockFetch.mock.calls[0]?.[0]
    expect(url).toContain("/git/refs")
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1].body)
    expect(body.ref).toBe("refs/heads/feature-x")
  })
})

describe("deleteBranch", () => {
  it("delegates to deleteRef with heads/ prefix", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteBranch("old-branch")
    expect(mockFetch.mock.calls[0]?.[0]).toContain("/git/refs/heads/old-branch")
  })
})

describe("createPullRequest", () => {
  it("creates PR and returns number + url", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, html_url: "https://github.com/test/pr/42" })
    })
    const result = await createPullRequest("title", "body", "feature", "master")
    expect(result.number).toBe(42)
    expect(result.url).toBe("https://github.com/test/pr/42")
  })
})

describe("mergePullRequest", () => {
  it("sends PUT to merge endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await mergePullRequest(42)
    expect(mockFetch.mock.calls[0]?.[0]).toContain("/pulls/42/merge")
    expect(mockFetch.mock.calls[0]?.[1].method).toBe("PUT")
  })

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, text: async () => "Conflict" })
    await expect(mergePullRequest(42)).rejects.toThrow("GitHub mergePullRequest failed")
  })
})
