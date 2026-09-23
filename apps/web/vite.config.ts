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
      },
    }),
  ],
})
