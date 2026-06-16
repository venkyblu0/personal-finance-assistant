import { defineConfig } from 'vite';

export default defineConfig({
  base: '/personal-finance-assistant/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
