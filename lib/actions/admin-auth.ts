'use server';

import db from '../db';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { hashPassword, verifyPassword } from '../utils/password';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { getClientIp } from '../middleware/ratelimit';
import { createSession, destroySession, validateSession } from '../auth';
import type { AuthUser } from '../auth';

/**
 * Admin login result type
 */
export interface AdminLoginResult {
  success?: boolean;
  error?: string;
  username?: string;
}

/**
 * Admin users list result type
 */
export interface AdminUsersResult {
  users?: Array<{ id: number; username: string }>;
  error?: string;
}

/**
 * Password change result type
 */
export interface ChangePasswordResult {
  success?: boolean;
  error?: string;
}

/**
 * Login an admin user
 */
export async function loginAdminUser(username: string, password: string): Promise<AdminLoginResult> {
  try {
    // Validate input
    if (!username || !password) {
      return { error: 'Username and password are required' };
    }

    // Check for existing user
    const user = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username) as
      | { id: number; username: string; password_hash: string }
      | undefined;

    if (!user) {
      return { error: 'Invalid credentials' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return { error: 'Invalid credentials' };
    }

    // Create session
    await createSession(user.id, 'ADMIN');

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.ADMIN_LOGIN,
      entityType: EntityTypes.ADMIN_USER,
      entityId: user.id,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
    });

    revalidatePath('/');
    return { success: true, username: user.username };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to login';
    return { error: message };
  }
}

/**
 * Logout the current admin user
 */
export async function logoutAdminUser(): Promise<{ success: boolean }> {
  try {
    await destroySession();
    revalidatePath('/');
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Get all admin users
 */
export async function getAdminUsers(): Promise<AdminUsersResult> {
  try {
    const user = await validateSession();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const users = db.prepare('SELECT id, username FROM admin_users').all() as Array<{
      id: number;
      username: string;
    }>;

    return { users };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get admin users';
    return { error: message };
  }
}

/**
 * Change admin password
 */
export async function changeAdminPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  try {
    const user = await validateSession();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    // Verify current password
    const storedUser = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(userId) as
      | { password_hash: string }
      | undefined;

    if (!storedUser) {
      return { error: 'User not found' };
    }

    const isValid = await verifyPassword(currentPassword, storedUser.password_hash);
    if (!isValid) {
      return { error: 'Current password is incorrect' };
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashedPassword, userId);

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.PASSWORD_CHANGED,
      entityType: EntityTypes.ADMIN_USER,
      entityId: userId,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to change password';
    return { error: message };
  }
}
