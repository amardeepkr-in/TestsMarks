import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock db ──
vi.mock('@/lib/db', () => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  return {
    default: {
      prepare: vi.fn(() => ({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      })),
    },
  };
});

// ── Mock auth ──
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));

// ── Mock rbac ──
vi.mock('@/lib/services/rbac', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  Permission: {
    EDIT_SUBMISSIONS: 'edit_submissions',
    DELETE_SUBMISSIONS: 'delete_submissions',
    MANAGE_USERS: 'manage_users',
    MANAGE_SETTINGS: 'manage_settings',
  },
}));

// ── Mock audit ──
vi.mock('@/lib/services/audit', () => ({
  createAuditLog: vi.fn().mockReturnValue(1),
  AuditActions: {
    SUBMISSION_CREATED: 'submission_created',
    SUBMISSION_UPDATED: 'submission_updated',
    SUBMISSION_DELETED: 'submission_deleted',
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGIN_FAILED: 'login_failed',
    PASSWORD_CHANGED: 'password_changed',
    SETTING_UPDATED: 'setting_updated',
    ADMIN_USER_CREATED: 'admin_user_created',
    ADMIN_USER_DELETED: 'admin_user_deleted',
  },
  EntityTypes: {
    SUBMISSION: 'submission',
    ADMIN_USER: 'admin_user',
    SETTING: 'setting',
    SYSTEM: 'system',
  },
}));

// ── Mock email ──
vi.mock('@/lib/services/email', () => ({
  queueEmail: vi.fn().mockResolvedValue(undefined),
  getSubmissionConfirmationEmail: vi.fn().mockReturnValue('email body'),
  getMarksUpdateEmail: vi.fn().mockReturnValue('marks body'),
  getAdmitCardUploadEmail: vi.fn().mockReturnValue('admit body'),
}));

// ── Mock ratelimit ──
vi.mock('@/lib/middleware/ratelimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  loginRateLimit: {},
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// ── Mock next/cache ──
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ── Mock next/headers ──
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test-agent'),
  }),
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-token' }),
  }),
}));

// ── Mock fs/promises ──
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock fs (existsSync) ──
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
}));

import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/services/rbac';
import { createAuditLog } from '@/lib/services/audit';
import { revalidatePath } from 'next/cache';
import {
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissions,
} from '@/lib/actions';
import type { Submission } from '@/lib/types';

const mockPrepare = vi.mocked(db.prepare);
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRequireAuth = vi.mocked(requireAuth);
const mockHasPermission = vi.mocked(hasPermission);
const mockCreateAuditLog = vi.mocked(createAuditLog);
const mockRevalidatePath = vi.mocked(revalidatePath);

function setupDbMock() {
  mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll } as any);
}

const adminUser = { id: 1, username: 'admin', role: 'ADMIN' } as any;

const sampleSubmission: Submission = {
  id: 1,
  name: 'Alice',
  category: 'Math',
  roll: 'R001',
  marks: '85',
  admit_card_path: null,
  admit_card_filename: null,
  created_at: '2025-06-15T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  setupDbMock();
  mockRequireAuth.mockResolvedValue(adminUser);
  mockHasPermission.mockResolvedValue(true);
  mockCreateAuditLog.mockReturnValue(1);
});

