import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Unit tests only (tests/unit). The browser tests in tests/e2e run with Playwright.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts', 'packages/*/test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // The components are covered by the browser tests (tests/e2e).
      include: ['src/composables/**/*.ts', 'packages/*/src/**/*.ts'],
      reporter: ['text-summary', 'html'],
    },
  },
})
