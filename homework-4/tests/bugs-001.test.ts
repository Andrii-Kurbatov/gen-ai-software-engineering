import request from 'supertest';
import { createApp } from '../src/app';
import { reset } from '../src/store';

const app = createApp();

beforeEach(() => {
  reset();
});

// ─── BUG-001: maxAmount filter string-vs-number coercion ──────────────────────

describe('GET /expenses?maxAmount= (BUG-001)', () => {
  it('excludes expenses whose amount exceeds the numeric maxAmount', async () => {
    // This is the regression case: before the fix, the cast `as unknown as number`
    // left `max` as a string, and numeric-vs-string JS coercion could produce
    // incorrect results (the documented example: maxAmount="9" vs amount 100).
    await request(app)
      .post('/expenses')
      .send({ description: 'cheap', amount: 5, category: 'food' });
    await request(app)
      .post('/expenses')
      .send({ description: 'expensive', amount: 100, category: 'food' });

    const res = await request(app).get('/expenses?maxAmount=9');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(5);
  });

  it('includes expenses whose amount equals maxAmount (boundary)', async () => {
    await request(app)
      .post('/expenses')
      .send({ description: 'boundary', amount: 9, category: 'food' });

    const res = await request(app).get('/expenses?maxAmount=9');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(9);
  });

  it('returns all expenses when maxAmount is not a valid number (no-op)', async () => {
    // Before the fix, a non-numeric maxAmount caused NaN comparisons that
    // silently excluded all expenses. The fix guards with isNaN and skips.
    await request(app)
      .post('/expenses')
      .send({ description: 'any', amount: 50, category: 'misc' });

    const res = await request(app).get('/expenses?maxAmount=notanumber');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns all expenses when no maxAmount filter is applied (happy path)', async () => {
    await request(app)
      .post('/expenses')
      .send({ description: 'a', amount: 5, category: 'food' });
    await request(app)
      .post('/expenses')
      .send({ description: 'b', amount: 100, category: 'food' });

    const res = await request(app).get('/expenses');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ─── BUG-002: missing 404 on unknown expense id ───────────────────────────────

describe('GET /expenses/:id (BUG-002)', () => {
  it('returns 404 with error body when the expense id does not exist', async () => {
    // Before the fix, the handler called res.json(undefined) returning 200
    // with an empty body instead of the documented 404 error shape.
    const res = await request(app).get('/expenses/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Expense not found' });
  });

  it('returns 200 with the expense object when the id exists (happy path)', async () => {
    const create = await request(app)
      .post('/expenses')
      .send({ description: 'lunch', amount: 12.5, category: 'food' });

    const { id } = create.body;
    const res = await request(app).get(`/expenses/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.amount).toBe(12.5);
  });
});

// ─── SEC-001: eval() code injection removed from GET /expenses/filter ─────────

describe('GET /expenses/filter (SEC-001)', () => {
  it('does not execute arbitrary code passed as expr param', async () => {
    // Before the fix, ?expr=process.exit(1) would have killed the server process.
    // After the fix, the expr param is ignored and an empty array is returned.
    const res = await request(app).get(
      '/expenses/filter?expr=process.exit(1)',
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by category via safe structured params (happy path)', async () => {
    await request(app)
      .post('/expenses')
      .send({ description: 'book', amount: 15, category: 'education' });
    await request(app)
      .post('/expenses')
      .send({ description: 'coffee', amount: 3, category: 'food' });

    const res = await request(app).get('/expenses/filter?category=education');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('education');
  });

  it('filters by maxAmount via safe structured params', async () => {
    await request(app)
      .post('/expenses')
      .send({ description: 'cheap', amount: 4, category: 'food' });
    await request(app)
      .post('/expenses')
      .send({ description: 'pricey', amount: 50, category: 'food' });

    const res = await request(app).get('/expenses/filter?maxAmount=10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(4);
  });
});
