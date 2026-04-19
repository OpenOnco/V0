import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,  // Fail if port is in use instead of switching
    proxy: {
      '/api/aacr': 'http://localhost:8090',
      '/api/news': 'http://localhost:8090',
      '/aacr': 'http://localhost:8090',
    },
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  }
})