// KYC decision logic (Approve / Hold / Reject).
//
// SAFETY NOTES
//  * Everything runs inside ONE Firestore transaction, so a crash can never leave an account
//    without its opening ledger entry (or the other way round).
//  * The opening credit uses a fixed ledger document ID (P663-CF-SEED-<accountId>_CREDIT) written with
//    create(), which FAILS if it already exists. Together with the status check, the INR 1,000 can never
//    be credited twice, even if the admin double-clicks or two admins approve at once.
//  * The account and ledger documents copy the exact fields the SharedBank Worker wrote for the seeded
//    account P663-001 (see the Firestore screenshots). The Worker owns those collections, so we only ever
//    CREATE new documents there and never edit or delete existing ones.
import { HttpError } from './errors.js';
import { OPENING_DEPOSIT_MINOR } from './validate.js';

export const APPLICATIONS = 'nb_applications';
export const AUDIT = 'nb_audit_logs';
export const OUTBOX = 'nb_outbox';
export const META = 'nb_meta';

// Existing seeded account is P663-001 / P66300000001, so numbering continues from 1.
const FIRST_EXISTING_NUMBER = 1;

export const accountIdFor = (bankId, n) => `${bankId}-${String(n).padStart(3, '0')}`;
export const accountNumberFor = (bankId, n) => `${bankId}${String(n).padStart(8, '0')}`;

const randomId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

function emailFor(type, app, extra, config) {
  const name = app.fullName;
  if (type === 'KYC_APPROVED') return {
    subject: `Your ${config.bankName} account is approved`,
    body: `Dear ${name},\n\nYour account application (${app.applicationId}) has been approved.\n\nAccount number: ${extra.accountNumber}\nIFSC: ${config.ifsc}\nOpening balance: INR ${(OPENING_DEPOSIT_MINOR / 100).toFixed(2)} (demo credit)\n\nSign in with the email and password you registered: ${config.portalUrl}\n\n${config.bankName}`,
  };
  if (type === 'KYC_HELD') return {
    subject: `Your ${config.bankName} application is on hold`,
    body: `Dear ${name},\n\nYour account application (${app.applicationId}) is on hold.\nReason: ${extra.reason}\n\nPlease contact the bank to continue.\n\n${config.bankName}`,
  };
  return {
    subject: `Your ${config.bankName} application was not approved`,
    body: `Dear ${name},\n\nWe could not approve your account application (${app.applicationId}).\nReason: ${extra.reason}\n\n${config.bankName}`,
  };
}

/**
 * Applies an admin decision. Returns { application, outboxEventId, alreadyApproved }.
 * `db` is a Firestore (or the test fake) exposing collection().doc() and runTransaction().
 */
export async function decideApplication(db, config, applicationId, decision, reason, adminEmail, now = new Date()) {
  const outcome = await db.runTransaction(async tx => {
    const appRef = db.collection(APPLICATIONS).doc(applicationId);
    const snap = await tx.get(appRef);
    if (!snap.exists) throw new HttpError(404, 'Application not found.', 'NOT_FOUND');
    const app = snap.data();

    // Re-approving an already approved application is a safe no-op (lets the admin retry the sign-in enable step).
    if (app.status === 'APPROVED' && decision === 'APPROVE') return { application: app, alreadyApproved: true };
    if (!['PENDING', 'HELD'].includes(app.status)) {
      throw new HttpError(409, `This application is already ${app.status.toLowerCase()}.`, 'ALREADY_DECIDED');
    }

    const eventId = randomId('EVT');
    const logId = randomId('LOG');
    let patch;
    let mailType;
    let extra = { reason };

    if (decision === 'APPROVE') {
      // ---- reads first (Firestore requires all reads before any write) ----
      const counterRef = db.collection(META).doc('accountCounter');
      const counterSnap = await tx.get(counterRef);
      let n = (counterSnap.exists ? counterSnap.data().last : FIRST_EXISTING_NUMBER);
      let accountRef;
      for (let tries = 0; tries < 10; tries += 1) {
        n += 1;
        accountRef = db.collection('accounts').doc(accountIdFor(config.bankId, n));
        if (!(await tx.get(accountRef)).exists) break;
        accountRef = null; // already used (e.g. counter was behind): try the next number
      }
      if (!accountRef) throw new HttpError(500, 'Could not allocate an account number. Try again.', 'NO_ACCOUNT_NUMBER');

      const accountId = accountIdFor(config.bankId, n);
      const accountNumber = accountNumberFor(config.bankId, n);
      const entryId = `${config.bankId}-CF-SEED-${accountId}_CREDIT`;
      const ledgerRef = db.collection('ledger_entries').doc(entryId);
      if ((await tx.get(ledgerRef)).exists) throw new HttpError(409, 'The opening credit already exists for this account.', 'ALREADY_CREDITED');

      // ---- writes ----
      tx.create(accountRef, { // same fields as the Worker's seeded account P663-001
        accountId, accountNumber, createdAt: now, currency: 'INR', customerUid: app.authUid,
        heldMinor: 0, isSynthetic: true, postedBalanceMinor: OPENING_DEPOSIT_MINOR, status: 'ACTIVE', updatedAt: now,
      });
      tx.create(ledgerRef, { // same fields as the Worker's seed entry P663-CF-SEED-P663-001_CREDIT
        accountId, amountMinor: OPENING_DEPOSIT_MINOR, currency: 'INR', direction: 'CREDIT', entryId,
        entryType: 'DEMO_SEED', postedAt: now, transferId: `${config.bankId}-CF-SEED-${accountId}`,
      });
      tx.set(counterRef, { last: n, updatedAt: now });
      patch = { status: 'APPROVED', accountId, accountNumber, reason: null };
      mailType = 'KYC_APPROVED';
      extra = { accountNumber };
    } else if (decision === 'HOLD') {
      patch = { status: 'HELD', reason };
      mailType = 'KYC_HELD';
    } else {
      patch = { status: 'REJECTED', reason };
      mailType = 'KYC_REJECTED';
    }

    const updated = { ...app, ...patch, reviewedBy: adminEmail, reviewedAt: now, updatedAt: now };
    tx.update(db.collection(APPLICATIONS).doc(applicationId), { ...patch, reviewedBy: adminEmail, reviewedAt: now, updatedAt: now });
    tx.create(db.collection(AUDIT).doc(logId), {
      logId, action: `KYC_${decision}`, applicationId, actor: adminEmail, reason: reason || null, at: now,
      description: `${adminEmail} chose ${decision} for ${applicationId}${patch.accountId ? ` (account ${patch.accountId})` : ''}`,
    });
    const mail = emailFor(mailType, updated, extra, config);
    tx.create(db.collection(OUTBOX).doc(eventId), { // outbox: committed together with the decision, sent afterwards
      eventId, type: mailType, applicationId, uid: app.authUid, email: app.email, subject: mail.subject, body: mail.body,
      status: 'PENDING', attempts: 0, createdAt: now,
    });
    return { application: updated, outboxEventId: eventId, alreadyApproved: false };
  });
  return outcome;
}
