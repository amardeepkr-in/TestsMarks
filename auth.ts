import crypto from 'crypto';
import { cookies } from 'next/headers';
import db from './db';
import type { Permission } from './services/rbac';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

interface Session {
  id: string;
  user_id: number;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

/**
 * Generate a cryptographically random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session in DB and set the session cookie
 */
export async function createSession(userId: number, role: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, role, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, role, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  return token;
}

/**
 * Validate a session token and return the authenticated user
 * Returns null if session is invalid or expired
 */
export async function validateSession(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = db.prepare(`
      SELECT s.*, u.username
      FROM sessions s
      JOIN admin_users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(token) as (Session & { username: string }) | undefined;

    if (!session) return null;

    return {
      id: session.user_id,
      username: session.username,
      role: session.role,
    };
  } catch {
    return null;
  }
}

/**
 * Require an authenticated admin user. Throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await validateSession();
  if (!user) {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}

/**
 * Require an authenticated admin user with a specific role.
 * Throws if not authenticated or insufficient role.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  const adminRoles = ['SUPER_ADMIN', 'ADMIN'];
  if (!adminRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  return user;
}

/**
 * Require an authenticated user with a specific permission.
 * Combines auth check + RBAC permission check in one call.
 * Throws if not authenticated or missing the required permission.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuth();
  // Dynamic import to avoid circular dependency
  const { hasPermission } = await import('./services/rbac');
  if (!(await hasPermission(user.id, permission))) {
    throw new Error(`Forbidden: Missing permission ${permission}`);
  }
  return user;
}

/**
 * Destroy the current session (logout)
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    }
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // best effort
  }
}

/**
 * Extend session expiry if it's within 50% of lifetime
 * (session rotation)
 */
export async function rotateSessionIfNeeded(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return;

    const session = db.prepare(`
      SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')
    `).get(token) as Session | undefined;

    if (!session) return;

    const createdAt = new Date(session.created_at).getTime();
    const expiresAt = new Date(session.expires_at).getTime();
    const now = Date.now();
    const lifetime = expiresAt - createdAt;
    const elapsed = now - createdAt;

    // Rotate if more than 50% of lifetime has elapsed
    if (elapsed > lifetime * 0.5) {
      const newExpiresAt = new Date(now + SESSION_MAX_AGE * 1000).toISOString();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiresAt, token);
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
    }
  } catch {
    // best effort
  }
}

/**
 * Cleanup expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const result = db.prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')').run();
  return result.changes;
}
