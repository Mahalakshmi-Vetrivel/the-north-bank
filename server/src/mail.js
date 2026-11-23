// Outbox pattern: the e-mail record is committed WITH the decision (see decide.js);
// this module sends it afterwards and marks it SENT (or LOGGED / FAILED).
import nodemailer from 'nodemailer';
import { OUTBOX } from './decide.js';

export function createMailer(config, log = console) {
  const configured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
  const transport = configured ? nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  }) : null;

  return {
    configured,
    // Never throws: a mail problem must not undo or hide a bank decision. Failed events stay in the outbox.
    async deliver(db, eventId) {
      const ref = db.collection(OUTBOX).doc(eventId);
      try {
        const snap = await ref.get();
        if (!snap.exists) return;
        const event = snap.data();
        if (event.status === 'SENT' || event.status === 'LOGGED') return;
        if (!transport) {
          log.log(`[mail:dev] To: ${event.email}\nSubject: ${event.subject}\n${event.body}\n`);
          await ref.update({ status: 'LOGGED', attempts: (event.attempts || 0) + 1, sentAt: new Date() });
          return;
        }
        await transport.sendMail({ from: config.mailFrom, to: event.email, subject: event.subject, text: event.body });
        await ref.update({ status: 'SENT', attempts: (event.attempts || 0) + 1, sentAt: new Date() });
      } catch (error) {
        log.error('[mail] delivery failed:', error.message);
        try { await ref.update({ status: 'FAILED', lastError: String(error.message).slice(0, 200) }); } catch { /* ignore */ }
      }
    },
  };
}
