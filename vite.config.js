import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 生产构建输出到 /tools/ 子路径（GitHub Pages），开发时用根路径。
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/tools/' : '/',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    // GitHub Pages 静态托管，资源用相对路径更稳妥
    assetsDir: 'assets',
  },
}))
