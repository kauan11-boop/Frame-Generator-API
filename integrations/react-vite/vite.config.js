import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ajuste "base" para o nome do repositório/página no GitHub Pages.
// Ex.: base: '/Frame-Generator-API/' para project pages, ou '/' para user/org pages/custom domain.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/Frame-Generator-API/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
