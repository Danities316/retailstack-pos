import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'


const baseURL = 'http://localhost:3000/api'
const apiBasePattern = new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*$`);

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(),
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
        // Optional: customize caching strategies
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
})
