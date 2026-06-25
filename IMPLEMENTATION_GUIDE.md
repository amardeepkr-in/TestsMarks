# TestMarks Portal - Implementation Guide

## 🚀 Quick Start for Implementation

This guide provides step-by-step instructions for implementing the enhancements outlined in the Enhancement Plan.

---

## Phase 1: Security & Foundation (Weeks 1-2)

### 1.1 Implement bcrypt Password Hashing

**Install Dependencies:**
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

**Create Password Utility (`lib/utils/password.ts`):**
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Update `lib/actions.ts`:**
```typescript
import { hashPassword, verifyPassword, validatePasswordStrength } from './utils/password';

// Replace existing hashPassword and verifyPassword functions
export async function loginAdminUser(username: string, password: string) {
  // ... existing validation ...
  
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined;
  if (!user) {
    return { error: 'Invalid username or password' };
  }
  
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { error: 'Invalid username or password' };
  }
  
  // ... rest of the function ...
}

export async function createAdminUser(username: string, password: string) {
  // ... existing validation ...
  
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return { error: strength.errors.join(', ') };
  }
  
  const hash = await hashPassword(password);
  const result = db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
  
  // ... rest of the function ...
}
```

### 1.2 Add Rate Limiting

**Install Dependencies:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Create Rate Limit Middleware (`lib/middleware/ratelimit.ts`):**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Use in-memory store for development, Redis for production
const redis = process.env.REDIS_URL
  ? new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN || '',
    })
  : undefined;

// Create rate limiters
export const loginRateLimit = new Ratelimit({
  redis: redis || new Map(),
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 requests per 15 minutes
  analytics: true,
});

export const apiRateLimit = new Ratelimit({
  redis: redis || new Map(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return { success, limit, remaining, reset };
}
```

**Create Rate Limit API Route (`app/api/middleware/ratelimit/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimit } from '@/lib/middleware/ratelimit';

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success, limit, remaining, reset } = await apiRateLimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  return NextResponse.next();
}
```

### 1.3 Input Validation with Zod

**Install Dependencies:**
```bash
npm install zod
```

**Create Validation Schemas (`lib/validation/schemas.ts`):**
```typescript
import { z } from 'zod';

export const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
  roll: z.string().min(1, 'Roll number is required').max(50, 'Roll number too long'),
  marks: z.string().min(1, 'Marks are required').max(20, 'Marks too long'),
});

export const adminUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type),
      'Only JPG, PNG, or PDF files are allowed'
    ),
});
```

**Update Server Actions with Validation:**
```typescript
import { submissionSchema, adminUserSchema } from './validation/schemas';

export async function createSubmission(formData: FormData) {
  const data = {
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    roll: formData.get('roll') as string,
    marks: formData.get('marks') as string,
  };

  const result = submissionSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  // ... rest of the function ...
}
```

### 1.4 CSRF Protection

**Create CSRF Utility (`lib/utils/csrf.ts`):**
```typescript
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';

export async function generateCSRFToken(): Promise<string> {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return token;
}

export async function verifyCSRFToken(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (!storedToken || !token) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(storedToken),
    Buffer.from(token)
  );
}
```

### 1.5 Audit Logging

**Create Audit Log Service (`lib/services/audit.ts`):**
```typescript
import db from '../db';
import { cookies, headers } from 'next/headers';

export interface AuditLogEntry {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const headersList = await headers();
  const cookieStore = await cookies();
  
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';
  const userId = cookieStore.get('adminUserId')?.value;

  const stmt = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    userId || entry.userId || null,
    entry.action,
    entry.entityType,
    entry.entityId || null,
    entry.oldValues ? JSON.stringify(entry.oldValues) : null,
    entry.newValues ? JSON.stringify(entry.newValues) : null,
    ipAddress,
    userAgent
  );
}

