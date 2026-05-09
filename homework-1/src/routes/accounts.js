const { Router } = require('express');
const { findAll } = require('../store/transactions');
const { ACCOUNT_PATTERN } = require('../validators/transaction');

const router = Router();

router.param('accountId', (req, res, next, accountId) => {
  if (!ACCOUNT_PATTERN.test(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID format. Expected ACC-XXXXX (5 alphanumeric characters)' });
  }
  next();
});

function getRelated(accountId) {
  return findAll().filter(
    (tx) => tx.fromAccount === accountId || tx.toAccount === accountId
  );
}

function computeBalances(accountId, related) {
  const balances = {};
  for (const tx of related) {
    const cur = tx.currency;
    if (!balances[cur]) balances[cur] = 0;

    if (tx.type === 'deposit' && tx.toAccount === accountId) {
      balances[cur] += tx.amount;
    } else if (tx.type === 'withdrawal' && tx.fromAccount === accountId) {
      balances[cur] -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.toAccount === accountId) balances[cur] += tx.amount;
      if (tx.fromAccount === accountId) balances[cur] -= tx.amount;
    }
  }
  for (const cur of Object.keys(balances)) {
    balances[cur] = Math.round(balances[cur] * 100) / 100;
  }
  return balances;
}

router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;
  const related = getRelated(accountId);
  if (related.length === 0) return res.status(404).json({ error: 'Account not found' });

  res.json({ accountId, balances: computeBalances(accountId, related) });
});

router.get('/:accountId/summary', (req, res) => {
  const { accountId } = req.params;
  const related = getRelated(accountId);
  if (related.length === 0) return res.status(404).json({ error: 'Account not found' });

  const totalDeposits = {};
  const totalWithdrawals = {};
  let mostRecentDate = null;

  for (const tx of related) {
    const ts = new Date(tx.timestamp);
    if (!mostRecentDate || ts > mostRecentDate) mostRecentDate = ts;

    const cur = tx.currency;

    if (tx.type === 'deposit' && tx.toAccount === accountId) {
      totalDeposits[cur] = Math.round(((totalDeposits[cur] ?? 0) + tx.amount) * 100) / 100;
    } else if (tx.type === 'withdrawal' && tx.fromAccount === accountId) {
      totalWithdrawals[cur] = Math.round(((totalWithdrawals[cur] ?? 0) + tx.amount) * 100) / 100;
    } else if (tx.type === 'transfer') {
      if (tx.toAccount === accountId) {
        totalDeposits[cur] = Math.round(((totalDeposits[cur] ?? 0) + tx.amount) * 100) / 100;
      }
      if (tx.fromAccount === accountId) {
        totalWithdrawals[cur] = Math.round(((totalWithdrawals[cur] ?? 0) + tx.amount) * 100) / 100;
      }
    }
  }

  res.json({
    accountId,
    totalDeposits,
    totalWithdrawals,
    transactionCount: related.length,
    mostRecentTransaction: mostRecentDate.toISOString(),
  });
});

router.get('/:accountId/interest', (req, res) => {
  const { accountId } = req.params;
  const { rate, days } = req.query;

  const rateNum = Number(rate);
  const daysNum = Number(days);

  if (rate === undefined || !Number.isFinite(rateNum) || rateNum < 0) {
    return res.status(400).json({ error: '"rate" must be a non-negative finite number (e.g. 0.05)' });
  }
  if (days === undefined || !Number.isFinite(daysNum) || daysNum <= 0 || !Number.isInteger(daysNum)) {
    return res.status(400).json({ error: '"days" must be a positive integer' });
  }

  const related = getRelated(accountId);
  if (related.length === 0) return res.status(404).json({ error: 'Account not found' });

  const balances = computeBalances(accountId, related);
  const interest = {};
  const overdraftCurrencies = [];

  for (const [cur, principal] of Object.entries(balances)) {
    if (principal < 0) {
      overdraftCurrencies.push(cur);
      interest[cur] = 0;
    } else {
      interest[cur] = Math.round(principal * rateNum * (daysNum / 365) * 100) / 100;
    }
  }

  res.json({ accountId, rate: rateNum, days: daysNum, balances, interest, overdraftCurrencies });
});

module.exports = router;
