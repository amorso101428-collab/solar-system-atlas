import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
