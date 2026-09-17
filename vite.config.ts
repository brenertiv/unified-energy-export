import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this app at /unified-energy-export/
  base: process.env.GITHUB_ACTIONS ? '/unified-energy-export/' : '/',
});
