First read `agents.md` for context (the runtime pipeline protocol is in `specification.md`).

Run the multi-agent banking pipeline end-to-end:
1. Check that `sample-transactions.json` exists.
2. Clear the `shared/` directories (input, processing, output, results) — keep `.gitkeep` files.
3. Run: `python integrator.py`
4. Show a summary from `shared/results/pipeline_summary.json`.
5. Report any rejected transactions and their `reason`.
