'use server'

import crypto from 'crypto';
import db from './db';
import { Submission, AppSettings, AdminUser } from './types';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { hashPassword, verifyPassword, validatePasswordStrength } from './utils/password';
import {
  loginSchema,
  adminUserSchema,
  settingsSchema,
  passwordChangeSchema,
  idSchema,
  submissionSchema,
} from './validation/schemas';
import { createAuditLog, AuditActions, EntityTypes } from './services/audit';
import { hasPermission, Permission } from './services/rbac';
import { checkRateLimit, loginRateLimit, getClientIp } from './middleware/ratelimit';
import { queueEmail, getSubmissionConfirmationEmail, getMarksUpdateEmail, getAdmitCardUploadEmail } from './services/email';
import { createSession, requireAuth, destroySession } from './auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const ALLOWED_SUBMISSION_FIELDS = ['name', 'category', 'roll', 'marks'] as const;

// ─── Admin User Auth ───

export async function loginAdminUser(username: string, password: string) {
  try {
    // Get client IP for rate limiting and audit logging
    const headersList = await headers();
    const ipAddress = getClientIp(headersList);
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Check rate limit
    const rateLimitResult = await checkRateLimit(loginRateLimit, ipAddress);
    if (!rateLimitResult.success) {
      createAuditLog({
        action: AuditActions.LOGIN_FAILED,
        entityType: EntityTypes.SYSTEM,
        ipAddress,
        userAgent,
        newValues: { reason: 'rate_limit_exceeded', username },
      });
      return { error: 'Too many login attempts. Please try again later.' };
    }

    // Validate input with Zod
    const validation = loginSchema.safeParse({ username, password });
    if (!validation.success) {
      const errors = validation.error.issues.map(e => e.message).join(', ');
      createAuditLog({
        action: AuditActions.LOGIN_FAILED,
        entityType: EntityTypes.SYSTEM,
        ipAddress,
        userAgent,
        newValues: { reason: 'validation_failed', username, errors },
      });
      return { error: errors };
    }

    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined;

    if (!user) {
      createAuditLog({
        action: AuditActions.LOGIN_FAILED,
        entityType: EntityTypes.SYSTEM,
        ipAddress,
        userAgent,
        newValues: { reason: 'user_not_found', username },
      });
      return { error: 'Invalid username or password' };
    }

    // Check if password is old base64 format and migrate to bcrypt
    let isValidPassword = false;
    if (user.password_hash.length === 16 || !user.password_hash.startsWith('$2')) {
      // Old base64 format
      const oldHash = Buffer.from(password).toString('base64');
      if (oldHash === user.password_hash) {
        isValidPassword = true;
        // Migrate to bcrypt
        const newHash = await hashPassword(password);
        db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
        console.log(`Migrated password for user ${username} to bcrypt`);
      }
    } else {
      // New bcrypt format
      isValidPassword = await verifyPassword(password, user.password_hash);
    }

    if (!isValidPassword) {
      createAuditLog({
        action: AuditActions.LOGIN_FAILED,
        entityType: EntityTypes.SYSTEM,
        userId: user.id,
        ipAddress,
        userAgent,
        newValues: { reason: 'invalid_password', username },
      });
      return { error: 'Invalid username or password' };
    }

    // Successful login — create DB session with random token
    await createSession(user.id, user.role || 'VIEWER');

    createAuditLog({
      userId: user.id,
      action: AuditActions.LOGIN,
      entityType: EntityTypes.ADMIN_USER,
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    revalidatePath('/');
    return { success: true, username: user.username };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    console.error('Login error:', error);
    return { error: message };
  }
}

export async function logoutAdminUser() {
  try {
    const user = await requireAuth();
    const headersList = await headers();

    createAuditLog({
      userId: user.id,
      action: AuditActions.LOGOUT,
      entityType: EntityTypes.ADMIN_USER,
      entityId: user.id,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
    });

    await destroySession();
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return { error: message };
  }
}

export async function changeAdminPassword(userId: number, currentPassword: string, newPassword: string) {
  try {
    const currentUser = await requireAuth();
    if (!(await hasPermission(currentUser.id, Permission.MANAGE_USERS))) {
      return { error: 'Insufficient permissions to change passwords' };
    }
    // Validate input
    const validation = passwordChangeSchema.safeParse({ currentPassword, newPassword });
    if (!validation.success) {
      const errors = validation.error.issues.map(e => e.message).join(', ');
      return { error: errors };
    }

    // Validate password strength
    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.isValid) {
      return { error: strengthCheck.errors.join(', ') };
    }

    const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(userId) as AdminUser | undefined;
    if (!user) return { error: 'User not found' };

    // Verify current password (handle both old and new formats)
    let isValidPassword = false;
    if (user.password_hash.length === 16 || !user.password_hash.startsWith('$2')) {
      const oldHash = Buffer.from(currentPassword).toString('base64');
      isValidPassword = oldHash === user.password_hash;
    } else {
      isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    }

    if (!isValidPassword) {
      const headersList = await headers();
      createAuditLog({
        userId,
        action: AuditActions.LOGIN_FAILED,
        entityType: EntityTypes.ADMIN_USER,
        entityId: userId,
        ipAddress: getClientIp(headersList),
        userAgent: headersList.get('user-agent') || 'unknown',
        newValues: { reason: 'incorrect_current_password' },
      });
      return { error: 'Current password is incorrect' };
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    const headersList = await headers();
    createAuditLog({
      userId,
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

export async function getAdminUsers() {
  const users = db.prepare('SELECT id, username, created_at FROM admin_users ORDER BY id ASC').all() as Omit<AdminUser, 'password_hash'>[];
  return users;
}

export async function createAdminUser(username: string, password: string) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.MANAGE_USERS))) {
      return { error: 'Insufficient permissions to create users' };
    }

    // Validate input with Zod
    const validation = adminUserSchema.safeParse({ username, password });
    if (!validation.success) {
      const errors = validation.error.issues.map(e => e.message).join(', ');
      return { error: errors };
    }

    // Validate password strength
    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      return { error: strengthCheck.errors.join(', ') };
    }

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
    return { success: true, id: result.lastInsertRowid };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create admin user';
    return { error: message };
  }
}

