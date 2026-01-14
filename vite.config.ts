import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: 'base' must be relative for the app to work in a file:// environment (like an APK)
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})