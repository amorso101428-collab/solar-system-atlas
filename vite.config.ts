import bundledOrbits from './public/data/earth-live.json'
import orbitMetadata from './public/data/earth-live-meta.json'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'public-orbit-data',
    configureServer(server) {
      let cache = JSON.stringify(bundledOrbits), updated = Date.parse(orbitMetadata.fetchedAt)
      let pending: Promise<string> | null = null
      server.middlewares.use('/api/orbits', async (_request, response) => {
        try {
          if (!cache || Date.now() - updated > 7200000) {
            pending ??= fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON', { signal: AbortSignal.timeout(12000) })
              .then(async r => { if (!r.ok) throw new Error('upstream'); const json = await r.json(); if (!Array.isArray(json)) throw new Error('invalid GP'); return JSON.stringify(json) })
              .finally(() => { pending = null })
            cache = await pending; updated = Date.now()
          }
          response.setHeader('X-Orbit-Fetched-At', new Date(updated).toISOString()); response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'public, max-age=7200'); response.end(cache)
        } catch { response.statusCode = 503; response.end('Orbit source unavailable') }
      })
    },
  }],
  base: './',
  server: { port: 5180, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // 第三方库拆成独立 chunk：业务代码改动时，浏览器仍能复用这些文件的缓存
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const p = id.replace(/\\/g, '/')
          if (p.includes('/three/') || p.includes('/three-')) return 'three'
          if (p.includes('/@react-three/')) return 'r3f'
          if (p.includes('/react/') || p.includes('/react-dom/') || p.includes('/scheduler/')) return 'react'
        },
      },
    },
  },
})
