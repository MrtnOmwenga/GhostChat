import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API and the WebSocket are proxied, so the page, the API and the session
// cookie share one origin exactly as they do in production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
  test: {
    environment: 'node',
  },
});
