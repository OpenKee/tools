import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  {
    path: '/apps/atlas-info',
    name: 'atlas-info',
    component: () => import('./views/AtlasInfo.vue'),
    meta: { preserveScroll: true },
  },
  { path: '/apps/dev-tools', name: 'dev-tools', component: () => import('./views/DevTools.vue') },
  { path: '/apps/api-probe', name: 'api-probe', component: () => import('./views/ApiProbe.vue') },
  { path: '/apps/space-now', name: 'space-now', component: () => import('./views/space/SpaceNow.vue') },
  { path: '/apps/hn-reader', name: 'hn-reader', component: () => import('./views/HnReader.vue') },
  { path: '/apps/time-leave', name: 'time-leave', component: () => import('./views/TimeLeave.vue') },
  { path: '/apps/meme-forge', name: 'meme-forge', component: () => import('./views/MemeForge.vue') },
  { path: '/apps/node-atlas', name: 'node-atlas', component: () => import('./views/NodeAtlas.vue') },
  { path: '/apps/radio-atlas', name: 'radio-atlas', component: () => import('./views/RadioAtlas.vue') },
  { path: '/apps/rate-board', name: 'rate-board', component: () => import('./views/RateBoard.vue') },
  { path: '/apps/repo-lens', name: 'repo-lens', component: () => import('./views/RepoLens.vue') },
  { path: '/apps/food', name: 'food', component: () => import('./views/FoodAtlas.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path && to.meta.preserveScroll) return false
    return { top: 0 }
  },
})
