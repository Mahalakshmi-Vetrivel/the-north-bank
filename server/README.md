# The North Bank – own backend (registration, KYC, admin)

Runs **on your laptop**. It never touches the shared Worker or the shared directory.
It only uses this bank's own Firestore project (`the-north-bank`).

What it does
- Customer applies (KYC) -> status PENDING; a *disabled* Firebase login is created.
- Admin approves / holds / rejects. Approve = creates ONE account + ONE ₹1,000 opening
  ledger entry (once only, even on double click) and enables the login.
- E-mails go to an outbox; sent by SMTP if configured, otherwise printed in this window.
- Admin can set per-transfer / daily limits (soft check in the portal only).

Own collections: `nb_applications`, `nb_audit_logs`, `nb_outbox`, `nb_meta`, `nb_limits`.
Only new documents in `accounts` and `ledger_entries` are created, on approval.

## Setup (Command Prompt, inside the `server` folder)
1. `npm install`
2. Firebase Console -> the-north-bank -> Project settings -> Service accounts ->
   **Generate new private key**. Save it as `server\secrets\key.json`.
   NEVER commit it or paste it in chat (`.gitignore` already blocks it).
3. `copy .env.example .env`, then edit `.env`: set `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   Optional e-mail: set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`,
   `SMTP_PASS` (a Gmail *App Password*). Without it, e-mails are only logged.
4. `npm test` (19 tests should pass), then `npm start`.
   The server refuses to start if the key belongs to another Firebase project.
5. In another window, in the project root: `npm run dev`, open http://localhost:5173
   - `/#/register` customer application, `/#/status` track it, `/#/admin` admin console.

The frontend talks to `http://localhost:8787` (override with `VITE_NB_API_URL`).
