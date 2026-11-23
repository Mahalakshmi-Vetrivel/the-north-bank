import { beforeEach, describe, expect, it } from 'vitest';
import { decideApplication, accountIdFor, accountNumberFor } from '../src/decide.js';
import { fakeDb, testConfig } from './fakes.js';

let db;
const seedApp = (id = 'APP-1', status = 'PENDING', uid = 'uidA') => db.collection('nb_applications').doc(id).set({
  applicationId: id, authUid: uid, fullName: 'Asha Rao', email: 'asha@example.com', status, openingDepositMinor: 100000,
});
const count = prefix => [...db.store.keys()].filter(key => key.startsWith(prefix)).length;

beforeEach(() => { db = fakeDb(); });

describe('number formats match the Worker seeded account', () => {
  it('P663-001 / P66300000001', () => {
    expect(accountIdFor('P663', 1)).toBe('P663-001');
    expect(accountNumberFor('P663', 1)).toBe('P66300000001');
    expect(accountIdFor('P663', 12)).toBe('P663-012');
  });
});

describe('approve', () => {
  it('creates the account, one opening credit, audit log and e-mail event', async () => {
    await seedApp();
    const result = await decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'admin@test.example');
    expect(result.application.status).toBe('APPROVED');
    const account = db.store.get('accounts/P663-002');
    expect(account).toMatchObject({ accountId: 'P663-002', accountNumber: 'P66300000002', currency: 'INR', customerUid: 'uidA',
      heldMinor: 0, postedBalanceMinor: 100000, status: 'ACTIVE', isSynthetic: true });
    expect(Object.keys(account).sort()).toEqual(['accountId', 'accountNumber', 'createdAt', 'currency', 'customerUid', 'heldMinor', 'isSynthetic', 'postedBalanceMinor', 'status', 'updatedAt']);
    const ledger = db.store.get('ledger_entries/P663-CF-SEED-P663-002_CREDIT');
    expect(ledger).toMatchObject({ accountId: 'P663-002', amountMinor: 100000, currency: 'INR', direction: 'CREDIT', entryType: 'DEMO_SEED', transferId: 'P663-CF-SEED-P663-002' });
    expect(Object.keys(ledger).sort()).toEqual(['accountId', 'amountMinor', 'currency', 'direction', 'entryId', 'entryType', 'postedAt', 'transferId']);
    expect(count('nb_audit_logs/')).toBe(1);
    expect([...db.store.entries()].find(([k]) => k.startsWith('nb_outbox/'))[1]).toMatchObject({ type: 'KYC_APPROVED', email: 'asha@example.com', status: 'PENDING' });
  });

  it('never credits twice, even for simultaneous double clicks', async () => {
    await seedApp();
    const results = await Promise.all([1, 2, 3].map(() => decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'admin@test.example')));
    expect(results.filter(r => !r.alreadyApproved)).toHaveLength(1);
    expect(count('accounts/')).toBe(1);
    expect(count('ledger_entries/')).toBe(1);
    expect(db.store.get('accounts/P663-002').postedBalanceMinor).toBe(100000);
    expect(count('nb_outbox/')).toBe(1);
  });

  it('gives each customer a different account number', async () => {
    await seedApp('APP-1', 'PENDING', 'uidA');
    await seedApp('APP-2', 'PENDING', 'uidB');
    await decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'a');
    await decideApplication(db, testConfig, 'APP-2', 'APPROVE', '', 'a');
    expect(db.store.get('accounts/P663-002').customerUid).toBe('uidA');
    expect(db.store.get('accounts/P663-003').customerUid).toBe('uidB');
  });

  it('skips an account id that already exists (never overwrites the Worker data)', async () => {
    await db.collection('accounts').doc('P663-002').set({ accountId: 'P663-002', postedBalanceMinor: 55 });
    await seedApp();
    await decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'a');
    expect(db.store.get('accounts/P663-002').postedBalanceMinor).toBe(55);
    expect(db.store.get('accounts/P663-003').customerUid).toBe('uidA');
  });
});

describe('hold and reject', () => {
  it('hold keeps the application open and creates no account', async () => {
    await seedApp();
    const r = await decideApplication(db, testConfig, 'APP-1', 'HOLD', 'Document unclear', 'a');
    expect(r.application).toMatchObject({ status: 'HELD', reason: 'Document unclear' });
    expect(count('accounts/')).toBe(0);
    expect(count('ledger_entries/')).toBe(0);
  });
  it('a held application can still be approved', async () => {
    await seedApp('APP-1', 'HELD');
    const r = await decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'a');
    expect(r.application.status).toBe('APPROVED');
    expect(count('ledger_entries/')).toBe(1);
  });
  it('reject is final: it cannot be approved afterwards', async () => {
    await seedApp();
    await decideApplication(db, testConfig, 'APP-1', 'REJECT', 'Invalid ID', 'a');
    await expect(decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'a')).rejects.toMatchObject({ status: 409 });
    expect(count('accounts/')).toBe(0);
  });
  it('an approved application cannot be rejected', async () => {
    await seedApp();
    await decideApplication(db, testConfig, 'APP-1', 'APPROVE', '', 'a');
    await expect(decideApplication(db, testConfig, 'APP-1', 'REJECT', 'oops', 'a')).rejects.toMatchObject({ status: 409 });
  });
  it('unknown application is a 404', async () => {
    await expect(decideApplication(db, testConfig, 'NOPE', 'APPROVE', '', 'a')).rejects.toMatchObject({ status: 404 });
  });
});
