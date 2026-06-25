import db from '../db';
import fs from 'fs';
import path from 'path';

export interface BackupInfo {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  created_by: string;
}

// Ensure backup directory exists
function ensureBackupDir(): string {
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

// Create full database backup
export async function createBackup(createdBy: string = 'admin'): Promise<BackupInfo> {
  const backupDir = ensureBackupDir();
  const timestamp = Date.now();
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  try {
    // Export all tables to JSON
    const tablesList = ['submissions', 'app_settings', 'admin_users', 'audit_logs', 'student_access', 'email_queue'];
    const backup: Record<string, unknown> = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tables: {} as Record<string, unknown[]>,
    };

    const tables = backup.tables as Record<string, unknown[]>;

    // Export each table
    for (const table of tablesList) {
      try {
        const data = db.prepare(`SELECT * FROM ${table}`).all();
        tables[table] = data;
      } catch {
        // Table might not exist, skip it
        console.warn(`Table ${table} not found, skipping...`);
      }
    }

    // Write backup file
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    // Get file size
    const stats = fs.statSync(filepath);

    // Record backup in database (if backups table exists)
    try {
      // Create backups table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT NOT NULL
        )
      `);

      const result = db
        .prepare('INSERT INTO backups (filename, size, created_by) VALUES (?, ?, ?)')
        .run(filename, stats.size, createdBy);

      return {
        id: result.lastInsertRowid as number,
        filename,
        size: stats.size,
        created_at: new Date().toISOString(),
        created_by: createdBy,
      };
    } catch {
      // If we can't record in database, still return backup info
      return {
        id: timestamp,
        filename,
        size: stats.size,
        created_at: new Date().toISOString(),
        created_by: createdBy,
      };
    }
  } catch (error) {
    console.error('Backup creation failed:', error);
    throw new Error('Failed to create backup');
  }
}

// Restore from backup
export async function restoreBackup(backupId: number): Promise<void> {
  const backupDir = ensureBackupDir();

  try {
    // Get backup info
    const backupInfo = db
      .prepare('SELECT * FROM backups WHERE id = ?')
      .get(backupId) as BackupInfo | undefined;

    if (!backupInfo) {
      throw new Error('Backup not found');
    }

    const filepath = path.join(backupDir, backupInfo.filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file not found');
    }

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

    // Validate backup structure
    if (!backupData.version || !backupData.tables) {
      throw new Error('Invalid backup file format');
    }

    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    try {
      // Restore each table
      for (const [tableName, rows] of Object.entries(backupData.tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // Clear existing data (except backups table)
        if (tableName !== 'backups') {
          db.prepare(`DELETE FROM ${tableName}`).run();
        }

        // Insert backup data
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const insertStmt = db.prepare(
          `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`
        );

        for (const row of rows as Record<string, unknown>[]) {
          const values = columns.map((col) => row[col]);
          insertStmt.run(...values);
        }
      }

      // Commit transaction
      db.exec('COMMIT');

      // Log restore action in audit log
      try {
        db.prepare(
          'INSERT INTO audit_logs (action, details, ip_address) VALUES (?, ?, ?)'
        ).run('backup_restore', `Restored from backup: ${backupInfo.filename}`, 'system');
      } catch {
        // Ignore if audit log fails
      }
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Backup restore failed:', error);
    throw new Error('Failed to restore backup');
  }
}

// List all backups
export function listBackups(): BackupInfo[] {
  try {
    // Ensure backups table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL
      )
    `);

    const backups = db
      .prepare('SELECT * FROM backups ORDER BY created_at DESC')
      .all() as BackupInfo[];

    return backups;
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
}

// Delete backup
export function deleteBackup(backupId: number): void {
  const backupDir = ensureBackupDir();

  try {
    // Get backup info
    const backupInfo = db
      .prepare('SELECT * FROM backups WHERE id = ?')
      .get(backupId) as BackupInfo | undefined;

    if (!backupInfo) {
      throw new Error('Backup not found');
    }

    const filepath = path.join(backupDir, backupInfo.filename);

    // Delete file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete from database
    db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
  } catch (error) {
    console.error('Failed to delete backup:', error);
    throw new Error('Failed to delete backup');
  }
}

// Get backup file path for download
export function getBackupFilePath(backupId: number): string | null {
  const backupDir = ensureBackupDir();

  try {
    const backupInfo = db
      .prepare('SELECT * FROM backups WHERE id = ?')
      .get(backupId) as BackupInfo | undefined;

    if (!backupInfo) {
      return null;
    }

    const filepath = path.join(backupDir, backupInfo.filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    return filepath;
  } catch (error) {
    console.error('Failed to get backup file path:', error);
    return null;
  }
}


