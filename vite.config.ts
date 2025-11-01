import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// FIX: Import fileURLToPath and url to resolve __dirname issue in ES modules.
import { fileURLToPath } from 'url';

// ✅ Configuração original e estável do Nexus
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Use import.meta.url to correctly resolve the path in an ES module environment.
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },
  server: {
    host: true, // permite que o AI Studio acesse localhost
  },
});
