import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Use polling for file watching inside Docker on macOS
    // Fixes EAGAIN (-35) errors from virtiofs bind mounts
    watch: {
      usePolling: true,
      interval: 1000,
    },
    // Proxy API requests to the Flask backend during development
    // This means fetch('/api/...') in React gets forwarded to Flask
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
        // SSE streams and camera proxies need no buffering/timeout
        ws: true,
        timeout: 0,
      },
    },
  },
})
