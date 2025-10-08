import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    hmr: { port: 5173 },
    proxy: {
      // Proxy para API do Aditivo → evita CORS no ambiente local
      '/api-aditivo': {
        target: 'https://api-aditivo-production-ed80.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-aditivo/, ''),
      },
      // (opcional) se quiser, pode adicionar também a de correspondências:
      '/api-correspondencias': {
        target: 'https://correspondencias-backend-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-correspondencias/, ''),
      },
    },
  },
});
