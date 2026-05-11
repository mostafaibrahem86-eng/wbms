import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// CRITICAL: JWT_SECRET must be set in environment variables
// Generate a strong secret: openssl rand -base64 32
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is not set');
    }
    // Dev-only fallback — never use in production
    console.warn('[AUTH] WARNING: Using dev-only JWT_SECRET. Set JWT_SECRET in .env for production.');
    return 'wbms-local-dev-secret-key-do-not-use-in-production';
  }
  return secret;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJWTSecret());
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT utilities
export async function createToken(payload: TokenPayload): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

// Get authenticated user from Request object
export async function getAuthUser(request: Request): Promise<TokenPayload | null> {
  // 1. Check Authorization: Bearer <token> header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token) {
      return verifyToken(token);
    }
  }

  // 2. Fallback: check cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const token = cookies['wbms-token'];
    if (token) {
      return verifyToken(token);
    }
  }

  return null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const name = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      cookies[name] = value;
    }
  }
  return cookies;
}

// Cookie options helper
export const COOKIE_OPTIONS = {
  name: 'wbms-token' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// Exclude password from user object
export function excludePassword<T extends { password?: string | null }>(
  user: T
): Omit<T, 'password'> {
  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
