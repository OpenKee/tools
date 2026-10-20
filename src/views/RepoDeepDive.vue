<script setup lang="ts">
/* ============================================================
   Repo Deep Dive — GitHub 仓库深挖 + 用户透视（合并版 Vue 3 SFC）
   - WORK MODE（owner/repo）：基本信息 + 语言节点图 + 贡献者 + 52 周提交活动 + topics
   - USER MODE（纯用户名）：用户资料卡 + 仓库列表 + 语言统计 + 活跃度评分 + 分页
   - 单一搜索框：自动识别 用户名 / owner/repo / GitHub URL，归一化后决定模式
   - USER MODE 中点击仓库可切换到对应仓库的 WORK MODE，并提供返回用户视图的入口
   - 可选 GitHub Token，规避未认证限流（60/小时）
   - USER MODE 带 localStorage 缓存（10 分钟 TTL）与后台静默刷新
   - 深色 GitHub 主题
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, githubLangColors, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典（合并两页，en / zh 各保留两页全部文案） ---------- */
const copy = {
  en: {
    eyebrow: 'GitHub repo deep dive',
    title: 'Repo Deep Dive',
    lead: 'Enter an owner/repo to deep-dive a repository, or a bare username to analyze a user: stats, language graphs, contributors, commit activity, and profile analytics.',
    searchPlaceholder: 'vuejs/core or vuejs',
    analyze: 'Analyze',
    quickLinks: 'Try:',
    tokenToggle: 'Optional: GitHub token',
    tokenSave: 'Save',
    tokenClear: 'Clear',
    tokenConfigured: 'Configured',
    tokenNotConfigured: 'Not configured',
    tokenRecommended: 'Tip: GitHub limits unauthenticated requests to 60/hr. Add a token below for reliable analysis.',
    errorBadInput: 'Enter a GitHub username or owner/repo.',
    errorRepoNotFound: 'Repository not found.',
    errorUserNotFound: 'User not found.',
    errorRateLimit: 'GitHub API rate limit reached.',
    errorRateLimitHint: 'Unauthenticated requests are capped at 60/hr and shared by IP. Add a personal access token to raise to 5000/hr.',
    errorRateLimitReset: 'Resets at {time}.',
    errorForbidden: 'Access forbidden. The user or repo may be inaccessible or a token may be required.',
    errorGeneric: 'Error: {msg}',
    errorStatsPending: 'Statistics are being computed by GitHub. Please retry in a moment.',
    stars: 'Stars',
    forks: 'Forks',
    issues: 'Open issues',
    watchers: 'Watchers',
    size: 'Size',
    defaultBranch: 'Default branch',
    license: 'License',
    created: 'Created',
    pushed: 'Last push',
    homepage: 'Homepage',
    openRepo: 'Open on GitHub',
    topics: 'Topics',
    languages: 'Language distribution',
    languagesUser: 'Languages',
    contributors: 'Contributors',
    commits: 'Commit activity',
    commits52: 'Past 52 weeks · {n} commits',
    noCommits: 'No commit activity data.',
    loading: 'Loading…',
    anonymous: 'anonymous',
    legend: 'Top languages',
    contributions: 'contributions',
    bytes: 'bytes',
    noLanguages: 'No language data.',
    noContributors: 'No contributor data.',
    noTopics: 'No topics.',
    hoverHint: 'Hover a node for details.',
    /* ---------- user mode ---------- */
    openProfile: 'Open profile →',
    activityScore: 'Activity score',
    repositories: 'Repositories',
    filter: 'Filter…',
    byStars: 'By stars',
    byUpdated: 'By updated',
    byForks: 'By forks',
    byName: 'By name',
    followers: 'Followers',
    publicRepos: 'Public repos',
    totalStars: 'Total stars',
    repos: 'repos',
    fresh: 'fresh',
    dormant: 'dormant',
    hot: 'hot',
    fork: 'fork',
    scoreHigh: 'Very active — regular commits, stars growing, healthy issue response.',
    scoreMid: 'Moderately active — some recent activity, decent engagement.',
    scoreLow: 'Quiet — limited recent activity or very new account.',
    noRepos: 'No repositories.',
    noLang: 'No language data.',
    backToUser: '← Back to @{user}',
  },
  zh: {
    eyebrow: 'GitHub 仓库深挖',
    title: '仓库深挖',
    lead: '输入 owner/repo 深挖一个仓库，或输入纯用户名分析用户：统计信息、语言图谱、贡献者、提交活动、用户资料分析。',
    searchPlaceholder: 'vuejs/core 或 用户名',
    analyze: '分析',
    quickLinks: '试试：',
    tokenToggle: '可选：GitHub token',
    tokenSave: '保存',
    tokenClear: '清除',
    tokenConfigured: '已配置',
    tokenNotConfigured: '未配置',
    tokenRecommended: '提示：GitHub 未认证请求限制为 60 次/小时。建议在下方添加 token 以获得稳定体验。',
    errorBadInput: '请输入 GitHub 用户名或 owner/repo。',
    errorRepoNotFound: '仓库不存在。',
    errorUserNotFound: '用户不存在。',
    errorRateLimit: 'GitHub API 请求次数已达上限。',
    errorRateLimitHint: '未认证配额为 60 次/小时且按 IP 共享（与他人共用网络时易耗尽）。添加 Personal Access Token 可提升到 5000 次/小时。',
    errorRateLimitReset: '重置时间：{time}',
    errorForbidden: '访问被拒绝。仓库或用户可能不可访问，或需要提供 token。',
    errorGeneric: '出错：{msg}',
    errorStatsPending: 'GitHub 正在统计中，请稍后重试。',
    stars: '星标',
    forks: 'Fork',
    issues: 'Open issues',
    watchers: '关注',
    size: '大小',
    defaultBranch: '默认分支',
    license: '许可证',
    created: '创建于',
    pushed: '最近推送',
    homepage: '主页',
    openRepo: '在 GitHub 打开',
    topics: '话题',
    languages: '语言分布',
    languagesUser: '语言分布',
    contributors: '贡献者',
    commits: '提交活动',
    commits52: '过去 52 周 · {n} 次提交',
    noCommits: '无提交活动数据。',
    loading: '加载中…',
    anonymous: '匿名',
    legend: '主要语言',
    contributions: '次贡献',
    bytes: '字节',
    noLanguages: '无语言数据。',
    noContributors: '无贡献者数据。',
    noTopics: '无话题。',
    hoverHint: '悬停节点查看详情。',
    /* ---------- user mode ---------- */
    openProfile: '打开主页 →',
    activityScore: '活跃度评分',
    repositories: '仓库',
    filter: '筛选…',
    byStars: '按星标',
    byUpdated: '按更新',
    byForks: '按 Fork',
    byName: '按名称',
    followers: '关注者',
    publicRepos: '公开仓库',
    totalStars: '累计星标',
    repos: '个仓库',
    fresh: '刚更新',
    dormant: '沉寂',
    hot: '热门',
    fork: '复刻',
    scoreHigh: '非常活跃 — 定期提交，星标增长，issue 响应健康。',
    scoreMid: '一般活跃 — 有一些近期活动，参与度还行。',
    scoreLow: '安静 — 近期活动少，或者是新账户。',
    noRepos: '没有仓库。',
    noLang: '没有语言数据。',
    backToUser: '← 返回 @{user}',
  },
}

