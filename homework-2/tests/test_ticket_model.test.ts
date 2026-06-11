import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketFiltersSchema,
} from '../src/types/ticket.types';
import { closeDb, getDb } from '../src/db/database';

describe('Ticket Model Validation', () => {
  describe('CreateTicketSchema', () => {
    it('should accept valid minimal payload', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'Test subject',
        description: 'This is a valid description with enough characters',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing customer_email', () => {
      const result = CreateTicketSchema.safeParse({
        subject: 'Test',
        description: 'This is a valid description',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'not-an-email',
        subject: 'Test',
        description: 'Valid description content here',
      });
      expect(result.success).toBe(false);
    });

    it('should reject subject shorter than 1 character', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: '',
        description: 'Valid description content here',
      });
      expect(result.success).toBe(false);
    });

    it('should reject subject longer than 200 characters', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'a'.repeat(201),
        description: 'Valid description content here',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description shorter than 10 characters', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description longer than 2000 characters', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority enum', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Valid description',
        priority: 'invalid_priority',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status enum', () => {
      const result = CreateTicketSchema.safeParse({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Valid description',
        status: 'invalid_status',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateTicketSchema', () => {
    it('should reject empty object', () => {
      const result = UpdateTicketSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject unknown fields', () => {
      const result = UpdateTicketSchema.safeParse({
        subject: 'Updated subject',
        unknown_field: 'should fail',
      });
      expect(result.success).toBe(false);
    });

    it('should accept single field update', () => {
      const result = UpdateTicketSchema.safeParse({
        status: 'in_progress',
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple field updates', () => {
      const result = UpdateTicketSchema.safeParse({
        subject: 'Updated',
        priority: 'high',
        status: 'resolved',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TicketFiltersSchema', () => {
    it('should accept empty filters', () => {
      const result = TicketFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept status filter', () => {
      const result = TicketFiltersSchema.safeParse({
        status: 'new',
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple filters', () => {
      const result = TicketFiltersSchema.safeParse({
        status: 'new',
        category: 'account_access',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Database Configuration', () => {
    it('should use default file path when DB_PATH is not set', () => {
      closeDb();
      const saved = process.env['DB_PATH'];
      delete process.env['DB_PATH'];
      try {
        const db = getDb();
        expect(db).toBeDefined();
      } finally {
        closeDb();
        process.env['DB_PATH'] = saved;
      }
    });
  });
});