describe('submission actions integration', () => {
  describe('createSubmission', () => {
    function makeFormData(data: Record<string, string>): FormData {
      const fd = new FormData();
      for (const [key, value] of Object.entries(data)) {
        fd.set(key, value);
      }
      return fd;
    }

    it('creates a submission and returns success with id', async () => {
      // getSettings returns allow_submissions=1
      mockGet.mockReturnValueOnce({ allow_submissions: 1, allow_uploads: 1 });
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });

      const formData = makeFormData({ name: 'Alice', category: 'Math', roll: 'R001', marks: '85' });
      const result = await createSubmission(formData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('id');
      expect(mockRun).toHaveBeenCalled();
    });

    it('returns error when validation fails', async () => {
      const formData = makeFormData({ name: '', category: 'Math', roll: 'R001', marks: '85' });
      const result = await createSubmission(formData);

      expect(result).toHaveProperty('error');
      expect((result as any).error).toBeTruthy();
    });

    it('returns error when submissions are disabled', async () => {
      mockGet.mockReturnValueOnce({ allow_submissions: 0, allow_uploads: 1 });

      const formData = makeFormData({ name: 'Alice', category: 'Math', roll: 'R001', marks: '85' });
      const result = await createSubmission(formData);

      expect(result).toHaveProperty('error', 'Submissions are currently disabled');
    });

    it('does not require authentication', async () => {
      mockGet.mockReturnValueOnce({ allow_submissions: 1, allow_uploads: 1 });
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });

      const formData = makeFormData({ name: 'Alice', category: 'Math', roll: 'R001', marks: '85' });
      await createSubmission(formData);

      // createSubmission does NOT call requireAuth
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it('validates marks range (0-1000)', async () => {
      const formData = makeFormData({ name: 'Alice', category: 'Math', roll: 'R001', marks: '1500' });
      const result = await createSubmission(formData);

      expect(result).toHaveProperty('error');
    });

    it('revalidates the root path', async () => {
      mockGet.mockReturnValueOnce({ allow_submissions: 1, allow_uploads: 1 });
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });

      const formData = makeFormData({ name: 'Alice', category: 'Math', roll: 'R001', marks: '85' });
      await createSubmission(formData);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });
  });

  describe('updateSubmission', () => {
    it('updates a submission field and returns success', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce(sampleSubmission); // existing check
      mockRun.mockReturnValue({ changes: 1 });

      const result = await updateSubmission(1, 'name', 'Bob');

      expect(result).toHaveProperty('success', true);
      expect(mockRun).toHaveBeenCalled();
    });

    it('returns error when user lacks permission', async () => {
      mockHasPermission.mockResolvedValue(false);

      const result = await updateSubmission(1, 'name', 'Bob');
      expect(result).toHaveProperty('error', 'Insufficient permissions to edit submissions');
    });

    it('returns error for invalid field name', async () => {
      mockHasPermission.mockResolvedValue(true);

      const result = await updateSubmission(1, 'invalid_field', 'value');
      expect(result).toHaveProperty('error', 'Invalid field');
    });

    it('returns error when name is empty', async () => {
      mockHasPermission.mockResolvedValue(true);

      const result = await updateSubmission(1, 'name', '');
      expect(result).toHaveProperty('error', 'Name cannot be empty');
    });

    it('returns error when name exceeds 200 characters', async () => {
      mockHasPermission.mockResolvedValue(true);

      const longName = 'A'.repeat(201);
      const result = await updateSubmission(1, 'name', longName);
      expect(result).toHaveProperty('error', 'Name must be under 200 characters');
    });

    it('returns error when category is empty', async () => {
      mockHasPermission.mockResolvedValue(true);

      const result = await updateSubmission(1, 'category', '');
      expect(result).toHaveProperty('error', 'Category cannot be empty');
    });

    it('returns error when roll is empty', async () => {
      mockHasPermission.mockResolvedValue(true);

      const result = await updateSubmission(1, 'roll', '');
      expect(result).toHaveProperty('error', 'Roll number cannot be empty');
    });

    it('returns error when marks is empty', async () => {
      mockHasPermission.mockResolvedValue(true);

      const result = await updateSubmission(1, 'marks', '');
      expect(result).toHaveProperty('error', 'Marks cannot be empty');
    });

    it('returns error when submission not found', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce(undefined); // submission not found

      const result = await updateSubmission(999, 'name', 'Bob');
      expect(result).toHaveProperty('error', 'Submission not found');
    });

    it('trims whitespace from values', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce(sampleSubmission);
      mockRun.mockReturnValue({ changes: 1 });

      await updateSubmission(1, 'name', '  Bob  ');

      const updateCall = mockRun.mock.calls[0];
      expect(updateCall[0]).toBe('Bob');
    });

    it('revalidates the root path on success', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce(sampleSubmission);
      mockRun.mockReturnValue({ changes: 1 });

      await updateSubmission(1, 'name', 'Bob');

      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('allows updating all valid fields (name, category, roll, marks)', async () => {
      mockHasPermission.mockResolvedValue(true);

      for (const field of ['name', 'category', 'roll', 'marks']) {
        mockGet.mockReturnValueOnce(sampleSubmission);
        mockRun.mockReturnValue({ changes: 1 });
        const result = await updateSubmission(1, field, 'new-value');
        expect(result).toHaveProperty('success', true);
      }
    });
  });

  describe('deleteSubmission', () => {
    it('deletes a submission and returns success', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce({ admit_card_path: null });
      mockRun.mockReturnValue({ changes: 1 });

      const result = await deleteSubmission(1);

      expect(result).toHaveProperty('success', true);
    });

    it('returns error when user lacks permission', async () => {
      mockHasPermission.mockResolvedValue(false);

      const result = await deleteSubmission(1);
      expect(result).toHaveProperty('error', 'Insufficient permissions to delete submissions');
    });

    it('returns error when submission not found', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce(undefined);

      const result = await deleteSubmission(999);
      expect(result).toHaveProperty('error', 'Submission not found');
    });

    it('revalidates the root path on success', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce({ admit_card_path: null });
      mockRun.mockReturnValue({ changes: 1 });

      await deleteSubmission(1);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('calls requireAuth before deletion', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce({ admit_card_path: null });
      mockRun.mockReturnValue({ changes: 1 });

      await deleteSubmission(1);

      expect(mockRequireAuth).toHaveBeenCalled();
    });

    it('checks DELETE_SUBMISSIONS permission', async () => {
      mockHasPermission.mockResolvedValue(true);
      mockGet.mockReturnValueOnce({ admit_card_path: null });
      mockRun.mockReturnValue({ changes: 1 });

      await deleteSubmission(1);

      expect(mockHasPermission).toHaveBeenCalledWith(1, 'delete_submissions');
    });
  });

  describe('getSubmissions', () => {
    it('returns all submissions from the database', async () => {
      mockAll.mockReturnValue([sampleSubmission, { ...sampleSubmission, id: 2, name: 'Bob' }]);

      const result = await getSubmissions();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('returns empty array when no submissions exist', async () => {
      mockAll.mockReturnValue([]);

      const result = await getSubmissions();
      expect(result).toEqual([]);
    });

    it('does not call requireAuth', async () => {
      mockAll.mockReturnValue([]);
      await getSubmissions();
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });
  });

  describe('getSubmissionsPaginated', () => {
    it('returns paginated results with metadata', async () => {
      const mockData = [
        { id: 1, name: 'Alice', roll: 'R001', category: 'Math', marks: '90', admit_card_path: null, created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, name: 'Bob', roll: 'R002', category: 'Science', marks: '85', admit_card_path: null, created_at: '2025-01-01', updated_at: '2025-01-01' },
      ];
      mockGet.mockReturnValue({ count: 50 });
      mockAll.mockReturnValue(mockData);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(1, 25);

      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.totalPages).toBe(2);
    });

    it('clamps page to 1 minimum', async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockReturnValue([]);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(-1, 25);

      expect(result.page).toBe(1);
    });

    it('clamps pageSize to max 100', async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockReturnValue([]);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(1, 500);

      expect(result.pageSize).toBe(100);
    });

    it('applies search filter', async () => {
      mockGet.mockReturnValue({ count: 1 });
      mockAll.mockReturnValue([{ id: 1, name: 'Alice', roll: 'R001', category: 'Math', marks: '90', admit_card_path: null, created_at: '2025-01-01', updated_at: '2025-01-01' }]);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(1, 25, { search: 'Alice' });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('applies category filter', async () => {
      mockGet.mockReturnValue({ count: 1 });
      mockAll.mockReturnValue([]);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(1, 25, { category: 'Math' });

      expect(result.total).toBe(1);
    });

    it('defaults to id sort when invalid sortBy given', async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockReturnValue([]);

      const { getSubmissionsPaginated } = await import('@/lib/actions');
      const result = await getSubmissionsPaginated(1, 25, { sortBy: 'invalid_column' });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
