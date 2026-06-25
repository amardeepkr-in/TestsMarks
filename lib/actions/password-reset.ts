'use server';

import crypto from 'crypto';
import db from '../db';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { hashPassword, validatePasswordStrength } from '../utils/password';
import { passwordChangeSchema } from '../validation/schemas';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { queueEmail } from '../services/email';

/**
 * Password reset request result type
 */
export interface PasswordResetRequestResult {
  success?: boolean;
  error?: string;
}

/**
 * Password reset result type
 */
export interface PasswordResetResult {
  success?: boolean;
  error?: string;
}

/**
 * Request password reset for admin user
 * Generates a secure token and sends email if configured
 */
export async function requestPasswordReset(username: string): Promise<PasswordResetRequestResult> {
  try {
    const user = db.prepare('SELECT id, email FROM admin_users WHERE username = ?').get(username) as
      | { id: number; email: string }
      | undefined;

    if (!user) {
      // Don't reveal whether user exists
      return { success: true };
    }

    // Invalidate any existing tokens for this user
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 0').run(user.id);

    // Generate token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      token,
      expiresAt
    );

    // Build reset URL
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const resetUrl = `${protocol}://${host}/admin/reset-password?token=${token}`;

    // Send email if user has email configured
    if (user.email) {
      await queueEmail(
        user.email,
        'Password Reset Request - TestMarks',
        `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your TestMarks admin account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <p><small>Reset URL: ${resetUrl}</small></p>
      `
      );
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process password reset';
    return { error: message };
  }
}

/**
 * Reset password using a valid reset token
 */
export async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
  try {
    // Validate password strength
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      return { error: strength.errors.join(', ') };
    }

    // Find valid token
    const resetRow = db.prepare(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?'
    ).get(token) as { id: number; user_id: number; expires_at: string; used: number } | undefined;

    if (!resetRow) {
      return { error: 'Invalid or expired reset token' };
    }

    if (resetRow.used) {
      return { error: 'Reset token has already been used' };
    }

    if (new Date(resetRow.expires_at) < new Date()) {
      return { error: 'Reset token has expired' };
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword);
    db.prepare("UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      hashedPassword,
      resetRow.user_id
    );

    // Mark token as used
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);

    // Invalidate all sessions for this user
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetRow.user_id);

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return { error: message };
  }
}
