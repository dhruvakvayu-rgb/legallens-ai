import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  optimizeDeps: {
    // Pre-bundle pdfjs so Vite doesn't try to transform its worker internals
    include: ['pdfjs-dist'],
    // Exclude tesseract.js — it manages its own worker via blob URLs
    exclude: ['tesseract.js'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Keep pdfjs worker as a separate chunk so it can be loaded as a URL
        manualChunks: {
          'pdf-worker': ['pdfjs-dist'],
        },
      },
    },
  },
})
