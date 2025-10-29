import { defineConfig } from 'vite';
import react from './src/shims/viteReactPlugin';
import path from 'path';
import { fileURLToPath } from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
      '@google/genai': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/shims/googleGenai.ts'),
    },
  },
});