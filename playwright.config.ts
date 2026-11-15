import { defineConfig, devices } from '@playwright/test'

// Browser smoke tests (decision D9) against the production build and the real API (api/).
// @playwright/test is pinned to the version of the container's browsers (.devcontainer).
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1300, height: 800 } } },
  ],
  webServer: {
    command: 'sh tests/e2e/serve.sh',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    stderr: 'ignore', // php -S logs every request there
  },
})
