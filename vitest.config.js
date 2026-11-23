import { defineConfig } from 'vitest/config';

// The portal tests live in tests/. The backend has its own tests in server/ (run with `npm test` inside server/).
export default defineConfig({ test: { include: ['tests/**/*.test.js'] } });
