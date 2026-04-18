import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api to Express backend (default :3000); run `npm run start:api`
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
  },
})
