import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // ⚠️ Wir bauen für Netlify in "dist"
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // Nur für lokales Dev – Netlify benutzt das NICHT
  server: {
    host: true,
    port: 5177,
  },
})
