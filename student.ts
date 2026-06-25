'use server';

import { cookies } from 'next/headers';
import db from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import { queueEmail, getWelcomeEmail } from '@/lib/services/email';
import crypto from 'crypto';

const STUDENT_SESSION_COOKIE = 'student_session';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

// Rate limiting store (in production, use Redis or similar)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Generate secure 8-character access code
export async function generateAccessCode(
  rollNumber: string,
  email: string
): Promise<{ success: boolean; accessCode?: string; error?: string }> {
  try {
    // Check if student exists in submissions
    const student = db.prepare(
      'SELECT name, roll FROM submissions WHERE roll = ? LIMIT 1'
    ).get(rollNumber) as { name: string; roll: string } | undefined;

    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    // Generate secure 8-character access code
    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Store in student_access table
    db.prepare(
      `INSERT INTO student_access (roll_number, access_token, created_at, last_accessed_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run(rollNumber, accessCode);

    // Log audit event
    createAuditLog({
      action: 'student_access_code_generated',
      entityType: 'student',
      entityId: null,
      newValues: { rollNumber, email },
    });

    return { success: true, accessCode };
  } catch (error) {
    console.error('Error generating access code:', error);
    return { success: false, error: 'Failed to generate access code' };
  }
}

// Student login with rate limiting
export async function studentLogin(
  rollNumber: string,
  accessCode: string
): Promise<{ success: boolean; error?: string; student?: { name: string; roll: string } }> {
  try {
    // Check rate limiting
    const now = Date.now();
    const attempts = loginAttempts.get(rollNumber);

    if (attempts) {
      if (now < attempts.resetAt) {
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
          return {
            success: false,
            error: `Too many login attempts. Please try again in ${Math.ceil((attempts.resetAt - now) / 60000)} minutes.`
          };
        }
      } else {
        // Reset window expired
        loginAttempts.delete(rollNumber);
      }
    }

    // Verify access code
    const accessRecord = db.prepare(
      `SELECT roll_number FROM student_access
       WHERE roll_number = ? AND access_token = ?
       ORDER BY created_at DESC LIMIT 1`
    ).get(rollNumber, accessCode) as { roll_number: string } | undefined;

    if (!accessRecord) {
      // Increment failed attempts
      const current = loginAttempts.get(rollNumber) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
      loginAttempts.set(rollNumber, {
        count: current.count + 1,
        resetAt: current.resetAt,
      });

      createAuditLog({
        action: 'student_login_failed',
        entityType: 'student',
        newValues: { rollNumber, reason: 'Invalid access code' },
      });

      return { success: false, error: 'Invalid roll number or access code' };
    }

    // Get student details
    const student = db.prepare(
      'SELECT name, roll FROM submissions WHERE roll = ? LIMIT 1'
    ).get(rollNumber) as { name: string; roll: string } | undefined;

    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    // Update last accessed time
    db.prepare(
      `UPDATE student_access
       SET last_accessed_at = datetime('now')
       WHERE roll_number = ? AND access_token = ?`
    ).run(rollNumber, accessCode);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set(STUDENT_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Store session in database
    db.prepare(
      `INSERT INTO student_access (roll_number, access_token, created_at, last_accessed_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run(rollNumber, sessionToken);

    // Clear failed attempts
    loginAttempts.delete(rollNumber);

    createAuditLog({
      action: 'student_login_success',
      entityType: 'student',
      newValues: { rollNumber, name: student.name },
    });

    return { success: true, student };
  } catch (error) {
    console.error('Error during student login:', error);
    return { success: false, error: 'Login failed. Please try again.' };
  }
}

// Student logout
export async function studentLogout(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

    if (sessionToken) {
      // Get roll number before deleting session
      const session = db.prepare(
        'SELECT roll_number FROM student_access WHERE access_token = ?'
      ).get(sessionToken) as { roll_number: string } | undefined;

      // Delete session from database
      db.prepare(
        'DELETE FROM student_access WHERE access_token = ?'
      ).run(sessionToken);

      if (session) {
        createAuditLog({
          action: 'student_logout',
          entityType: 'student',
          newValues: { rollNumber: session.roll_number },
        });
      }
    }

    // Clear cookie
    cookieStore.delete(STUDENT_SESSION_COOKIE);

    return { success: true };
  } catch (error) {
    console.error('Error during student logout:', error);
    return { success: false };
  }
}

// Get current student session
export async function getStudentSession(): Promise<{
  authenticated: boolean;
  student?: { name: string; roll: string };
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return { authenticated: false };
    }

    // Verify session exists and is recent (within 7 days)
    const session = db.prepare(
      `SELECT roll_number FROM student_access
       WHERE access_token = ?
       AND datetime(last_accessed_at) > datetime('now', '-7 days')`
    ).get(sessionToken) as { roll_number: string } | undefined;

    if (!session) {
      // Invalid or expired session — reuse the already-awaited cookieStore
      cookieStore.delete(STUDENT_SESSION_COOKIE);
      return { authenticated: false };
    }

    // Get student details
    const student = db.prepare(
      'SELECT name, roll FROM submissions WHERE roll = ? LIMIT 1'
    ).get(session.roll_number) as { name: string; roll: string } | undefined;

    if (!student) {
      return { authenticated: false };
    }

    // Update last accessed time
    db.prepare(
      `UPDATE student_access
       SET last_accessed_at = datetime('now')
       WHERE access_token = ?`
    ).run(sessionToken);

    return { authenticated: true, student };
  } catch (error) {
    console.error('Error getting student session:', error);
    return { authenticated: false };
  }
}

