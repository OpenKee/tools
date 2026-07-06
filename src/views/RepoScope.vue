<script setup>
/* ============================================================
   Repo Scope — GitHub 用户与仓库分析（Vue 3 SFC）
   - 用户资料、仓库列表、语言分布、活跃度评分
   - localStorage 缓存（10 分钟 TTL），后台静默刷新
   - 可选 GitHub Token，规避未认证限流（60/小时）
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale, githubLangColors } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典 ---------- */
const copy = {
  en: {
    eyebrow: 'GitHub analysis utility', title: 'Repo Scope',
    lead: 'Analyze any GitHub user — repos, languages, activity scores, and health at a glance.',
    analyze: 'Analyze', tokenToggle: 'Optional: GitHub token', tokenSave: 'Save', tokenClear: 'Clear',
    openProfile: 'Open profile →', activityScore: 'Activity score',
    languages: 'Languages', repositories: 'Repositories', close: 'Close',
    byStars: 'By stars', byUpdated: 'By updated', byForks: 'By forks', byName: 'By name',
    followers: 'Followers', publicRepos: 'Public repos', totalStars: 'Total stars', repos: 'repos',
    loading: 'Loading…',
    errorRateLimit: 'GitHub API rate limit exceeded. Add a personal access token to raise limit to 5000/hr.',
    errorRateLimitReset: 'Resets at {time}.',
    errorForbidden: 'Access forbidden. The user may be suspended or a token is required.',
    errorNotFound: 'User not found.', errorGeneric: 'Error: {msg}',
    tokenRecommended: 'Tip: GitHub limits unauthenticated requests to 60/hr. Add a token below for reliable analysis.',
    fresh: 'fresh', dormant: 'dormant', hot: 'hot', fork: 'fork',
    created: 'Created', pushed: 'Last push', license: 'License', topics: 'Topics',
    scoreHigh: 'Very active — regular commits, stars growing, healthy issue response.',
    scoreMid: 'Moderately active — some recent activity, decent engagement.',
    scoreLow: 'Quiet — limited recent activity or very new account.',
    noRepos: 'No repositories.', noLang: 'No language data.',
    stars: 'stars', forks: 'forks', issues: 'issues',
    watchers: 'Watchers', size: 'Size', language: 'Language', defaultBranch: 'Branch',
    homepage: 'Homepage',
  },
  zh: {
    eyebrow: 'GitHub 分析工具', title: 'Repo Scope',
    lead: '分析任意 GitHub 用户 — 仓库、语言、活跃度评分、健康度一目了然。',
    analyze: '分析', tokenToggle: '可选：GitHub token', tokenSave: '保存', tokenClear: '清除',
    openProfile: '打开主页 →', activityScore: '活跃度评分',
    languages: '语言分布', repositories: '仓库', close: '关闭',
    byStars: '按星标', byUpdated: '按更新', byForks: '按 Fork', byName: '按名称',
    followers: '关注者', publicRepos: '公开仓库', totalStars: '累计星标', repos: '个仓库',
    loading: '加载中…',
    errorRateLimit: 'GitHub API 请求次数已达上限。添加 Personal Access Token 可提升到 5000 次/小时。',
    errorRateLimitReset: '重置时间：{time}',
    errorForbidden: '访问被拒绝。该用户可能已被冻结，或需要提供 token。',
    errorNotFound: '用户不存在。', errorGeneric: '出错：{msg}',
    tokenRecommended: '提示：GitHub 未认证请求限制为 60 次/小时。建议在下方添加 token 以获得稳定体验。',
    fresh: '刚更新', dormant: '沉寂', hot: '热门', fork: '复刻',
    created: '创建于', pushed: '最近推送', license: '许可证', topics: '标签',
    scoreHigh: '非常活跃 — 定期提交，星标增长，issue 响应健康。',
    scoreMid: '一般活跃 — 有一些近期活动，参与度还行。',
    scoreLow: '安静 — 近期活动少，或者是新账户。',
    noRepos: '没有仓库。', noLang: '没有语言数据。',
    stars: '星标', forks: 'Fork', issues: '议题',
    watchers: '关注', size: '大小', language: '语言', defaultBranch: '分支',
    homepage: '主页',
  },
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const PER_PAGE = 20
const CACHE_TTL = 10 * 60 * 1000 // 10 分钟缓存

/* ---------- 响应式状态 ---------- */
const username = ref('')                              // 搜索框输入
const tokenInput = ref('')                            // token 输入框
const tokenOk = ref(false)                            // token 保存成功的高亮
const tokenToggleOpen = ref(false)                    // token 折叠区是否展开
const ghToken = ref(lsGet('repo-scope-token') || '')  // 已保存的 token

const profile = ref(null)       // GitHub 用户资料
const repos = ref([])           // 已过滤的非 fork 仓库列表

const search = ref('')          // 仓库搜索关键字
const sort = ref('stars')       // 排序方式
const page = ref(1)             // 当前页码

const loading = ref(false)      // 主加载中
const errorMsg = ref('')        // 主错误信息

const detailFullName = ref('')  // 详情面板对应的仓库全名
const detail = ref(null)        // 仓库详情数据
const detailLoading = ref(false)// 详情加载中
const detailError = ref('')     // 详情错误信息

const tokenInputEl = ref(null)  // token 输入框引用（用于聚焦）

/* 初始化 token 输入框 */
if (ghToken.value) tokenInput.value = ghToken.value

/* ---------- 工具函数 ---------- */

// 数字格式化（按当前语言）
function num(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

// 语言对应颜色，缺省灰色
function langColor(n) {
  return githubLangColors[n] || '#8b8b8b'
}

// 距今天数
function daysSince(d) {
  return (Date.now() - new Date(d).getTime()) / 86400000
}

// 日期格式化（按当前语言）
function fmtDate(d) {
  return new Date(d).toLocaleDateString(locale())
}

// 博客地址补全协议
function blogUrl(blog) {
  return blog.startsWith('http') ? blog : 'https://' + blog
}

// 仓库标签：fresh / dormant / hot / fork
function repoTags(repo) {
  const tags = []
  if (daysSince(repo.updated_at) < 21) tags.push({ text: t.value('fresh'), cls: 'fresh' })
  if (daysSince(repo.updated_at) > 180) tags.push({ text: t.value('dormant'), cls: 'dormant' })
  if ((repo.stargazers_count || 0) >= 50) tags.push({ text: t.value('hot'), cls: 'hot' })
  if (repo.fork) tags.push({ text: t.value('fork'), cls: '' })
  return tags
}

// 活跃度评分（0-100）
function calcScore(p, rs) {
  let score = 0
  score += Math.min(15, daysSince(p.created_at) / 100)     // 账号年龄（max 15）
  score += Math.min(20, rs.length * 1.5)                    // 公开仓库数（max 20）
  const stars = rs.reduce((s, r) => s + (r.stargazers_count || 0), 0)
  score += Math.min(25, Math.log10(stars + 1) * 8)         // 累计星标（max 25）
  const recent = rs.filter(r => daysSince(r.pushed_at) < 90).length
  score += Math.min(25, recent * 3)                         // 近期活动（max 25）
  const forks = rs.reduce((s, r) => s + (r.forks_count || 0), 0)
  score += Math.min(15, Math.log10(forks + 1) * 6)         // Fork 数（max 15）
  return Math.min(100, Math.round(score))
}

/* ---------- 缓存读写 ---------- */

function cacheKey(u) {
  return 'repo-scope-cache-' + u.toLowerCase()
}

// 读取缓存（过期返回 null）
function getCache(u) {
  try {
    const raw = lsGet(cacheKey(u))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > CACHE_TTL) return null
    return data
  } catch (e) { return null }
}

// 写入缓存
function setCache(u, p, rs) {
  lsSet(cacheKey(u), JSON.stringify({ ts: Date.now(), profile: p, repos: rs }))
}

/* ---------- GitHub API 请求 ---------- */

// 主流程：带细分的限流错误识别
async function ghFetch(url) {
  const h = { Accept: 'application/vnd.github+json' }
  if (ghToken.value) h.Authorization = `Bearer ${ghToken.value}`
  const r = await fetch(url, { headers: h })
  const limit = parseInt(r.headers.get('x-ratelimit-limit') || '0', 10)
  const remaining = parseInt(r.headers.get('x-ratelimit-remaining') || '0', 10)
  const reset = parseInt(r.headers.get('x-ratelimit-reset') || '0', 10)
  if (r.status === 403) {
    // 403 可能是限流，也可能是其他禁止访问场景；结合 remaining 判断
    if (remaining === 0 || limit === 60) {
      const err = new Error('rate_limit')
      err.resetAt = reset ? new Date(reset * 1000) : null
      throw err
    }
    throw new Error('forbidden')
  }
  if (r.status === 404) throw new Error('not_found')
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    throw new Error(b.message || `${r.status}`)
  }
  return r.json()
}

