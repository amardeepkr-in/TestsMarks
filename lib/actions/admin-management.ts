'use server';

import db from '../db';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { hashPassword } from '../utils/password';
import { adminUserSchema, idSchema } from '../validation/schemas';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { hasPermission, Permission } from '../services/rbac';
import { requireAuth } from '../auth';
import { getClientIp } from '../middleware/ratelimit';

/**
 * Admin user creation result type
 */
export interface CreateAdminUserResult {
  success?: boolean;
  error?: string;
  id?: number;
}

/**
 * Admin user deletion result type
 */
export interface DeleteAdminUserResult {
  success?: boolean;
  error?: string;
}

/**
 * Create a new admin user
 */
export async function createAdminUser(username: string, password: string): Promise<CreateAdminUserResult> {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.MANAGE_USERS))) {
      return { error: 'Insufficient permissions to create users' };
    }

    // Validate input with Zod
    const validation = adminUserSchema.safeParse({ username, password });
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => e.message).join(', ');
      return { error: errors };
    }

    // Check for existing user
    const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
    if (existing) return { error: 'Username already exists' };

    const hash = await hashPassword(password);
    const result = db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.ADMIN_USER_CREATED,
      entityType: EntityTypes.ADMIN_USER,
      entityId: result.lastInsertRowid as number,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
      newValues: { username },
    });

    revalidatePath('/');
    return { success: true, id: result.lastInsertRowid as number };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create admin user';
    return { error: message };
  }
}

/**
 * Delete an admin user
 */
export async function deleteAdminUser(userId: number): Promise<DeleteAdminUserResult> {
  try {
    const currentUser = await requireAuth();
    if (!(await hasPermission(currentUser.id, Permission.MANAGE_USERS))) {
      return { error: 'Insufficient permissions to delete users' };
    }

    // Validate input
    const validation = idSchema.safeParse({ id: userId });
    if (!validation.success) {
      return { error: 'Invalid user ID' };
    }

    // Prevent deleting the last admin
    const count = db.prepare('SELECT COUNT(*) as cnt FROM admin_users').get() as { cnt: number };
    if (count.cnt <= 1) return { error: 'Cannot delete the last admin user' };

    // Prevent self-deletion
    if (currentUser.id === userId) return { error: 'Cannot delete your own account' };

    const user = db.prepare('SELECT username FROM admin_users WHERE id = ?').get(userId) as
      | { username: string }
      | undefined;
    if (!user) return { error: 'User not found' };

    db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);

    const headersList = await headers();
    createAuditLog({
      userId: currentUser.id,
      action: AuditActions.ADMIN_USER_DELETED,
      entityType: EntityTypes.ADMIN_USER,
      entityId: userId,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
      oldValues: { username: user.username },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete admin user';
    return { error: message };
  }
}