export async function deleteAdminUser(userId: number) {
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

    const count = db.prepare('SELECT COUNT(*) as cnt FROM admin_users').get() as { cnt: number };
    if (count.cnt <= 1) return { error: 'Cannot delete the last admin user' };

    // Prevent self-deletion
    if (currentUser.id === userId) return { error: 'Cannot delete your own account' };

    const user = db.prepare('SELECT username FROM admin_users WHERE id = ?').get(userId) as { username: string } | undefined;
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

export async function getSubmissions(): Promise<Submission[]> {
  const stmt = db.prepare('SELECT * FROM submissions ORDER BY id ASC');
  return stmt.all() as Submission[];
}

export async function getSettings(): Promise<AppSettings> {
  const stmt = db.prepare('SELECT * FROM app_settings WHERE id = 1');
  return stmt.get() as AppSettings;
}

export async function updateSetting(field: string, value: number) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.MANAGE_SETTINGS))) {
      return { error: 'Insufficient permissions to change settings' };
    }

    // Validate input
    const validation = settingsSchema.safeParse({ field, value });
    if (!validation.success) {
      const errors = validation.error.issues.map(e => e.message).join(', ');
      return { error: errors };
    }

    // Get old value
    const oldSetting = db.prepare(`SELECT ${field} FROM app_settings WHERE id = 1`).get() as Record<string, number>;
    const oldValue = oldSetting[field];

    const numericValue = value === 1 ? 1 : 0;
    const stmt = db.prepare(`UPDATE app_settings SET ${field} = ? WHERE id = 1`);
    stmt.run(numericValue);

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.SETTING_UPDATED,
      entityType: EntityTypes.SETTING,
      entityId: 1,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
      oldValues: { [field]: oldValue },
      newValues: { [field]: numericValue },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update setting';
    return { error: message };
  }
}

