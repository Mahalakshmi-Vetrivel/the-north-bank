# Changelog

## UI redesign (branch `ui-redesign`)

Frontend only. The SharedBank Worker contract is unchanged: the portal still calls the same four
endpoints (`POST /banks/P663/sign-in`, `GET /banks/P663/dashboard`, `POST /banks/P663/transfers`,
`GET /directory/banks`) with the same headers and the same Idempotency-Key logic.

### Added
- Material UI theme (`src/theme.js`): navy and teal brand palette, Inter type, light/dark mode toggle.
- App shell: top bar, side navigation (drawer on mobile), breadcrumbs, user menu.
- Split-layout sign-in page with show/hide password.
- Dashboard: account cards (available, held, total), money in/out summary, recent activity, receipt dialog.
- Send money: 3-step stepper (details → review → receipt), receiving bank name from the directory,
  client-side checks (amount format, available balance, same-account). Retrying after an error re-uses
  the same Idempotency-Key, exactly as before.
- Transactions: search, status/direction/date filters (IST), pagination, CSV export, receipt view.
- 404 page and a sign-in guard on every page.
- Unit tests (`npm test`) for amount parsing, Indian money formatting, labels and CSV export.

### Changed
- `src/main.jsx` now renders `App` (router + theme). The SharedBank switch link is unchanged.
- Worker calls moved from `LiveBank.jsx` into `src/bank/BankContext.jsx` without changes.
- Icons now come from `@mui/icons-material` (replaces `lucide-react`). Added `react-router-dom`, `vitest`.

### Removed
- `src/LiveBank.jsx`, `src/live.css`, `src/style.css` (replaced by the new pages and MUI theme; still in git history).

### Not changed (do not edit)
`src/live-api.js`, `src/amount.js`, `src/bank-config.js`, `src/cloudflare-config.js`, `.x42-portal.json`,
`.github/workflows/pages.yml`, `vite.config.js`, `index.html`.

## Registration, KYC and admin (own backend)
- New `server/` (Express + firebase-admin + nodemailer), isolated `nb_*` collections.
- New pages: Register, Application status, Admin (KYC review, limits, e-mails & audit).
- Soft transfer-limit check in the Transfer page. Shared Worker/config untouched.

## Portfolio, saved payees and loans
- Portfolio page (read-only), Saved payees (own `nb_beneficiaries`), Loans (apply + admin review in `nb_loans`, no payout).
- "Send money" from a saved payee only pre-fills the existing transfer form; the transfer logic is unchanged.
