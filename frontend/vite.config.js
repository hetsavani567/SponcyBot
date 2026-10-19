import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/companies': 'http://localhost:5000',
      '/emails': 'http://localhost:5000',
      '/gmail': 'http://localhost:5000',
      '/outreach': 'http://localhost:5000',
      '/team-members': 'http://localhost:5000',
      '/llm': 'http://localhost:5000',
      '/health': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
