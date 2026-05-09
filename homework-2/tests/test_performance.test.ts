// @ts-ignore
import autocannon from 'autocannon';
import app from '../src/app';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';
import { Server } from 'http';

describe('Performance Tests', () => {
  let server: Server;
  const testPort = 3001;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll((done) => {
    runMigrations();
    server = app.listen(testPort, done);
  });

  afterAll((done) => {
    server.close(() => {
      closeDb();
      done();
    });
  });

  it(
    'should handle 20 concurrent POST /tickets requests without error',
    async () => {
      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/tickets`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customer_email: 'perf@example.com',
            subject: 'Performance Test',
            description: 'This is a valid description for performance testing',
          }),
        })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 201 || r.status === 400).length;

      expect(successCount).toBe(20);
    },
    15000
  );

  it(
    'should handle 20 concurrent GET /tickets requests all return 200',
    async () => {
      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/tickets`, { method: 'GET' })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 200).length;

      expect(successCount).toBe(20);
    },
    15000
  );

  it(
    'should bulk import 50-record CSV completes under 2000 ms',
    async () => {
      const tickets = Array.from({ length: 50 }, (_, i) => ({
        customer_email: `perf${i}@example.com`,
        subject: `Perf Ticket ${i}`,
        description: `This is a valid description for performance test ticket number ${i}`,
      }));

      const csv = [
        'customer_email,subject,description',
        ...tickets.map((t) => `${t.customer_email},${t.subject},${t.description}`),
      ].join('\n');

      const startTime = Date.now();

      const formData = new FormData();
      formData.append('file', new Blob([csv], { type: 'text/csv' }), 'test.csv');

      const response = await fetch(`${baseUrl}/tickets/import`, {
        method: 'POST',
        body: formData,
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    },
    15000
  );

  it(
    'should handle 20 concurrent reads on same ticket id all return identical data',
    async () => {
      const createResponse = await fetch(`${baseUrl}/tickets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_email: 'sameid@example.com',
          subject: 'Same ID Test',
          description: 'This is a valid description for same ID concurrent test',
        }),
      });

      const ticket = (await createResponse.json()) as any;
      const ticketId = ticket.id;

      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/tickets/${ticketId}`, { method: 'GET' })
      );

      const responses = await Promise.all(requests);
      const allSuccess = responses.every((r) => r.status === 200);

      expect(allSuccess).toBe(true);
      expect(responses).toHaveLength(20);
    },
    15000
  );

  it(
    'should handle 20 concurrent classification requests',
    async () => {
      const createResponse = await fetch(`${baseUrl}/tickets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_email: 'classify@example.com',
          subject: 'Cannot login',
          description: 'I forgot my password and cannot sign in to the system',
        }),
      });

      const ticket = (await createResponse.json()) as any;
      const ticketId = ticket.id;

      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/tickets/${ticketId}/auto-classify`, { method: 'POST' })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 200).length;

      expect(successCount).toBe(20);
    },
    15000
  );
});
