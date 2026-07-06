<script setup>
/* ============================================================
   HN Reader — Hacker News 阅读器（Vue 3 SFC）
   数据源：Hacker News Firebase API（公开、免费、支持 CORS）
   - 6 个标签页：Top / Best / New / Ask HN / Show HN / Jobs
   - 无限滚动、相对时间、来源域名、文字帖展开
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, escapeHtml } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Hacker News reader',
    title: 'HN Reader',
    lead: 'A compact feed of what Hacker News is reading right now.',
    top: 'Top',
    best: 'Best',
    new: 'New',
    ask: 'Ask HN',
    show: 'Show HN',
    jobs: 'Jobs',
    loading: 'Loading stories…',
    loadingMore: 'Loading more…',
    error: 'Failed to load stories. Check your connection and try again.',
    empty: 'No stories in this feed.',
    end: '— end of feed —',
    points: 'pts',
    by: 'by',
    comments: 'comments',
    comment: 'comment',
    noComments: 'discuss',
    justNow: 'just now',
    minuteAgo: 'm ago',
    hourAgo: 'h ago',
    dayAgo: 'd ago',
    monthAgo: 'mo ago',
  },
  zh: {
    eyebrow: 'Hacker News 阅读器',
    title: 'HN Reader',
    lead: '紧凑呈现 Hacker News 此刻正在阅读的内容。',
    top: '热门',
    best: '最佳',
    new: '最新',
    ask: 'Ask HN',
    show: 'Show HN',
    jobs: '招聘',
    loading: '正在加载文章…',
    loadingMore: '加载更多…',
    error: '加载失败，请检查网络后重试。',
    empty: '该分类下暂无文章。',
    end: '— 已到底部 —',
    points: '分',
    by: '作者',
    comments: '评论',
    comment: '评论',
    noComments: '讨论',
    justNow: '刚刚',
    minuteAgo: '分钟前',
    hourAgo: '小时前',
    dayAgo: '天前',
    monthAgo: '个月前',
  },
}

const t = useT(copy)

// ---------- 常量 ----------
const API = 'https://hacker-news.firebaseio.com/v0'

// 各标签页对应的 stories 端点
const ENDPOINTS = {
  top: '/topstories.json',
  best: '/beststories.json',
  new: '/newstories.json',
  ask: '/askstories.json',
  show: '/showstories.json',
  job: '/jobstories.json',
}

const PAGE_SIZE = 20

// 标签页定义：key 用于端点，label 为 i18n 文案键
const TABS = [
  { key: 'top', label: 'top' },
  { key: 'best', label: 'best' },
  { key: 'new', label: 'new' },
  { key: 'ask', label: 'ask' },
  { key: 'show', label: 'show' },
  { key: 'job', label: 'jobs' },
]

// ---------- 状态 ----------
const currentTab = ref('top')                       // 当前标签页
const idsCache = reactive({})                        // 每个标签页的 id 列表缓存
const loadedItems = ref([])                          // 当前已加载的 item（含 null 占位）
const loading = ref(false)                           // 加载中
const finished = ref(false)                          // 已加载到末尾
const error = ref(false)                             // 加载失败
const expanded = ref(new Set())                      // 已展开的文字帖 id 集合
const now = ref(Math.floor(Date.now() / 1000))       // 当前时间（Unix 秒），用于相对时间刷新

const sentinelEl = ref(null)                         // 哨兵元素引用（无限滚动触发点）
let observer = null                                  // IntersectionObserver 实例
let scrollHandler = null                             // 降级滚动监听处理函数
let clockTimer = null                                // 相对时间刷新定时器

// ---------- 工具函数 ----------

// HN 原帖链接
function hnUrl(id) {
  return 'https://news.ycombinator.com/item?id=' + id
}

// 相对时间：time 为 Unix 秒
function relativeTime(time) {
  const diff = Math.max(0, now.value - (time || 0))
  if (diff < 60) return t.value('justNow')
  if (diff < 3600) return Math.floor(diff / 60) + t.value('minuteAgo')
  if (diff < 86400) return Math.floor(diff / 3600) + t.value('hourAgo')
  if (diff < 2592000) return Math.floor(diff / 86400) + t.value('dayAgo')
  return Math.floor(diff / 2592000) + t.value('monthAgo')
}

// 从 url 提取域名（去掉 www. 前缀）
function domainFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return ''
  }
}

// 评论数文案
function commentsLabel(c) {
  if (!c) return t.value('noComments')
  return c + ' ' + (c === 1 ? t.value('comment') : t.value('comments'))
}

// 安全渲染 text 字段（用于 v-html）：
// 先全量转义杜绝 XSS，再恢复受控的基本标签（p / a / 基本格式）。
// 链接仅允许 http/https 协议，阻止 javascript:/data: 等危险协议。
function sanitizeText(html) {
  if (!html) return ''
  let s = escapeHtml(html)
  // 恢复段落
  s = s.replace(/&lt;p&gt;/g, '<p>').replace(/&lt;\/p&gt;/g, '</p>')
  // 恢复基本格式标签
  s = s.replace(/&lt;(\/?)(i|b|em|strong|code|pre)&gt;/g, '<$1$2>')
  // 恢复链接：href 中的 &amp;/&#39; 还原后校验协议
  s = s.replace(/&lt;a\s+href=&quot;(.*?)&quot;&gt;/g, (m, raw) => {
    const url = raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    if (!/^https?:\/\//i.test(url)) return ''
    return '<a href="' + url + '" target="_blank" rel="noreferrer noopener">'
  })
  s = s.replace(/&lt;\/a&gt;/g, '</a>')
  return s
}

// 文字帖展开 / 折叠
function isExpanded(id) {
  return expanded.value.has(id)
}
function toggleExpand(id) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

// ---------- computed ----------

// 当前标签页的 id 列表（null 表示尚未加载）
const currentIds = computed(() => idsCache[currentTab.value] || null)

// 可见行：过滤掉 null 占位，保留原始序号作为排名
const visibleItems = computed(() => {
  const result = []
  loadedItems.value.forEach((item, idx) => {
    if (item) result.push({ item, rank: idx + 1 })
  })
  return result
})

// 状态条文本
const statusText = computed(() => {
  if (loading.value) {
    return loadedItems.value.length === 0 ? t.value('loading') : t.value('loadingMore')
  }
  const ids = currentIds.value
  if (loadedItems.value.length && ids && ids.length) {
    return loadedItems.value.length + ' / ' + ids.length
  }
  return ''
})

// 是否显示“该分类下暂无文章”空状态
const showEmpty = computed(
  () => !loading.value && !error.value && currentIds.value !== null && currentIds.value.length === 0,
)

// 是否显示“已到底部”结尾标记（只要有已加载内容即显示，与原实现一致）
const showEnd = computed(() => loadedItems.value.length > 0)

// ---------- 数据加载 ----------

// 获取某个标签页的全部 id（带缓存）
async function getIds(tab) {
  if (idsCache[tab]) return idsCache[tab]
  const ids = await fetchJSON(API + ENDPOINTS[tab])
  idsCache[tab] = ids || []
  return idsCache[tab]
}

// 并发拉取一批 item 详情（限制并发数避免瞬时大量请求）
async function fetchItems(ids) {
  const concurrency = 8
  const results = new Array(ids.length)
  let i = 0
  function next() {
    if (i >= ids.length) return Promise.resolve()
    const idx = i++
    return fetchJSON(API + '/item/' + ids[idx] + '.json')
      .then((item) => { results[idx] = item })
      .catch(() => { results[idx] = null })
      .then(next)
  }
  const workers = []
  for (let w = 0; w < concurrency; w++) workers.push(next())
  await Promise.all(workers)
  return results
}

// 加载下一页（每次 PAGE_SIZE 条）
async function loadNext() {
  if (loading.value || finished.value) return
  loading.value = true
  error.value = false
  const tab = currentTab.value
  try {
    const ids = await getIds(tab)
    // 切换标签页后异步返回的旧结果需丢弃
    if (tab !== currentTab.value) return
    if (!ids.length) {
      finished.value = true
      loading.value = false
      return
    }
    const start = loadedItems.value.length
    const slice = ids.slice(start, start + PAGE_SIZE)
    if (!slice.length) {
      finished.value = true
      loading.value = false
      return
    }
    const items = await fetchItems(slice)
    if (tab !== currentTab.value) return
    for (const it of items) loadedItems.value.push(it)
    if (loadedItems.value.length >= ids.length) finished.value = true
    loading.value = false
  } catch (e) {
    if (tab !== currentTab.value) return
    error.value = true
    loading.value = false
  }
}

// 切换标签页
function switchTab(tab) {
  if (tab === currentTab.value) return
  currentTab.value = tab
  loadedItems.value = []
  finished.value = false
  loading.value = false
  error.value = false
  expanded.value = new Set()
  loadNext()
}

// ---------- 生命周期 ----------
onMounted(() => {
  loadNext()
  // 每分钟刷新相对时间，避免时间显示陈旧
  clockTimer = setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 60000)
  // 无限滚动：观察哨兵元素，不支持时降级为滚动监听
  if ('IntersectionObserver' in window && sentinelEl.value) {
    observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNext() },
      { rootMargin: '400px' },
    )
    observer.observe(sentinelEl.value)
  } else {
    scrollHandler = () => {
      if (!sentinelEl.value) return
      const rect = sentinelEl.value.getBoundingClientRect()
      if (rect.top < window.innerHeight + 400) loadNext()
    }
    window.addEventListener('scroll', scrollHandler)
  }
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (observer) observer.disconnect()
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
})
</script>

<template>
  <div class="hn-reader-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div class="masthead-copy">
          <p class="kicker">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 标签页 -->
      <nav class="tabs" role="tablist" aria-label="Stories">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="tab"
          :class="{ active: tab.key === currentTab }"
          type="button"
          role="tab"
          :aria-selected="tab.key === currentTab ? 'true' : 'false'"
          @click="switchTab(tab.key)"
        >{{ t(tab.label) }}</button>
      </nav>

      <!-- 状态条 -->
      <div class="status" aria-live="polite">
        <template v-if="loading">
          <span class="spinner"></span>
          <span>{{ statusText }}</span>
        </template>
        <p v-else-if="error" class="error-msg">{{ t('error') }}</p>
        <span v-else>{{ statusText }}</span>
      </div>

      <!-- 文章列表 -->
      <section class="list" :aria-busy="loading">
        <p v-if="showEmpty" class="empty">{{ t('empty') }}</p>
        <template v-else>
          <article
            v-for="row in visibleItems"
            :key="row.item.id"
            class="row"
          >
            <span class="rank">{{ row.rank }}</span>
            <div class="main">
              <div class="title-line">
                <!-- 有 url → 外链 -->
                <a
                  v-if="row.item.url"
                  class="title"
                  :href="row.item.url"
                  target="_blank"
                  rel="noreferrer noopener"
                >{{ row.item.title }}</a>
                <!-- 文字帖 → 可展开按钮 -->
                <button
                  v-else-if="row.item.text"
                  class="title-toggle"
                  type="button"
                  :aria-expanded="isExpanded(row.item.id) ? 'true' : 'false'"
                  @click="toggleExpand(row.item.id)"
                >
                  <span class="caret">▸</span>{{ row.item.title }}
                </button>
                <!-- 否则链接到原帖 -->
                <a
                  v-else
                  class="title"
                  :href="hnUrl(row.item.id)"
                  target="_blank"
                  rel="noreferrer"
                >{{ row.item.title }}</a>
                <span v-if="domainFrom(row.item.url)" class="domain">({{ domainFrom(row.item.url) }})</span>
              </div>
              <div class="meta">
                <span class="score">{{ row.item.score || 0 }} {{ t('points') }}</span>
                <span class="dot">·</span>
                <span class="by">{{ t('by') }} {{ row.item.by || '' }}</span>
                <span class="dot">·</span>
                <span class="time">{{ relativeTime(row.item.time) }}</span>
                <span class="dot">·</span>
                <a
                  class="comments"
                  :href="hnUrl(row.item.id)"
                  target="_blank"
                  rel="noreferrer"
                >{{ commentsLabel(row.item.descendants) }}</a>
              </div>
              <!-- 文字帖展开内容（v-html 安全渲染） -->
              <div
                v-if="row.item.text"
                v-show="isExpanded(row.item.id)"
                class="content"
                v-html="sanitizeText(row.item.text)"
              ></div>
            </div>
          </article>
          <div v-if="showEnd" class="end-msg">{{ t('end') }}</div>
        </template>
      </section>

      <!-- 无限滚动哨兵 -->
      <div ref="sentinelEl" class="sentinel" aria-hidden="true"></div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   HN Reader — 深色主题样式
   accent 采用 Hacker News 橙 (#ff6600)，列表式紧凑布局
   原 :root 变量迁移到组件根类 .hn-reader-app，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.hn-reader-app {
  /* 表面与文字 */
  --bg: #0b0e14;
  --panel: #141821;
  --panel-hover: #1b212c;
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.14);
  --text: #e6e8ec;
  --muted: #8b95a5;
  --muted-2: #6b7585;

  /* 强调色：HN 橙 */
  --accent: #ff6600;
  --accent-soft: rgba(255, 102, 0, 0.12);

  /* 字体 */
  --font: "Outfit", system-ui, -apple-system, sans-serif;
  --mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

  /* 映射到共享设计系统令牌 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-font: var(--font);
  --ok-mono: var(--mono);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: var(--line);

  /* 深色色彩方案 */
  color-scheme: dark;

  min-height: 100vh;
  margin: 0;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

