import Database from 'better-sqlite3';
import path from 'path';

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    const dbPath =
      process.env['DB_PATH'] ??
      path.join(__dirname, '..', '..', 'tickets.db');
    instance = new Database(dbPath);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
  }
  return instance;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}