/* ---------- 派生：统计卡片 ---------- */

const totalStars = computed(() =>
  repos.value.reduce((s, r) => s + (r.stargazers_count || 0), 0)
)

const langCount = computed(() =>
  new Set(repos.value.map(r => r.language).filter(Boolean)).size
)

const statItems = computed(() => {
  if (!profile.value) return []
  return [
    { label: t.value('followers'), value: num(profile.value.followers) },
    { label: t.value('publicRepos'), value: num(repos.value.length) },
    { label: t.value('totalStars'), value: num(totalStars.value) },
    { label: t.value('languages'), value: langCount.value, sub: t.value('repos') },
  ]
})

/* ---------- 派生：资料 meta ---------- */

const profileMeta = computed(() => {
  if (!profile.value) return []
  const p = profile.value
  const items = []
  if (p.company) items.push({ icon: '🏢', text: p.company })
  if (p.location) items.push({ icon: '📍', text: p.location })
  if (p.blog) items.push({ icon: '🔗', url: blogUrl(p.blog), text: p.blog })
  items.push({ icon: '📅', text: fmtDate(p.created_at) })
  return items
})

/* ---------- 派生：活跃度评分 ---------- */

const score = computed(() => {
  if (!profile.value) return 0
  return calcScore(profile.value, repos.value)
})

