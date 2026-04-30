const { v4: uuidv4 } = require('uuid');

const transactions = [];

function findAll() {
  return transactions;
}

function findById(id) {
  return transactions.find((tx) => tx.id === id) || null;
}

function insert(data) {
  const tx = {
    ...data,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    status: 'completed',
  };
  transactions.push(tx);
  return tx;
}

function filter({ accountId, type, from, to } = {}) {
  return transactions.filter((tx) => {
    if (accountId && tx.fromAccount !== accountId && tx.toAccount !== accountId) return false;
    if (type && tx.type !== type) return false;
    if (from && new Date(tx.timestamp) < new Date(from)) return false;
    if (to && new Date(tx.timestamp) > new Date(to + 'T23:59:59.999Z')) return false;
    return true;
  });
}

module.exports = { findAll, findById, insert, filter };
