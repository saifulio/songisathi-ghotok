import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SongiSathi React app. Design-system fonts/tokens live in src/styles.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Forward API calls to the Express auth server.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
