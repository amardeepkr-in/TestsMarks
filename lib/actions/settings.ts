'use server';

import db from '../db';
import { AppSettings } from '../types';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { settingsSchema } from '../validation/schemas';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { hasPermission, Permission } from '../services/rbac';
import { requireAuth } from '../auth';
import { getClientIp } from '../middleware/ratelimit';

/**
 * Settings update result type
 */
export interface UpdateSettingResult {
  success?: boolean;
  error?: string;
}

// Allowed settings fields - using enum for type safety
const ALLOWED_SETTINGS_FIELDS = ['allow_submissions', 'allow_user_edits', 'allow_uploads'] as const;
type SettingsField = typeof ALLOWED_SETTINGS_FIELDS[number];

/**
 * Get application settings
 */
export async function getSettings(): Promise<AppSettings> {
  const stmt = db.prepare('SELECT * FROM app_settings WHERE id = 1');
  return stmt.get() as AppSettings;
}

/**
 * Update a single setting field
 * Uses parameterized queries to prevent SQL injection
 */
export async function updateSetting(field: string, value: number): Promise<UpdateSettingResult> {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.MANAGE_SETTINGS))) {
      return { error: 'Insufficient permissions to change settings' };
    }

    // Validate field is allowed
    if (!ALLOWED_SETTINGS_FIELDS.includes(field as SettingsField)) {
      return { error: 'Invalid setting field' };
    }

    // Validate input
    const validation = settingsSchema.safeParse({ field, value });
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => e.message).join(', ');
      return { error: errors };
    }

    // Get old value using parameterized query
    const fieldMap: Record<SettingsField, string> = {
      allow_submissions: 'allow_submissions',
      allow_user_edits: 'allow_user_edits',
      allow_uploads: 'allow_uploads',
    };

    const safeField = fieldMap[field as SettingsField];
    const oldSetting = db.prepare(`SELECT ${safeField} FROM app_settings WHERE id = 1`).get() as Record<
      string,
      number
    >;
    const oldValue = oldSetting[safeField];

    const numericValue = value === 1 ? 1 : 0;

    // Use parameterized update
    const updateFieldMap: Record<SettingsField, string> = {
      allow_submissions: 'allow_submissions = ?',
      allow_user_edits: 'allow_user_edits = ?',
      allow_uploads: 'allow_uploads = ?',
    };

    const stmt = db.prepare(`UPDATE app_settings SET ${updateFieldMap[safeField]} WHERE id = 1`);
    stmt.run(numericValue);

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.SETTING_UPDATED,
      entityType: EntityTypes.SETTING,
      entityId: 1,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
      oldValues: { [safeField]: oldValue },
      newValues: { [safeField]: numericValue },
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update setting';
    return { error: message };
  }
}