const t = useT(copy)

/* ---------- GitHub API 数据结构 ---------- */
interface RepoInfo {
  full_name: string
  html_url: string
  description?: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  subscribers_count?: number
  watchers_count?: number
  size: number
  default_branch?: string
  license?: { spdx_id?: string | null } | null
  created_at?: string
  pushed_at?: string
  homepage?: string | null
  topics?: string[]
}

interface Contributor {
  login?: string
  name?: string
  id?: number
  avatar_url?: string
  html_url?: string
  contributions?: number
}

interface Participation {
  all: number[]
}

interface LangNode {
  name: string
  bytes: number
  pct: string
  color: string
  r: number
  x: number
  y: number
}

interface GHUser {
  login: string
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  avatar_url: string
  html_url: string
  followers: number
  created_at: string
}

interface GHRepo {
  name: string
  full_name: string
  description: string | null
  language: string | null
  fork: boolean
  html_url: string
  homepage: string | null
  topics: string[]
  created_at: string
  updated_at: string
  pushed_at: string
  size: number
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  subscribers_count: number
  watchers_count: number
  default_branch: string
  license: { spdx_id: string | null } | null
}

interface GHProfileCache {
  ts: number
  profile: GHUser
  repos: GHRepo[]
}

/** 归一化后的查询：mode 决定跑 WORK MODE 还是 USER MODE。 */
interface ParsedQuery {
  mode: 'repo' | 'user'
  value: string
}

type Mode = '' | 'repo' | 'user'

/* ---------- 常量 ---------- */
const quickPicks = ['vuejs/core', 'facebook/react', 'microsoft/vscode', 'torvalds/linux']
const PER_PAGE = 20
const CACHE_TTL = 10 * 60 * 1000 // 10 分钟缓存

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const USER_RE = /^[A-Za-z0-9_.-]+$/

/* ---------- token 状态 ---------- */
const ghToken = ref(lsGet('repo-scope-token') || '')
const tokenInput = ref(ghToken.value)
const tokenToggleOpen = ref(false)
const tokenSaved = ref(false)
const tokenInputEl = ref<HTMLInputElement | null>(null)

function saveToken() {
  const v = tokenInput.value.trim()
  if (!v) return
  ghToken.value = v
  lsSet('repo-scope-token', v)
  tokenSaved.value = true
  setTimeout(() => { tokenSaved.value = false }, 1500)
}

function clearToken() {
  ghToken.value = ''
  tokenInput.value = ''
  try { localStorage.removeItem('repo-scope-token') } catch (e) {}
}

/* ---------- 搜索 / 模式状态 ---------- */
const query = ref('')
const mode = ref<Mode>('')
const inputError = ref('')

/** 从用户列表跳到仓库时记录来源用户名，用于返回。 */
const originUser = ref('')

/* ---------- WORK MODE 状态（owner/repo 深挖） ---------- */
const currentRepo = ref('')
const repoInfo = ref<RepoInfo | null>(null)
const languages = ref<Record<string, number> | null>(null)
const contributors = ref<Contributor[] | null>(null)
const participation = ref<Participation | null>(null)

const loadingInfo = ref(false)
const loadingLangs = ref(false)
const loadingContribs = ref(false)
const loadingCommits = ref(false)

const errorInfo = ref('')
const errorLangs = ref('')
const errorContribs = ref('')
const errorCommits = ref('')

const hoveredLang = ref<LangNode | null>(null)

/* ---------- USER MODE 状态（用户名透视） ---------- */
const currentUser = ref('')
const profile = ref<GHUser | null>(null)
const repos = ref<GHRepo[]>([])

const filterText = ref('')
const sort = ref('stars')
const page = ref(1)

const loading = ref(false)
const errorMsg = ref('')

/* ---------- 工具函数 ---------- */
function num(v: number | null | undefined): string {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale())
}

function langColor(name: string): string {
  return githubLangColors[name] || '#999'
}

function daysSince(d: string): number {
  return (Date.now() - new Date(d).getTime()) / 86400000
}

function blogUrl(blog: string): string {
  return blog.startsWith('http') ? blog : 'https://' + blog
}

/* ---------- 输入归一化 ----------
   接受：纯用户名（vuejs）、owner/repo（vuejs/core）、完整 GitHub URL
   （https://github.com/vuejs/core 或 https://github.com/vuejs）。 */
function parseQuery(raw: string): ParsedQuery | null {
  let q = raw.trim()
  if (!q) return null
  q = q.split('?')[0].split('#')[0]
  q = q.replace(/^https?:\/\//i, '')          // 去掉协议
  q = q.replace(/^www\./i, '')                 // 去掉 www.
  q = q.replace(/^github\.com/i, '')           // 去掉 github.com 主机
  q = q.replace(/\.git$/i, '')                 // 去掉 .git 后缀
  q = q.replace(/^\/+/, '').replace(/\/+$/, '') // 去掉首尾斜杠
  if (!q) return null
  const parts = q.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const full = `${parts[0]}/${parts[1]}`
    return REPO_RE.test(full) ? { mode: 'repo', value: full } : null
  }
  return parts.length === 1 && USER_RE.test(parts[0]) ? { mode: 'user', value: parts[0] } : null
}

