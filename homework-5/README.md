# Homework 5 — Configure MCP Servers

**Author:** Andrii Kurbatov

This homework configures **three external MCP servers** (GitHub, Filesystem, Jira via Atlassian) and implements **one custom MCP server** with FastMCP, then demonstrates a working interaction against each from Claude Code.

---

## What is MCP?

The **Model Context Protocol (MCP)** lets an AI client (here, Claude Code) talk to external systems through a standard interface. Each server exposes two main capability types:

- **Resources** are *URIs that Claude can read from* — passive data sources such as files, API responses, or database rows (e.g. `lorem://ipsum`). The client decides when to read them; they don't perform side effects.
- **Tools** are *actions Claude can call* to perform operations — reading a file, running a query, creating an issue, etc. (e.g. the `read` tool). Tools are invoked by the model to *do* something.

---

## Servers configured

| # | Server | Type | Transport | Purpose |
|---|--------|------|-----------|---------|
| 1 | `github` | external (official) | HTTP (`https://api.githubcopilot.com/mcp/`) | Query repos, PRs, issues, commits |
| 2 | `filesystem` | external (`@modelcontextprotocol/server-filesystem`) | stdio (`npx`) | List/read files under the project directory |
| 3 | Atlassian (Jira) | external (claude.ai connector) | HTTP (OAuth) | Query Jira projects/issues via JQL |
| 4 | `lorem-ipsum` | **custom (FastMCP)** | stdio (Python) | Serve word-limited text from `lorem-ipsum.md` |

The committed configuration lives in [`.mcp.json`](.mcp.json). See [`HOWTORUN.md`](HOWTORUN.md) for setup and credentials.

---

## Demonstrated interactions (see `docs/screenshots/`)

| Task | Interaction | Result |
|------|-------------|--------|
| 1. GitHub | "list recent PRs" → `list_pull_requests` | Returned PR #2 (homework-2) and PR #1 (homework-1), both merged into `main` |
| 2. Filesystem | list `homework-5/` + read `TASKS.md` → `list_directory`, `read_text_file` | Returned the directory tree and file contents |
| 3. Jira | "show me last 5 issues on the Jira board, just titles" → Atlassian MCP | Returned the 5 most recently created Jira issues from the project/board with ticket keys and titles |
| 4. Custom | call `read` tool (default + `word_count=10`) | 30 words by default; exactly 10 words when requested |

Screenshots:
- `docs/screenshots/github-mcp-result.png`
- `docs/screenshots/filesystem-mcp-result.png`
- `docs/screenshots/jira-or-notion-mcp-result.png`
- `docs/screenshots/custom-mcp-read-tool-result.png`

---

## Custom MCP server (`custom-mcp-server/`)

A FastMCP server that exposes the contents of `lorem-ipsum.md`:

- **Resource** `lorem://ipsum` — returns the default **30** words.
- **Resource template** `lorem://ipsum/{word_count}` — returns exactly `word_count` words.
- **Tool** `read(word_count: int = 30)` — returns the same word-limited content; this is the action Claude calls.

```
custom-mcp-server/
├── server.py          # FastMCP server (resource + read tool)
├── lorem-ipsum.md     # source text the resource/tool reads from
└── requirements.txt   # includes fastmcp
```

Verified with `fastmcp 3.4.2` on Python 3.14.5. Tested both via FastMCP's in-memory client and live through Claude Code.

---

## AI tools used

- **Claude Code (Claude Opus 4.8)** — scaffolded the MCP configuration, authored `server.py`, the lorem-ipsum source, and these docs; registered each server; ran and verified every interaction.
- **GitHub MCP**, **Filesystem MCP**, **Atlassian (Jira) MCP**, and the **custom FastMCP server** — exercised directly as the deliverables.

## Challenges

- **GitHub OAuth failed** with *"Incompatible auth server: does not support dynamic client registration."* Resolved by authenticating the official remote GitHub MCP server with a **Personal Access Token** via an `Authorization: Bearer` header instead of OAuth. The committed config uses a `${GITHUB_PAT}` placeholder so no secret is stored in the repo.
- **Jira boards vs. projects** — a board shows only issues matching its own filter, while JQL queries can target the whole project. The captured result uses the accessible project/board context and redacts sensitive title details in the screenshot.
