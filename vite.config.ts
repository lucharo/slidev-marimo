import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@slidev/cli'],
    exclude: ['fsevents']
  },
  server: {
    fs: {
      strict: false
    }
  }
})