/* ---------- ghFetch：GitHub REST 封装 ---------- */
// 404 抛 not_found；真限流（响应体 message 含 "rate limit"）抛 rate_limit；
// 其他 403 抛 forbidden；202（stats 计算中）返回 null；其余非 ok 抛原始 message。
// 注意：不能用 remaining===0 判断——响应缺失该头时默认值也是 0，会误判。
async function ghFetch<T = unknown>(url: string): Promise<T | null> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (ghToken.value) headers['Authorization'] = `Bearer ${ghToken.value}`
  const r = await fetch(url, { headers })
  const reset = parseInt(r.headers.get('x-ratelimit-reset') || '0', 10)
  if (r.status === 404) throw new Error('not_found')
  if (r.status === 403 || r.status === 429) {
    // 读响应体，用 message 文本判断是否真限流（GitHub 真限流 message 一定含 "rate limit"）
    const body = await r.json().catch(() => ({}))
    const msg = (body && body.message) || ''
    if (/rate limit/i.test(msg)) {
      const err = new Error('rate_limit') as Error & { resetAt?: Date | null }
      err.resetAt = reset ? new Date(reset * 1000) : null
      throw err
    }
    throw new Error('forbidden')
  }
  if (r.status === 202) return null
  if (!r.ok) {
    let msg = `${r.status}`
    try { const b = await r.json(); msg = b.message || msg } catch (e) {}
    throw new Error(msg)
  }
  return r.json()
}

// 统一的错误信息格式化；rate_limit 时自动展开 token 配置区。
// kind 区分做仓库深挖还是用户分析，用于 not_found 文案。
function formatError(e: Error, kind: 'repo' | 'user' = 'repo'): string {
  if (e.message === 'not_found') {
    return kind === 'user' ? t.value('errorUserNotFound') : t.value('errorRepoNotFound')
  }
  if (e.message === 'rate_limit') {
    tokenToggleOpen.value = true
    let msg = t.value('errorRateLimit')
    // 未配 token 时给出 IP 共享配额的解释，避免用户误以为是自己的请求导致的
    if (!ghToken.value) {
      msg += ' ' + t.value('errorRateLimitHint')
    }
    const resetAt = (e as Error & { resetAt?: Date | null }).resetAt
    if (resetAt) {
      const timeStr = resetAt.toLocaleString(locale(), {
        month: 'numeric', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      msg += ' ' + t.value('errorRateLimitReset').replace('{time}', timeStr)
    }
    return msg
  }
  if (e.message === 'forbidden') return t.value('errorForbidden')
  return t.value('errorGeneric').replace('{msg}', e.message)
}

// USER MODE 错误：额外聚焦 token 输入框，方便用户立即补 token。
function formatUserError(e: Error): string {
  const msg = formatError(e, 'user')
  if (e.message === 'rate_limit') setTimeout(() => tokenInputEl.value?.focus(), 0)
  return msg
}

/* ---------- 缓存读写（USER MODE） ---------- */
function cacheKey(u: string): string {
  return 'repo-scope-cache-' + u.toLowerCase()
}

// 读取缓存（过期返回 null）
function getCache(u: string): GHProfileCache | null {
  try {
    const raw = lsGet(cacheKey(u))
    if (!raw) return null
    const data = JSON.parse(raw) as GHProfileCache
    if (Date.now() - data.ts > CACHE_TTL) return null
    return data
  } catch (e) { return null }
}

// 写入缓存
function setCache(u: string, p: GHUser, rs: GHRepo[]) {
  lsSet(cacheKey(u), JSON.stringify({ ts: Date.now(), profile: p, repos: rs }))
}

/* ---------- 派生：WORK MODE ---------- */
const metrics = computed(() => {
  if (!repoInfo.value) return []
  const r = repoInfo.value
  return [
    { label: t.value('stars'), value: num(r.stargazers_count) },
    { label: t.value('forks'), value: num(r.forks_count) },
    { label: t.value('issues'), value: num(r.open_issues_count) },
    { label: t.value('watchers'), value: num(r.subscribers_count ?? r.watchers_count) },
    { label: t.value('size'), value: num(r.size) + ' KB' },
    { label: t.value('defaultBranch'), value: r.default_branch || '—' },
  ]
})

const repoTopics = computed(() => repoInfo.value?.topics || [])

// 每个语言一个圆：圆周等角排列，半径按字节占比（min 8, max 40）
const SVG_W = 480
const SVG_H = 360

const langNodes = computed(() => {
  if (!languages.value) return []
  const entries = Object.entries(languages.value)
  if (!entries.length) return []
  const total = entries.reduce((s, [, b]) => s + b, 0) || 1
  const maxBytes = entries[0][1]
  // 取 top 12 防止节点过密
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 12)
  const cx = SVG_W / 2
  const cy = SVG_H / 2
  const ringR = 120
  const n = sorted.length
  return sorted.map(([name, bytes], i) => {
    const ratio = bytes / maxBytes
    const r = 8 + ratio * (40 - 8)
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return {
      name,
      bytes,
      pct: ((bytes / total) * 100).toFixed(2),
      color: langColor(name),
      r,
      x: cx + ringR * Math.cos(angle),
      y: cy + ringR * Math.sin(angle),
    }
  })
})

const langLegend = computed(() => {
  if (!languages.value) return []
  const entries = Object.entries(languages.value)
  if (!entries.length) return []
  const total = entries.reduce((s, [, b]) => s + b, 0) || 1
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, bytes]) => ({
      name,
      bytes,
      pct: ((bytes / total) * 100).toFixed(1),
      color: langColor(name),
    }))
})