.hn-reader-app * { box-sizing: border-box; }

.hn-reader-app a { color: var(--accent); text-decoration: none; }
.hn-reader-app a:hover { text-decoration: underline; }
.hn-reader-app h1, .hn-reader-app h2, .hn-reader-app p,
.hn-reader-app strong, .hn-reader-app span, .hn-reader-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(860px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1.2rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

.kicker {
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 600;
}

.masthead h1 {
  margin-top: 0.3rem;
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.6rem;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 52ch;
}

/* ---------- 标签页 ---------- */
.tabs {
  display: flex;
  gap: 0.3rem;
  margin-top: 1.2rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }

.tab {
  font: inherit;
  font-family: var(--mono);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  padding: 0.5rem 0.9rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 6px;
  white-space: nowrap;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.04);
}

.tab.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(255, 102, 0, 0.28);
}

/* ---------- 状态条 ---------- */
.status {
  min-height: 2rem;
  padding: 0.7rem 0;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* ---------- 文章列表 ---------- */
.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 0.8rem;
  padding: 0.85rem 0.6rem;
  border-bottom: 1px solid var(--line);
  position: relative;
  transition: background 0.15s, box-shadow 0.15s;
}

.row:hover {
  background: var(--panel-hover);
  box-shadow: inset 2px 0 0 var(--accent);
}