const scoreClass = computed(() =>
  score.value >= 65 ? 'high' : score.value >= 35 ? 'mid' : 'low'
)

const scoreDescKey = computed(() =>
  score.value >= 65 ? 'scoreHigh' : score.value >= 35 ? 'scoreMid' : 'scoreLow'
)

/* ---------- 派生：语言分布 ---------- */

const languageStats = computed(() => {
  const counts = {}
  repos.value.forEach(r => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1 })
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const max = ranked[0]?.[1] || 1
  return ranked.map(([name, count]) => ({
    name,
    count,
    pct: (count / max * 100).toFixed(1),
    color: langColor(name),
  }))
})

/* ---------- 派生：仓库列表（过滤 + 排序 + 分页） ---------- */

const filteredRepos = computed(() => {
  const s = search.value.toLowerCase()
  if (!s) return repos.value
  return repos.value.filter(r =>
    r.name.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s)
  )
})

const sortedRepos = computed(() => {
  const arr = [...filteredRepos.value]
  if (sort.value === 'stars') arr.sort((a, b) => b.stargazers_count - a.stargazers_count)
  else if (sort.value === 'updated') arr.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  else if (sort.value === 'forks') arr.sort((a, b) => b.forks_count - a.forks_count)
  else arr.sort((a, b) => a.name.localeCompare(b.name))
  return arr
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRepos.value.length / PER_PAGE)))

const pageButtons = computed(() => {
  const pages = []
  for (let i = 1; i <= Math.min(totalPages.value, 8); i++) pages.push(i)
  return pages
})

