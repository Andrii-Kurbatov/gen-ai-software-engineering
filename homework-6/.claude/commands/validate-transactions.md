First read `agents.md` for context (the validation rules are defined in `specification.md`).

Validate all transactions in `sample-transactions.json` without processing them:
1. Run: `python -m agents.transaction_validator --dry-run`
2. Report total count, valid count, invalid count, and the reason for each rejection.
3. Present the results as a table.
