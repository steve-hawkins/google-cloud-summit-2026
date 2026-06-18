import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