const pagedRepos = computed(() => {
  const start = (page.value - 1) * PER_PAGE
  return sortedRepos.value.slice(start, start + PER_PAGE)
})

// 预计算每条仓库的标签，避免模板内重复调用
const pagedReposView = computed(() =>
  pagedRepos.value.map(r => ({ repo: r, tags: repoTags(r) }))
)

/* ---------- 派生：详情面板标签 ---------- */

const detailTags = computed(() => detail.value ? repoTags(detail.value) : [])

/* ---------- 事件处理 ---------- */

function onSubmit() {
  analyzeUser(username.value.trim())
}

function changePage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function closeDetail() {
  detailFullName.value = ''
  detail.value = null
  detailError.value = ''
}

function saveToken() {
  const v = tokenInput.value.trim()
  if (!v) return
  ghToken.value = v
  lsSet('repo-scope-token', v)
  tokenOk.value = true
  setTimeout(() => { tokenOk.value = false }, 1500)
}

function clearToken() {
  ghToken.value = ''
  tokenInput.value = ''
  try { localStorage.removeItem('repo-scope-token') } catch (e) {}
}

/* ---------- 主流程：分析用户 ---------- */

async function analyzeUser(u) {
  if (!u) return
  // 重置已有结果与详情
  profile.value = null
  repos.value = []
  errorMsg.value = ''
  detailFullName.value = ''
  detail.value = null
  detailError.value = ''
  loading.value = true

  // 优先使用缓存，避免重复触发限流
  const cached = getCache(u)
  if (cached) {
    applyData(cached.profile, cached.repos)
    // 后台静默刷新一次（不阻塞 UI）
    refreshInBackground(u)
    return
  }

  try {
    const [p, rs] = await Promise.all([
      ghFetch(`https://api.github.com/users/${u}`),
      ghFetch(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`),
    ])
    const nonForks = rs.filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)
    applyData(p, nonForks)
  } catch (e) {
    loading.value = false
    let msg
    if (e.message === 'rate_limit') {
      msg = t.value('errorRateLimit')
      if (e.resetAt) {
        msg += ' ' + t.value('errorRateLimitReset').replace('{time}', e.resetAt.toLocaleTimeString(locale()))
      }
      // 自动展开 token 输入区，提醒用户填入
      tokenToggleOpen.value = true
      setTimeout(() => tokenInputEl.value?.focus(), 0)
    } else if (e.message === 'forbidden') {
      msg = t.value('errorForbidden')
    } else if (e.message === 'not_found') {
      msg = t.value('errorNotFound')
    } else {
      msg = t.value('errorGeneric').replace('{msg}', e.message)
    }
    errorMsg.value = msg
  }
}

// 应用数据到状态
function applyData(p, rs) {
  profile.value = p
  repos.value = rs
  page.value = 1
  loading.value = false
  errorMsg.value = ''
}

// 后台静默刷新（错误吞掉，缓存数据仍可用）
async function refreshInBackground(u) {
  try {
    const headers = { Accept: 'application/vnd.github+json' }
    if (ghToken.value) headers.Authorization = `Bearer ${ghToken.value}`
    const [p, rs] = await Promise.all([
      fetchJSON(`https://api.github.com/users/${u}`, { headers }),
      fetchJSON(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`, { headers }),
    ])
    const nonForks = rs.filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)
    // 仅当用户没有切换查询时才更新 UI
    if (username.value.trim().toLowerCase() === u.toLowerCase()) {
      applyData(p, nonForks)
    }
  } catch (e) { /* 静默失败，缓存数据仍可用 */ }
}

/* ---------- 加载仓库详情 ---------- */

async function loadDetail(fullName) {
  detailFullName.value = fullName
  detail.value = null
  detailError.value = ''
  detailLoading.value = true
  try {
    detail.value = await ghFetch(`https://api.github.com/repos/${fullName}`)
  } catch (e) {
    detailError.value = e.message
  } finally {
    detailLoading.value = false
  }
}

/* ---------- watch：搜索/排序变化时回到第 1 页 ---------- */

watch([search, sort], () => { page.value = 1 })

/* ---------- 生命周期 ---------- */

onMounted(() => {
  // 从 URL hash 自动加载用户
  const hashUser = decodeURIComponent(location.hash.slice(1))
  if (hashUser) {
    username.value = hashUser
    analyzeUser(hashUser)
  }
})
</script>

<template>
  <div class="repo-scope-app">
    <AppHeader title="Repo Scope" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索 -->
      <section class="search-bar">
        <form @submit.prevent="onSubmit">
          <input v-model="username" type="text" placeholder="torvalds" autocomplete="off" aria-label="GitHub username" />
          <button type="submit">{{ t('analyze') }}</button>
        </form>
        <p class="token-hint">{{ t('tokenRecommended') }}</p>
        <details class="token-toggle" :open="tokenToggleOpen">
          <summary @click.prevent="tokenToggleOpen = !tokenToggleOpen">{{ t('tokenToggle') }}</summary>
          <div class="token-row">
            <input
              ref="tokenInputEl"
              v-model="tokenInput"
              type="password"
              placeholder="ghp_xxxx"
              autocomplete="off"
              aria-label="GitHub personal access token"
              :class="{ 'token-ok': tokenOk }"
            />
            <button type="button" @click="saveToken">{{ t('tokenSave') }}</button>
            <button type="button" class="btn-ghost" @click="clearToken">{{ t('tokenClear') }}</button>
          </div>
        </details>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>

      <!-- 错误 -->
      <p v-else-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

      <!-- 结果 -->
      <template v-else-if="profile">
        <!-- 资料 -->
        <section class="profile-section">
          <div class="profile-card">
            <img class="avatar" :src="profile.avatar_url" alt="avatar" />
            <div class="profile-info">
              <h2>{{ profile.name || profile.login }}</h2>
              <p class="profile-bio">{{ profile.bio || '' }}</p>
              <div class="profile-meta">
                <span v-for="(m, i) in profileMeta" :key="i" class="meta-item">
                  {{ m.icon }}
                  <a v-if="m.url" :href="m.url" target="_blank" rel="noreferrer">{{ m.text }}</a>
                  <template v-else>{{ m.text }}</template>
                </span>
              </div>
              <a :href="profile.html_url" target="_blank" rel="noreferrer" class="profile-link">{{ t('openProfile') }}</a>
            </div>
          </div>
          <div class="stat-strip">
            <div v-for="(s, i) in statItems" :key="i" class="stat-card">
              <div class="stat-label">{{ s.label }}</div>
              <div class="stat-value">{{ s.value }}</div>
              <div v-if="s.sub" class="stat-sub">{{ s.sub }}</div>
            </div>
          </div>
        </section>

        <!-- 活跃度评分 -->
        <section class="score-section">
          <div class="score-card">
            <div class="score-ring" :class="scoreClass">{{ score }}</div>
            <div class="score-info">
              <h3>{{ t('activityScore') }}</h3>
              <p class="score-desc">{{ t(scoreDescKey) }}</p>
            </div>
          </div>
        </section>

        <!-- 语言分布 -->
        <section class="lang-section">
          <h2>{{ t('languages') }}</h2>
          <div v-if="languageStats.length" class="lang-bars">
            <div v-for="l in languageStats" :key="l.name" class="lang-bar-row">
              <span class="lang-bar-name"><span class="lang-dot" :style="{ background: l.color }"></span> {{ l.name }}</span>
              <div class="lang-bar-track">
                <div class="lang-bar-fill" :style="{ width: l.pct + '%', background: l.color }"></div>
              </div>
              <span class="lang-bar-pct">{{ num(l.count) }}</span>
            </div>
          </div>
          <div v-else class="loading">{{ t('noLang') }}</div>
        </section>

        <!-- 仓库 + 详情 -->
        <div class="repo-layout">
          <section class="repo-section">
            <div class="repo-header">
              <h2>{{ t('repositories') }}</h2>
              <div class="repo-controls">
                <select v-model="sort">
                  <option value="stars">{{ t('byStars') }}</option>
                  <option value="updated">{{ t('byUpdated') }}</option>
                  <option value="forks">{{ t('byForks') }}</option>
                  <option value="name">{{ t('byName') }}</option>
                </select>
                <input v-model="search" type="text" placeholder="Filter…" aria-label="Filter repositories" />
              </div>
            </div>
            <div class="repo-grid">
              <div v-if="!pagedReposView.length" class="loading">{{ t('noRepos') }}</div>
              <div
                v-for="item in pagedReposView"
                :key="item.repo.full_name"
                class="repo-card"
                @click="loadDetail(item.repo.full_name)"
              >
                <span class="repo-card-name">{{ item.repo.name }}</span>
                <span class="repo-card-stats">
                  ★ {{ num(item.repo.stargazers_count) }} · ƒ {{ num(item.repo.forks_count) }}
                  <template v-if="item.repo.language"> · <span class="lang-dot" :style="{ background: langColor(item.repo.language) }"></span></template>
                </span>
                <p v-if="item.repo.description" class="repo-card-desc">{{ item.repo.description }}</p>
                <div v-if="item.tags.length" class="repo-card-tags">
                  <span v-for="(tag, i) in item.tags" :key="i" class="repo-tag" :class="tag.cls">{{ tag.text }}</span>
                </div>
              </div>
            </div>
            <div v-if="pageButtons.length > 1" class="pagination">
              <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">←</button>
              <button
                v-for="p in pageButtons"
                :key="p"
                class="page-btn"
                :class="{ active: p === page }"
                @click="changePage(p)"
              >{{ p }}</button>
              <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">→</button>
            </div>
          </section>

          <aside v-if="detailFullName" class="detail-section">
            <div class="detail-head">
              <h2>{{ detailFullName }}</h2>
              <button type="button" @click="closeDetail">&times;</button>
            </div>
            <div class="detail-body">
              <div v-if="detailLoading" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
              <p v-else-if="detailError" class="error-msg">{{ detailError }}</p>
              <template v-else-if="detail">
                <div class="detail-item">
                  <div class="d-label">{{ t('stars') }}</div>
                  <div class="d-value">{{ num(detail.stargazers_count) }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('forks') }}</div>
                  <div class="d-value">{{ num(detail.forks_count) }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('issues') }}</div>
                  <div class="d-value">{{ num(detail.open_issues_count) }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('watchers') }}</div>
                  <div class="d-value">{{ num(detail.subscribers_count ?? detail.watchers_count) }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('language') }}</div>
                  <div class="d-value">{{ detail.language || '—' }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('license') }}</div>
                  <div class="d-value">{{ detail.license?.spdx_id || '—' }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('size') }}</div>
                  <div class="d-value">{{ num(detail.size) }} KB</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('defaultBranch') }}</div>
                  <div class="d-value">{{ detail.default_branch }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('created') }}</div>
                  <div class="d-value">{{ fmtDate(detail.created_at) }}</div>
                </div>
                <div class="detail-item">
                  <div class="d-label">{{ t('pushed') }}</div>
                  <div class="d-value">{{ fmtDate(detail.pushed_at) }}</div>
                </div>
                <div v-if="detail.homepage" class="detail-item">
                  <div class="d-label">{{ t('homepage') }}</div>
                  <div class="d-value">
                    <a :href="detail.homepage" target="_blank" rel="noreferrer">{{ detail.homepage }}</a>
                  </div>
                </div>
                <div v-if="detail.topics?.length" class="detail-item detail-item-full">
                  <div class="d-label">{{ t('topics') }}</div>
                  <div class="d-value">
                    <span v-for="tp in detail.topics" :key="tp" class="repo-tag">{{ tp }}</span>
                  </div>
                </div>
                <div class="detail-item detail-item-full detail-tags-row">
                  <span v-for="(tag, i) in detailTags" :key="i" class="repo-tag" :class="tag.cls">{{ tag.text }}</span>
                  <a :href="detail.html_url" target="_blank" rel="noreferrer" class="detail-github-link">GitHub →</a>
                </div>
              </template>
            </div>
          </aside>
        </div>
      </template>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

