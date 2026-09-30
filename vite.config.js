import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    // Pisah vendor besar supaya browser bisa cache-nya terpisah dari kode app.
    // Tanpa ini, satu deploy baru membatalkan seluruh cache dan user mengunduh
    // ulang >1MB — hal yang paling terasa di jaringan seluler.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Chart.js hanya dipakai tab Statistik → chunk sendiri.
          if (id.includes('chart.js')) return 'vendor-chart'
          // PDF + spreadsheet: hanya saat user ekspor/impor.
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('/dompurify/')) return 'vendor-sanitize'
          // Firebase dipakai dari halaman login, jadi pisahkan: bundel awal
          // shell bisa mulai dirender lebih cepat.
          if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        id: '/',
        name: 'MyDuit — Catatan Keuangan',
        short_name: 'MyDuit',
        description: 'Catat, pantau, dan kendalikan keuangan pribadi. Offline-first.',
        lang: 'id',
        dir: 'ltr',
        theme_color: '#2D6A4F',
        background_color: '#1B4332',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Jangan precache chunk monster yang tidak pernah dipakai di awal.
        // chunks yang berat sudah di-lazy; precache semuanya membuat install
        // PWA pertama kali mengunduh >2.7MB sebelum app bisa dibuka.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})