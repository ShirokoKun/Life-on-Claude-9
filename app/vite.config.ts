import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Everything is bundled from node_modules: no CDN access at render time.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: { chunkSizeWarningLimit: 4000 },
});
