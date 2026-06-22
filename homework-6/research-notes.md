# research-notes.md — Agent 2 Library Research

## 1. Python `decimal` Module

**Search term**: "Python decimal module monetary arithmetic ROUND_HALF_UP"
**Library ID**: `/python/cpython`

### Key patterns applied

**Rounding to 2 decimal places (monetary serialisation)**:
```python
from decimal import Decimal, ROUND_HALF_UP

amount = Decimal("9999.999")
rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
# → Decimal('10000.00')
```

**Validating at-most-2-decimal-places** (reject `"9.999"` but accept `"9.99"`):
```python
d = Decimal(amount_str)
if d.as_tuple().exponent < -2:
    # more than 2 decimal places — reject
```

**Why `Decimal` over `float`**: floats suffer from binary-representation loss
(`0.1 + 0.2 != 0.3`); `Decimal` is base-10 and exact for fixed-point money.

**Applied in**: `agents/transaction_validator.py` (amount validation),
`agents/fraud_detector.py` (USD-equivalent conversion), `agents/reporter.py`
(no arithmetic, but amounts are kept as strings throughout).

---

## 2. FastMCP

**Search term**: "building MCP server with tools and resources using FastMCP Python"
**Library ID**: `/prefecthq/fastmcp`

### Key patterns applied

**Defining a tool** (schema auto-derived from type hints + docstring):
```python
from fastmcp import FastMCP

mcp = FastMCP(name="My Server")

@mcp.tool
def get_weather(city: str) -> dict:
    """Gets the current weather for a specific city."""
    return {"city": city, "temperature": "72F"}
```

**Defining a resource** (URI template with static path):
```python
@mcp.resource("config://app")
def app_config() -> str:
    """Application configuration."""
    return '{"app_name": "My App"}'
```

**Running the server** (stdio transport — default for MCP):
```python
if __name__ == "__main__":
    mcp.run()
```

**Applied in**: `pipeline_mcp/server.py` — tools `get_transaction_status` and
`list_pipeline_results`, plus resource `pipeline://summary`.

Note: the server lives at `pipeline_mcp/server.py` (not `mcp/server.py`) to
avoid shadowing the installed `mcp` package that `fastmcp` imports internally.
