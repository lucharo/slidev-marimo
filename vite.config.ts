import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@slidev/cli']
  },
  server: {
    fs: {
      strict: false
    }
  }
})