const topContributors = computed(() => {
  if (!Array.isArray(contributors.value)) return []
  return [...contributors.value]
    .sort((a, b) => (b.contributions || 0) - (a.contributions || 0))
    .slice(0, 12)
})

const COMMIT_W = 520
const COMMIT_H = 140
const commitBars = computed(() => {
  const all = participation.value && Array.isArray(participation.value.all) ? participation.value.all : []
  if (!all.length) return []
  const max = Math.max(1, ...all)
  const pad = 4
  const barW = (COMMIT_W - pad * 2) / all.length
  const innerH = COMMIT_H - 16
  const currentIdx = all.length - 1
  return all.map((v, i) => {
    const h = (v / max) * innerH
    return {
      x: pad + i * barW,
      w: Math.max(1, barW - 1),
      h,
      y: COMMIT_H - h - 2,
      v,
      isCurrent: i === currentIdx,
    }
  })
})

const totalCommits = computed(() => {
  const all = participation.value && Array.isArray(participation.value.all) ? participation.value.all : []
  return all.reduce((s, v) => s + (v || 0), 0)
})

/* ---------- 派生：USER MODE ---------- */
const totalStars = computed(() =>
  repos.value.reduce((s, r) => s + (r.stargazers_count || 0), 0)
)

const langCount = computed(() =>
  new Set(repos.value.map(r => r.language).filter(Boolean)).size
)

const statItems = computed(() => {
  if (!profile.value) return []
  return [
    { label: t.value('followers'), value: num(profile.value.followers), sub: '' },
    { label: t.value('publicRepos'), value: num(repos.value.length), sub: '' },
    { label: t.value('totalStars'), value: num(totalStars.value), sub: '' },
    { label: t.value('languages'), value: num(langCount.value), sub: t.value('repos') },
  ]
})

const profileMeta = computed(() => {
  if (!profile.value) return []
  const p = profile.value
  const items: { icon: string; text: string; url?: string }[] = []
  if (p.company) items.push({ icon: '🏢', text: p.company })
  if (p.location) items.push({ icon: '📍', text: p.location })
  if (p.blog) items.push({ icon: '🔗', url: blogUrl(p.blog), text: p.blog })
  items.push({ icon: '📅', text: fmtDate(p.created_at) })
  return items
})

