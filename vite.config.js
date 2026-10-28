import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 部署在 /tools/ 子路径，开发用根路径。
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/tools/' : '/',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
}))