export async function getAuditLogs(filters?: {
  userId?: number;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.userId) {
    query += ' AND user_id = ?';
    params.push(filters.userId);
  }

  if (filters?.entityType) {
    query += ' AND entity_type = ?';
    params.push(filters.entityType);
  }

  if (filters?.startDate) {
    query += ' AND created_at >= ?';
    params.push(filters.startDate.toISOString());
  }

  if (filters?.endDate) {
    query += ' AND created_at <= ?';
    params.push(filters.endDate.toISOString());
  }

  query += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params);
}
```

**Update Actions to Include Audit Logging:**
```typescript
import { createAuditLog } from './services/audit';

export async function createSubmission(formData: FormData) {
  // ... existing code ...
  
  const result = stmt.run(name, category, roll, marks);
  const id = result.lastInsertRowid;

  await createAuditLog({
    action: 'CREATE',
    entityType: 'submission',
    entityId: id as number,
    newValues: { name, category, roll, marks },
  });

  // ... rest of the function ...
}

export async function deleteSubmission(id: number) {
  // ... existing code ...
  
  const existing = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  
  await createAuditLog({
    action: 'DELETE',
    entityType: 'submission',
    entityId: id,
    oldValues: existing as Record<string, unknown>,
  });

  // ... rest of the function ...
}
```

---

## Phase 2: Core Features (Weeks 3-4)

### 2.1 Database Migrations

**Create Migration System (`lib/db/migrations/index.ts`):**
```typescript
import db from '../db';
import fs from 'fs';
import path from 'path';

interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

export function initMigrationTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getMigrations(): Migration[] {
  return db.prepare('SELECT * FROM migrations ORDER BY id ASC').all() as Migration[];
}

export async function runMigrations() {
  initMigrationTable();
  
  const migrationsDir = path.join(process.cwd(), 'lib', 'db', 'migrations', 'files');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  const applied = getMigrations().map(m => m.name);
  const pending = files.filter(f => !applied.includes(f));
  
  for (const file of pending) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    
    console.log(`✓ Migration ${file} completed`);
  }
  
  console.log(`Migrations complete. ${pending.length} migrations applied.`);
}
```

**Create First Migration (`lib/db/migrations/files/001_add_audit_logs.sql`):**
```sql
-- Add audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

### 2.2 Email Notification System

**Install Dependencies:**
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

**Create Email Service (`lib/services/email.ts`):**
```typescript
import nodemailer from 'nodemailer';
import db from '../db';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function queueEmail(options: EmailOptions): Promise<number> {
  const stmt = db.prepare(`
    INSERT INTO email_queue (to_email, subject, body, status)
    VALUES (?, ?, ?, 'pending')
  `);
  
  const result = stmt.run(options.to, options.subject, options.html);
  return result.lastInsertRowid as number;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@testmarks.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function processEmailQueue(): Promise<void> {
  const pending = db.prepare(`
    SELECT * FROM email_queue 
    WHERE status = 'pending' AND attempts < 3
    ORDER BY created_at ASC
    LIMIT 10
  `).all();

  for (const email of pending as any[]) {
    const success = await sendEmail({
      to: email.to_email,
      subject: email.subject,
      html: email.body,
    });

    if (success) {
      db.prepare('UPDATE email_queue SET status = ? WHERE id = ?').run('sent', email.id);
    } else {
      db.prepare('UPDATE email_queue SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE id = ?').run(email.id);
    }
  }
}

// Email templates
export function getSubmissionConfirmationEmail(data: {
  name: string;
  roll: string;
  category: string;
  marks: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Submission Confirmed</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name},</p>
          <p>Your submission has been successfully recorded.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Roll Number: ${data.roll}</li>
            <li>Category: ${data.category}</li>
            <li>Marks: ${data.marks}</li>
          </ul>
          <p>Thank you for using our portal.</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

### 2.3 Student Portal

**Create Student Access Schema Migration (`lib/db/migrations/files/002_add_student_access.sql`):**
```sql
CREATE TABLE IF NOT EXISTS student_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_number TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_access_roll ON student_access(roll_number);
```

**Create Student Actions (`lib/actions/student.ts`):**
```typescript
'use server'

