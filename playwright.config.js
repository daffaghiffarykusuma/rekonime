import { defineConfig } from '@playwright/test';

const port = Number(process.env.REKONIME_E2E_PORT || 4173);

export default defineConfig({
  testDir: 'test/e2e',
  testIgnore: /production-smoke\.spec\.js/,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    timeout: 120000
  }
});
