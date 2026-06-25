import db from '../../db';
import fs from 'fs';
import path from 'path';

/**
 * Migration record
 */
interface Migration {
  id: number;
  name: string;
  executed_at: string;
}

/**
 * Initialize the migrations table
 * This table tracks which migrations have been executed
 */
export function initMigrationTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Get list of executed migrations
 * @returns Array of migration records
 */
export function getMigrations(): Migration[] {
  try {
    const stmt = db.prepare('SELECT * FROM migrations ORDER BY id ASC');
    return stmt.all() as Migration[];
  } catch (error) {
    console.error('Failed to get migrations:', error);
    return [];
  }
}

/**
 * Check if a migration has been executed
 * @param name - Migration name
 * @returns True if migration has been executed
 */
export function isMigrationExecuted(name: string): boolean {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM migrations WHERE name = ?');
    const result = stmt.get(name) as { count: number };
    return result.count > 0;
  } catch (error) {
    console.error('Failed to check migration:', error);
    return false;
  }
}

/**
 * Record a migration as executed
 * @param name - Migration name
 */
export function recordMigration(name: string): void {
  try {
    const stmt = db.prepare('INSERT INTO migrations (name) VALUES (?)');
    stmt.run(name);
  } catch (error) {
    console.error('Failed to record migration:', error);
    throw error;
  }
}

/**
 * Execute a SQL migration file
 * @param filePath - Path to SQL file
 * @param name - Migration name
 */
export function executeMigration(filePath: string, name: string): void {
  try {
    console.log(`Executing migration: ${name}`);

    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute SQL
    db.exec(sql);

    // Record migration
    recordMigration(name);

    console.log(`Migration completed: ${name}`);
  } catch (error) {
    console.error(`Migration failed: ${name}`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 * Reads .sql files from lib/db/migrations/files/ directory
 * and executes them in order if not already executed
 */
export function runMigrations(): void {
  try {
    // Initialize migrations table
    initMigrationTable();

    // Get migrations directory
    const migrationsDir = path.join(__dirname, 'files');

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }

    // Get all .sql files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    console.log(`Found ${files.length} migration file(s)`);

    // Execute each migration if not already executed
    let executedCount = 0;
    for (const file of files) {
      const name = file.replace('.sql', '');

      if (isMigrationExecuted(name)) {
        console.log(`Migration already executed: ${name}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      executeMigration(filePath, name);
      executedCount++;
    }

    if (executedCount > 0) {
      console.log(`Executed ${executedCount} migration(s)`);
    } else {
      console.log('All migrations up to date');
    }
  } catch (error) {
    console.error('Migration system error:', error);
    throw error;
  }
}

/**
 * Rollback a migration (for development/testing)
 * WARNING: This does not undo the SQL changes, only removes the record
 * @param name - Migration name
 */
export function rollbackMigration(name: string): void {
  try {
    const stmt = db.prepare('DELETE FROM migrations WHERE name = ?');
    stmt.run(name);
    console.log(`Rolled back migration: ${name}`);
  } catch (error) {
    console.error('Failed to rollback migration:', error);
    throw error;
  }
}

/**
 * Get migration status
 * @returns Object with migration statistics
 */
export function getMigrationStatus(): {
  total: number;
  executed: number;
  pending: number;
  migrations: Array<{ name: string; executed: boolean; executedAt?: string }>;
} {
  try {
    const migrationsDir = path.join(__dirname, 'files');

    if (!fs.existsSync(migrationsDir)) {
      return { total: 0, executed: 0, pending: 0, migrations: [] };
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const executedMigrations = getMigrations();
    const executedMap = new Map(
      executedMigrations.map(m => [m.name, m.executed_at])
    );

    const migrations = files.map(file => {
      const name = file.replace('.sql', '');
      const executedAt = executedMap.get(name);
      return {
        name,
        executed: !!executedAt,
        executedAt,
      };
    });

    const executed = migrations.filter(m => m.executed).length;

    return {
      total: files.length,
      executed,
      pending: files.length - executed,
      migrations,
    };
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return { total: 0, executed: 0, pending: 0, migrations: [] };
  }
}


