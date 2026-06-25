import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Performance & safety pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -16000'); // 16 MB cache

// Create base tables
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    roll TEXT NOT NULL,
    marks TEXT NOT NULL,
    admit_card_path TEXT,
    admit_card_filename TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    allow_submissions INTEGER DEFAULT 1,
    allow_user_edits INTEGER DEFAULT 1,
    allow_uploads INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO app_settings (id, allow_submissions, allow_user_edits, allow_uploads)
  VALUES (1, 1, 1, 1);
`);

// Seed default admin user if no users exist
const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM admin_users').get() as { cnt: number };
if (adminCount.cnt === 0) {
  const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(defaultPassword, 12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(defaultUsername, hash);
}

// Run database migrations
try {
  // Dynamic require avoids circular deps at module init time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runMigrations } = require('./db/migrations');
  runMigrations();
} catch (error) {
  // Migrations are non-fatal — app can start without them for backward compat
  console.error('[DB] Migration error (non-fatal):', error);
}

// Cleanup expired sessions on startup
try {
  const result = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} expired sessions`);
  }
} catch {
  // sessions table may not exist yet if migrations haven't run
}

// Cleanup stale student access records (older than 7 days)
try {
  const result = db.prepare("DELETE FROM student_access WHERE datetime(created_at) < datetime('now', '-7 days')").run();
  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} stale student access records`);
  }
} catch {
  // student_access table may not exist yet
}

export default db;
