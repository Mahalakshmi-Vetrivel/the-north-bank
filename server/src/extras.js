// Customer extras: saved payees (beneficiaries) and loan applications.
//
// SAFETY NOTES
//  * Own collections only: nb_beneficiaries and nb_loans. Nothing here writes to accounts, ledger_entries,
//    transfers or any collection owned by the SharedBank Worker. A loan "approval" is a decision record only;
//    NO money is credited (the e-mail says disbursal is pending).
//  * Customer identity comes from a verified Firebase ID token (auth.verifyIdToken), never from the request body.
import { HttpError } from './errors.js';
import { AUDIT, OUTBOX } from './decide.js';

export const BENEFICIARIES = 'nb_beneficiaries';
export const LOANS = 'nb_loans';
export const LOAN_RATE_PERCENT = 10; // demo rate, fixed
export const LOAN_MIN_MINOR = 100_000; // INR 1,000
export const LOAN_MAX_MINOR = 50_000_000; // INR 5,00,000
export const MAX_BENEFICIARIES = 50;

const iso = value => (value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value ?? null);
const randomId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

export function emiMinor(principalMinor, months, ratePercent = LOAN_RATE_PERCENT) {
  const r = ratePercent / 12 / 100;
  const factor = (1 + r) ** months;
  return Math.round((principalMinor * r * factor) / (factor - 1));
}

function text(value, min, max, label) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (clean.length < min || clean.length > max) throw new HttpError(400, `${label} must be ${min}–${max} characters.`, 'INVALID_INPUT');
  return clean;
}

export function validateBeneficiary(body = {}) {
  const name = text(body.name, 2, 60, 'Name');
  const ifsc = text(body.ifsc, 11, 11, 'IFSC').toUpperCase();
  if (!/^[A-Z0-9]{11}$/.test(ifsc)) throw new HttpError(400, 'IFSC must be 11 letters or digits.', 'INVALID_INPUT');
  const accountNumber = text(body.accountNumber, 6, 24, 'Account number');
  if (!/^[A-Za-z0-9-]+$/.test(accountNumber)) throw new HttpError(400, 'Account number can only contain letters, digits and dashes.', 'INVALID_INPUT');
  const bankName = typeof body.bankName === 'string' ? body.bankName.trim().slice(0, 60) : '';
  return { name, ifsc, accountNumber, bankName };
}

export function validateLoan(body = {}) {
  const amountMinor = Number(body.amountMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < LOAN_MIN_MINOR || amountMinor > LOAN_MAX_MINOR) {
    throw new HttpError(400, 'Loan amount must be between INR 1,000 and INR 5,00,000.', 'INVALID_INPUT');
  }
  const tenureMonths = Number(body.tenureMonths);
  if (!Number.isInteger(tenureMonths) || tenureMonths < 3 || tenureMonths > 60) throw new HttpError(400, 'Tenure must be 3 to 60 months.', 'INVALID_INPUT');
  const purpose = text(body.purpose, 3, 120, 'Purpose');
  const accountId = text(body.accountId, 3, 40, 'Account');
  return { amountMinor, tenureMonths, purpose, accountId };
}

const publicLoan = loan => ({
  loanId: loan.loanId, accountId: loan.accountId, amountMinor: loan.amountMinor, tenureMonths: loan.tenureMonths,
  interestRatePercent: loan.interestRatePercent, emiMinor: loan.emiMinor, purpose: loan.purpose, status: loan.status,
  reason: loan.reason ?? null, applicantEmail: loan.email, createdAt: iso(loan.createdAt), reviewedAt: iso(loan.reviewedAt),
});

function loanMail(type, loan, config, reason) {
  const money = minor => `INR ${(minor / 100).toFixed(2)}`;
  if (type === 'LOAN_APPROVED') return {
    subject: `Your ${config.bankName} loan application is approved`,
    body: `Dear customer,\n\nYour loan application ${loan.loanId} for ${money(loan.amountMinor)} over ${loan.tenureMonths} months has been approved.\nEstimated EMI: ${money(loan.emiMinor)} at ${loan.interestRatePercent}% a year.\n\nDisbursal is pending: no money has been credited yet.\n\n${config.bankName}`,
  };
  return {
    subject: `Your ${config.bankName} loan application was not approved`,
    body: `Dear customer,\n\nWe could not approve loan application ${loan.loanId}.\nReason: ${reason}\n\n${config.bankName}`,
  };
}