/* ============================================================
   Repo Scope — 米色纸感主题
   原 :root 变量迁移到组件根类 .repo-scope-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.repo-scope-app {
  /* 表面与文字 */
  --bg: #f2efe7;
  --paper: #f8f5ee;
  --paper-2: #efe8dc;
  --ink: #181512;
  --muted: #6a6258;
  --line: #cdc2b3;
  --accent: #1f4a88;
  --accent-soft: #dde5f1;
  --green: #16a34a;
  --green-bg: #f0fdf4;
  --yellow: #ca8a04;
  --yellow-bg: #fefce8;
  --red: #dc2626;
  --red-bg: #fef2f2;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--paper);
  --ok-line: var(--line);
  --ok-text: var(--ink);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  /* 原 body 样式迁移到根元素 */
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  color: var(--ink);
  background: linear-gradient(180deg, #ece7dc 0%, #f4f1ea 100%);
  min-height: 100vh;
}

.repo-scope-app a:hover {
  text-decoration: underline;
}

/* ---------- 主容器 ---------- */

.shell {
  width: min(1000px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0.3rem 0 1rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  font-family: "IBM Plex Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--muted);
}

.masthead h1 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.88rem;
}

/* ---------- 搜索 ---------- */

.search-bar {
  margin-top: 0.8rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.search-bar form {
  display: flex;
  gap: 0.5rem;
}

.search-bar input[type="text"] {
  flex: 1;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.5);
  font-size: 1rem;
}

