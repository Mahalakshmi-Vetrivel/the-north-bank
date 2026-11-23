import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createMailer } from '../src/mail.js';
import { emiMinor, validateBeneficiary, validateLoan } from '../src/extras.js';
import { fakeAuth, fakeDb, testConfig } from './fakes.js';

describe('extras validation', () => {
  it('beneficiary rules', () => {
    expect(validateBeneficiary({ name: 'Ravi', ifsc: 'maha0k6p3dy', accountNumber: 'P66300000002' }).ifsc).toBe('MAHA0K6P3DY');
    for (const patch of [{ name: 'R' }, { ifsc: 'SHORT' }, { accountNumber: '12' }, { accountNumber: 'bad number!' }]) {
      expect(() => validateBeneficiary({ name: 'Ravi', ifsc: 'MAHA0K6P3DY', accountNumber: 'P66300000002', ...patch })).toThrow();
    }
  });
  it('loan rules and EMI', () => {
    const ok = { accountId: 'P663-002', amountMinor: 5_000_000, tenureMonths: 12, purpose: 'Laptop' };
    expect(validateLoan(ok).tenureMonths).toBe(12);
    for (const patch of [{ amountMinor: 500 }, { amountMinor: 99_999_999 }, { amountMinor: 1.5 }, { tenureMonths: 2 }, { tenureMonths: 61 }, { purpose: 'x' }]) {
      expect(() => validateLoan({ ...ok, ...patch })).toThrow();
    }
    // INR 50,000 at 10% for 12 months is about INR 4,396 a month.
    expect(emiMinor(5_000_000, 12)).toBeGreaterThan(439_000);
    expect(emiMinor(5_000_000, 12)).toBeLessThan(440_500);
  });
});

describe('extras HTTP flow', () => {
  let server, base, db;
  const alice = 'tok:uidA:alice@example.com';
  const bob = 'tok:uidB:bob@example.com';
  const call = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  beforeAll(async () => {
    db = fakeDb();
    await db.collection('accounts').doc('P663-002').set({ accountId: 'P663-002', customerUid: 'uidA', postedBalanceMinor: 100000, heldMinor: 0, status: 'ACTIVE' });
    await db.collection('accounts').doc('P663-003').set({ accountId: 'P663-003', customerUid: 'uidB', postedBalanceMinor: 100000, heldMinor: 0, status: 'ACTIVE' });
    const mailer = createMailer(testConfig, { log() {}, error() {} });
    server = createApp({ db, auth: fakeAuth(), mailer, config: testConfig }).listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  });
  afterAll(() => server.close());

  it('customer routes need a verified token', async () => {
    expect((await call('/api/me/beneficiaries')).status).toBe(401);
    expect((await call('/api/me/beneficiaries', { token: 'garbage' })).status).toBe(401);
    expect((await call('/api/me/loans')).status).toBe(401);
  });

  it('beneficiaries: add, duplicate, isolation between customers, delete', async () => {
    const payee = { name: 'Ravi Kumar', ifsc: 'MAHA0K6P3DY', accountNumber: 'P66300000003', bankName: 'The North Bank' };
    const added = await call('/api/me/beneficiaries', { method: 'POST', token: alice, body: payee });
    expect(added.status).toBe(201);
    expect((await call('/api/me/beneficiaries', { method: 'POST', token: alice, body: payee })).status).toBe(409);
    expect((await call('/api/me/beneficiaries', { token: alice })).json.rows).toHaveLength(1);
    expect((await call('/api/me/beneficiaries', { token: bob })).json.rows).toHaveLength(0);
    // Bob cannot delete Alice's payee; it looks like "not found".
    expect((await call('/api/me/beneficiaries/' + encodeURIComponent(added.json.id), { method: 'DELETE', token: bob })).status).toBe(404);
    expect((await call('/api/me/beneficiaries/' + encodeURIComponent(added.json.id), { method: 'DELETE', token: alice })).status).toBe(200);
    expect((await call('/api/me/beneficiaries', { token: alice })).json.rows).toHaveLength(0);
  });

  it('loans: only for own account, one pending at a time, admin decides, NO money moves', async () => {
    const loan = { accountId: 'P663-002', amountMinor: 5_000_000, tenureMonths: 12, purpose: 'Laptop' };
    // Bob cannot apply against Alice's account.
    expect((await call('/api/me/loans', { method: 'POST', token: bob, body: loan })).status).toBe(403);
    const applied = await call('/api/me/loans', { method: 'POST', token: alice, body: loan });
    expect(applied.status).toBe(201);
    expect((await call('/api/me/loans', { method: 'POST', token: alice, body: loan })).status).toBe(409);
    expect((await call('/api/me/loans', { token: bob })).json.rows).toHaveLength(0);

    const admin = (await call('/api/admin/login', { method: 'POST', body: { email: testConfig.adminEmail, password: testConfig.adminPassword } })).json.token;
    expect((await call('/api/admin/loans')).status).toBe(401);
    expect((await call('/api/admin/loans', { token: admin })).json.rows).toHaveLength(1);
    expect((await call('/api/admin/loans/' + applied.json.loanId, { method: 'PATCH', token: admin, body: { decision: 'REJECT' } })).status).toBe(400);

    const before = JSON.stringify([...db.store.entries()].filter(([k]) => k.startsWith('accounts/') || k.startsWith('ledger_entries/')));
    const [a, b] = await Promise.all([1, 2].map(() => call('/api/admin/loans/' + applied.json.loanId, { method: 'PATCH', token: admin, body: { decision: 'APPROVE' } })));
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const after = JSON.stringify([...db.store.entries()].filter(([k]) => k.startsWith('accounts/') || k.startsWith('ledger_entries/')));
    expect(after).toBe(before); // accounts and ledger untouched
    const mails = [...db.store.entries()].filter(([k, v]) => k.startsWith('nb_outbox/') && v.type === 'LOAN_APPROVED');
    expect(mails).toHaveLength(1);
    expect(mails[0][1].body).toContain('no money has been credited');
    expect((await call('/api/me/loans', { token: alice })).json.rows[0].status).toBe('APPROVED');
  });
});
