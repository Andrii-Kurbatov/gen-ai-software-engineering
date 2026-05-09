const express = require('express');
const transactionsRouter = require('./routes/transactions');
const accountsRouter = require('./routes/accounts');

const app = express();

app.use(express.json());

app.use('/transactions', transactionsRouter);
app.use('/accounts', accountsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

module.exports = app;
