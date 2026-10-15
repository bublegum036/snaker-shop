import { defineConfig } from '@playwright/test'
import base from './playwright.config'

if (!Array.isArray(base.webServer) || base.webServer.length !== 2) {
  throw new Error('Preview tests require the isolated backend and frontend servers')
}

export default defineConfig({
  ...base,
  testIgnore: [],
  webServer: [
    base.webServer[0],
    { ...base.webServer[1], command: 'npm run preview -- --port 14200' },
  ],
})