.search-bar button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.2rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.token-hint {
  margin: 0.35rem 0 0.1rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.4;
}

.token-toggle {
  margin-top: 0.4rem;
  font-size: 0.76rem;
}

.token-toggle summary {
  cursor: pointer;
  color: var(--muted);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.7rem;
}

.token-row {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.35rem;
  align-items: center;
}

.token-row input {
  flex: 1;
  font: inherit;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--line);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.78rem;
}

.token-row input.token-ok {
  border-color: #4a8;
  background: rgba(68, 170, 136, 0.08);
}

.token-row button {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
}

.btn-ghost {
  color: var(--muted) !important;
}

/* ---------- 资料 ---------- */

.profile-section {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
}

.profile-card {
  display: flex;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--paper);
  border: 1px solid var(--line);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid var(--line);
  flex-shrink: 0;
}

.profile-info h2 {
  font-size: 1.3rem;
}

.profile-bio {
  color: var(--muted);
  font-size: 0.88rem;
  margin-top: 0.25rem;
  line-height: 1.5;
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.profile-meta .meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.profile-link {
  display: inline-block;
  margin-top: 0.4rem;
  font-size: 0.78rem;
  font-family: "IBM Plex Mono", monospace;
}

.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.stat-card {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 0.7rem;
  text-align: center;
}

.stat-card .stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-family: "IBM Plex Mono", monospace;
}

