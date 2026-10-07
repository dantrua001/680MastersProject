import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server forwards /api to the FastAPI backend. The game's WebSocket connects straight to
// the backend (see src/useGame.js) rather than through this proxy, to avoid a known conflict
// between Vite's own HMR socket and a proxied WebSocket on some Node versions.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
});