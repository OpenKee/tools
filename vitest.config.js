import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['ui-tests/**/*.spec.js'],
    setupFiles: ['./ui-tests/setup.js'],
    restoreMocks: true,
    maxWorkers: 4,
  },
})
