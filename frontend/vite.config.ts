import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_URL = 'http://localhost:5175';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': BACKEND_URL,
      '/guide': BACKEND_URL,
      '/ws': { target: BACKEND_URL.replace('http', 'ws'), ws: true },
    },
  },
});
