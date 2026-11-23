import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { loadConfig } from './config.js';
import { createMailer } from './mail.js';
import { createApp } from './app.js';

const config = loadConfig();
if (!config.adminEmail || config.adminPassword.length < 8) {
  console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters in server/.env');
  process.exit(1);
}

let key;
try { key = JSON.parse(readFileSync(config.serviceAccountPath, 'utf8')); } catch {
  console.error(`Cannot read the service-account key at ${config.serviceAccountPath}. See server/README.md.`);
  process.exit(1);
}
// Hard stop if the key belongs to any other project (for example a shared or another bank's project).
if (key.project_id !== config.expectedProjectId) {
  console.error(`Refusing to start: the key is for project "${key.project_id}" but this bank uses "${config.expectedProjectId}".`);
  process.exit(1);
}

initializeApp({ credential: cert(key) });
const db = getFirestore();
const app = createApp({ db, auth: getAuth(), mailer: createMailer(config), config });
app.listen(config.port, () => {
  console.log(`${config.bankName} services running on http://localhost:${config.port} (project ${key.project_id})`);
  console.log(`E-mail: ${config.smtp.host ? 'SMTP' : 'log only (no SMTP configured)'}`);
});
