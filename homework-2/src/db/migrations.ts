import { getDb } from './database';

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id                        TEXT    PRIMARY KEY NOT NULL,
      customer_id               TEXT,
      customer_email            TEXT    NOT NULL,
      customer_name             TEXT,
      subject                   TEXT    NOT NULL,
      description               TEXT    NOT NULL,
      category                  TEXT,
      priority                  TEXT    NOT NULL DEFAULT 'medium',
      status                    TEXT    NOT NULL DEFAULT 'new',
      created_at                TEXT    NOT NULL,
      updated_at                TEXT    NOT NULL,
      resolved_at               TEXT,
      assigned_to               TEXT,
      tags                      TEXT    NOT NULL DEFAULT '[]',
      metadata                  TEXT    NOT NULL DEFAULT '{}',
      classification_confidence REAL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
  `);
}
