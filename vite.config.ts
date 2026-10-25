import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // `scripts/dev.mjs` starts a PHP development server on this port that serves
  // `php-api/index.php` as the router. Point the proxy at it so the browser
  // talks to a same-origin `/api` path and never needs CORS.
  const phpTarget = env.RELIEF_DEV_PHP_TARGET || 'http://127.0.0.1:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: phpTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
            scanner: ['qr-scanner']
          }
        }
      }
    }
  }
})
