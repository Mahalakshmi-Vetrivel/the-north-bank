import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createMailer } from '../src/mail.js';
import { validateDecision, validateLimits, validateRegistration } from '../src/validate.js';
import { fakeAuth, fakeDb, testConfig } from './fakes.js';

const good = { fullName: 'Asha Rao', email: 'Asha@Example.com', password: 'longenough1', phone: '98765 43210', address: '12 Lake Road, Chennai',
  dob: '1998-04-02', idType: 'PAN', documentNames: ['pan.pdf'], openingDepositMinor: 1 };

describe('validation', () => {
  it('accepts good registration and forces the INR 1,000 opening amount elsewhere', () => {
    const v = validateRegistration(good);
    expect(v.email).toBe('asha@example.com');
    expect(v.phone).toBe('9876543210');
  });
  it('rejects bad input', () => {
    for (const patch of [{ fullName: 'A' }, { email: 'nope' }, { password: 'short' }, { phone: '123' }, { dob: '2015-01-01' }, { idType: 'X' }, { documentNames: [] }]) {
      expect(() => validateRegistration({ ...good, ...patch })).toThrow();
    }
  });
  it('decision and limits rules', () => {
    expect(() => validateDecision({ decision: 'HOLD', reason: '' })).toThrow();
    expect(validateDecision({ decision: 'approve' }).decision).toBe('APPROVE');
    expect(() => validateLimits({ perTransferMinor: 500, dailyMinor: 100 })).toThrow();
    expect(() => validateLimits({ perTransferMinor: 1.5, dailyMinor: 100 })).toThrow();
    expect(validateLimits({ perTransferMinor: 5000, dailyMinor: 20000 })).toEqual({ perTransferMinor: 5000, dailyMinor: 20000 });
  });
});

describe('HTTP flow', () => {
  let server, base, db, auth;
  const call = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  beforeAll(async () => {
    db = fakeDb(); auth = fakeAuth();
    await db.collection('accounts').doc('P663-001').set({ accountId: 'P663-001', accountNumber: 'P66300000001', postedBalanceMinor: 80000, heldMinor: 0, status: 'ACTIVE' });
    const mailer = createMailer(testConfig, { log() {}, error() {} });
    server = createApp({ db, auth, mailer, config: testConfig }).listen(0);
    base = 'http://127.0.0.1:' + server.address().port;
  });
  afterAll(() => server.close());

  it('register → pending, login disabled, duplicate blocked', async () => {
    const r = await call('/api/register', { method: 'POST', body: good });
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('PENDING');
    expect([...auth.users.values()][0]).toMatchObject({ email: 'asha@example.com', disabled: true });
    expect((await call('/api/register', { method: 'POST', body: good })).status).toBe(409);
    good.applicationId = r.json.applicationId;
  });

  it('status lookup needs the matching e-mail (customer A cannot read B)', async () => {
    expect((await call(`/api/applications/${good.applicationId}/status?email=asha@example.com`)).json.status).toBe('PENDING');
    expect((await call(`/api/applications/${good.applicationId}/status?email=other@example.com`)).status).toBe(404);
  });

  it('admin endpoints reject missing or wrong sign-in', async () => {
    expect((await call('/api/admin/summary')).status).toBe(401);
    expect((await call('/api/admin/summary', { token: 'x'.repeat(64) })).status).toBe(401);
    expect((await call('/api/admin/login', { method: 'POST', body: { email: 'admin@test.example', password: 'wrong' } })).status).toBe(401);
    expect((await call('/api/admin/applications/' + good.applicationId, { method: 'PATCH', body: { decision: 'APPROVE' } })).status).toBe(401);
  });

  it('admin approves once: account, ₹1,000, login enabled, e-mail logged, double click safe', async () => {
    const { json: { token } } = await call('/api/admin/login', { method: 'POST', body: { email: 'ADMIN@test.example', password: 'test-admin-pass' } });
    expect(token).toHaveLength(64);
    const list = await call('/api/admin/applications?status=PENDING', { token });
    expect(list.json.total).toBe(1);
    expect(list.json.rows[0].authUid).toBeUndefined();

    const [a, b] = await Promise.all([1, 2].map(() => call('/api/admin/applications/' + good.applicationId, { method: 'PATCH', token, body: { decision: 'APPROVE' } })));
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a, b].filter(x => x.json.alreadyApproved)).toHaveLength(1);
    expect([...db.store.keys()].filter(k => k.startsWith('ledger_entries/'))).toHaveLength(1);
    expect(db.store.get('accounts/P663-002').postedBalanceMinor).toBe(100000);
    expect([...auth.users.values()][0].disabled).toBe(false);
    const outbox = (await call('/api/admin/outbox', { token })).json.rows;
    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe('LOGGED');
    expect(outbox[0].email).toBe('asha@example.com');
    expect((await call('/api/admin/summary', { token })).json).toMatchObject({ applications: { approved: 1, pending: 0 }, customers: 2, totalDepositsMinor: 180000 });
  });

  it('limits: set, validated, readable, audited', async () => {
    const { json: { token } } = await call('/api/admin/login', { method: 'POST', body: { email: 'admin@test.example', password: 'test-admin-pass' } });
    expect((await call('/api/admin/limits/P663-002', { method: 'PATCH', token, body: { perTransferMinor: 99999999, dailyMinor: 100 } })).status).toBe(400);
    expect((await call('/api/admin/limits/NOPE', { method: 'PATCH', token, body: { perTransferMinor: 100, dailyMinor: 200 } })).status).toBe(404);
    expect((await call('/api/admin/limits/P663-002', { method: 'PATCH', token, body: { perTransferMinor: 50000, dailyMinor: 100000 } })).status).toBe(200);
    expect((await call('/api/limits/P663-002')).json).toEqual({ perTransferMinor: 50000, dailyMinor: 100000 });
    expect((await call('/api/limits/P663-001')).json).toEqual({ perTransferMinor: null, dailyMinor: null });
    expect((await call('/api/admin/audit', { token })).json.rows.some(r => r.action === 'LIMITS_SET')).toBe(true);
  });

  it('reject sends a reason e-mail; a login for it stays disabled', async () => {
    await call('/api/register', { method: 'POST', body: { ...good, email: 'b@example.com' } });
    const { json: { token } } = await call('/api/admin/login', { method: 'POST', body: { email: 'admin@test.example', password: 'test-admin-pass' } });
    const id = (await call('/api/admin/applications?status=PENDING', { token })).json.rows[0].applicationId;
    expect((await call('/api/admin/applications/' + id, { method: 'PATCH', token, body: { decision: 'REJECT' } })).status).toBe(400);
    expect((await call('/api/admin/applications/' + id, { method: 'PATCH', token, body: { decision: 'REJECT', reason: 'ID not readable' } })).status).toBe(200);
    expect([...auth.users.values()].find(u => u.email === 'b@example.com').disabled).toBe(true);
    expect((await call('/api/admin/outbox', { token })).json.rows.some(r => r.type === 'KYC_REJECTED' && r.body.includes('ID not readable'))).toBe(true);
  });
});
