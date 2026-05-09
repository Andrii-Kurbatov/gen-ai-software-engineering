# How to Run

## Prerequisites
- Node.js ≥ 18
- npm

## Install & Start

```bash
cd homework-1
npm install
npm start
# → Banking API running on http://localhost:3000
```

Use `PORT=8080 npm start` to run on a different port.

---

## Sample Requests

The examples below use account `ACC-AA111` throughout. Run them in order — later examples (balance, summary, interest) show the expected output after all preceding transactions have been created.

### Create a deposit (USD)
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA111","amount":1000,"currency":"USD","type":"deposit"}'
```

### Create a deposit (UAH)
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA111","amount":1000,"currency":"UAH","type":"deposit"}'
```

### Create a transfer
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-AA111","toAccount":"ACC-BB222","amount":250.00,"currency":"USD","type":"transfer"}'
```

### Create a withdrawal
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-AA111","amount":50,"currency":"USD","type":"withdrawal"}'
```

### List all transactions
```bash
curl http://localhost:3000/transactions
```

### Filter transactions
```bash
# By account
curl "http://localhost:3000/transactions?accountId=ACC-AA111"

# By type
curl "http://localhost:3000/transactions?type=deposit"

# By date range
curl "http://localhost:3000/transactions?from=2026-01-01&to=2026-12-31"

# Combined
curl "http://localhost:3000/transactions?accountId=ACC-AA111&type=transfer"
```

### Get transaction by ID
```bash
curl http://localhost:3000/transactions/<id>
```

### Get account balance (per currency)
```bash
curl http://localhost:3000/accounts/ACC-AA111/balance
# → { "accountId": "ACC-AA111", "balances": { "USD": 700, "UAH": 1000 } }
```
*After the four transactions above: 1000 deposit − 250 transfer − 50 withdrawal = 700 USD; 1000 UAH deposit.*

### Get account summary
```bash
curl http://localhost:3000/accounts/ACC-AA111/summary
# → {
#     "totalDeposits":    { "USD": 1000, "UAH": 1000 },
#     "totalWithdrawals": { "USD": 300 },
#     "transactionCount": 4,
#     "mostRecentTransaction": "2026-04-30T..."
#   }
```
*totalWithdrawals USD = 250 (outgoing transfer) + 50 (withdrawal).*

### Get simple interest on current balance
```bash
# 5% annual rate for 30 days
curl "http://localhost:3000/accounts/ACC-AA111/interest?rate=0.05&days=30"
# → {
#     "balances":           { "USD": 700,  "UAH": 1000  },
#     "interest":           { "USD": 2.88, "UAH": 4.11  },
#     "overdraftCurrencies": []
#   }
```
*Simple interest = principal × rate × (days / 365). Currencies with negative balance earn 0 and are listed in `overdraftCurrencies`.*

---

## Validation Errors

Invalid requests return HTTP `400` with field-level detail:
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount":-5,"currency":"XYZ","type":"refund"}'
# → { "error": "Validation failed", "details": [...] }
```
