'use server';

import db from '../db';
import { Submission, AppSettings } from '../types';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { submissionSchema } from '../validation/schemas';
import { createAuditLog, AuditActions, EntityTypes } from '../services/audit';
import { hasPermission, Permission } from '../services/rbac';
import { requireAuth } from '../auth';
import { getClientIp } from '../middleware/ratelimit';
import { getSettings } from './settings';
import { processFileUpload, type FileUploadResult } from './file-upload';
import { queueEmail, getSubmissionConfirmationEmail, getMarksUpdateEmail } from '../services/email';

/**
 * Submission creation result type
 */
export interface CreateSubmissionResult {
  success?: boolean;
  error?: string;
  id?: number;
}

/**
 * Submission update result type
 */
export interface UpdateSubmissionResult {
  success?: boolean;
  error?: string;
}

/**
 * Paginated submissions response type
 */
export interface PaginatedSubmissions {
  data: Submission[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Submission statistics type
 */
export interface SubmissionStats {
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
}

/**
 * Filter options for submission queries
 */
export interface SubmissionFilters {
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const ALLOWED_SUBMISSION_FIELDS = ['name', 'category', 'roll', 'marks'] as const;

/**
 * Get all submissions
 */
export async function getSubmissions(): Promise<Submission[]> {
  const stmt = db.prepare('SELECT * FROM submissions ORDER BY id ASC');
  return stmt.all() as Submission[];
}

/**
 * Get paginated submissions with optional filters
 */
export async function getSubmissionsPaginated(
  page: number = 1,
  pageSize: number = 25,
  filters?: SubmissionFilters
): Promise<PaginatedSubmissions> {
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

  const totalResult = db
    .prepare(`SELECT COUNT(*) as count FROM submissions ${whereClause}`)
    .get(...params) as { count: number };
  const total = totalResult.count;
  const totalPages = Math.ceil(total / safePageSize);

  const data = db
    .prepare(
      `SELECT * FROM submissions ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, offset) as Submission[];

  return { data, total, page: safePage, pageSize: safePageSize, totalPages };
}

/**
 * Search submissions by query
 */
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

/**
 * Get submission count
 */
export async function getSubmissionCount(): Promise<number> {
  const result = db.prepare('SELECT COUNT(*) as count FROM submissions').get() as { count: number };
  return result.count;
}

/**
 * Get submission statistics
 */
export async function getSubmissionStats(): Promise<SubmissionStats> {
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
      medianMarks =
        numericMarks.length % 2
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

/**
 * Create a new submission
 */
export async function createSubmission(formData: FormData): Promise<CreateSubmissionResult> {
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
  const id = result.lastInsertRowid as number;

  const file = formData.get('file') as File | null;
  if (file && file.size > 0) {
    const settings2 = await getSettings();
    if (settings2 && settings2.allow_uploads === 0) {
      return { error: 'File uploads are currently disabled' };
    }
    const uploadResult = await processFileUpload(id, file);
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

/**
 * Update a submission with full data
 */
export async function updateSubmissionFull(id: number, formData: FormData): Promise<UpdateSubmissionResult> {
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

/**
 * Update a single field of a submission
 */
export async function updateSubmission(
  id: number,
  field: string,
  value: string
): Promise<UpdateSubmissionResult> {
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
        let marksData: Record<string, unknown>;
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

/**
 * Delete a submission
 */
export async function deleteSubmission(id: number): Promise<UpdateSubmissionResult> {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user.id, Permission.DELETE_SUBMISSIONS))) {
      return { error: 'Insufficient permissions to delete submissions' };
    }

    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(id) as
      | { admit_card_path: string | null }
      | undefined;
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

// Import fs and path for file operations
import fs from 'fs';
import path from 'path';
import { unlink } from 'fs/promises';
