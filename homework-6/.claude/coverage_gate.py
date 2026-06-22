#!/usr/bin/env python3
"""PreToolUse coverage gate. Blocks `git push` if pytest coverage is below the
threshold. Fails CLOSED: if coverage can't be measured, the push is blocked.

Blocking mechanism: exit code 2 (Claude Code treats exit 2 from a PreToolUse
hook as "deny the tool call" and shows stderr).
"""
import json
import os
import subprocess
import sys

THRESHOLD = "100"  # change to "100" temporarily to force a block for screenshots


def block(reason: str) -> None:
    print(f"Coverage gate: {reason} Push blocked.", file=sys.stderr)
    sys.exit(2)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # no/invalid input — don't interfere with non-push tools

    cmd = (data.get("tool_input") or {}).get("command", "")
    if "git push" not in cmd:
        sys.exit(0)  # only gate pushes

    here = os.path.dirname(os.path.abspath(__file__))  # .../homework-6/.claude
    root = os.path.dirname(here)                        # .../homework-6
    venv_py = os.path.join(root, ".venv", "bin", "python")
    py = venv_py if os.path.exists(venv_py) else sys.executable

    try:
        result = subprocess.run(
            [py, "-m", "pytest",
             "--cov=agents", "--cov=integrator", "--cov=pipeline_mcp",
             f"--cov-fail-under={THRESHOLD}", "-q"],
            cwd=root,
        )
    except Exception as exc:  # pytest missing, etc. — fail closed
        block(f"could not run pytest ({exc}).")
        return

    if result.returncode != 0:
        block(f"pytest coverage below {THRESHOLD}%.")
    sys.exit(0)  # passed — allow the push


if __name__ == "__main__":
    main()
