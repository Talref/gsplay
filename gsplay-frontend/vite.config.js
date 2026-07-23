// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          axios: ['axios'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        base: '/', 
      },
    },
  },
  };
});