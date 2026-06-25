import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Generate a cryptographically secure CSRF token
 * @returns Random token string
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Verify CSRF token using timing-safe comparison
 * @param token - Token to verify
 * @param expectedToken - Expected token value
 * @returns True if tokens match, false otherwise
 */
export function verifyCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }

  // Ensure both tokens are the same length to prevent timing attacks
  if (token.length !== expectedToken.length) {
    return false;
  }

  // Use timing-safe comparison
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

/**
 * Set CSRF token in httpOnly, secure cookie
 * @param token - Token to store
 */
export async function setCSRFCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Get CSRF token from cookie
 * @returns Token string or null if not found
 */
export async function getCSRFCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Delete CSRF token cookie
 */
export async function deleteCSRFCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}

/**
 * Generate and set a new CSRF token
 * @returns The generated token
 */
export async function createCSRFToken(): Promise<string> {
  const token = generateCSRFToken();
  await setCSRFCookie(token);
  return token;
}

/**
 * Verify CSRF token from request against stored cookie
 * @param requestToken - Token from request (form data or header)
 * @returns True if valid, false otherwise
 */
export async function verifyCSRFFromRequest(requestToken: string): Promise<boolean> {
  const storedToken = await getCSRFCookie();
  if (!storedToken) {
    return false;
  }
  return verifyCSRFToken(requestToken, storedToken);
}


