import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: /production-smoke\.spec\.js/,
  timeout: 90000,
  expect: {
    timeout: 15000
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: false,
    timeout: 120000
  }
});
