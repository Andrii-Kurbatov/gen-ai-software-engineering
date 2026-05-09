const { Router } = require('express');
const { findById, insert, filter } = require('../store/transactions');
const { transactionSchema, validate } = require('../validators/transaction');

const router = Router();

router.post('/', validate(transactionSchema), (req, res) => {
  const tx = insert(req.body);
  res.status(201).json(tx);
});

router.get('/', (req, res) => {
  const { from, to } = req.query;
  if (from && isNaN(Date.parse(from))) {
    return res.status(400).json({ error: 'Invalid "from" date' });
  }
  if (to && isNaN(Date.parse(to))) {
    return res.status(400).json({ error: 'Invalid "to" date' });
  }
  res.json(filter(req.query));
});

router.get('/:id', (req, res) => {
  const tx = findById(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

module.exports = router;
