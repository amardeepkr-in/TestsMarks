import db from '../db';

/**
 * Audit log entry
 */
export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Audit log input
 */
export interface CreateAuditLogInput {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  userId?: number;
  action?: string;
  entityType?: string;
  entityId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create an audit log entry
 * @param input - Audit log data
 * @returns Created audit log ID
 */
export function createAuditLog(input: CreateAuditLogInput): number {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.oldValues ? JSON.stringify(input.oldValues) : null,
      input.newValues ? JSON.stringify(input.newValues) : null,
      input.ipAddress ?? null,
      input.userAgent ?? null
    );

    return result.lastInsertRowid as number;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the application
    return -1;
  }
}

/**
 * Get audit logs with optional filters
 * @param filters - Filter criteria
 * @returns Array of audit logs
 */
export function getAuditLogs(filters: AuditLogFilters = {}): AuditLog[] {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.userId !== undefined) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.entityId !== undefined) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }

    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const query = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params) as AuditLog[];
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

/**
 * Get audit log count with optional filters
 * @param filters - Filter criteria
 * @returns Total count of matching audit logs
 */
export function getAuditLogCount(filters: AuditLogFilters = {}): number {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.userId !== undefined) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.entityId !== undefined) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }

    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;

    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  } catch (error) {
    console.error('Failed to get audit log count:', error);
    return 0;
  }
}

/**
 * Get recent audit logs for a specific entity
 * @param entityType - Type of entity
 * @param entityId - ID of entity
 * @param limit - Maximum number of logs to return
 * @returns Array of audit logs
 */
export function getEntityAuditHistory(
  entityType: string,
  entityId: number,
  limit: number = 10
): AuditLog[] {
  return getAuditLogs({
    entityType,
    entityId,
    limit,
  });
}

/**
 * Get recent audit logs for a specific user
 * @param userId - User ID
 * @param limit - Maximum number of logs to return
 * @returns Array of audit logs
 */
export function getUserAuditHistory(userId: number, limit: number = 50): AuditLog[] {
  return getAuditLogs({
    userId,
    limit,
  });
}

/**
 * Common audit actions
 */
export const AuditActions = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_CHANGED: 'password_changed',

  // Submissions
  SUBMISSION_CREATED: 'submission_created',
  SUBMISSION_UPDATED: 'submission_updated',
  SUBMISSION_DELETED: 'submission_deleted',
  SUBMISSIONS_WIPED: 'submissions_wiped',

  // Files
  FILE_UPLOADED: 'file_uploaded',
  FILE_DELETED: 'file_deleted',

  // Settings
  SETTING_UPDATED: 'setting_updated',

  // Admin Users
  ADMIN_USER_CREATED: 'admin_user_created',
  ADMIN_USER_DELETED: 'admin_user_deleted',

  // Export
  DATA_EXPORTED: 'data_exported',
} as const;

/**
 * Common entity types
 */
export const EntityTypes = {
  SUBMISSION: 'submission',
  ADMIN_USER: 'admin_user',
  SETTING: 'setting',
  FILE: 'file',
  SYSTEM: 'system',
} as const;


