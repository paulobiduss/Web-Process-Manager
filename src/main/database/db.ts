import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

/**
 * Abre (lazy) o banco SQLite local em userData/wpm.db e garante o schema.
 * better-sqlite3 é síncrono — seguro de usar direto no processo main.
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'wpm.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      command      TEXT NOT NULL,
      cwd          TEXT,
      match_key    TEXT NOT NULL,
      exe_name     TEXT,
      port         INTEGER,
      created_at   TEXT NOT NULL,
      last_seen_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_servers_match_key ON servers (match_key);
  `)
}
