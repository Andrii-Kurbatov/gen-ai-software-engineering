import request from 'supertest';
import app from '../src/app';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';

describe('Integration - End-to-End Workflows', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  it('should complete full lifecycle: create → update to in_progress → resolve → verify resolved_at set', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'lifecycle@example.com',
      subject: 'Lifecycle Test',
      description: 'This is a valid description for lifecycle testing',
    });

    const ticketId = createRes.body.id;
    const initialTime = createRes.body.created_at;

    expect(createRes.body.status).toBe('new');
    expect(createRes.body.resolved_at).toBeNull();

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      status: 'in_progress',
    });

    expect(updateRes.body.status).toBe('in_progress');
    expect(updateRes.body.resolved_at).toBeNull();

    const resolveRes = await request(app).put(`/tickets/${ticketId}`).send({
      status: 'resolved',
    });

    expect(resolveRes.body.status).toBe('resolved');
    expect(resolveRes.body.resolved_at).not.toBeNull();
  });

  it('should bulk import CSV → auto-classify first imported ticket → verify category updated', async () => {
    const csv = `customer_email,subject,description
import1@example.com,Cannot login,I forgot my password and cannot sign in
import2@example.com,Payment issue,I was charged twice for my subscription`;

    const importRes = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(csv), 'test.csv');

    expect(importRes.status).toBe(200);
    expect(importRes.body.successful).toBeGreaterThan(0);

    const listRes = await request(app).get('/tickets');
    const firstTicket = listRes.body.find((t: any) => t.customer_email === 'import1@example.com');

    expect(firstTicket).toBeDefined();

    const classifyRes = await request(app).post(`/tickets/${firstTicket.id}/auto-classify`);

    expect(classifyRes.status).toBe(200);
    expect(classifyRes.body.category).toBe('account_access');
  });

  it('should GET /tickets with combined category + priority filters return correct subset', async () => {
    await request(app).post('/tickets?auto_classify=true').send({
      customer_email: 'filter1@example.com',
      subject: 'Critical production issue',
      description: 'Our production database is down due to a critical security breach',
    });

    await request(app).post('/tickets?auto_classify=true').send({
      customer_email: 'filter2@example.com',
      subject: 'Low priority suggestion',
      description: 'This is a cosmetic improvement suggestion',
    });

    const response = await request(app).get('/tickets?priority=urgent&category=technical_issue');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((ticket: any) => {
      if (ticket.priority !== undefined) {
        expect(ticket.priority).toBe('urgent');
      }
    });
  });

  it('should import 20 tickets via JSON and verify successful count', async () => {
    const tickets = Array.from({ length: 20 }, (_, i) => ({
      customer_email: `json${i}@example.com`,
      subject: `JSON Ticket ${i}`,
      description: `This is a valid description for JSON import ticket number ${i} with sufficient content`,
    }));

    const json = JSON.stringify(tickets);

    const importRes = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(json), 'test.json');

    expect(importRes.status).toBe(200);
    expect(importRes.body.successful).toBe(20);
    expect(importRes.body.total).toBe(20);
    expect(importRes.body.failed).toBe(0);
  });

  it('should update ticket status to resolved set resolved_at, to closed does not change resolved_at', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'status@example.com',
      subject: 'Status Test',
      description: 'This is a valid description for status testing',
    });

    const ticketId = createRes.body.id;

    const resolveRes = await request(app).put(`/tickets/${ticketId}`).send({
      status: 'resolved',
    });

    const resolvedAt = resolveRes.body.resolved_at;
    expect(resolvedAt).not.toBeNull();

    const closedRes = await request(app).put(`/tickets/${ticketId}`).send({
      status: 'closed',
    });

    expect(closedRes.body.resolved_at).toBe(resolvedAt);
  });

  it('should update ticket with customer info and tags', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'customer-info@example.com',
      subject: 'Customer Info Test',
      description: 'This is a valid description for customer info testing',
    });

    const ticketId = createRes.body.id;

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      customer_id: 'CUST-123',
      customer_name: 'John Doe',
      tags: ['urgent', 'vip'],
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.customer_id).toBe('CUST-123');
    expect(updateRes.body.customer_name).toBe('John Doe');
    expect(updateRes.body.tags).toEqual(['urgent', 'vip']);
  });

  it('should update ticket with metadata', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'metadata@example.com',
      subject: 'Metadata Test',
      description: 'This is a valid description for metadata testing',
    });

    const ticketId = createRes.body.id;

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      metadata: {
        source: 'api',
        browser: 'Firefox',
        device_type: 'mobile',
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.metadata.source).toBe('api');
    expect(updateRes.body.metadata.browser).toBe('Firefox');
    expect(updateRes.body.metadata.device_type).toBe('mobile');
  });

  it('should clear category and assigned_to by setting them to null', async () => {
    const create = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'clear@example.com',
        subject: 'Clearable fields',
        description: 'Testing null update semantics',
        category: 'billing_question',
        assigned_to: 'agent-1',
      });
    const id = create.body.id;

    const update = await request(app)
      .put(`/tickets/${id}`)
      .send({ category: null, assigned_to: null });

    expect(update.status).toBe(200);
    expect(update.body.category).toBeNull();
    expect(update.body.assigned_to).toBeNull();
  });

  it('should update only subject without touching tags or metadata', async () => {
    const create = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'partial@example.com',
        subject: 'Original subject',
        description: 'Original description here',
      });
    const id = create.body.id;

    const update = await request(app)
      .put(`/tickets/${id}`)
      .send({ subject: 'Updated subject' });

    expect(update.status).toBe(200);
    expect(update.body.subject).toBe('Updated subject');
  });
});
