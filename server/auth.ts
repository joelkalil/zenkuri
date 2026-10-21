import { scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  getUserByUsername,
  hashPassword,
  updateUserPassword,
  type UserRecord,
} from './db';
import { ApiError, sendError } from './errors';

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, displayName: user.displayName };
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/i;

export function registerUser(username: string, password: string, displayName?: string): { user: PublicUser; token: string } {
  const name = String(username ?? '').trim();
  if (!USERNAME_PATTERN.test(name)) {
    throw new ApiError('auth.invalid_username', 400);
  }
  if (String(password ?? '').length < 6) {
    throw new ApiError('auth.password_too_short', 400);
  }
  if (getUserByUsername(name)) {
    throw new ApiError('auth.username_taken', 409);
  }
  const user = createUser(name, String(displayName ?? '').trim() || name, hashPassword(password));
  return { user: toPublicUser(user), token: createSession(user.id) };
}

export function loginUser(username: string, password: string): { user: PublicUser; token: string } {
  const user = getUserByUsername(String(username ?? '').trim());
  if (!user || !verifyPassword(String(password ?? ''), user.passwordHash)) {
    throw new ApiError('auth.invalid_credentials', 401);
  }
  return { user: toPublicUser(user), token: createSession(user.id) };
}

export function logoutToken(token: string | null) {
  if (token) deleteSession(token);
}

export function changePassword(user: UserRecord, currentPassword: string, newPassword: string) {
  if (!verifyPassword(String(currentPassword ?? ''), user.passwordHash)) {
    throw new ApiError('auth.current_password_incorrect', 400);
  }
  if (String(newPassword ?? '').length < 6) {
    throw new ApiError('auth.password_too_short', 400);
  }
  updateUserPassword(user.id, hashPassword(newPassword));
}

export function extractToken(req: Request): string | null {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      user?: UserRecord;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const user = token ? getSessionUser(token) : null;
  if (!user) {
    sendError(res, 401, 'auth.unauthenticated');
    return;
  }
  req.userId = user.id;
  req.user = user;
  next();
}