export async function createSubmission(formData: FormData) {
  const parsed = submissionSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category'),
    roll: formData.get('roll'),
    marks: formData.get('marks'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { name, category, roll, marks } = parsed.data;

  const settings = await getSettings();
  if (settings && settings.allow_submissions === 0) {
    return { error: 'Submissions are currently disabled' };
  }

  const stmt = db.prepare(`
    INSERT INTO submissions (name, category, roll, marks)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(name, category, roll, marks);
  const id = result.lastInsertRowid;

  const file = formData.get('file') as File | null;
  if (file && file.size > 0) {
    const settings2 = await getSettings();
    if (settings2 && settings2.allow_uploads === 0) {
      return { error: 'File uploads are currently disabled' };
    }
    const uploadResult = await processFileUpload(id as number, file);
    if (uploadResult?.error) {
      return { error: uploadResult.error };
    }
  }

  // Send confirmation email if email is provided
  const email = formData.get('email') as string | null;
  if (email && email.trim()) {
    try {
      const emailBody = getSubmissionConfirmationEmail({
        studentName: name,
        rollNumber: roll,
        examName: category,
        submissionDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      });
      await queueEmail(email.trim(), 'Submission Confirmation - TestMarks', emailBody);
    } catch (error) {
      console.error('Failed to queue confirmation email:', error);
      // Don't fail the submission if email fails
    }
  }

  revalidatePath('/');
  return { success: true, id };
}

export async function updateSubmissionFull(id: number, formData: FormData) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.EDIT_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to edit submissions' };
    }

    const parsed = submissionSchema.safeParse({
      name: formData.get('name'),
      category: formData.get('category'),
      roll: formData.get('roll'),
      marks: formData.get('marks'),
    });

    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    const { name, category, roll, marks } = parsed.data;

    // Verify submission exists
    const existing = db.prepare('SELECT id FROM submissions WHERE id = ?').get(id);
    if (!existing) return { error: 'Submission not found' };

    const stmt = db.prepare('UPDATE submissions SET name = ?, category = ?, roll = ?, marks = ? WHERE id = ?');
    stmt.run(name, category, roll, marks, id);

    const file = formData.get('file') as File | null;
    if (file && file.size > 0) {
      const settings = await getSettings();
      if (settings && settings.allow_uploads === 0) {
        return { error: 'File uploads are currently disabled' };
      }
      const fileError = await processFileUpload(id, file);
      if (fileError?.error) {
        return { error: fileError.error };
      }
    }

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update submission';
    return { error: message };
  }
}

export async function updateSubmission(id: number, field: string, value: string) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.EDIT_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to edit submissions' };
    }
    if (!ALLOWED_SUBMISSION_FIELDS.includes(field as typeof ALLOWED_SUBMISSION_FIELDS[number])) {
      return { error: 'Invalid field' };
    }

    const trimmedValue = value.trim();
    if (field === 'name' && trimmedValue.length === 0) return { error: 'Name cannot be empty' };
    if (field === 'name' && trimmedValue.length > 200) return { error: 'Name must be under 200 characters' };
    if (field === 'category' && trimmedValue.length === 0) return { error: 'Category cannot be empty' };
    if (field === 'category' && trimmedValue.length > 100) return { error: 'Category must be under 100 characters' };
    if (field === 'roll' && trimmedValue.length === 0) return { error: 'Roll number cannot be empty' };
    if (field === 'roll' && trimmedValue.length > 50) return { error: 'Roll number must be under 50 characters' };
    if (field === 'marks' && trimmedValue.length === 0) return { error: 'Marks cannot be empty' };
    if (field === 'marks' && trimmedValue.length > 20) return { error: 'Marks must be under 20 characters' };

    // Get old value for comparison
    const oldSubmission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Submission | undefined;
    if (!oldSubmission) return { error: 'Submission not found' };

    const stmt = db.prepare(`UPDATE submissions SET ${field} = ? WHERE id = ?`);
    stmt.run(trimmedValue, id);

    // Send email notification if marks were updated
    if (field === 'marks' && oldSubmission && oldSubmission.marks !== trimmedValue) {
      try {
        // Try to parse marks as JSON for detailed breakdown
        let marksData;
        try {
          marksData = JSON.parse(trimmedValue);
        } catch {
          marksData = { total: { obtained: parseFloat(trimmedValue) || 0, total: 100 } };
        }

        // Calculate totals
        let totalObtained = 0;
        let totalMax = 0;
        Object.entries(marksData).forEach(([key, val]) => {
          if (key !== 'total' && typeof val === 'object' && val !== null) {
            const subjectMarks = val as { obtained?: number; total?: number };
            totalObtained += subjectMarks.obtained || 0;
            totalMax += subjectMarks.total || 0;
          }
        });

        getMarksUpdateEmail({
          studentName: oldSubmission.name,
          rollNumber: oldSubmission.roll,
          examName: oldSubmission.category,
          marks: totalObtained,
          totalMarks: totalMax || 100,
        });

        // Queue email (we don't have email in submission, so this would need to be added)
        // For now, we'll skip the actual email sending
        // await queueEmail(studentEmail, 'Marks Updated - TestMarks', emailBody);
      } catch (error) {
        console.error('Failed to queue marks update email:', error);
      }
    }

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update submission';
    return { error: message };
  }
}

export async function uploadAdmitCard(id: number, formData: FormData) {
  const file = formData.get('file') as File;
  if (!file || file.size === 0) {
    return { error: 'No file provided' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size must be under 10MB' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only JPG, PNG, or PDF files are allowed' };
  }

  const settings = await getSettings();
  if (settings && settings.allow_uploads === 0) {
    return { error: 'File uploads are currently disabled' };
  }

  const uploadResult = await processFileUpload(id, file);
  if (uploadResult?.error) {
    return { error: uploadResult.error };
  }

  // Send admit card upload notification
  try {
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Submission | undefined;
    if (submission) {
      getAdmitCardUploadEmail({
        studentName: submission.name,
        rollNumber: submission.roll,
        examName: submission.category,
        uploadDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      });

      // Queue email (we don't have email in submission, so this would need to be added)
      // For now, we'll skip the actual email sending
      // await queueEmail(studentEmail, 'Admit Card Available - TestMarks', emailBody);
    }
  } catch (error) {
    console.error('Failed to queue admit card email:', error);
  }

  revalidatePath('/');
  return { success: true };
}

async function processFileUpload(id: number, file: File): Promise<{ error?: string }> {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100);
    const filename = `${Date.now()}-${id}-${safeName}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(id) as { admit_card_path: string | null } | undefined;
    if (existing?.admit_card_path) {
      const oldPath = path.join(process.cwd(), 'public', existing.admit_card_path);
      if (fs.existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    const stmt = db.prepare('UPDATE submissions SET admit_card_path = ?, admit_card_filename = ? WHERE id = ?');
    stmt.run(`/uploads/${filename}`, file.name, id);

    return {};
  } catch {
    return { error: 'Failed to save file' };
  }
}

export async function deleteSubmission(id: number) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.DELETE_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to delete submissions' };
    }

    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(id) as { admit_card_path: string | null } | undefined;
    if (!existing) return { error: 'Submission not found' };

    if (existing.admit_card_path) {
      const filePath = path.join(process.cwd(), 'public', existing.admit_card_path);
      if (fs.existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }
    }

    const stmt = db.prepare('DELETE FROM submissions WHERE id = ?');
    stmt.run(id);
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete submission';
    return { error: message };
  }
}

