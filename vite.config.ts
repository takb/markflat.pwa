import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: 'markflat',
        short_name: 'm♭',
        description: 'A pwa to manage, display and edit markflat files',
        theme_color: '#e91e63',
        display: 'standalone',
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
  // `pnpm dev:api` serves the API locally (api/dev/config.example.php); the dev server
  // forwards /api to it, as the host's api/.htaccess does.
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8090', rewrite: path => path.replace(/^\/api/, '') },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})