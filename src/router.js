import { createRouter, createWebHistory } from 'vue-router'

// 生产部署在 /tools/ 子路径，开发时用根路径。
const base = import.meta.env.PROD ? '/tools/' : '/'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  // 已迁移到 Vue 的应用（SPA 路由）
  { path: '/apps/qr-forge', name: 'qr-forge', component: () => import('./views/QrForge.vue') },
  { path: '/apps/sun-moon', name: 'sun-moon', component: () => import('./views/SunMoon.vue') },
  { path: '/apps/crypto-pulse', name: 'crypto-pulse', component: () => import('./views/CryptoPulse.vue') },
  { path: '/apps/earthquake', name: 'earthquake', component: () => import('./views/Earthquake.vue') },
  // 其余 25 个应用暂未迁移，首页卡片用 <a href> 跳转到旧路径（整页刷新）。
]

const router = createRouter({
  history: createWebHistory(base),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
