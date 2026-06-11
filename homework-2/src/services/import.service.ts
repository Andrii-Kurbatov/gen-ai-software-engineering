import { parse as parseCsv } from 'csv-parse/sync';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { getDb } from '../db/database';
import {
  CreateTicketSchema,
  ImportResult,
  ImportError,
  RawRecord,
  ImportFormat,
} from '../types/ticket.types';
import { TicketService } from './ticket.service';
import { ParseError, UnsupportedMediaError } from '../utils/errors';

export class ImportService {
  constructor(private ticketService: TicketService) {}

  async importFromBuffer(
    buffer: Buffer,
    format: ImportFormat
  ): Promise<ImportResult> {
    const records = this.parseBuffer(buffer, format);
    return this.processRecords(records);
  }

  private parseBuffer(buffer: Buffer, format: ImportFormat): RawRecord[] {
    if (format === 'csv') return this.parseCsv(buffer);
    if (format === 'json') return this.parseJson(buffer);
    if (format === 'xml') return this.parseXml(buffer);
    throw new UnsupportedMediaError(format);
  }

  private parseCsv(buffer: Buffer): RawRecord[] {
    try {
      const text = buffer.toString('utf-8');
      const records = parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as RawRecord[];
      return records;
    } catch (error) {
      throw new ParseError(
        `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseJson(buffer: Buffer): RawRecord[] {
    try {
      const text = buffer.toString('utf-8');
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new ParseError('JSON must be an array of objects');
      }

      return data;
    } catch (error) {
      if (error instanceof ParseError) throw error;
      throw new ParseError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseXml(buffer: Buffer): RawRecord[] {
    try {
      const text = buffer.toString('utf-8');

      const validation = XMLValidator.validate(text);
      if (validation !== true) {
        throw new ParseError(
          `Malformed XML: ${(validation as { err: { msg: string } }).err.msg}`
        );
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        parseAttributeValue: false,
      });
      const result = parser.parse(text);

      const root = result.tickets || result.records || result.data;

      if (!root) {
        throw new ParseError(
          'XML must have a root element: <tickets>, <records>, or <data>'
        );
      }

      let items = root.ticket || root.record || root.item;

      if (!items) {
        throw new ParseError('No ticket/record/item elements found in XML');
      }

      if (!Array.isArray(items)) {
        items = [items];
      }

      return items;
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(
        `Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private processRecords(records: RawRecord[]): ImportResult {
    const errors: ImportError[] = [];
    let successful = 0;

    const db = getDb();
    const runImport = db.transaction(() => {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        const result = CreateTicketSchema.safeParse(record);
        if (result.success) {
          this.ticketService.create(result.data);
          successful++;
        } else {
          const errorMessages = result.error.errors.map(
            (err) =>
              `${err.path.join('.')}: ${err.message}`
          );

          errors.push({
            row: i + 1,
            record,
            errors: errorMessages,
          });
        }
      }
    });

    runImport();

    return {
      total: records.length,
      successful,
      failed: errors.length,
      errors,
    };
  }
}
