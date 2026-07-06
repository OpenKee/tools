import { createRouter, createWebHistory } from 'vue-router'

// 生产部署在 /tools/ 子路径，开发时用根路径。
const base = import.meta.env.PROD ? '/tools/' : '/'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/apps/air-quality', name: 'air-quality', component: () => import('./views/AirQuality.vue') },
  { path: '/apps/aurora-forecast', name: 'aurora-forecast', component: () => import('./views/AuroraForecast.vue') },
  { path: '/apps/atlas-info', name: 'atlas-info', component: () => import('./views/AtlasInfo.vue') },
  { path: '/apps/book-finder', name: 'book-finder', component: () => import('./views/BookFinder.vue') },
  { path: '/apps/city-dashboard', name: 'city-dashboard', component: () => import('./views/CityDashboard.vue') },
  { path: '/apps/cocktail-bar', name: 'cocktail-bar', component: () => import('./views/CocktailBar.vue') },
  { path: '/apps/crypto-pulse', name: 'crypto-pulse', component: () => import('./views/CryptoPulse.vue') },
  { path: '/apps/dev-tools', name: 'dev-tools', component: () => import('./views/DevTools.vue') },
  { path: '/apps/earth-now', name: 'earth-now', component: () => import('./views/EarthNow.vue') },
  { path: '/apps/earthquake', name: 'earthquake', component: () => import('./views/Earthquake.vue') },
  { path: '/apps/hn-reader', name: 'hn-reader', component: () => import('./views/HnReader.vue') },
  { path: '/apps/hour-bridge', name: 'hour-bridge', component: () => import('./views/HourBridge.vue') },
  { path: '/apps/iss-tracker', name: 'iss-tracker', component: () => import('./views/IssTracker.vue') },
  { path: '/apps/launch-board', name: 'launch-board', component: () => import('./views/LaunchBoard.vue') },
  { path: '/apps/markdown-studio', name: 'markdown-studio', component: () => import('./views/MarkdownStudio.vue') },
  { path: '/apps/mars-weather', name: 'mars-weather', component: () => import('./views/MarsWeather.vue') },
  { path: '/apps/meme-forge', name: 'meme-forge', component: () => import('./views/MemeForge.vue') },
  { path: '/apps/movie-quest', name: 'movie-quest', component: () => import('./views/MovieQuest.vue') },
  { path: '/apps/node-atlas', name: 'node-atlas', component: () => import('./views/NodeAtlas.vue') },
  { path: '/apps/offday-planner', name: 'offday-planner', component: () => import('./views/OffdayPlanner.vue') },
  { path: '/apps/password-vault', name: 'password-vault', component: () => import('./views/PasswordVault.vue') },
  { path: '/apps/qr-forge', name: 'qr-forge', component: () => import('./views/QrForge.vue') },
  { path: '/apps/radio-atlas', name: 'radio-atlas', component: () => import('./views/RadioAtlas.vue') },
  { path: '/apps/rate-board', name: 'rate-board', component: () => import('./views/RateBoard.vue') },
  { path: '/apps/repo-deep-dive', name: 'repo-deep-dive', component: () => import('./views/RepoDeepDive.vue') },
  { path: '/apps/repo-scope', name: 'repo-scope', component: () => import('./views/RepoScope.vue') },
  { path: '/apps/sky-brief', name: 'sky-brief', component: () => import('./views/SkyBrief.vue') },
  { path: '/apps/sun-moon', name: 'sun-moon', component: () => import('./views/SunMoon.vue') },
  { path: '/apps/taste-atlas', name: 'taste-atlas', component: () => import('./views/TasteAtlas.vue') },
  { path: '/apps/trending-atlas', name: 'trending-atlas', component: () => import('./views/TrendingAtlas.vue') },
  { path: '/apps/trip-prep', name: 'trip-prep', component: () => import('./views/TripPrep.vue') },
  { path: '/apps/word-forge', name: 'word-forge', component: () => import('./views/WordForge.vue') },
  // Space Hub / GitHub Hub 已拆解为独立应用，旧链接重定向到对应的融合应用
  { path: '/apps/space-hub', redirect: '/apps/earth-now' },
  { path: '/apps/github-hub', redirect: '/apps/repo-deep-dive' },
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
