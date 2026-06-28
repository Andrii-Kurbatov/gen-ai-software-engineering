import request from 'supertest';
import { createApp } from '../src/app';

// Minimal smoke test so `npm test` is wired up before the pipeline runs.
// The Unit Test Generator agent adds bug-specific tests for the changed code.
describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
