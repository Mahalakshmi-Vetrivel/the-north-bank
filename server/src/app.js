import express from 'express';
import cors from 'cors';
import { HttpError } from './errors.js';
import { createAdminAuth } from './adminAuth.js';
import { validateDecision, validateLimits, validateRegistration, OPENING_DEPOSIT_MINOR } from './validate.js';
import { APPLICATIONS, AUDIT, OUTBOX, decideApplication } from './decide.js';
import { registerExtras } from './extras.js';

const LIMITS = 'nb_limits';
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const iso = value => (value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value ?? null);

// Never send the auth uid or e-mail body details more widely than needed.
const publicApp = app => ({
  applicationId: app.applicationId, fullName: app.fullName, email: app.email, phone: app.phone, address: app.address,
  dob: app.dob, idType: app.idType, documentNames: app.documentNames, openingDepositMinor: app.openingDepositMinor,
  status: app.status, reason: app.reason ?? null, accountId: app.accountId ?? null, accountNumber: app.accountNumber ?? null,
  reviewedBy: app.reviewedBy ?? null, createdAt: iso(app.createdAt), reviewedAt: iso(app.reviewedAt),
});

export function createApp({ db, auth, mailer, config }) {
  const app = express();
  const admin = createAdminAuth(config);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  app.use(cors({
    origin(origin, callback) { callback(null, !origin || config.allowedOrigins.includes(origin)); },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'no-store'); next(); });

  app.get('/api/health', (_req, res) => res.json({ ok: true, bankId: config.bankId, mail: mailer.configured ? 'smtp' : 'log-only' }));

  // ---------- Customer (public) ----------
  app.post('/api/register', wrap(async (req, res) => {
    const input = validateRegistration(req.body);
    let user;
    try {
      // Created DISABLED: cannot sign in anywhere until an admin approves. No password is stored by us.
      user = await auth.createUser({ email: input.email, password: input.password, displayName: input.fullName, disabled: true });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') throw new HttpError(409, 'An account or application with this email already exists.', 'EMAIL_EXISTS');
      if (error.code === 'auth/invalid-password' || error.code === 'auth/weak-password') throw new HttpError(400, 'Choose a stronger password.', 'INVALID_INPUT');
      throw error;
    }
    const applicationId = `APP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    const now = new Date();
    try {
      await db.collection(APPLICATIONS).doc(applicationId).create({
        applicationId, authUid: user.uid, fullName: input.fullName, email: input.email, phone: input.phone, address: input.address,
        dob: input.dob, idType: input.idType, documentNames: input.documentNames, openingDepositMinor: OPENING_DEPOSIT_MINOR,
        status: 'PENDING', reason: null, reviewedBy: null, accountId: null, createdAt: now, updatedAt: now,
      });
    } catch (error) {
      await auth.deleteUser(user.uid).catch(() => {}); // do not leave a login behind without an application
      throw error;
    }
    res.status(201).json({ applicationId, status: 'PENDING' });
  }));

  app.get('/api/applications/:id/status', wrap(async (req, res) => {
    const snap = await db.collection(APPLICATIONS).doc(String(req.params.id)).get();
    const email = String(req.query.email || '').trim().toLowerCase();
    // Same answer for "not found" and "wrong e-mail" so IDs cannot be probed.
    if (!snap.exists || snap.data().email !== email) throw new HttpError(404, 'No application found for that reference and email.', 'NOT_FOUND');
    const data = snap.data();
    res.json({ applicationId: data.applicationId, status: data.status, reason: data.reason ?? null, accountNumber: data.accountNumber ?? null, createdAt: iso(data.createdAt) });
  }));

  // Limits are only numbers; the portal uses them for a pre-check before a transfer is sent.
  app.get('/api/limits/:accountId', wrap(async (req, res) => {
    const snap = await db.collection(LIMITS).doc(String(req.params.accountId)).get();
    res.json(snap.exists ? { perTransferMinor: snap.data().perTransferMinor, dailyMinor: snap.data().dailyMinor } : { perTransferMinor: null, dailyMinor: null });
  }));

  // ---------- Admin ----------
  app.post('/api/admin/login', (req, res, next) => {
    try { res.json(admin.login(req.body?.email, req.body?.password, req.ip)); } catch (error) { next(error); }
  });
  app.post('/api/admin/logout', admin.require, (req, res) => { admin.logout((req.get('authorization') || '').slice(7)); res.json({ ok: true }); });

  const allApplications = async () => {
    const snap = await db.collection(APPLICATIONS).get();
    return snap.docs.map(doc => doc.data()).sort((a, b) => new Date(iso(b.createdAt)) - new Date(iso(a.createdAt)));
  };

  app.get('/api/admin/summary', admin.require, wrap(async (_req, res) => {
    const apps = await allApplications();
    const count = status => apps.filter(item => item.status === status).length;
    const accounts = (await db.collection('accounts').get()).docs.map(doc => doc.data()); // read-only
    res.json({
      applications: { total: apps.length, pending: count('PENDING'), held: count('HELD'), approved: count('APPROVED'), rejected: count('REJECTED') },
      customers: accounts.length,
      totalDepositsMinor: accounts.reduce((sum, item) => sum + (Number(item.postedBalanceMinor) || 0), 0),
      recent: apps.slice(0, 5).map(publicApp),
    });
  }));

  app.get('/api/admin/applications', admin.require, wrap(async (req, res) => {
    const status = String(req.query.status || 'ALL').toUpperCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 10));
    const rows = (await allApplications()).filter(item => (status === 'ALL' || item.status === status)
      && (!q || [item.fullName, item.email, item.applicationId, item.accountNumber].some(v => String(v || '').toLowerCase().includes(q))));
    res.json({ total: rows.length, page, size, rows: rows.slice(page * size, page * size + size).map(publicApp) });
  }));

  app.patch('/api/admin/applications/:id', admin.require, wrap(async (req, res) => {
    const { decision, reason } = validateDecision(req.body);
    const result = await decideApplication(db, config, String(req.params.id), decision, reason, req.admin.email);
    let loginEnabled = true;
    if (decision === 'APPROVE') {
      try { await auth.updateUser(result.application.authUid, { disabled: false }); } catch (error) {
        loginEnabled = false; // account exists and is credited once; pressing Approve again only retries this step
        console.error('[approve] could not enable login:', error.message);
      }
    }
    if (result.outboxEventId) await mailer.deliver(db, result.outboxEventId);
    if (!loginEnabled) throw new HttpError(502, 'Account created, but enabling the sign-in failed. Press Approve again to retry; the money is not credited twice.', 'LOGIN_ENABLE_FAILED');
    res.json({ application: publicApp(result.application), alreadyApproved: result.alreadyApproved });
  }));

  app.get('/api/admin/accounts', admin.require, wrap(async (_req, res) => {
    const [accounts, limits] = await Promise.all([db.collection('accounts').get(), db.collection(LIMITS).get()]);
    const byId = new Map(limits.docs.map(doc => [doc.id, doc.data()]));
    res.json({ rows: accounts.docs.map(doc => doc.data()).map(item => ({
      accountId: item.accountId, accountNumber: item.accountNumber, status: item.status,
      postedBalanceMinor: item.postedBalanceMinor, heldMinor: item.heldMinor,
      perTransferMinor: byId.get(item.accountId)?.perTransferMinor ?? null, dailyMinor: byId.get(item.accountId)?.dailyMinor ?? null,
    })) });
  }));

  app.patch('/api/admin/limits/:accountId', admin.require, wrap(async (req, res) => {
    const limits = validateLimits(req.body);
    const accountId = String(req.params.accountId);
    if (!(await db.collection('accounts').doc(accountId).get()).exists) throw new HttpError(404, 'Account not found.', 'NOT_FOUND');
    const now = new Date();
    const logId = `LOG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    await db.collection(LIMITS).doc(accountId).set({ accountId, ...limits, updatedBy: req.admin.email, updatedAt: now });
    await db.collection(AUDIT).doc(logId).create({ logId, action: 'LIMITS_SET', actor: req.admin.email, at: now,
      description: `${req.admin.email} set limits for ${accountId}: per transfer ${limits.perTransferMinor}, daily ${limits.dailyMinor} (paise)` });
    res.json({ accountId, ...limits });
  }));

  const recent = collection => wrap(async (_req, res) => {
    const snap = await db.collection(collection).get();
    const rows = snap.docs.map(doc => doc.data()).sort((a, b) => new Date(iso(b.at || b.createdAt)) - new Date(iso(a.at || a.createdAt))).slice(0, 30);
    res.json({ rows: rows.map(row => ({ ...row, at: iso(row.at), createdAt: iso(row.createdAt), sentAt: iso(row.sentAt), authUid: undefined, uid: undefined })) });
  });
  app.get('/api/admin/audit', admin.require, recent(AUDIT));
  app.get('/api/admin/outbox', admin.require, recent(OUTBOX));

  registerExtras(app, { db, auth, mailer, config, admin, wrap });

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found.', 'NOT_FOUND')));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error('[error]', error);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on the server.' } });
  });
  return app;
}
