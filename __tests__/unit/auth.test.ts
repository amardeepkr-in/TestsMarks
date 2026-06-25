import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDbPrepare } = vi.hoisted(() => ({
  mockDbPrepare: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: {
    prepare: mockDbPrepare,
  },
}));

import { cookies } from 'next/headers';
import {
  createSession,
  validateSession,
  destroySession,
  cleanupExpiredSessions,
} from '@/lib/auth';

const mockCookies = vi.mocked(cookies);

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

function setupDbStatement(returnValue: unknown) {
  const mockGet = vi.fn().mockReturnValue(returnValue);
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  mockDbPrepare.mockReturnValue({
    get: mockGet,
    run: mockRun,
  });
  return { mockGet, mockRun };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookies.mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);
});

describe('validateSession', () => {
  it('returns null when no session cookie exists', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const user = await validateSession();
    expect(user).toBeNull();
  });

  it('returns null when session is expired', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'expired-token' });
    setupDbStatement(undefined);

    const user = await validateSession();
    expect(user).toBeNull();
  });

  it('returns user for valid session', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
    setupDbStatement({
      user_id: 1,
      username: 'admin',
      role: 'ADMIN',
      created_at: '2024-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
    });

    const user = await validateSession();
    expect(user).toEqual({
      id: 1,
      username: 'admin',
      role: 'ADMIN',
    });
  });

  it('returns null on database error', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    mockDbPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });

    const user = await validateSession();
    expect(user).toBeNull();
  });
});

describe('createSession', () => {
  it('inserts session into database', async () => {
    const { mockRun } = setupDbStatement(null);

    await createSession(1, 'ADMIN');

    expect(mockRun).toHaveBeenCalledTimes(1);
    const [token, userId, role, expiresAt] = mockRun.mock.calls[0];
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64); // 32 bytes hex
    expect(userId).toBe(1);
    expect(role).toBe('ADMIN');
    expect(typeof expiresAt).toBe('string');
  });

  it('sets session cookie', async () => {
    setupDbStatement(null);

    await createSession(1, 'ADMIN');

    expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
    const [name, value, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe('session_id');
    expect(typeof value).toBe('string');
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(86400); // 24 hours
  });

  it('returns the session token', async () => {
    setupDbStatement(null);

    const token = await createSession(1, 'ADMIN');

    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
  });

  it('generates unique tokens for each session', async () => {
    setupDbStatement(null);

    const token1 = await createSession(1, 'ADMIN');
    const token2 = await createSession(2, 'VIEWER');

    expect(token1).not.toBe(token2);
  });
});

describe('destroySession', () => {
  it('deletes session from database when cookie exists', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token-to-delete' });
    const { mockRun } = setupDbStatement(null);

    await destroySession();

    expect(mockRun).toHaveBeenCalledWith('token-to-delete');
  });

  it('clears the session cookie', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    setupDbStatement(null);

    await destroySession();

    expect(mockCookieStore.delete).toHaveBeenCalledWith('session_id');
  });

  it('does not query database when no cookie exists', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await destroySession();

    expect(mockDbPrepare).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('session_id');
  });

  it('handles errors gracefully (best effort)', async () => {
    mockCookieStore.get.mockImplementation(() => {
      throw new Error('Cookie error');
    });

    // Should not throw
    await expect(destroySession()).resolves.toBeUndefined();
  });
});

describe('cleanupExpiredSessions', () => {
  it('returns number of deleted sessions', () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 5 });
    mockDbPrepare.mockReturnValue({
      get: vi.fn(),
      run: mockRun,
    });

    const count = cleanupExpiredSessions();
    expect(count).toBe(5);
  });

  it('returns 0 when no sessions expired', () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 0 });
    mockDbPrepare.mockReturnValue({
      get: vi.fn(),
      run: mockRun,
    });

    const count = cleanupExpiredSessions();
    expect(count).toBe(0);
  });
});