export function registerExtras(app, { db, auth, mailer, config, admin, wrap }) {
  // ----- customer identity: verified Firebase ID token -----
  const requireCustomer = wrap(async (req, _res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    let decoded;
    try { decoded = await auth.verifyIdToken(token); } catch { throw new HttpError(401, 'Your sign-in could not be verified. Sign in again.', 'UNAUTHENTICATED'); }
    req.customer = { uid: decoded.uid, email: String(decoded.email || '').toLowerCase() };
    next();
  });

  // ----- beneficiaries -----
  app.get('/api/me/beneficiaries', requireCustomer, wrap(async (req, res) => {
    const snap = await db.collection(BENEFICIARIES).get();
    const rows = snap.docs.map(doc => doc.data()).filter(item => item.uid === req.customer.uid)
      .sort((a, b) => new Date(iso(b.createdAt)) - new Date(iso(a.createdAt)));
    res.json({ rows: rows.map(item => ({ id: item.id, name: item.name, ifsc: item.ifsc, accountNumber: item.accountNumber, bankName: item.bankName, createdAt: iso(item.createdAt) })) });
  }));

  app.post('/api/me/beneficiaries', requireCustomer, wrap(async (req, res) => {
    const input = validateBeneficiary(req.body);
    const mine = (await db.collection(BENEFICIARIES).get()).docs.map(doc => doc.data()).filter(item => item.uid === req.customer.uid);
    if (mine.length >= MAX_BENEFICIARIES) throw new HttpError(409, `You can save up to ${MAX_BENEFICIARIES} payees.`, 'LIMIT_REACHED');
    const id = `${req.customer.uid}_${input.ifsc}_${input.accountNumber}`;
    try {
      await db.collection(BENEFICIARIES).doc(id).create({ id, uid: req.customer.uid, ...input, createdAt: new Date() });
    } catch { throw new HttpError(409, 'This payee is already saved.', 'DUPLICATE'); }
    res.status(201).json({ id, ...input });
  }));

  app.delete('/api/me/beneficiaries/:id', requireCustomer, wrap(async (req, res) => {
    const ref = db.collection(BENEFICIARIES).doc(String(req.params.id));
    const snap = await ref.get();
    // Same answer whether it does not exist or belongs to someone else.
    if (!snap.exists || snap.data().uid !== req.customer.uid) throw new HttpError(404, 'Payee not found.', 'NOT_FOUND');
    await ref.delete();
    res.json({ ok: true });
  }));

  // ----- loans: customer -----
  app.get('/api/me/loans', requireCustomer, wrap(async (req, res) => {
    const rows = (await db.collection(LOANS).get()).docs.map(doc => doc.data()).filter(item => item.uid === req.customer.uid)
      .sort((a, b) => new Date(iso(b.createdAt)) - new Date(iso(a.createdAt)));
    res.json({ rows: rows.map(publicLoan) });
  }));

  app.post('/api/me/loans', requireCustomer, wrap(async (req, res) => {
    const input = validateLoan(req.body);
    const account = await db.collection('accounts').doc(input.accountId).get(); // read-only check of ownership
    if (!account.exists || account.data().customerUid !== req.customer.uid) throw new HttpError(403, 'That account does not belong to you.', 'FORBIDDEN');
    const loans = (await db.collection(LOANS).get()).docs.map(doc => doc.data());
    if (loans.some(item => item.uid === req.customer.uid && item.status === 'PENDING')) {
      throw new HttpError(409, 'You already have a loan application waiting for review.', 'PENDING_EXISTS');
    }
    const loanId = randomId('LN');
    const now = new Date();
    await db.collection(LOANS).doc(loanId).create({
      loanId, uid: req.customer.uid, email: req.customer.email, ...input, interestRatePercent: LOAN_RATE_PERCENT,
      emiMinor: emiMinor(input.amountMinor, input.tenureMonths), status: 'PENDING', reason: null, reviewedBy: null, createdAt: now, updatedAt: now,
    });
    res.status(201).json({ loanId, status: 'PENDING', emiMinor: emiMinor(input.amountMinor, input.tenureMonths) });
  }));

  // ----- loans: admin (decision only, no money moves) -----
  app.get('/api/admin/loans', admin.require, wrap(async (req, res) => {
    const status = String(req.query.status || 'ALL').toUpperCase();
    const rows = (await db.collection(LOANS).get()).docs.map(doc => doc.data())
      .filter(item => status === 'ALL' || item.status === status)
      .sort((a, b) => new Date(iso(b.createdAt)) - new Date(iso(a.createdAt)));
    res.json({ rows: rows.map(publicLoan) });
  }));

  app.patch('/api/admin/loans/:id', admin.require, wrap(async (req, res) => {
    const decision = String(req.body?.decision || '').toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(decision)) throw new HttpError(400, 'Decision must be APPROVE or REJECT.', 'INVALID_INPUT');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    if (decision === 'REJECT' && reason.length < 3) throw new HttpError(400, 'Enter a reason for rejecting.', 'INVALID_INPUT');
    const loanId = String(req.params.id);
    const now = new Date();
    const out = await db.runTransaction(async tx => {
      const ref = db.collection(LOANS).doc(loanId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, 'Loan application not found.', 'NOT_FOUND');
      const loan = snap.data();
      if (loan.status !== 'PENDING') throw new HttpError(409, `This loan is already ${loan.status.toLowerCase()}.`, 'ALREADY_DECIDED');
      const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const patch = { status, reason: decision === 'REJECT' ? reason : null, reviewedBy: req.admin.email, reviewedAt: now, updatedAt: now };
      const updated = { ...loan, ...patch };
      const type = decision === 'APPROVE' ? 'LOAN_APPROVED' : 'LOAN_REJECTED';
      const eventId = randomId('EVT');
      const logId = randomId('LOG');
      tx.update(ref, patch);
      tx.create(db.collection(AUDIT).doc(logId), { logId, action: `LOAN_${decision}`, loanId, actor: req.admin.email, reason: patch.reason, at: now,
        description: `${req.admin.email} chose ${decision} for loan ${loanId} (INR ${(loan.amountMinor / 100).toFixed(2)}, no money moved)` });
      const mail = loanMail(type, updated, config, reason);
      tx.create(db.collection(OUTBOX).doc(eventId), { eventId, type, loanId, uid: loan.uid, email: loan.email, subject: mail.subject, body: mail.body, status: 'PENDING', attempts: 0, createdAt: now });
      return { loan: updated, eventId };
    });
    await mailer.deliver(db, out.eventId);
    res.json({ loan: publicLoan(out.loan) });
  }));
}
