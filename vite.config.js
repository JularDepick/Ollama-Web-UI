import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-*.svg'],
      manifest: {
        name: 'Ollama Web UI',
        short_name: 'OllamaUI',
        description: 'Ollama 对话 Web 客户端',
        theme_color: '#1677ff',
        background_color: '#f5f7fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': '/src' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split vendor libraries into a separate chunk
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vue')) {
            return 'vendor'
          }
          // Split markdown/code-related utilities (loaded on demand)
          if (id.includes('markdown')) {
            return 'markdown'
          }
        }
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    // Chunk size warnings
    chunkSizeWarningLimit: 200
  }
})
