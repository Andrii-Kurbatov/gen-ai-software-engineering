import express, { NextFunction, Request, Response } from 'express';
import { runMigrations } from './db/migrations';
import ticketsRouter from './routes/tickets.routes';
import { AppError, ValidationError } from './utils/errors';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

runMigrations();

app.use('/tickets', ticketsRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

export default app;
