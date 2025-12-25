import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true  // Fail if port is in use instead of switching
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  }
})