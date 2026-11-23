import { HttpError } from './errors.js';

export const ID_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE'];
// The assignment fixes the opening balance at INR 1,000 = 100000 paise. The client value is ignored.
export const OPENING_DEPOSIT_MINOR = 100000;

const text = (value, min, max, label) => {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (clean.length < min || clean.length > max) throw new HttpError(400, `${label} must be ${min}–${max} characters.`, 'INVALID_INPUT');
  return clean;
};

export function validateRegistration(body = {}) {
  const fullName = text(body.fullName, 2, 80, 'Full name');
  const email = text(body.email, 5, 120, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.', 'INVALID_INPUT');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 100) throw new HttpError(400, 'Password must be 8–100 characters.', 'INVALID_INPUT');
  const phone = String(body.phone || '').replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(phone)) throw new HttpError(400, 'Enter a 10-digit mobile number.', 'INVALID_INPUT');
  const address = text(body.address, 5, 200, 'Address');
  const dob = typeof body.dob === 'string' ? body.dob.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) throw new HttpError(400, 'Enter your date of birth.', 'INVALID_INPUT');
  const age = (Date.now() - Date.parse(dob)) / (365.25 * 24 * 3600 * 1000);
  if (age < 18 || age > 120) throw new HttpError(400, 'You must be at least 18 years old to open an account.', 'INVALID_INPUT');
  const idType = ID_TYPES.includes(body.idType) ? body.idType : null;
  if (!idType) throw new HttpError(400, 'Choose an ID proof type.', 'INVALID_INPUT');
  const names = Array.isArray(body.documentNames) ? body.documentNames : [];
  const documentNames = names.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim().slice(0, 120)).slice(0, 5);
  if (!documentNames.length) throw new HttpError(400, 'Attach at least one document.', 'INVALID_INPUT');
  return { fullName, email, password, phone, address, dob, idType, documentNames };
}

export function validateDecision(body = {}) {
  const decision = String(body.decision || '').toUpperCase();
  if (!['APPROVE', 'HOLD', 'REJECT'].includes(decision)) throw new HttpError(400, 'Decision must be APPROVE, HOLD or REJECT.', 'INVALID_INPUT');
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  if (decision !== 'APPROVE' && reason.length < 3) throw new HttpError(400, 'Enter a reason for holding or rejecting.', 'INVALID_INPUT');
  return { decision, reason };
}

export function validateLimits(body = {}) {
  const per = Number(body.perTransferMinor);
  const daily = Number(body.dailyMinor);
  if (!Number.isSafeInteger(per) || !Number.isSafeInteger(daily) || per <= 0 || daily <= 0) {
    throw new HttpError(400, 'Limits must be positive whole amounts in paise.', 'INVALID_INPUT');
  }
  if (per > daily) throw new HttpError(400, 'The per-transfer limit cannot be more than the daily limit.', 'INVALID_INPUT');
  return { perTransferMinor: per, dailyMinor: daily };
}
