# Skill: Research Quality Measurement

A rubric the **Bug Research Verifier** uses to grade the Bug Researcher's output and to
structure `verified-research.md`.

## Purpose

Give every verification run a consistent, objective quality label so downstream agents (the
Bug Planner especially) know how much to trust the research before acting on it.

## Quality Levels

| Level | Label | Meaning |
|-------|-------|---------|
| **L4** | ✅ Verified | 100% of file:line references resolve and every snippet matches source byte-for-byte. Root cause is correct and reproducible. No discrepancies. |
| **L3** | 🟢 Strong | ≥ 90% of references resolve and snippets match. Minor cosmetic drift (whitespace, line shifted ±2) only. Conclusions hold. |
| **L2** | 🟡 Partial | 70–89% of references resolve, or a snippet is paraphrased rather than exact, or one claim lacks evidence. Usable but must be spot-checked before planning. |
| **L1** | 🟠 Weak | 40–69% accuracy, or a stated root cause is unsupported by the cited code. Re-research required for the failing items. |
| **L0** | 🔴 Unreliable | < 40% accuracy, fabricated references, or snippets that do not exist in source. Do not plan from this; send back to the Bug Researcher. |

## How to Measure

1. **Reference resolution rate** = (references that point to a real file:line) ÷ (total references).
2. **Snippet fidelity** = (snippets that match source exactly) ÷ (total snippets).
3. **Claim support** = each stated root cause is backed by at least one verified snippet.
4. Take the **lowest** level implied by the three metrics — quality is gated by its weakest dimension.

## Required `verified-research.md` Sections

The verifier MUST emit these sections, in this order:

1. **Verification Summary** — overall `PASS`/`FAIL`, the Research Quality level + label from the
   table above, and the three measured metrics.
2. **Verified Claims** — each claim with its file:line and a ✅ confirming the snippet matched.
3. **Discrepancies Found** — every mismatch (wrong line, paraphrased snippet, unsupported claim),
   or "None".
4. **Research Quality Assessment** — the chosen level + a short reasoning paragraph tying the
   metrics to the level.
5. **References** — the list of files/paths inspected during verification.

## Pass/Fail Rule

- **PASS** at **L3 or higher**.
- **FAIL** at **L2 or lower** (planning should not proceed until the flagged items are re-researched).