.rank {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--muted-2);
  text-align: right;
  padding-top: 0.15rem;
}

.main { min-width: 0; }

.title-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title {
  color: var(--text);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.35;
  text-decoration: none;
}
.title:hover { color: var(--accent); }

/* 文字帖可展开标题按钮 */
.title-toggle {
  font: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: var(--text);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.35;
}
.title-toggle:hover { color: var(--accent); }

.title-toggle .caret {
  display: inline-block;
  width: 0.8rem;
  color: var(--muted-2);
  transition: transform 0.2s ease;
  margin-right: 0.15rem;
  font-family: var(--mono);
}
.title-toggle[aria-expanded="true"] .caret { transform: rotate(90deg); }

.domain {
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--muted-2);
}

.meta {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--mono);
  font-size: 0.74rem;
  color: var(--muted);
}

.meta .score { color: var(--accent); font-weight: 500; }
.meta .dot { color: var(--muted-2); }
.meta .by { color: var(--muted); }
.meta .comments { color: var(--muted); cursor: pointer; }
.meta .comments:hover { color: var(--accent); text-decoration: underline; }

/* ---------- 展开内容（Ask HN / 文字帖） ---------- */
/* v-html 注入的子元素需用 :deep() 才能被 scoped 样式命中 */
.content {
  margin-top: 0.6rem;
  padding: 0.85rem 0.95rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 2px solid var(--accent);
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--text);
  overflow-x: auto;
}
.content :deep(p) { margin: 0 0 0.6rem; }
.content :deep(p:last-child) { margin-bottom: 0; }
.content :deep(a) { color: var(--accent); }
.content :deep(code) {
  font-family: var(--mono);
  font-size: 0.82rem;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
.content :deep(pre) {
  font-family: var(--mono);
  font-size: 0.82rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.6rem;
  border-radius: 4px;
  overflow-x: auto;
}

/* ---------- 哨兵与加载态 ---------- */
.sentinel { height: 1px; }

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: hn-spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes hn-spin { to { transform: rotate(360deg); } }

.end-msg {
  padding: 1.4rem 0;
  text-align: center;
  font-family: var(--mono);
  font-size: 0.74rem;
  color: var(--muted-2);
}

.error-msg {
  margin: 0.6rem 0;
  padding: 0.8rem 0.9rem;
  color: #ff8b6b;
  background: rgba(255, 102, 0, 0.08);
  border: 1px solid rgba(255, 102, 0, 0.22);
  border-radius: 6px;
  font-size: 0.86rem;
  line-height: 1.5;
}

.empty {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .shell { padding: 1rem 0 2.5rem; }
  .row {
    grid-template-columns: 1.9rem 1fr;
    gap: 0.6rem;
    padding: 0.8rem 0.3rem;
  }
  .title,
  .title-toggle { font-size: 0.94rem; }
  .masthead { flex-direction: column; align-items: start; gap: 0.6rem; }
}
</style>
