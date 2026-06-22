import { createApp } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Expense Tracker API listening on http://localhost:${PORT}`);
});
