import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Express API runs separately on port 4000 during development.
const proxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
  '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 is often taken by other Vite apps, so this project uses 5180.
    port: 5180,
    strictPort: true,
    proxy,
  },
  preview: {
    port: 5180,
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
