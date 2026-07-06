import { createRouter, createWebHistory } from 'vue-router'

// 生产部署在 /tools/ 子路径，开发时用根路径。
const base = import.meta.env.PROD ? '/tools/' : '/'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/apps/air-quality', name: 'air-quality', component: () => import('./views/AirQuality.vue') },
  { path: '/apps/atlas-info', name: 'atlas-info', component: () => import('./views/AtlasInfo.vue') },
  { path: '/apps/book-finder', name: 'book-finder', component: () => import('./views/BookFinder.vue') },
  { path: '/apps/cocktail-bar', name: 'cocktail-bar', component: () => import('./views/CocktailBar.vue') },
  { path: '/apps/crypto-pulse', name: 'crypto-pulse', component: () => import('./views/CryptoPulse.vue') },
  { path: '/apps/dev-tools', name: 'dev-tools', component: () => import('./views/DevTools.vue') },
  { path: '/apps/earthquake', name: 'earthquake', component: () => import('./views/Earthquake.vue') },
  { path: '/apps/github-hub', name: 'github-hub', component: () => import('./views/GithubHub.vue') },
  { path: '/apps/hn-reader', name: 'hn-reader', component: () => import('./views/HnReader.vue') },
  { path: '/apps/hour-bridge', name: 'hour-bridge', component: () => import('./views/HourBridge.vue') },
  { path: '/apps/markdown-studio', name: 'markdown-studio', component: () => import('./views/MarkdownStudio.vue') },
  { path: '/apps/meme-forge', name: 'meme-forge', component: () => import('./views/MemeForge.vue') },
  { path: '/apps/movie-quest', name: 'movie-quest', component: () => import('./views/MovieQuest.vue') },
  { path: '/apps/offday-planner', name: 'offday-planner', component: () => import('./views/OffdayPlanner.vue') },
  { path: '/apps/password-vault', name: 'password-vault', component: () => import('./views/PasswordVault.vue') },
  { path: '/apps/qr-forge', name: 'qr-forge', component: () => import('./views/QrForge.vue') },
  { path: '/apps/radio-atlas', name: 'radio-atlas', component: () => import('./views/RadioAtlas.vue') },
  { path: '/apps/rate-board', name: 'rate-board', component: () => import('./views/RateBoard.vue') },
  { path: '/apps/sky-brief', name: 'sky-brief', component: () => import('./views/SkyBrief.vue') },
  { path: '/apps/space-hub', name: 'space-hub', component: () => import('./views/SpaceHub.vue') },
  { path: '/apps/sun-moon', name: 'sun-moon', component: () => import('./views/SunMoon.vue') },
  { path: '/apps/taste-atlas', name: 'taste-atlas', component: () => import('./views/TasteAtlas.vue') },
  { path: '/apps/word-forge', name: 'word-forge', component: () => import('./views/WordForge.vue') },
  // 已聚合到 /apps/space-hub（ISS Tracker + Mars Weather + Aurora Forecast + Launch Board）
  // 已聚合到 /apps/github-hub（Trending Atlas + Repo Scope + Node Atlas）
  // 兼容旧链接：重定向到对应 Hub
  { path: '/apps/iss-tracker', redirect: '/apps/space-hub?tab=iss' },
  { path: '/apps/mars-weather', redirect: '/apps/space-hub?tab=mars' },
  { path: '/apps/aurora-forecast', redirect: '/apps/space-hub?tab=aurora' },
  { path: '/apps/launch-board', redirect: '/apps/space-hub?tab=launch' },
  { path: '/apps/trending-atlas', redirect: '/apps/github-hub?tab=trending' },
  { path: '/apps/repo-scope', redirect: '/apps/github-hub?tab=repo' },
  { path: '/apps/node-atlas', redirect: '/apps/github-hub?tab=node' },
  // 兜底：未知路径回到首页
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(base),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
