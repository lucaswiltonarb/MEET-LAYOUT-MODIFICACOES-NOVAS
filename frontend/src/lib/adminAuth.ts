import { cookies } from 'next/headers';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'dev_secret_32_chars_xxxxxxxxxxxxx';
const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function sign(data: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function buildSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin|${exp}`;
  const sig = sign(payload);
  return `${payload}|${sig}`;
}

export function verifySessionToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split('|');
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`${role}|${expStr}`);
  return expected === sig && role === 'admin';
}

export async function setAdminSessionCookie() {
  const token = buildSessionToken();
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  return verifySessionToken(token || '');
}
