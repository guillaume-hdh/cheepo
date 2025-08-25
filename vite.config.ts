import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT : assets en chemins relatifs pour servir depuis /public_html/app
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
