import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { appDefines } from './appDefines'

// 部署到 GitHub Pages 時由 workflow 帶入（例如 /billing.mirumo.net/）；自訂網域或本機是根目錄
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: appDefines(),
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
        start_url: base,
        scope: base,
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        // task#88：Android 安裝需要 PNG；maskable 版的圖案縮在安全區內
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
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