import db from '../db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function generateAccessCode(rollNumber: string, email?: string): Promise<string> {
  const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  const stmt = db.prepare(`
    INSERT INTO student_access (roll_number, access_code, email)
    VALUES (?, ?, ?)
    ON CONFLICT(roll_number) DO UPDATE SET access_code = ?, email = ?
  `);
  
  stmt.run(rollNumber, accessCode, email || null, accessCode, email || null);
  
  return accessCode;
}

export async function studentLogin(rollNumber: string, accessCode: string) {
  const student = db.prepare('SELECT * FROM student_access WHERE roll_number = ? AND access_code = ?')
    .get(rollNumber, accessCode);
  
  if (!student) {
    return { error: 'Invalid roll number or access code' };
  }
  
  db.prepare('UPDATE student_access SET last_login = CURRENT_TIMESTAMP WHERE roll_number = ?')
    .run(rollNumber);
  
  const cookieStore = await cookies();
  cookieStore.set('studentRoll', rollNumber, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return { success: true };
}

export async function getStudentSubmissions(rollNumber: string) {
  return db.prepare('SELECT * FROM submissions WHERE roll = ? ORDER BY created_at DESC')
    .all(rollNumber);
}
```

**Create Student Portal Page (`app/student/page.tsx`):**
```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStudentSubmissions } from '@/lib/actions/student';
import StudentDashboard from '@/components/StudentDashboard';

export default async function StudentPage() {
  const cookieStore = await cookies();
  const rollNumber = cookieStore.get('studentRoll')?.value;
  
  if (!rollNumber) {
    redirect('/student/login');
  }
  
  const submissions = await getStudentSubmissions(rollNumber);
  
  return <StudentDashboard submissions={submissions} rollNumber={rollNumber} />;
}
```

---

## Phase 3: Analytics & Reporting (Weeks 5-6)

### 3.1 Advanced Analytics with Charts

**Install Dependencies:**
```bash
npm install recharts
```

**Create Analytics Service (`lib/services/analytics.ts`):**
```typescript
import db from '../db';
import { Submission } from '../types';

export interface AnalyticsData {
  categoryDistribution: { name: string; value: number }[];
  marksDistribution: { range: string; count: number }[];
  timeSeriesData: { date: string; count: number; avgMarks: number }[];
  topPerformers: { name: string; roll: string; marks: number }[];
  categoryPerformance: { category: string; avg: number; min: number; max: number; count: number }[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  // Category distribution
  const categoryDist = db.prepare(`
    SELECT category as name, COUNT(*) as value
    FROM submissions
    GROUP BY category
    ORDER BY value DESC
  `).all() as { name: string; value: number }[];

  // Marks distribution
  const marksDist = db.prepare(`
    SELECT 
      CASE 
        WHEN CAST(marks AS REAL) < 40 THEN '0-39'
        WHEN CAST(marks AS REAL) < 60 THEN '40-59'
        WHEN CAST(marks AS REAL) < 75 THEN '60-74'
        WHEN CAST(marks AS REAL) < 90 THEN '75-89'
        ELSE '90-100'
      END as range,
      COUNT(*) as count
    FROM submissions
    WHERE marks GLOB '[0-9]*'
    GROUP BY range
    ORDER BY range
  `).all() as { range: string; count: number }[];

  // Time series data
  const timeSeries = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      AVG(CAST(marks AS REAL)) as avgMarks
    FROM submissions
    WHERE marks GLOB '[0-9]*'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all() as { date: string; count: number; avgMarks: number }[];

  // Top performers
  const topPerformers = db.prepare(`
    SELECT name, roll, CAST(marks AS REAL) as marks
    FROM submissions
    WHERE marks GLOB '[0-9]*'
    ORDER BY marks DESC
    LIMIT 10
  `).all() as { name: string; roll: string; marks: number }[];

  // Category performance
  const categoryPerf = db.prepare(`
    SELECT 
      category,
      AVG(CAST(marks AS REAL)) as avg,
      MIN(CAST(marks AS REAL)) as min,
      MAX(CAST(marks AS REAL)) as max,
      COUNT(*) as count
    FROM submissions
    WHERE marks GLOB '[0-9]*'
    GROUP BY category
    ORDER BY avg DESC
  `).all() as { category: string; avg: number; min: number; max: number; count: number }[];

  return {
    categoryDistribution: categoryDist,
    marksDistribution: marksDist,
    timeSeriesData: timeSeries.reverse(),
    topPerformers,
    categoryPerformance: categoryPerf,
  };
}
```

### 3.2 Excel Export

**Install Dependencies:**
```bash
npm install exceljs
```

**Create Excel Export Service (`lib/services/export.ts`):**
```typescript
import ExcelJS from 'exceljs';
import { Submission } from '../types';

export async function exportToExcel(submissions: Submission[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Submissions sheet
  const sheet = workbook.addWorksheet('Submissions');
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Roll Number', key: 'roll', width: 15 },
    { header: 'Marks', key: 'marks', width: 10 },
    { header: 'Admit Card', key: 'admit_card', width: 15 },
    { header: 'Created At', key: 'created_at', width: 20 },
  ];
  
  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  };
  
