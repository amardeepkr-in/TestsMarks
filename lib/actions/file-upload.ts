'use server';

import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import db from '../db';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

/**
 * File upload result type
 */
export interface FileUploadResult {
  error?: string;
}

/**
 * Validate file for upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file || file.size === 0) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must be under 10MB' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, or PDF files are allowed' };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent directory traversal and special character issues
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100);
}

/**
 * Process file upload and save to disk
 * Updates the submission record with the file path
 */
export async function processFileUpload(id: number, file: File): Promise<FileUploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = sanitizeFilename(file.name);
    const filename = `${Date.now()}-${id}-${safeName}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    // Get existing file path for cleanup
    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(id) as
      | { admit_card_path: string | null }
      | undefined;

    if (existing?.admit_card_path) {
      const oldPath = path.join(process.cwd(), 'public', existing.admit_card_path);
      if (fs.existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    // Update database with new file path
    const stmt = db.prepare('UPDATE submissions SET admit_card_path = ?, admit_card_filename = ? WHERE id = ?');
    stmt.run(`/uploads/${filename}`, file.name, id);

    return {};
  } catch (error) {
    console.error('File upload error:', error);
    return { error: 'Failed to save file' };
  }
}

/**
 * Delete a file from disk and clear database reference
 */
export async function deleteFile(submissionId: number): Promise<FileUploadResult> {
  try {
    const existing = db.prepare('SELECT admit_card_path FROM submissions WHERE id = ?').get(submissionId) as
      | { admit_card_path: string | null }
      | undefined;

    if (!existing) {
      return { error: 'Submission not found' };
    }

    if (existing.admit_card_path) {
      const filePath = path.join(process.cwd(), 'public', existing.admit_card_path);
      if (fs.existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }

      // Clear database reference
      const stmt = db.prepare(
        'UPDATE submissions SET admit_card_path = NULL, admit_card_filename = NULL WHERE id = ?'
      );
      stmt.run(submissionId);
    }

    return {};
  } catch (error) {
    console.error('File deletion error:', error);
    return { error: 'Failed to delete file' };
  }
}

/**
 * Clean up all uploaded files (for database wipe)
 */
export async function cleanupAllUploadedFiles(): Promise<void> {
  try {
    const files = db.prepare('SELECT admit_card_path FROM submissions WHERE admit_card_path IS NOT NULL').all() as {
      admit_card_path: string;
    }[];

    for (const file of files) {
      const filePath = path.join(process.cwd(), 'public', file.admit_card_path);
      if (fs.existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Error cleaning up uploaded files:', error);
  }
}