.stat-card .stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 0.15rem;
  letter-spacing: -0.02em;
}

.stat-card .stat-sub {
  font-size: 0.7rem;
  color: var(--muted);
}

/* ---------- 活跃度评分 ---------- */

.score-section {
  margin-top: 0.8rem;
}

.score-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--paper);
  border: 1px solid var(--line);
}

.score-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 800;
  flex-shrink: 0;
}

.score-ring.high { background: var(--green-bg); color: var(--green); border: 3px solid var(--green); }
.score-ring.mid { background: var(--yellow-bg); color: var(--yellow); border: 3px solid var(--yellow); }
.score-ring.low { background: var(--red-bg); color: var(--red); border: 3px solid var(--red); }

.score-info h3 {
  font-size: 0.92rem;
}

.score-desc {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 0.2rem;
  line-height: 1.5;
}

/* ---------- 语言分布 ---------- */

.lang-section {
  margin-top: 0.8rem;
}

.lang-section h2 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.lang-bars {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lang-bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 50px;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
}

.lang-bar-name {
  font-weight: 500;
}

.lang-bar-track {
  height: 18px;
  background: var(--paper-2);
  border: 1px solid rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.lang-bar-fill {
  height: 100%;
  transition: width 0.6s ease;
}

.lang-bar-pct {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  text-align: right;
  color: var(--muted);
}

/* ---------- 仓库列表 ---------- */

.repo-section {
  min-width: 0;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.repo-header h2 {
  font-size: 1rem;
}

.repo-controls {
  display: flex;
  gap: 0.4rem;
}

.repo-controls select,
.repo-controls input {
  font: inherit;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--line);
  background: var(--paper);
  font-size: 0.78rem;
}

.repo-controls input {
  width: 120px;
}

.repo-grid {
  display: grid;
  gap: 0;
}

.repo-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem;
  padding: 0.7rem 0.6rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background 100ms;
}

