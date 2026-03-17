import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    headers: {
      // Prevent OAuth popup postMessage warnings/disruptions during local dev.
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
  },
})
