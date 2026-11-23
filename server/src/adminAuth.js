// Pre-created bank administrator. Credentials come from environment variables (never from the browser).
// A successful login returns a random opaque token; only its hash is kept in memory (restart = sign in again).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';

const sha = value => createHash('sha256').update(String(value)).digest();
const same = (a, b) => timingSafeEqual(sha(a), sha(b));
const SESSION_MS = 8 * 3600 * 1000;

export function createAdminAuth(config) {
  const sessions = new Map(); // tokenHash(hex) -> { email, expires }
  const failures = new Map(); // ip -> { count, since }

  function login(email, password, ip = 'unknown') {
    const record = failures.get(ip);
    if (record && Date.now() - record.since < 10 * 60 * 1000 && record.count >= 5) {
      throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'RATE_LIMITED');
    }
    const ok = config.adminEmail && config.adminPassword
      && same(String(email || '').trim().toLowerCase(), config.adminEmail) && same(password || '', config.adminPassword);
    if (!ok) {
      const fresh = record && Date.now() - record.since < 10 * 60 * 1000 ? record : { count: 0, since: Date.now() };
      fresh.count += 1;
      failures.set(ip, fresh);
      throw new HttpError(401, 'Incorrect admin email or password.', 'BAD_LOGIN');
    }
    failures.delete(ip);
    const token = randomBytes(32).toString('hex');
    sessions.set(sha(token).toString('hex'), { email: config.adminEmail, expires: Date.now() + SESSION_MS });
    return { token, email: config.adminEmail };
  }

  function require(req, _res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const key = token ? sha(token).toString('hex') : '';
    const session = sessions.get(key);
    if (!session || session.expires < Date.now()) {
      sessions.delete(key);
      return next(new HttpError(401, 'Admin sign-in required.', 'UNAUTHENTICATED'));
    }
    req.admin = { email: session.email };
    return next();
  }

  function logout(token) { sessions.delete(sha(token).toString('hex')); }

  return { login, require, logout };
}
