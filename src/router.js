import { createRouter, createWebHistory } from 'vue-router'
import { PROJECTS, slugify } from './data/projects.js'

// 生产部署在 /tools/ 子路径，开发时用根路径。
const base = import.meta.env.PROD ? '/tools/' : '/'

// 懒加载所有视图模块。key 为相对本文件的路径，如 './views/Home.vue'。
const views = import.meta.glob('./views/*.vue')

// 由 slug 推导组件文件名：air-quality → AirQuality.vue
function componentFile(slug) {
  const Pascal = slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  return `./views/${Pascal}.vue`
}

// 从 projects.js 派生应用路由（单一数据源，新增工具无需改本文件）。
// 若漏建视图文件，此处会立即抛错，避免上线后静默 404。
const appRoutes = PROJECTS.map((p) => {
  const slug = p.slug || slugify(p.name)
  const file = componentFile(slug)
  const loader = views[file]
  if (!loader) {
    throw new Error(`路由生成失败：找不到视图 ${file}（对应工具 "${p.name}"）`)
  }
  return { path: `/apps/${slug}`, name: slug, component: loader }
})

const routes = [
  { path: '/', name: 'home', component: views['./views/Home.vue'] },
  ...appRoutes,
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