  // Add data
  submissions.forEach(sub => {
    sheet.addRow({
      id: sub.id,
      name: sub.name,
      category: sub.category,
      roll: sub.roll,
      marks: sub.marks,
      admit_card: sub.admit_card_filename || 'Not uploaded',
      created_at: sub.created_at,
    });
  });
  
  // Statistics sheet
  const statsSheet = workbook.addWorksheet('Statistics');
  // Add statistics...
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}
```

---

## Testing Strategy

### Unit Tests Example (`tests/unit/password.test.ts`)

```typescript
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/utils/password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result = validatePasswordStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Deployment Checklist

- [ ] Update environment variables in production
- [ ] Run database migrations
- [ ] Set up Redis for caching (if using)
- [ ] Configure email SMTP settings
- [ ] Set up cloud storage (if using)
- [ ] Configure monitoring (Sentry)
- [ ] Set up automated backups
- [ ] Enable HTTPS
- [ ] Configure CORS
- [ ] Set up rate limiting
- [ ] Test all critical paths
- [ ] Review security settings
- [ ] Set up health check monitoring
- [ ] Configure log aggregation
- [ ] Test email notifications
- [ ] Verify file uploads work
- [ ] Test student portal access
- [ ] Verify admin authentication
- [ ] Test data export features
- [ ] Check mobile responsiveness
- [ ] Verify PWA installation

---

## Monitoring Setup

### Sentry Integration

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### Winston Logging

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

---

## Performance Optimization Tips

1. **Database Indexing**: Add indexes on frequently queried columns
2. **Caching**: Use Redis for session storage and frequently accessed data
3. **Image Optimization**: Use Next.js Image component with proper sizing
4. **Code Splitting**: Lazy load heavy components
5. **API Response Caching**: Cache API responses with appropriate TTL
6. **Database Connection Pooling**: Reuse database connections
7. **CDN**: Serve static assets from CDN
8. **Compression**: Enable gzip/brotli compression
9. **Lazy Loading**: Load data on demand, not all at once
10. **Debouncing**: Debounce search inputs and API calls

---

## Next Steps

1. Choose which phase to implement first
2. Set up development environment with new dependencies
3. Create feature branch for implementation
4. Follow implementation guide step by step
5. Write tests for each feature
6. Review and test thoroughly
7. Deploy to staging environment
8. Get user feedback
9. Deploy to production

**Ready to implement?** Switch to Code mode and start building!