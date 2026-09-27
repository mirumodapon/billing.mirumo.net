import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    conditions: ['development', 'import', 'module', 'browser', 'default'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Travel Split',
        short_name: 'Travel Split',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // 規格 7.6：匯率回應快取一小時，離線時還拿得到最後一次抓到的值
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.frankfurter\.app\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'fx', expiration: { maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
})
