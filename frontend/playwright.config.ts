import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

// A nonce also proves that /api points at THIS run's disposable backend.
const runId = process.env.E2E_RUN_ID ?? randomUUID()
process.env.E2E_RUN_ID = runId
const python = fileURLToPath(new URL('../presentation/sneaker-practice/.venv/bin/python', import.meta.url))
const fixture = fileURLToPath(new URL('./e2e/server.py', import.meta.url))
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:14200',
    browserName: 'chromium',
    locale: 'ru-RU',
    screenshot: 'only-on-failure',
    // Authentication requests contain generated credentials. Do not record them.
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: `${quote(python)} ${quote(fixture)}`,
      url: `http://127.0.0.1:18000/__e2e__/ready/${runId}`,
      env: { E2E_RUN_ID: runId },
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --port 14200',
      url: 'http://127.0.0.1:14200',
      env: { SNEAKER_API_TARGET: 'http://127.0.0.1:18000' },
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
      timeout: 30_000,
    },
  ],
})
