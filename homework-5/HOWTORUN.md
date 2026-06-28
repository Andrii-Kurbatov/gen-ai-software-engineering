# How to Run — Homework 5 MCP Servers

This guide covers installing, running, connecting, and testing all four MCP servers.
Commands assume the repository root is the working directory and Claude Code is the MCP client.

> **Where config lives.** The committed deliverable is [`homework-5/.mcp.json`](.mcp.json).
> Claude Code loads a project `.mcp.json` from the directory it is launched in, and per-user
> servers from `~/.claude.json`. The servers below were registered with `claude mcp add` (user
> scope) so they work in any session; the committed file documents the equivalent configuration.
> After adding/editing any server, run `/mcp` inside Claude Code to (re)connect and load its tools.

---

## Prerequisites

- **Node.js** ≥ 18 with `npx` (used for the Filesystem server) — verified with Node 24.13.0.
- **Python** ≥ 3.10 (custom server) — verified with Python 3.14.5.
- **GitHub CLI** (`gh`) authenticated, *or* a GitHub Personal Access Token.
- **Claude Code** as the MCP client.

---

## 1. GitHub MCP (official remote server)

The OAuth flow is incompatible with Claude Code (no dynamic client registration), so authenticate
with a **Personal Access Token** via header.

```bash
# Use your existing gh login as the token (token never printed):
claude mcp add -s user --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer $(gh auth token)"

# (Alternative) create a classic PAT at https://github.com/settings/tokens
# with repo + read:org scope, then:
#   --header "Authorization: Bearer <your_pat>"
```

The committed `.mcp.json` uses a `${GITHUB_PAT}` placeholder instead of a hard-coded token. To use
that form, export the token before launching Claude Code:

```bash
export GITHUB_PAT=$(gh auth token)   # add to ~/.zshrc to persist
```

**Test:** in Claude Code, run `/mcp` (server shows ✓ connected), then ask:
> "Using GitHub MCP, list the 5 most recent pull requests on my repo."

---

## 2. Filesystem MCP

```bash
claude mcp add -s user filesystem -- \
  npx -y @modelcontextprotocol/server-filesystem \
  /Users/akurbatov/Documents/Courses/gen-ai-software-engineering
```

Replace the path with the directory you want to expose. The server only allows access within that
directory.

**Test:** run `/mcp`, then ask:
> "Using the filesystem MCP, list the homework-5 directory and read TASKS.md."

---

## 3. Jira MCP (Atlassian)

This uses the claude.ai-managed **Atlassian** connector (OAuth). Authenticate it from the `/mcp`
menu in Claude Code (or the claude.ai connectors page) and approve access to your Jira site.

**Test:** run `/mcp` to confirm Atlassian is authenticated, then ask:
> "Give me the last 5 bug tickets on <project>."
>
> e.g. *"Show me last 5 issues on <project> Jira board, just titles."* → returns the 5 most recently created matching ticket keys and titles.

---

## 4. Custom FastMCP Server

### Install dependencies

```bash
cd homework-5/custom-mcp-server
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt   # installs fastmcp
```

### Run the server (standalone check)

```bash
./.venv/bin/python server.py        # starts the server over stdio
```

The server runs over stdio, so it produces no terminal output while waiting for a client — that is
expected. Press `Ctrl+C` to stop. To verify it end-to-end without a client:

```bash
./.venv/bin/python - <<'PY'
import asyncio
from fastmcp import Client
from server import mcp
async def main():
    async with Client(mcp) as c:
        print(await c.call_tool("read", {"word_count": 5}))
asyncio.run(main())
PY
# -> "Lorem ipsum dolor sit amet"
```

### Connect the MCP configuration

```bash
claude mcp add -s user lorem-ipsum -- \
  "$(pwd)/.venv/bin/python" "$(pwd)/server.py"
```

(The committed `.mcp.json` references `homework-5/custom-mcp-server/.venv/bin/python` and
`homework-5/custom-mcp-server/server.py`.)

### Use / test the `read` tool

Run `/mcp` in Claude Code (`lorem-ipsum` shows ✓ connected), then ask:

> "Read lorem ipsum" → returns 30 words (default).
>
> "Read 10 words of lorem ipsum" → returns exactly 10 words.

The `read` tool accepts an optional `word_count` (default `30`). The same content is also available
as a **resource** at `lorem://ipsum` (30 words) and `lorem://ipsum/{word_count}` (N words).

---

## Verify all servers

```bash
claude mcp list
```

Each of `github`, `filesystem`, and `lorem-ipsum` should report **✔ Connected**; Atlassian should
report authenticated.