export async function deleteAdmitCard(id: number) {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.DELETE_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to delete admit cards' };
    }

    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(id) as { admit_card_path: string | null } | undefined;
    if (!existing) return { error: 'Submission not found' };

    if (existing.admit_card_path) {
      const filePath = path.join(process.cwd(), 'public', existing.admit_card_path);
      if (fs.existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }
    }

    const stmt = db.prepare('UPDATE submissions SET admit_card_path = NULL, admit_card_filename = NULL WHERE id = ?');
    stmt.run(id);
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete admit card';
    return { error: message };
  }
}

export async function wipeDatabase() {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.DELETE_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to wipe database' };
    }

    const files = db.prepare('SELECT admit_card_path FROM submissions WHERE admit_card_path IS NOT NULL').all() as { admit_card_path: string }[];
    for (const file of files) {
      const filePath = path.join(process.cwd(), 'public', file.admit_card_path);
      if (fs.existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }
    }

    const stmt = db.prepare('DELETE FROM submissions');
    stmt.run();
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to wipe database';
    return { error: message };
  }
}

export async function exportSubmissionsCSV(): Promise<string> {
  const submissions = await getSubmissions();
  const headers = ['ID', 'Name', 'Category', 'Roll', 'Marks', 'Admit Card', 'Created At'];
  const rows = submissions.map(s => [
    s.id,
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.category || '').replace(/"/g, '""')}"`,
    `"${(s.roll || '').replace(/"/g, '""')}"`,
    `"${(s.marks || '').replace(/"/g, '""')}"`,
    s.admit_card_filename || '',
    s.created_at || '',
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export async function getSubmissionCount(): Promise<number> {
  const result = db.prepare('SELECT COUNT(*) as count FROM submissions').get() as { count: number };
  return result.count;
}

export async function getSubmissionsPaginated(
  page: number = 1,
  pageSize: number = 25,
  filters?: { search?: string; category?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
): Promise<{ data: Submission[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (safePage - 1) * safePageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    conditions.push('(name LIKE ? OR category LIKE ? OR roll LIKE ? OR marks LIKE ?)');
    params.push(pattern, pattern, pattern, pattern);
  }
  if (filters?.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSorts = ['id', 'name', 'roll', 'category', 'marks', 'created_at'];
  const sortBy = allowedSorts.includes(filters?.sortBy ?? '') ? filters!.sortBy! : 'id';
  const sortOrder = filters?.sortOrder === 'desc' ? 'DESC' : 'ASC';

  const totalResult = db.prepare(`SELECT COUNT(*) as count FROM submissions ${whereClause}`).get(...params) as { count: number };
  const total = totalResult.count;
  const totalPages = Math.ceil(total / safePageSize);

  const data = db.prepare(
    `SELECT * FROM submissions ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, safePageSize, offset) as Submission[];

  return { data, total, page: safePage, pageSize: safePageSize, totalPages };
}

export async function searchSubmissions(query: string): Promise<Submission[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const stmt = db.prepare(`
    SELECT * FROM submissions
    WHERE name LIKE ? OR category LIKE ? OR roll LIKE ? OR marks LIKE ?
    ORDER BY id ASC LIMIT 50
  `);
  const pattern = `%${trimmed}%`;
  return stmt.all(pattern, pattern, pattern, pattern) as Submission[];
}

export async function getSubmissionStats(): Promise<{
  total: number;
  withAdmitCard: number;
  withoutAdmitCard: number;
  highestMarks: number | null;
  averageMarks: string | null;
  lowestMarks: number | null;
  medianMarks: number | string | null;
  categoryCount: number;
  topCategory: string | null;
  topCategoryAvg: string | null;
}> {
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN admit_card_path IS NOT NULL AND admit_card_path != '' THEN 1 ELSE 0 END) as with_admit_card,
        MAX(CAST(marks AS REAL)) as highest_marks,
        MIN(CAST(marks AS REAL)) as lowest_marks,
        ROUND(AVG(CAST(marks AS REAL)), 1) as average_marks,
        COUNT(DISTINCT category) as category_count
      FROM submissions
    `).get() as Record<string, number>;

    const withoutAdmitCard = row.total - row.with_admit_card;

    // Median marks
    let medianMarks: number | string | null = null;
    const numericMarks = db.prepare(`
      SELECT CAST(marks AS REAL) as m FROM submissions
      WHERE CAST(marks AS REAL) IS NOT NULL AND marks != ''
      ORDER BY m
    `).all() as { m: number }[];

    if (numericMarks.length > 0) {
      const mid = Math.floor(numericMarks.length / 2);
      medianMarks = numericMarks.length % 2
        ? numericMarks[mid].m
        : ((numericMarks[mid - 1].m + numericMarks[mid].m) / 2).toFixed(1);
    }

    // Top category by average marks
    const topCat = db.prepare(`
      SELECT category, ROUND(AVG(CAST(marks AS REAL)), 1) as avg_marks
      FROM submissions
      WHERE CAST(marks AS REAL) IS NOT NULL AND marks != ''
      GROUP BY category
      ORDER BY avg_marks DESC
      LIMIT 1
    `).get() as { category: string; avg_marks: string } | undefined;

    return {
      total: row.total,
      withAdmitCard: row.with_admit_card,
      withoutAdmitCard,
      highestMarks: row.highest_marks,
      averageMarks: row.average_marks?.toString() ?? null,
      lowestMarks: row.lowest_marks,
      medianMarks,
      categoryCount: row.category_count,
      topCategory: topCat?.category ?? null,
      topCategoryAvg: topCat?.avg_marks ?? null,
    };
  } catch (error) {
    console.error('Error computing stats:', error);
    return {
      total: 0,
      withAdmitCard: 0,
      withoutAdmitCard: 0,
      highestMarks: null,
      averageMarks: null,
      lowestMarks: null,
      medianMarks: null,
      categoryCount: 0,
      topCategory: null,
      topCategoryAvg: null,
    };
  }
}

// ── Password Reset ──

export async function requestPasswordReset(username: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = db.prepare('SELECT id, email FROM admin_users WHERE username = ?').get(username) as { id: number; email: string } | undefined;
    if (!user) {
      // Don't reveal whether user exists
      return { success: true };
    }

    // Invalidate any existing tokens for this user
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 0').run(user.id);

    // Generate token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    // Build reset URL
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const resetUrl = `${protocol}://${host}/admin/reset-password?token=${token}`;

    // Send email if user has email configured
    if (user.email) {
      await queueEmail(user.email, 'Password Reset Request - TestMarks', `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your TestMarks admin account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <p><small>Reset URL: ${resetUrl}</small></p>
      `);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process password reset';
    return { error: message };
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success?: boolean; error?: string }> {
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
    db.prepare('UPDATE admin_users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashedPassword, resetRow.user_id);

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

