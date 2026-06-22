import express from 'express';
import { createExpense, getExpense, getSummary, listExpenses } from './store';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/expenses', (req, res) => {
    const { description, amount, category } = req.body ?? {};
    const expense = createExpense({ description, amount, category });
    res.status(201).json(expense);
  });

  app.get('/expenses', (req, res) => {
    const { category, maxAmount } = req.query as { category?: string; maxAmount?: string };
    res.json(listExpenses({ category, maxAmount }));
  });

  // NOTE: registered before `/expenses/:id` so "filter" is not treated as an id.
  app.get('/expenses/filter', (req, res) => {
    const { category, maxAmount } = req.query as { category?: string; maxAmount?: string };
    res.json(listExpenses({ category, maxAmount }));
  });

  app.get('/expenses/:id', (req, res) => {
    const expense = getExpense(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json(expense);
  });

  app.get('/summary', (_req, res) => {
    res.json(getSummary());
  });

  return app;
}
