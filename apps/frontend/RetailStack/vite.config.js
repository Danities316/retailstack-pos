import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const baseURL = env.VITE_API_BASE_URL
  const apiBasePattern = new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/.*$`)

  return {
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'RetailStack POS',
          short_name: 'RetailStack',
          start_url: '.',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1976d2',
          description: 'A modern POS system for retail businesses.',
          icons: [
            {
              src: '/logo.jpg',
              sizes: '192x192',
              type: 'image/jpg'
            },
            {
              src: '/logo.jpg',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: apiBasePattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 24 * 60 * 60, // 1 day
                },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})