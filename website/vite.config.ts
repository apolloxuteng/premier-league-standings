import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env so the proxy can read the API key (Node doesn't load it automatically)
  const env = loadEnv(mode, process.cwd(), '')
  const apiToken = env.VITE_FOOTBALL_DATA_API_KEY

  return {
    plugins: [react()],
    build: {
      outDir: 'website',
    },
    server: {
      proxy: {
        '/api/football': {
          target: 'https://api.football-data.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/football/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiToken) proxyReq.setHeader('X-Auth-Token', apiToken)
            })
          },
        },
      },
    },
  }
})
