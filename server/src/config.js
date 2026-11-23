// Central configuration, read once from environment variables.
const list = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8787,
    bankId: env.BANK_ID || 'P663',
    bankName: env.BANK_NAME || 'The North Bank',
    ifsc: env.IFSC || 'MAHA0K6P3DY',
    expectedProjectId: env.EXPECTED_PROJECT_ID || 'the-north-bank',
    serviceAccountPath: env.SERVICE_ACCOUNT_PATH || './secrets/key.json',
    adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',
    allowedOrigins: list(env.ALLOWED_ORIGINS || 'http://localhost:5173'),
    portalUrl: env.PORTAL_URL || 'http://localhost:5173/',
    smtp: { host: env.SMTP_HOST || '', port: Number(env.SMTP_PORT) || 465, user: env.SMTP_USER || '', pass: env.SMTP_PASS || '' },
    mailFrom: env.MAIL_FROM || 'The North Bank <no-reply@thenorthbank.example>',
  };
}