.repo-card:hover {
  background: var(--accent-soft);
}

.repo-card-name {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--accent);
}

.repo-card-desc {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-card-stats {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  color: var(--muted);
}

.repo-card-tags {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.repo-tag {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--line);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.repo-tag.fresh { border-color: var(--green); color: var(--green); }
.repo-tag.dormant { border-color: var(--red); color: var(--red); }
.repo-tag.hot { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* ---------- 详情面板 ---------- */

.repo-layout {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1rem;
  align-items: start;
}

.detail-section {
  background: var(--paper);
  border: 1px solid var(--accent);
  padding: 1rem;
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.detail-head h2 {
  font-size: 1.05rem;
  color: var(--accent);
}

.detail-head button {
  font: inherit;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  color: var(--muted);
  line-height: 1;
}

.detail-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.5rem;
}

.detail-item {
  padding: 0.4rem 0;
  border-bottom: 1px dotted rgba(0, 0, 0, 0.08);
}

.detail-item-full {
  grid-column: 1 / -1;
}

.detail-tags-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.3rem;
  border-bottom: none;
}

.detail-github-link {
  margin-left: 0.5rem;
  font-size: 0.78rem;
}

.detail-item .d-label {
  font-size: 0.68rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-item .d-value {
  font-weight: 600;
  font-size: 0.92rem;
  margin-top: 0.1rem;
}

/* ---------- 分页 ---------- */

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 0.8rem;
}

.page-btn {
  min-height: 2rem;
  min-width: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.76rem;
  color: var(--muted);
}

.page-btn:hover { border-color: var(--accent); color: var(--accent); }
.page-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.page-btn:disabled { opacity: 0.3; cursor: default; }

/* ---------- 加载与错误 ---------- */

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 1rem;
  font-size: 0.85rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-msg {
  color: #a33;
  background: rgba(170, 50, 50, 0.06);
  border: 1px solid rgba(170, 50, 50, 0.2);
  padding: 0.6rem;
  border-radius: 3px;
  font-size: 0.85rem;
  margin-top: 1rem;
}

/* ---------- 响应式 ---------- */

@media (max-width: 720px) {
  .masthead { flex-direction: column; gap: 0.5rem; }
  .stat-strip { grid-template-columns: repeat(2, 1fr); }
  .lang-bar-row { grid-template-columns: 70px 1fr 40px; }
  .profile-card { flex-direction: column; align-items: center; text-align: center; }
  .profile-meta { justify-content: center; }
  .detail-body { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .repo-layout {
    grid-template-columns: 1fr;
  }
  .detail-section {
    position: static;
    max-height: none;
  }
}
</style>
