import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Use __dirname to resolve path to 'src'. `process.cwd()` was causing a type error.
      '@': path.resolve(__dirname, 'src'),
    },
  },
});