import { ImportService } from '../src/services/import.service';
import { TicketService } from '../src/services/ticket.service';
import { TicketRepository } from '../src/repositories/ticket.repository';
import { ClassificationService } from '../src/services/classification.service';
import { ParseError } from '../src/utils/errors';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';

describe('ImportService - JSON', () => {
  let importService: ImportService;

  beforeAll(() => {
    runMigrations();
    const repo = new TicketRepository();
    const classifier = new ClassificationService();
    const ticketService = new TicketService(repo, classifier);
    importService = new ImportService(ticketService);
  });

  afterAll(() => {
    closeDb();
  });

  it('should import valid JSON array correctly', async () => {
    const json = JSON.stringify([
      {
        customer_email: 'test1@example.com',
        subject: 'Subject 1',
        description: 'This is a valid description for testing',
      },
      {
        customer_email: 'test2@example.com',
        subject: 'Subject 2',
        description: 'Another valid description with sufficient content',
      },
    ]);

    const buffer = Buffer.from(json);
    const result = await importService.importFromBuffer(buffer, 'json');

    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should throw ParseError when JSON is not an array', async () => {
    const json = JSON.stringify({
      customer_email: 'test@example.com',
      subject: 'Subject',
      description: 'Valid description content',
    });

    const buffer = Buffer.from(json);

    await expect(importService.importFromBuffer(buffer, 'json')).rejects.toThrow(
      ParseError
    );
  });

  it('should throw ParseError for malformed JSON', async () => {
    const json = `[{"customer_email": "test@example.com", "subject": "Subject"`;

    const buffer = Buffer.from(json);

    await expect(importService.importFromBuffer(buffer, 'json')).rejects.toThrow(
      ParseError
    );
  });

  it('should handle mixed valid and invalid records per-record', async () => {
    const json = JSON.stringify([
      {
        customer_email: 'valid@example.com',
        subject: 'Valid Subject',
        description: 'This is a valid description content',
      },
      {
        customer_email: 'invalid-email',
        subject: 'Invalid',
        description: 'Too short',
      },
      {
        customer_email: 'another@example.com',
        subject: 'Another Valid',
        description: 'Another valid description with content',
      },
    ]);

    const buffer = Buffer.from(json);
    const result = await importService.importFromBuffer(buffer, 'json');

    expect(result.total).toBe(3);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('should return zero counts for empty array', async () => {
    const json = JSON.stringify([]);

    const buffer = Buffer.from(json);
    const result = await importService.importFromBuffer(buffer, 'json');

    expect(result.total).toBe(0);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should throw ParseError for invalid JSON format', async () => {
    const json = `[{"customer_email": "test@example.com"}`;

    const buffer = Buffer.from(json);

    await expect(importService.importFromBuffer(buffer, 'json')).rejects.toThrow(
      ParseError
    );
  });
});
