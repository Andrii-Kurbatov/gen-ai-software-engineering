"""Custom FastMCP server for Homework 5.

Exposes the contents of ``lorem-ipsum.md`` to an MCP client (e.g. Claude Code)
through two mechanisms:

* **Resource** — a URI Claude can read from. ``lorem://ipsum`` returns the
  default number of words (30); ``lorem://ipsum/{word_count}`` returns exactly
  ``word_count`` words.
* **Tool** — ``read`` is an action Claude can call. It takes an optional
  ``word_count`` parameter (default 30) and returns the same word-limited
  content the resource serves.
"""

from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP("lorem-ipsum-server")

# lorem-ipsum.md lives next to this file, regardless of the working directory.
LOREM_PATH = Path(__file__).parent / "lorem-ipsum.md"

DEFAULT_WORD_COUNT = 30


def _read_words(word_count: int = DEFAULT_WORD_COUNT) -> str:
    """Return exactly ``word_count`` whitespace-separated words from the file."""
    if word_count < 0:
        raise ValueError("word_count must be zero or positive")
    text = LOREM_PATH.read_text(encoding="utf-8")
    words = text.split()
    return " ".join(words[:word_count])


@mcp.resource("lorem://ipsum")
def lorem_default() -> str:
    """Resource URI: first 30 words (default) of lorem-ipsum.md."""
    return _read_words(DEFAULT_WORD_COUNT)


@mcp.resource("lorem://ipsum/{word_count}")
def lorem_n(word_count: int) -> str:
    """Resource URI template: first ``word_count`` words of lorem-ipsum.md."""
    return _read_words(int(word_count))


@mcp.tool
def read(word_count: int = DEFAULT_WORD_COUNT) -> str:
    """Read the lorem-ipsum content, limited to ``word_count`` words.

    Args:
        word_count: How many words to return. Defaults to 30.
    """
    return _read_words(word_count)


if __name__ == "__main__":
    # Default transport is stdio, which is what the MCP client launches.
    mcp.run()
