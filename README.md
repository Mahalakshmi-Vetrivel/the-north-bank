# The North Bank portal (P663)

Customer portal for The North Bank on the SharedBank test network. Built with React, Material UI and Vite.
Money movement (balances, transfers, interbank) is handled by the shared SharedBank Worker; this portal only
calls it. See `CHANGELOG.md` for what changed in the redesign.

## Run locally (Windows: use Command Prompt)

Requires Node.js 22 or newer.

```
npm ci
npm run dev      # opens on http://localhost:5173 (the Worker allows this port)
npm test         # unit tests
npm run build    # production build into dist/
```

If Vite starts on 5174 instead of 5173, another dev server is still running. Stop it first, or the Worker
will refuse the connection.

Running locally still talks to the live shared Worker. Signing in is safe; submitting a transfer creates a
real test transfer on the network.

## Pages

| Route | Page |
|---|---|
| `#/login` | Sign in |
| `#/` | Dashboard |
| `#/transfer` | Send money (stepper) |
| `#/history` | Transactions, filters, CSV export |

## Do not edit

These files belong to the SharedBank setup. Changing them can disconnect this bank from the network:
`src/live-api.js`, `src/cloudflare-config.js`, `src/bank-config.js` (`id`, `ifsc`), `.x42-portal.json`,
`.github/workflows/pages.yml`. Do not re-run `bank.sh portal --publish`: it regenerates this portal from the
template and overwrites these changes.

## Deploy

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`. Work on a branch and merge
to `main` only when you are ready to publish.
