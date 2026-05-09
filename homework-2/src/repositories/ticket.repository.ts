import { getDb } from '../db/database';
import {
  Ticket,
  UpdateTicketDTO,
  InternalUpdatePatch,
  ClassificationResult,
  TicketFilters,
} from '../types/ticket.types';

export class TicketRepository {
  private static readonly INSERT_TICKET = `
    INSERT INTO tickets (
      id, customer_id, customer_email, customer_name, subject, description,
      category, priority, status, created_at, updated_at, resolved_at,
      assigned_to, tags, metadata, classification_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  private static readonly SELECT_TICKET = `
    SELECT * FROM tickets WHERE id = ?
  `;

  private static readonly SELECT_ALL_TICKETS = `
    SELECT * FROM tickets
  `;


  private static readonly DELETE_TICKET = `
    DELETE FROM tickets WHERE id = ?
  `;

  private static readonly UPDATE_CLASSIFICATION = `
    UPDATE tickets SET
      category = ?,
      priority = ?,
      classification_confidence = ?,
      updated_at = ?
    WHERE id = ?
  `;

  private db = getDb();

  private rowToTicket(row: any): Ticket {
    return {
      id: row.id,
      customer_id: row.customer_id,
      customer_email: row.customer_email,
      customer_name: row.customer_name,
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
      assigned_to: row.assigned_to,
      tags: JSON.parse(row.tags) as string[],
      metadata: JSON.parse(row.metadata),
      classification_confidence: row.classification_confidence,
    };
  }

  findById(id: string): Ticket | undefined {
    const stmt = this.db.prepare(TicketRepository.SELECT_TICKET);
    const row = stmt.get(id);
    return row ? this.rowToTicket(row) : undefined;
  }

  findAll(filters?: TicketFilters): Ticket[] {
    let query = TicketRepository.SELECT_ALL_TICKETS;
    const params: (string | null | undefined)[] = [];

    const whereClauses: string[] = [];

    if (filters?.status) {
      whereClauses.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.category) {
      whereClauses.push('category = ?');
      params.push(filters.category);
    }

    if (filters?.priority) {
      whereClauses.push('priority = ?');
      params.push(filters.priority);
    }

    if (filters?.assigned_to !== undefined) {
      whereClauses.push('assigned_to = ?');
      params.push(filters.assigned_to);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map((row: any) => this.rowToTicket(row));
  }

  insert(ticket: Ticket): Ticket {
    const stmt = this.db.prepare(TicketRepository.INSERT_TICKET);
    stmt.run(
      ticket.id,
      ticket.customer_id || null,
      ticket.customer_email,
      ticket.customer_name || null,
      ticket.subject,
      ticket.description,
      ticket.category || null,
      ticket.priority,
      ticket.status,
      ticket.created_at,
      ticket.updated_at,
      ticket.resolved_at || null,
      ticket.assigned_to || null,
      JSON.stringify(ticket.tags),
      JSON.stringify(ticket.metadata),
      ticket.classification_confidence || null
    );
    return ticket;
  }

  update(id: string, data: InternalUpdatePatch): Ticket {
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    const add = (col: string, val: unknown) => {
      setClauses.unshift(`${col} = ?`);
      params.unshift(val);
    };

    if ('customer_id' in data) add('customer_id', data.customer_id ?? null);
    if ('customer_email' in data) add('customer_email', data.customer_email ?? null);
    if ('customer_name' in data) add('customer_name', data.customer_name ?? null);
    if ('subject' in data) add('subject', data.subject ?? null);
    if ('description' in data) add('description', data.description ?? null);
    if ('category' in data) add('category', data.category ?? null);
    if ('priority' in data) add('priority', data.priority ?? null);
    if ('status' in data) add('status', data.status ?? null);
    if ('resolved_at' in data) add('resolved_at', data.resolved_at ?? null);
    if ('assigned_to' in data) add('assigned_to', data.assigned_to ?? null);
    if ('tags' in data) add('tags', data.tags ? JSON.stringify(data.tags) : null);
    if ('metadata' in data) add('metadata', data.metadata ? JSON.stringify(data.metadata) : null);

    const sql = `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);

    this.db.prepare(sql).run(...params);

    const updated = this.findById(id);
    if (!updated) {
      throw new Error(`Ticket ${id} not found after update`);
    }
    return updated;
  }

  delete(id: string): void {
    const stmt = this.db.prepare(TicketRepository.DELETE_TICKET);
    stmt.run(id);
  }

  updateClassification(id: string, result: ClassificationResult): Ticket {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(TicketRepository.UPDATE_CLASSIFICATION);

    stmt.run(result.category, result.priority, result.confidence, now, id);

    const updated = this.findById(id);
    if (!updated) {
      throw new Error(`Ticket ${id} not found after classification update`);
    }
    return updated;
  }
}
