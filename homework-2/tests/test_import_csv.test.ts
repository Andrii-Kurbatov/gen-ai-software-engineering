import { ImportService } from '../src/services/import.service';
import { TicketService } from '../src/services/ticket.service';
import { TicketRepository } from '../src/repositories/ticket.repository';
import { ClassificationService } from '../src/services/classification.service';
import { ParseError } from '../src/utils/errors';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';

describe('ImportService - CSV', () => {
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

  it('should return correct ImportResult counts for valid CSV', async () => {
    const csv = `customer_email,subject,description
test1@example.com,Subject 1,This is a valid description for testing
test2@example.com,Subject 2,Another valid description with sufficient content`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip invalid records and insert valid ones', async () => {
    const csv = `customer_email,subject,description
invalid-email,Subject,This is invalid email test
valid@example.com,Valid Subject,This is a very valid description with enough content
another@example.com,Another,Description too short for this`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.total).toBe(3);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should throw ParseError for malformed CSV structure', async () => {
    const csv = `customer_email,subject,description
"unclosed quote,Subject,Description`;

    const buffer = Buffer.from(csv);

    await expect(importService.importFromBuffer(buffer, 'csv')).rejects.toThrow(ParseError);
  });

  it('should return zero counts for empty CSV', async () => {
    const csv = `customer_email,subject,description`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.total).toBe(0);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should record errors per row for missing required fields', async () => {
    const csv = `customer_email,subject,description
test@example.com,,Missing subject description`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.failed).toBe(1);
    expect(result.errors[0].row).toBe(1);
    expect(result.errors[0].errors.length).toBeGreaterThan(0);
  });

  it('should return failed count equal to total when all rows are invalid', async () => {
    const csv = `customer_email,subject,description
invalid,too,short
bad-email,a,x
not-email,b,y`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.total).toBe(3);
    expect(result.failed).toBe(3);
    expect(result.successful).toBe(0);
  });

  it('should handle CSV with extra fields in records', async () => {
    const csv = `customer_email,subject,description,extra_field
test@example.com,Valid Subject,This is a valid description with enough content,ignored`;

    const buffer = Buffer.from(csv);
    const result = await importService.importFromBuffer(buffer, 'csv');

    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
  });
});