// Get student submissions
export async function getStudentSubmissions(rollNumber: string): Promise<{
  success: boolean;
  submissions?: Array<{
    id: number;
    name: string;
    category: string;
    roll: string;
    marks: string;
    admit_card_path: string | null;
    admit_card_filename: string | null;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    const submissions = db.prepare(
      `SELECT id, name, category, roll, marks, admit_card_path, admit_card_filename, created_at
       FROM submissions
       WHERE roll = ?
       ORDER BY created_at DESC`
    ).all(rollNumber) as Array<{
      id: number;
      name: string;
      category: string;
      roll: string;
      marks: string;
      admit_card_path: string | null;
      admit_card_filename: string | null;
      created_at: string;
    }>;

    return { success: true, submissions };
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    return { success: false, error: 'Failed to fetch submissions' };
  }
}

// Request access code (generates and emails)
export async function requestAccessCode(
  rollNumber: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }

    // Check if student exists
    const student = db.prepare(
      'SELECT name, roll FROM submissions WHERE roll = ? LIMIT 1'
    ).get(rollNumber) as { name: string; roll: string } | undefined;

    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    // Generate access code
    const result = await generateAccessCode(rollNumber, email);

    if (!result.success || !result.accessCode) {
      return { success: false, error: result.error || 'Failed to generate access code' };
    }

    // Queue welcome email with access code
    const emailBody = getWelcomeEmail({
      studentName: student.name,
      rollNumber: student.roll,
      accessCode: result.accessCode,
      portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/student/login`,
    });

    await queueEmail(
      email,
      'Your TestMarks Student Portal Access Code',
      emailBody
    );

    createAuditLog({
      action: 'student_access_code_requested',
      entityType: 'student',
      newValues: { rollNumber, email },
    });

    return { success: true };
  } catch (error) {
    console.error('Error requesting access code:', error);
    return { success: false, error: 'Failed to send access code' };
  }
}

// Bulk generate access codes from CSV data
export async function bulkGenerateAccessCodes(
  students: Array<{ rollNumber: string; email: string }>
): Promise<{
  success: boolean;
  results?: Array<{ rollNumber: string; success: boolean; error?: string }>;
  error?: string;
}> {
  try {
    const results = [];

    for (const student of students) {
      const result = await requestAccessCode(student.rollNumber, student.email);
      results.push({
        rollNumber: student.rollNumber,
        success: result.success,
        error: result.error,
      });
    }

    createAuditLog({
      action: 'bulk_access_codes_generated',
      entityType: 'student',
      newValues: { count: students.length },
    });

    return { success: true, results };
  } catch (error) {
    console.error('Error bulk generating access codes:', error);
    return { success: false, error: 'Failed to generate access codes' };
  }
}

// Revoke student access
export async function revokeStudentAccess(rollNumber: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Delete all access tokens for this student
    db.prepare(
      'DELETE FROM student_access WHERE roll_number = ?'
    ).run(rollNumber);

    createAuditLog({
      action: 'student_access_revoked',
      entityType: 'student',
      newValues: { rollNumber },
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking student access:', error);
    return { success: false, error: 'Failed to revoke access' };
  }
}

// Get student access statistics
export async function getStudentAccessStats(): Promise<{
  success: boolean;
  stats?: {
    totalStudents: number;
    studentsWithAccess: number;
    recentLogins: number;
  };
  error?: string;
}> {
  try {
    const totalStudents = db.prepare(
      'SELECT COUNT(DISTINCT roll) as count FROM submissions'
    ).get() as { count: number };

    const studentsWithAccess = db.prepare(
      'SELECT COUNT(DISTINCT roll_number) as count FROM student_access'
    ).get() as { count: number };

    const recentLogins = db.prepare(
      `SELECT COUNT(DISTINCT roll_number) as count FROM student_access
       WHERE datetime(last_accessed_at) > datetime('now', '-7 days')`
    ).get() as { count: number };

    return {
      success: true,
      stats: {
        totalStudents: totalStudents.count,
        studentsWithAccess: studentsWithAccess.count,
        recentLogins: recentLogins.count,
      },
    };
  } catch (error) {
    console.error('Error getting student access stats:', error);
    return { success: false, error: 'Failed to fetch statistics' };
  }
}