// 活跃度评分（0-100）
function calcScore(p: GHUser, rs: GHRepo[]): number {
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

const score = computed(() => (profile.value ? calcScore(profile.value, repos.value) : 0))
const scoreClass = computed(() =>
  score.value >= 65 ? 'high' : score.value >= 35 ? 'mid' : 'low'
)
const scoreDescKey = computed(() =>
  score.value >= 65 ? 'scoreHigh' : score.value >= 35 ? 'scoreMid' : 'scoreLow'
)

const languageStats = computed(() => {
  const counts: Record<string, number> = {}
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

// 仓库标签：fresh / dormant / hot / fork
function repoTags(repo: GHRepo): { text: string; cls: string }[] {
  const tags: { text: string; cls: string }[] = []
  if (daysSince(repo.updated_at) < 21) tags.push({ text: t.value('fresh'), cls: 'fresh' })
  if (daysSince(repo.updated_at) > 180) tags.push({ text: t.value('dormant'), cls: 'dormant' })
  if ((repo.stargazers_count || 0) >= 50) tags.push({ text: t.value('hot'), cls: 'hot' })
  if (repo.fork) tags.push({ text: t.value('fork'), cls: '' })
  return tags
}

const filteredRepos = computed(() => {
  const s = filterText.value.toLowerCase()
  if (!s) return repos.value
  return repos.value.filter(r =>
    r.name.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s)
  )
})

const sortedRepos = computed(() => {
  const arr = [...filteredRepos.value]
  if (sort.value === 'stars') arr.sort((a, b) => b.stargazers_count - a.stargazers_count)
  else if (sort.value === 'updated') arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  else if (sort.value === 'forks') arr.sort((a, b) => b.forks_count - a.forks_count)
  else arr.sort((a, b) => a.name.localeCompare(b.name))
  return arr
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRepos.value.length / PER_PAGE)))

const pageButtons = computed(() => {
  const pages: number[] = []
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

/* ---------- 事件处理 ---------- */
function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Enter') onSearch()
}

function onSearch() {
  const parsed = parseQuery(query.value)
  if (!parsed) {
    inputError.value = t.value('errorBadInput')
    return
  }
  inputError.value = ''
  originUser.value = ''
  if (parsed.mode === 'repo') {
    diveRepo(parsed.value)
  } else {
    query.value = parsed.value
    analyzeUser(parsed.value)
  }
}

function quickPick(name: string) {
  query.value = name
  onSearch()
}

function changePage(p: number) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/* ---------- 主流程：WORK MODE（仓库深挖） ---------- */
async function diveRepo(q: string) {
  if (!q) return
  mode.value = 'repo'
  currentRepo.value = q
  query.value = q
  // 重置所有
  repoInfo.value = null
  languages.value = null
  contributors.value = null
  participation.value = null
  errorInfo.value = ''
  errorLangs.value = ''
  errorContribs.value = ''
  errorCommits.value = ''
  loadingInfo.value = true
  loadingLangs.value = true
  loadingContribs.value = true
  loadingCommits.value = true

  const base = `https://api.github.com/repos/${q}`
  const results = await Promise.allSettled([
    ghFetch<RepoInfo>(base),
    ghFetch<Record<string, number>>(base + '/languages'),
    ghFetch<Contributor[]>(base + '/contributors?per_page=30&anon=1'),
    ghFetch<Participation>(base + '/stats/participation'),
  ])

  // 基本信息
  if (results[0].status === 'fulfilled') {
    repoInfo.value = results[0].value
  } else {
    errorInfo.value = formatError(results[0].reason, 'repo')
  }
  loadingInfo.value = false

  // 语言分布
  if (results[1].status === 'fulfilled') {
    languages.value = results[1].value
  } else {
    errorLangs.value = formatError(results[1].reason, 'repo')
  }
  loadingLangs.value = false

  // 贡献者
  if (results[2].status === 'fulfilled') {
    contributors.value = results[2].value
  } else {
    errorContribs.value = formatError(results[2].reason, 'repo')
  }
  loadingContribs.value = false

  // 提交活动（202 时为 null）
  if (results[3].status === 'fulfilled') {
    participation.value = results[3].value
    if (results[3].value === null) {
      errorCommits.value = t.value('errorStatsPending')
    }
  } else {
    errorCommits.value = formatError(results[3].reason, 'repo')
  }
  loadingCommits.value = false
}

/* ---------- 主流程：USER MODE（用户分析） ---------- */
async function analyzeUser(u: string) {
  if (!u) return
  mode.value = 'user'
  currentUser.value = u
  // 重置已有结果
  profile.value = null
  repos.value = []
  errorMsg.value = ''
  filterText.value = ''
  sort.value = 'stars'
  page.value = 1
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
      ghFetch<GHUser>(`https://api.github.com/users/${u}`),
      ghFetch<GHRepo[]>(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`),
    ])
    if (!p) throw new Error('not_found')
    const nonForks = (rs ?? []).filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)
    applyData(p, nonForks)
  } catch (e) {
    loading.value = false
    errorMsg.value = formatUserError(e as Error)
  }
}

// 应用数据到状态
function applyData(p: GHUser, rs: GHRepo[]) {
  profile.value = p
  repos.value = rs
  page.value = 1
  loading.value = false
  errorMsg.value = ''
}

// 后台静默刷新（错误吞掉，缓存数据仍可用）
async function refreshInBackground(u: string) {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (ghToken.value) headers.Authorization = `Bearer ${ghToken.value}`
    const [p, rs] = await Promise.all([
      fetchJSON<GHUser>(`https://api.github.com/users/${u}`, { headers }),
      fetchJSON<GHRepo[]>(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`, { headers }),
    ])
    const nonForks = rs.filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)
    // 仅当用户没有切换查询、且仍停留在 USER MODE 时才更新 UI
    if (mode.value === 'user' && currentUser.value.toLowerCase() === u.toLowerCase()) {
      applyData(p, nonForks)
    }
  } catch (e) { /* 静默失败，缓存数据仍可用 */ }
}

/* ---------- 模式切换：USER MODE → WORK MODE（带返回） ---------- */
function openRepoFromUser(fullName: string) {
  originUser.value = currentUser.value
  diveRepo(fullName)
}

function backToUser() {
  const u = originUser.value
  if (!u) return
  originUser.value = ''
  query.value = u
  analyzeUser(u)
}

/* ---------- watch：搜索/排序变化时回到第 1 页 ---------- */
watch([filterText, sort], () => { page.value = 1 })

/* ---------- 生命周期 ---------- */
onMounted(() => {
  const hash = decodeURIComponent(location.hash.slice(1))
  if (hash) {
    query.value = hash
    onSearch()
  }
})
</script>

<template>
  <div class="repo-deep-dive-app">
    <AppHeader :title="{ en: 'Repo Deep Dive', zh: '仓库深挖' }" :show-lang-toggle="true" />

    <main class="shell">
      <!-- masthead -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 搜索区：单一输入框，自动识别 用户名 / owner/repo / URL -->
      <section class="search-bar">
        <div class="search-row">
          <input
            v-model="query"
            type="text"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            aria-label="GitHub username, owner/repo, or URL"
            @keydown="onSearchKey"
          />
          <button type="button" @click="onSearch">{{ t('analyze') }}</button>
        </div>
        <div class="quick-row">
          <span class="quick-label">{{ t('quickLinks') }}</span>
          <button
            v-for="name in quickPicks"
            :key="name"
            type="button"
            class="quick-pill"
            @click="quickPick(name)"
          >{{ name }}</button>
        </div>
        <p v-if="inputError" class="error-msg input-error">{{ inputError }}</p>
        <p class="token-hint">{{ t('tokenRecommended') }}</p>

        <!-- token 配置折叠区 -->
        <details class="token-toggle" :open="tokenToggleOpen">
          <summary @click.prevent="tokenToggleOpen = !tokenToggleOpen">
            <span>{{ t('tokenToggle') }}</span>
            <span class="token-badge" :class="{ on: ghToken }">
              {{ ghToken ? t('tokenConfigured') : t('tokenNotConfigured') }}
            </span>
          </summary>
          <div class="token-row">
            <input
              ref="tokenInputEl"
              v-model="tokenInput"
              type="password"
              placeholder="ghp_xxxx"
              autocomplete="off"
              aria-label="GitHub personal access token"
              :class="{ 'token-ok': tokenSaved }"
            />
            <button type="button" @click="saveToken">{{ t('tokenSave') }}</button>
            <button type="button" class="btn-ghost" @click="clearToken">{{ t('tokenClear') }}</button>
          </div>
        </details>
      </section>

      <!-- ============ USER MODE ============ -->
      <template v-if="mode === 'user'">
        <div v-if="loading" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
        <p v-else-if="errorMsg" class="error-msg user-error">{{ errorMsg }}</p>
        <template v-else-if="profile">
          <!-- 资料卡 -->
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
            <h2>{{ t('languagesUser') }}</h2>
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

          <!-- 仓库列表（点击进入 WORK MODE 深挖该仓库） -->
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
                <input v-model="filterText" type="text" :placeholder="t('filter')" aria-label="Filter repositories" />
              </div>
            </div>
            <div class="repo-grid">
              <div v-if="!pagedReposView.length" class="loading">{{ t('noRepos') }}</div>
              <div
                v-for="item in pagedReposView"
                :key="item.repo.full_name"
                class="repo-card"
                @click="openRepoFromUser(item.repo.full_name)"
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
        </template>
      </template>

      <!-- ============ WORK MODE ============ -->
      <button
        v-if="mode === 'repo' && currentRepo && originUser"
        type="button"
        class="back-to-user"
        @click="backToUser"
      >{{ t('backToUser').replace('{user}', originUser) }}</button>

      <section v-if="mode === 'repo' && currentRepo" class="result-grid">
        <!-- 1. 仓库概览大卡 -->
        <article class="card card-overview">
          <div v-if="loadingInfo" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorInfo" class="error-msg">{{ errorInfo }}</p>
          <template v-else-if="repoInfo">
            <div class="overview-head">
              <h2>
                <a :href="repoInfo.html_url" target="_blank" rel="noreferrer">{{ repoInfo.full_name }}</a>
              </h2>
              <a :href="repoInfo.html_url" target="_blank" rel="noreferrer" class="open-gh">{{ t('openRepo') }}</a>
            </div>
            <p v-if="repoInfo.description" class="overview-desc">{{ repoInfo.description }}</p>
            <div class="metrics-grid">
              <div v-for="(m, i) in metrics" :key="i" class="metric">
                <div class="metric-label">{{ m.label }}</div>
                <div class="metric-value">{{ m.value }}</div>
              </div>
            </div>
            <div class="overview-meta">
              <span v-if="repoInfo.license && repoInfo.license.spdx_id">
                <span class="meta-label">{{ t('license') }}</span>
                {{ repoInfo.license.spdx_id }}
              </span>
              <span>
                <span class="meta-label">{{ t('created') }}</span>
                {{ fmtDate(repoInfo.created_at) }}
              </span>
              <span>
                <span class="meta-label">{{ t('pushed') }}</span>
                {{ fmtDate(repoInfo.pushed_at) }}
              </span>
              <span v-if="repoInfo.homepage">
                <span class="meta-label">{{ t('homepage') }}</span>
                <a :href="repoInfo.homepage" target="_blank" rel="noreferrer">{{ repoInfo.homepage }}</a>
              </span>
            </div>
          </template>
        </article>

        <!-- 2. 语言节点图 -->
        <article class="card card-langs">
          <h3 class="card-title">{{ t('languages') }}</h3>
          <div v-if="loadingLangs" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorLangs" class="error-msg">{{ errorLangs }}</p>
          <template v-else>
            <div v-if="langNodes.length" class="lang-graph">
              <div class="lang-svg-wrap">
                <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="lang-svg" preserveAspectRatio="xMidYMid meet">
                  <g v-for="node in langNodes" :key="node.name">
                    <circle
                      :cx="node.x" :cy="node.y" :r="node.r"
                      :fill="node.color"
                      stroke="rgba(255,255,255,0.35)" stroke-width="1.5"
                      :class="['lang-circle', { dim: hoveredLang && hoveredLang.name !== node.name }]"
                      @mouseenter="hoveredLang = node"
                      @mouseleave="hoveredLang = null"
                    />
                    <text
                      :x="node.x" :y="node.y + node.r + 12"
                      text-anchor="middle" class="lang-label"
                    >{{ node.name }}</text>
                  </g>
                </svg>
                <div class="lang-tooltip" :class="{ show: hoveredLang }">
                  <template v-if="hoveredLang">
                    <span class="tt-name" :style="{ color: hoveredLang.color }">{{ hoveredLang.name }}</span>
                    <span class="tt-row">{{ num(hoveredLang.bytes) }} {{ t('bytes') }}</span>
                    <span class="tt-row">{{ hoveredLang.pct }}%</span>
                  </template>
                  <template v-else>{{ t('hoverHint') }}</template>
                </div>
              </div>
              <ul class="lang-legend">
                <li v-for="l in langLegend" :key="l.name" class="legend-row">
                  <span class="legend-dot" :style="{ background: l.color }"></span>
                  <span class="legend-name">{{ l.name }}</span>
                  <span class="legend-pct">{{ l.pct }}%</span>
                </li>
              </ul>
            </div>
            <div v-else class="loading">{{ t('noLanguages') }}</div>
          </template>
        </article>

        <!-- 3. 贡献者 -->
        <article class="card card-contribs">
          <h3 class="card-title">{{ t('contributors') }}</h3>
          <div v-if="loadingContribs" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorContribs" class="error-msg">{{ errorContribs }}</p>
          <template v-else>
            <div v-if="topContributors.length" class="contrib-grid">
              <a
                v-for="c in topContributors"
                :key="String(c.login || c.name) + String(c.id || '')"
                :href="c.html_url || (c.login ? `https://github.com/${c.login}` : undefined)"
                target="_blank"
                rel="noreferrer"
                class="contrib-card"
              >
                <img
                  v-if="c.avatar_url"
                  :src="c.avatar_url"
                  :alt="c.login || c.name || t('anonymous')"
                  class="contrib-avatar"
                  loading="lazy"
                />
                <span v-else class="contrib-avatar contrib-avatar-fallback"></span>
                <span class="contrib-name">{{ c.login || c.name || t('anonymous') }}</span>
                <span class="contrib-count">{{ num(c.contributions) }}</span>
              </a>
            </div>
            <div v-else class="loading">{{ t('noContributors') }}</div>
          </template>
        </article>

        <!-- 4. 提交活动柱状图 -->
        <article class="card card-commits">
          <h3 class="card-title">{{ t('commits') }}</h3>
          <div v-if="loadingCommits" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorCommits" class="error-msg">{{ errorCommits }}</p>
          <template v-else>
            <div v-if="commitBars.length" class="commit-wrap">
              <p class="commit-summary">{{ t('commits52').replace('{n}', num(totalCommits)) }}</p>
              <svg :viewBox="`0 0 ${COMMIT_W} ${COMMIT_H}`" class="commit-svg" preserveAspectRatio="none">
                <rect
                  v-for="(bar, i) in commitBars"
                  :key="i"
                  :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
                  :class="['commit-bar', { current: bar.isCurrent }]"
                />
              </svg>
            </div>
            <div v-else class="loading">{{ t('noCommits') }}</div>
          </template>
        </article>

        <!-- 5. Topics -->
        <article class="card card-topics">
          <h3 class="card-title">{{ t('topics') }}</h3>
          <div v-if="repoTopics.length" class="topics-cloud">
            <a
              v-for="tp in repoTopics"
              :key="tp"
              :href="`https://github.com/topics/${tp}`"
              target="_blank"
              rel="noreferrer"
              class="topic-pill"
            >{{ tp }}</a>
          </div>
          <div v-else class="loading">{{ t('noTopics') }}</div>
        </article>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Repo Deep Dive（合并版）— 深色 GitHub 主题
   在组件根类上覆盖 --ok-* 令牌，影响 AppHeader / AppFooter 等共享组件。
   USER MODE 区块沿用原 Repo Scope 的结构，但配色统一到深色主题令牌。
   ============================================================ */

.repo-deep-dive-app {
  --ok-bg: #0d1117;
  --ok-panel: #161b22;
  --ok-line: rgba(255, 255, 255, 0.1);
  --ok-text: #e6edf3;
  --ok-muted: #8b949e;
  --ok-accent: #58a6ff;
  --ok-radius: 8px;
  --ok-up: #3fb950;

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: var(--ok-text);
  background: var(--ok-bg);
  min-height: 100vh;
}

.repo-deep-dive-app a {
  color: var(--ok-accent);
  text-decoration: none;
}
.repo-deep-dive-app a:hover {
  text-decoration: underline;
}

/* ---------- 主容器 ---------- */

.shell {
  width: min(1100px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  padding: 0.5rem 0 1rem;
  border-bottom: 1px solid var(--ok-line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.masthead h1 {
  margin: 0.25rem 0 0;
  font-size: clamp(1.8rem, 4.5vw, 2.8rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ok-text);
}

.lead {
  margin: 0.4rem 0 0;
  color: var(--ok-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  max-width: 70ch;
}

/* ---------- 搜索区 ---------- */

.search-bar {
  margin-top: 0.8rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--ok-line);
}

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-row input[type="text"] {
  flex: 1;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-size: 1rem;
  border-radius: var(--ok-radius);
}
.search-row input[type="text"]:focus {
  outline: none;
  border-color: var(--ok-accent);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.25);
}

.search-row button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.2rem;
  border: 1px solid var(--ok-accent);
  background: var(--ok-accent);
  color: #0d1117;
  cursor: pointer;
  font-weight: 600;
  border-radius: var(--ok-radius);
}
.search-row button:hover {
  filter: brightness(1.08);
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.quick-label {
  font-size: 0.74rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.quick-pill {
  font: inherit;
  font-size: 0.76rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-accent);
  cursor: pointer;
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.quick-pill:hover {
  background: rgba(88, 166, 255, 0.12);
  border-color: var(--ok-accent);
}

.token-hint {
  margin: 0.4rem 0 0.1rem;
  font-size: 0.72rem;
  color: var(--ok-muted);
  line-height: 1.4;
}

/* token 配置折叠区 */
.token-toggle {
  margin-top: 0.6rem;
}

.token-toggle summary {
  cursor: pointer;
  color: var(--ok-muted);
  font-size: 0.78rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
}
.token-toggle summary::-webkit-details-marker { display: none; }

.token-badge {
  font-size: 0.66rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.token-badge.on {
  color: var(--ok-up);
  border-color: rgba(63, 185, 80, 0.5);
  background: rgba(63, 185, 80, 0.1);
}

.token-row {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.4rem;
  align-items: center;
}

.token-row input {
  flex: 1;
  font: inherit;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  border-radius: 4px;
}
.token-row input:focus {
  outline: none;
  border-color: var(--ok-accent);
}
.token-row input.token-ok {
  border-color: var(--ok-up);
  background: rgba(63, 185, 80, 0.08);
}

.token-row button {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-text);
  cursor: pointer;
  font-size: 0.76rem;
  border-radius: 4px;
}
.token-row button:first-of-type:hover {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

.btn-ghost {
  color: var(--ok-muted) !important;
}
.btn-ghost:hover {
  color: #f85149 !important;
  border-color: rgba(248, 81, 73, 0.5) !important;
}

/* ---------- 返回用户视图按钮 ---------- */

.back-to-user {
  margin-top: 1rem;
  font: inherit;
  font-size: 0.78rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-accent);
  cursor: pointer;
  border-radius: 999px;
}
.back-to-user:hover {
  border-color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.1);
}

/* ---------- WORK MODE 结果区栅格 ---------- */

.result-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 880px) {
  .result-grid {
    grid-template-columns: 1fr 1fr;
  }
  .card-overview,
  .card-commits {
    grid-column: 1 / -1;
  }
}

/* ---------- 通用卡片 ---------- */

.card {
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 1rem 1.1rem;
  min-width: 0;
}

.card-title {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ok-text);
  border-bottom: 1px solid var(--ok-line);
  padding-bottom: 0.4rem;
}

/* ---------- 1. 概览卡 ---------- */

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.overview-head h2 {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}

.overview-head h2 a {
  color: var(--ok-text);
}
.overview-head h2 a:hover {
  color: var(--ok-accent);
}

.open-gh {
  font-size: 0.76rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--ok-line);
  border-radius: 4px;
}
.open-gh:hover {
  border-color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.08);
}

.overview-desc {
  margin: 0.5rem 0 0.8rem;
  color: var(--ok-text);
  line-height: 1.5;
  font-size: 0.92rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}
@media (min-width: 560px) {
  .metrics-grid { grid-template-columns: repeat(6, 1fr); }
}

.metric {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  padding: 0.5rem 0.4rem;
  text-align: center;
}

.metric-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.metric-value {
  font-size: 1.05rem;
  font-weight: 700;
  margin-top: 0.15rem;
  letter-spacing: -0.02em;
}

.overview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  font-size: 0.8rem;
  color: var(--ok-text);
  border-top: 1px solid var(--ok-line);
  padding-top: 0.6rem;
}

.meta-label {
  color: var(--ok-muted);
  margin-right: 0.25rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---------- 2. 语言节点图 ---------- */

.lang-graph {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}
@media (min-width: 560px) {
  .lang-graph {
    grid-template-columns: 1.4fr 1fr;
    align-items: start;
  }
}

.lang-svg-wrap {
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  padding: 0.25rem;
}

.lang-svg {
  width: 100%;
  height: auto;
  display: block;
}

.lang-circle {
  transition: transform 120ms ease, opacity 120ms ease;
  transform-origin: center;
  transform-box: fill-box;
  cursor: pointer;
}
.lang-circle:hover {
  transform: scale(1.1);
}
.lang-circle.dim {
  opacity: 0.35;
}

.lang-label {
  font-size: 10px;
  fill: var(--ok-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  pointer-events: none;
}

.lang-tooltip {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  right: 0.4rem;
  background: rgba(13, 17, 23, 0.92);
  border: 1px solid var(--ok-line);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ok-muted);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  pointer-events: none;
  min-height: 1.2rem;
}
.lang-tooltip.show {
  color: var(--ok-text);
}
.tt-name {
  font-weight: 700;
  font-size: 0.8rem;
}
.tt-row {
  color: var(--ok-muted);
}

.lang-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.legend-row {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.78rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-name {
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-pct {
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.74rem;
}

/* ---------- 3. 贡献者 ---------- */

.contrib-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}
@media (min-width: 480px) {
  .contrib-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 720px) {
  .contrib-grid { grid-template-columns: repeat(4, 1fr); }
}

.contrib-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.4rem;
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  text-align: center;
  text-decoration: none;
}
.contrib-card:hover {
  border-color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.06);
  text-decoration: none;
}

.contrib-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--ok-line);
  object-fit: cover;
}
.contrib-avatar-fallback {
  background: var(--ok-muted);
  display: inline-block;
}

