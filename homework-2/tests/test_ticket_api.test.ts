import request from 'supertest';
import app from '../src/app';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';

describe('Ticket API Endpoints', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  it('should POST /tickets with 201 and valid body', async () => {
    const response = await request(app).post('/tickets').send({
      customer_email: 'test@example.com',
      subject: 'Test Subject',
      description: 'This is a valid description with enough characters',
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.customer_email).toBe('test@example.com');
    expect(response.body.subject).toBe('Test Subject');
  });

  it('should POST /tickets with 400 when missing required fields', async () => {
    const response = await request(app).post('/tickets').send({
      subject: 'Test Subject',
      description: 'This is a valid description with enough characters',
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should POST /tickets with 400 for invalid email', async () => {
    const response = await request(app).post('/tickets').send({
      customer_email: 'not-an-email',
      subject: 'Test Subject',
      description: 'This is a valid description with enough characters',
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should POST /tickets?auto_classify=true and return with category/priority set', async () => {
    const response = await request(app)
      .post('/tickets?auto_classify=true')
      .send({
        customer_email: 'test@example.com',
        subject: 'Cannot login to my account',
        description: 'I forgot my password and cannot sign in to the system',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('category');
    expect(response.body).toHaveProperty('priority');
    expect(response.body.category).toBe('account_access');
  });

  it('should GET /tickets and return 200 with array', async () => {
    await request(app).post('/tickets').send({
      customer_email: 'ticket1@example.com',
      subject: 'Ticket 1',
      description: 'This is a valid description for testing purposes',
    });

    const response = await request(app).get('/tickets');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should GET /tickets?status=new and return filtered results', async () => {
    const response = await request(app).get('/tickets?status=new');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((ticket: any) => {
      expect(ticket.status).toBe('new');
    });
  });

  it('should GET /tickets/:id with 200 for existing ticket', async () => {
    const createResponse = await request(app).post('/tickets').send({
      customer_email: 'gettest@example.com',
      subject: 'Get Test',
      description: 'This is a valid description for get testing',
    });

    const ticketId = createResponse.body.id;
    const response = await request(app).get(`/tickets/${ticketId}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(ticketId);
  });

  it('should GET /tickets/:id with 404 for unknown id', async () => {
    const response = await request(app).get('/tickets/nonexistent-id-12345');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('should PUT /tickets/:id with 200 and update fields', async () => {
    const createResponse = await request(app).post('/tickets').send({
      customer_email: 'updatetest@example.com',
      subject: 'Update Test',
      description: 'This is a valid description for update testing',
    });

    const ticketId = createResponse.body.id;
    const response = await request(app).put(`/tickets/${ticketId}`).send({
      subject: 'Updated Subject',
      status: 'in_progress',
    });

    expect(response.status).toBe(200);
    expect(response.body.subject).toBe('Updated Subject');
    expect(response.body.status).toBe('in_progress');
  });

  it('should DELETE /tickets/:id with 204', async () => {
    const createResponse = await request(app).post('/tickets').send({
      customer_email: 'deletetest@example.com',
      subject: 'Delete Test',
      description: 'This is a valid description for delete testing',
    });

    const ticketId = createResponse.body.id;
    const response = await request(app).delete(`/tickets/${ticketId}`);

    expect(response.status).toBe(204);
  });

  it('should POST /tickets/:id/auto-classify with 200 and return ClassificationResult', async () => {
    const createResponse = await request(app).post('/tickets').send({
      customer_email: 'classifytest@example.com',
      subject: 'Login problem with password reset',
      description: 'Cannot login with password and need help resetting my account',
    });

    const ticketId = createResponse.body.id;
    const response = await request(app).post(`/tickets/${ticketId}/auto-classify`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('category');
    expect(response.body).toHaveProperty('priority');
    expect(response.body).toHaveProperty('confidence');
    expect(response.body).toHaveProperty('keywords');
  });

  it('should GET /tickets?assigned_to=user with filtering', async () => {
    const response = await request(app).get('/tickets?assigned_to=');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should GET /tickets?status=unknown with 400 for invalid status filter', async () => {
    const response = await request(app).get('/tickets?status=invalid_status');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should POST /tickets/import with 400 when no file provided', async () => {
    const response = await request(app)
      .post('/tickets/import')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should POST /tickets/import with 415 for unsupported file type', async () => {
    const response = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('some data'), 'test.txt');

    expect(response.status).toBe(415);
    expect(response.body).toHaveProperty('error');
  });

  it('should PUT /tickets/:id with 400 for empty update body', async () => {
    const createResponse = await request(app).post('/tickets').send({
      customer_email: 'emptyupdate@example.com',
      subject: 'Empty Update Test',
      description: 'This is a valid description for empty update test',
    });

    const ticketId = createResponse.body.id;
    const response = await request(app).put(`/tickets/${ticketId}`).send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should POST /tickets/:id/auto-classify with 404 for non-existent ticket', async () => {
    const response = await request(app).post('/tickets/nonexistent-id/auto-classify');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('should GET /tickets with invalid category filter', async () => {
    const response = await request(app).get('/tickets?category=invalid_category');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should PUT /tickets/:id with 404 for non-existent ticket', async () => {
    const response = await request(app).put('/tickets/nonexistent-id').send({
      status: 'in_progress',
    });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('should DELETE /tickets/:id with 404 for non-existent ticket', async () => {
    const response = await request(app).delete('/tickets/nonexistent-id');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('should PUT /tickets/:id and update only specified fields', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'partial@example.com',
      subject: 'Original Subject',
      description: 'This is a valid description for partial update testing',
    });

    const ticketId = createRes.body.id;

    // Update only priority
    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      priority: 'urgent',
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.priority).toBe('urgent');
    expect(updateRes.body.subject).toBe('Original Subject');
  });

  it('should PUT /tickets/:id with category update', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'category@example.com',
      subject: 'Category Test',
      description: 'This is a valid description for category update testing',
    });

    const ticketId = createRes.body.id;

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      category: 'billing_question',
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.category).toBe('billing_question');
  });

  it('should PUT /tickets/:id with assigned_to update', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'assigned@example.com',
      subject: 'Assign Test',
      description: 'This is a valid description for assignment testing',
    });

    const ticketId = createRes.body.id;

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      assigned_to: 'support-agent-1',
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.assigned_to).toBe('support-agent-1');
  });

  it('should PUT /tickets/:id with multiple field updates', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'multi@example.com',
      subject: 'Multi Update Test',
      description: 'This is a valid description for multi-field update testing',
    });

    const ticketId = createRes.body.id;

    const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
      subject: 'Updated Subject',
      description: 'Updated description with new content for the ticket',
      priority: 'high',
      category: 'billing_question',
      status: 'in_progress',
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.subject).toBe('Updated Subject');
    expect(updateRes.body.priority).toBe('high');
    expect(updateRes.body.category).toBe('billing_question');
    expect(updateRes.body.status).toBe('in_progress');
  });

  it('should PUT /tickets/:id and clear assigned_to by setting to null', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_email: 'clear@example.com',
      subject: 'Clear Field Test',
      description: 'This is a valid description for clearing field test',
    });

    const ticketId = createRes.body.id;

    // First assign it
    const assignRes = await request(app).put(`/tickets/${ticketId}`).send({
      assigned_to: 'agent-1',
    });

    expect(assignRes.body.assigned_to).toBe('agent-1');

    // Then clear it by setting to null
    const clearRes = await request(app).put(`/tickets/${ticketId}`).send({
      assigned_to: null,
    });

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.assigned_to).toBeNull();
  });

  it('should POST /tickets/import with CSV file and non-standard MIME type', async () => {
    const csv = 'customer_email,subject,description\ntest@example.com,Valid Test,This is a valid description content';

    const response = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'application/octet-stream' });

    expect(response.status).toBe(200);
    expect(response.body.successful).toBeGreaterThanOrEqual(1);
  });

  it('should POST /tickets/import with JSON file and application/octet-stream MIME type', async () => {
    const json = JSON.stringify([
      { customer_email: 'test@example.com', subject: 'Test', description: 'Valid description content' },
    ]);

    const response = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(json), { filename: 'test.json', contentType: 'application/octet-stream' });

    expect(response.status).toBe(200);
    expect(response.body.successful).toBe(1);
  });

  it('should POST /tickets/import with XML file and application/octet-stream MIME type', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>test@example.com</customer_email>
    <subject>Test Ticket</subject>
    <description>This is a valid description for XML testing</description>
  </ticket>
</tickets>`;

    const response = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(xml), { filename: 'test.xml', contentType: 'application/octet-stream' });

    expect(response.status).toBe(200);
    expect(response.body.successful).toBe(1);
  });

  it('should return 415 when octet-stream file has unrecognised extension', async () => {
    const response = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('data'), { filename: 'data.txt', contentType: 'application/octet-stream' });
    expect(response.status).toBe(415);
  });

  it('should return 500 when an unexpected error is thrown in createTicket', async () => {
    const { TicketService } = require('../src/services/ticket.service');
    jest.spyOn(TicketService.prototype, 'create').mockImplementationOnce(() => {
      throw new Error('unexpected internal failure');
    });
    const response = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        subject: 'Test subject',
        description: 'Test description here',
      });
    expect(response.status).toBe(500);
  });
});
