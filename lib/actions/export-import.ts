'use server';

import db from '../db';
import { Submission } from '../types';
import { requireAuth } from '../auth';
import { hasPermission, Permission } from '../services/rbac';
import { cleanupAllUploadedFiles } from './file-upload';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { getClientIp } from '../middleware/ratelimit';
import { headers } from 'next/headers';

/**
 * Export result type
 */
export interface ExportResult {
  success?: boolean;
  error?: string;
  data?: string;
}

/**
 * CSV export headers
 */
const CSV_HEADERS = ['ID', 'Name', 'Category', 'Roll', 'Marks', 'Admit Card', 'Created At'];

/**
 * Escape CSV field value
 */
function escapeCsvField(value: string | null | undefined): string {
  if (!value) return '';
  return `"${(value as string).replace(/"/g, '""')}"`;
}

/**
 * Export submissions to CSV format
 */
export async function exportSubmissionsCSV(): Promise<string> {
  const submissions = await getSubmissionsForExport();
  const rows = submissions.map((s) => [
    s.id.toString(),
    escapeCsvField(s.name),
    escapeCsvField(s.category),
    escapeCsvField(s.roll),
    escapeCsvField(s.marks),
    escapeCsvField(s.admit_card_filename),
    escapeCsvField(s.created_at),
  ]);

  return [CSV_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Get all submissions for export
 */
async function getSubmissionsForExport(): Promise<Submission[]> {
  const stmt = db.prepare('SELECT * FROM submissions ORDER BY id ASC');
  return stmt.all() as Submission[];
}

/**
 * Wipe all submissions from database
 * Includes file cleanup and audit logging
 */
export async function wipeDatabase(): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.DELETE_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to wipe database' };
    }

    // Clean up uploaded files first
    await cleanupAllUploadedFiles();

    // Delete all submissions
    const stmt = db.prepare('DELETE FROM submissions');
    stmt.run();

    const headersList = await headers();
    createAuditLog({
      userId: user.id,
      action: AuditActions.SUBMISSIONS_WIPED,
      entityType: EntityTypes.SYSTEM,
      ipAddress: getClientIp(headersList),
      userAgent: headersList.get('user-agent') || 'unknown',
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to wipe database';
    return { error: message };
  }
}

// Import revalidatePath for the wipeDatabase function
import { revalidatePath } from 'next/cache';