.contrib-name {
  font-size: 0.78rem;
  color: var(--ok-accent);
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contrib-count {
  font-size: 0.7rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---------- 4. 提交活动 ---------- */

.commit-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.commit-summary {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.commit-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
}

.commit-bar {
  fill: var(--ok-accent);
  transition: fill 100ms;
}
.commit-bar.current {
  fill: var(--ok-up);
}
.commit-bar:hover {
  fill: #ffffff;
}

/* ---------- 5. Topics ---------- */

.topics-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.topic-pill {
  font-size: 0.78rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-decoration: none;
}
.topic-pill:hover {
  background: rgba(88, 166, 255, 0.16);
  border-color: var(--ok-accent);
  text-decoration: none;
}

/* ============================================================
   USER MODE 区块（原 Repo Scope 结构，配色统一到深色主题）
   ============================================================ */

/* ---------- 资料卡 ---------- */

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
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid var(--ok-line);
  flex-shrink: 0;
}

.profile-info h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--ok-text);
}

.profile-bio {
  color: var(--ok-muted);
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
  color: var(--ok-muted);
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.stat-card {
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 0.7rem;
  text-align: center;
}

.stat-card .stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.stat-card .stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 0.15rem;
  letter-spacing: -0.02em;
}

.stat-card .stat-sub {
  font-size: 0.7rem;
  color: var(--ok-muted);
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
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
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

.score-ring.high { background: rgba(63, 185, 80, 0.12); color: #3fb950; border: 3px solid #3fb950; }
.score-ring.mid { background: rgba(210, 153, 34, 0.12); color: #d29922; border: 3px solid #d29922; }
.score-ring.low { background: rgba(248, 81, 73, 0.12); color: #f85149; border: 3px solid #f85149; }

.score-info h3 {
  margin: 0;
  font-size: 0.92rem;
  color: var(--ok-text);
}

.score-desc {
  font-size: 0.8rem;
  color: var(--ok-muted);
  margin-top: 0.2rem;
  line-height: 1.5;
}

/* ---------- 语言分布（用户） ---------- */

.lang-section {
  margin-top: 0.8rem;
}

.lang-section h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
  color: var(--ok-text);
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--ok-line);
  border-radius: 3px;
  overflow: hidden;
}

.lang-bar-fill {
  height: 100%;
  transition: width 0.6s ease;
}

.lang-bar-pct {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  text-align: right;
  color: var(--ok-muted);
}

/* ---------- 仓库列表（用户） ---------- */

.repo-section {
  min-width: 0;
  margin-top: 1rem;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.repo-header h2 {
  font-size: 1rem;
  margin: 0;
  color: var(--ok-text);
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
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-size: 0.78rem;
  border-radius: 4px;
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
  border-bottom: 1px solid var(--ok-line);
  cursor: pointer;
  transition: background 100ms;
}

.repo-card:hover {
  background: rgba(88, 166, 255, 0.08);
}

.repo-card-name {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--ok-accent);
}

.repo-card-desc {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--ok-muted);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-card-stats {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.repo-card-tags {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.repo-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.repo-tag.fresh { border-color: #3fb950; color: #3fb950; }
.repo-tag.dormant { border-color: #f85149; color: #f85149; }
.repo-tag.hot { border-color: var(--ok-accent); color: var(--ok-accent); background: rgba(88, 166, 255, 0.1); }

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* ---------- 分页（用户） ---------- */

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
  border: 1px solid var(--ok-line);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.76rem;
  color: var(--ok-muted);
  border-radius: 4px;
}

.page-btn:hover { border-color: var(--ok-accent); color: var(--ok-accent); }
.page-btn.active { background: var(--ok-accent); color: #0d1117; border-color: var(--ok-accent); }
.page-btn:disabled { opacity: 0.3; cursor: default; }

/* ---------- 加载与错误 ---------- */

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ok-muted);
  padding: 0.5rem 0;
  font-size: 0.85rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--ok-line);
  border-top-color: var(--ok-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-msg {
  color: #f85149;
  background: rgba(248, 81, 73, 0.08);
  border: 1px solid rgba(248, 81, 73, 0.3);
  padding: 0.6rem 0.7rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.5;
}

.input-error {
  margin-top: 0.5rem;
}

.user-error {
  margin-top: 1rem;
}

/* ---------- 响应式 ---------- */

@media (max-width: 560px) {
  .overview-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .overview-meta {
    flex-direction: column;
    gap: 0.3rem;
  }
}

@media (max-width: 720px) {
  .stat-strip { grid-template-columns: repeat(2, 1fr); }
  .lang-bar-row { grid-template-columns: 70px 1fr 40px; }
  .profile-card { flex-direction: column; align-items: center; text-align: center; }
  .profile-meta { justify-content: center; }
}
</style>
