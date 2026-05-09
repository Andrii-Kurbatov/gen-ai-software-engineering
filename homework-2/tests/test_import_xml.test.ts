import { ImportService } from '../src/services/import.service';
import { TicketService } from '../src/services/ticket.service';
import { TicketRepository } from '../src/repositories/ticket.repository';
import { ClassificationService } from '../src/services/classification.service';
import { ParseError } from '../src/utils/errors';
import { runMigrations } from '../src/db/migrations';
import { closeDb } from '../src/db/database';

describe('ImportService - XML', () => {
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

  it('should import valid XML with multiple tickets', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>test1@example.com</customer_email>
    <subject>Subject 1</subject>
    <description>This is a valid description for testing</description>
  </ticket>
  <ticket>
    <customer_email>test2@example.com</customer_email>
    <subject>Subject 2</subject>
    <description>Another valid description with sufficient content</description>
  </ticket>
</tickets>`;

    const buffer = Buffer.from(xml);
    const result = await importService.importFromBuffer(buffer, 'xml');

    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should throw ParseError for malformed XML', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>test@example.com</customer_email>
    <subject>Subject</subject>`;

    const buffer = Buffer.from(xml);

    await expect(importService.importFromBuffer(buffer, 'xml')).rejects.toThrow(
      ParseError
    );
  });

  it('should import single-ticket XML (not array)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>single@example.com</customer_email>
    <subject>Single Ticket</subject>
    <description>This is a valid single ticket description</description>
  </ticket>
</tickets>`;

    const buffer = Buffer.from(xml);
    const result = await importService.importFromBuffer(buffer, 'xml');

    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should handle mixed valid and invalid records per-record', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>valid@example.com</customer_email>
    <subject>Valid Subject</subject>
    <description>This is a valid description content</description>
  </ticket>
  <ticket>
    <customer_email>invalid-email</customer_email>
    <subject>Invalid</subject>
    <description>Short</description>
  </ticket>
  <ticket>
    <customer_email>another@example.com</customer_email>
    <subject>Another Valid</subject>
    <description>Another valid description with sufficient content</description>
  </ticket>
</tickets>`;

    const buffer = Buffer.from(xml);
    const result = await importService.importFromBuffer(buffer, 'xml');

    expect(result.total).toBe(3);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('should throw ParseError for XML with no ticket elements', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets/>`;

    const buffer = Buffer.from(xml);

    await expect(importService.importFromBuffer(buffer, 'xml')).rejects.toThrow(
      ParseError
    );
  });

  it('should throw ParseError for XML with unknown root element', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<unknown>
  <ticket>
    <customer_email>test@example.com</customer_email>
    <subject>Test</subject>
    <description>Valid description content</description>
  </ticket>
</unknown>`;

    const buffer = Buffer.from(xml);

    await expect(importService.importFromBuffer(buffer, 'xml')).rejects.toThrow(
      ParseError
    );
  });

  it('should throw ParseError for XML with root but no item elements', async () => {
    const xml = `<tickets><metadata>no items here</metadata></tickets>`;
    await expect(
      importService.importFromBuffer(Buffer.from(xml), 'xml')
    ).rejects.toThrow(ParseError);
  });
});
