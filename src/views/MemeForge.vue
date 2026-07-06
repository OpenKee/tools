<script setup>
/* ============================================================
   Meme Forge — 梗图生成器（Vue 3 SFC 迁移版）
   数据来源：Meme API（聚合 Reddit 公开梗图，支持 CORS）
   - 共享 i18n：useT（来自 ../i18n.js），语言切换由 AppHeader 负责
   - 共享工具：fetchJSON（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   ============================================================ */
import { ref, computed, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Meme API · Random Memes',
    title: 'Meme Forge',
    lead: 'Get a random meme, pick a subreddit, or browse through the latest posts.',
    load: 'Load',
    random: 'Random',
    prev: '← Prev',
    next: 'Next →',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    loading: 'Loading…',
    fetchError: 'Failed to load meme.',
    dataSource: 'Data: Meme API / Reddit',
    allProjects: 'All projects ↗',
    subPlaceholder: 'memes',
    viewPost: 'View post ↗',
    upvotes: 'upvotes',
    by: 'by',
  },
  zh: {
    eyebrow: 'Meme API · 随机梗图',
    title: 'Meme Forge',
    lead: '随机获取一张梗图，或指定 subreddit 浏览最新帖子。',
    load: '加载',
    random: '随机',
    prev: '← 上一张',
    next: '下一张 →',
    copyLink: '复制链接',
    copied: '已复制！',
    loading: '加载中…',
    fetchError: '梗图加载失败。',
    dataSource: '数据：Meme API / Reddit',
    allProjects: '全部项目 ↗',
    subPlaceholder: 'memes',
    viewPost: '查看原帖 ↗',
    upvotes: '赞',
    by: '作者',
  },
}

// useT 返回 computed ref，模板中 t('key') 自动 unwrap；脚本中用 t.value('key')
const t = useT(copy)

// ---------- API 地址 ----------
const API_BASE = 'https://meme-api.com/gimme'

// ---------- 响应式状态 ----------
const subInput = ref('')           // subreddit 输入框
const currentMeme = ref(null)      // 当前展示的梗图
const history = ref([])            // 浏览历史
const historyIndex = ref(-1)       // 当前历史指针
const loading = ref(false)         // 加载中标志
const hasError = ref(false)        // 加载失败标志
const copied = ref(false)          // 复制成功提示

// ---------- 计算属性 ----------
// 上一张按钮禁用：历史指针已到最前
const prevDisabled = computed(() => historyIndex.value <= 0)
// 下一张按钮禁用：历史指针已到最后
const nextDisabled = computed(() => historyIndex.value >= history.value.length - 1)
// 复制按钮文案：复制成功时显示“已复制”，否则显示“复制链接”
const copyBtnText = computed(() => (copied.value ? t.value('copied') : t.value('copyLink')))

// ---------- 工具：构造 API 地址 ----------
function apiUrl(subreddit) {
  let url = API_BASE
  if (subreddit) url += '/' + encodeURIComponent(subreddit)
  return url
}

// ---------- 获取并规范化 subreddit 输入（去除 r/ 前缀） ----------
function getSubreddit() {
  return subInput.value.trim().replace(/^r\//, '')
}

// ---------- 拉取梗图 ----------
async function fetchMeme(subreddit) {
  loading.value = true
  currentMeme.value = null
  hasError.value = false
  try {
    const data = await fetchJSON(apiUrl(subreddit), { timeout: 15000 })
    loading.value = false
    if (!data || !data.url) {
      hasError.value = true
      return
    }
    currentMeme.value = data
    // 丢弃当前位置之后的历史，追加新条目
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(data)
    historyIndex.value = history.value.length - 1
  } catch (err) {
    loading.value = false
    hasError.value = true
    console.warn('Meme load failed:', err)
  }
}

// ---------- 历史导航：上一张 ----------
function goBack() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    currentMeme.value = history.value[historyIndex.value]
  }
}

// ---------- 历史导航：下一张（到末尾则拉取新梗图） ----------
function goForward() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    currentMeme.value = history.value[historyIndex.value]
  } else {
    fetchMeme(getSubreddit())
  }
}

// ---------- 复制当前梗图链接到剪贴板 ----------
function copyLink() {
  if (!currentMeme.value || !currentMeme.value.url) return
  const url = currentMeme.value.url
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () {
      copied.value = true
      setTimeout(function () { copied.value = false }, 1500)
    }).catch(function () {})
  }
}

// ---------- 提交 subreddit 表单：重置历史并加载 ----------
function onSubmit() {
  history.value = []
  historyIndex.value = -1
  fetchMeme(getSubreddit())
}

// ---------- 随机梗图：清空输入并重置历史 ----------
function onRandom() {
  subInput.value = ''
  history.value = []
  historyIndex.value = -1
  fetchMeme('')
}

// ---------- 初始化：首次拉取一张随机梗图 ----------
onMounted(function () {
  fetchMeme('')
})
</script>

<template>
  <div class="meme-forge-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <section class="controls">
        <form class="sub-row" @submit.prevent="onSubmit">
          <span class="sub-label">r/</span>
          <input
            v-model="subInput"
            type="text"
            :placeholder="t('subPlaceholder')"
            autocomplete="off"
            aria-label="Subreddit name"
          />
          <button type="submit">{{ t('load') }}</button>
          <button type="button" class="ok-btn-ghost" @click="onRandom">{{ t('random') }}</button>
        </form>
        <div class="action-row">
          <button type="button" class="ok-btn-ghost" :disabled="prevDisabled" @click="goBack">{{ t('prev') }}</button>
          <button type="button" class="ok-btn-ghost" :disabled="nextDisabled" @click="goForward">{{ t('next') }}</button>
          <button type="button" class="ok-btn-ghost copy-btn" @click="copyLink">{{ copyBtnText }}</button>
        </div>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 梗图卡片 -->
      <div v-if="currentMeme" class="meme-card">
        <img :src="currentMeme.url" :alt="currentMeme.title || ''" />
        <div class="meme-body">
          <h2 class="meme-title">{{ currentMeme.title || '' }}</h2>
          <div class="meme-meta">
            <span>r/{{ currentMeme.subreddit || '' }}</span>
            <span>{{ (currentMeme.ups || 0) + ' ' + t('upvotes') }}</span>
            <span>{{ t('by') + ' u/' + (currentMeme.author || '') }}</span>
          </div>
          <a class="meme-link" :href="currentMeme.postLink || '#'" target="_blank" rel="noopener">{{ t('viewPost') }}</a>
        </div>
      </div>

      <!-- 加载失败 -->
      <div v-if="hasError" class="ok-error">{{ t('fetchError') }}</div>

      <!-- 数据来源声明 -->
      <p class="data-source">{{ t('dataSource') }}</p>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   主题变量：原 :root 中的自定义变量迁移到组件根类 .meme-forge-app，
   同时把 --ok-* 共享 token 映射到本应用主题色（影响 AppHeader /
   AppFooter 等共享组件，CSS 变量会沿 DOM 树向下继承）。
   ============================================================ */
.meme-forge-app {
  --bg: #111111;
  --surface: #1a1a1a;
  --surface-2: #262626;
  --text: #f7f7f7;
  --text-muted: #a1a1aa;
  --border: #333333;
  --accent: #f97316;
  --accent-2: #fbbf24;
  --accent-contrast: #ffffff;
  color-scheme: dark;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-surface: var(--surface);
  --ok-text: var(--text);
  --ok-text-muted: var(--text-muted);
  --ok-border: var(--border);
  --ok-accent: var(--accent);
  --ok-accent-contrast: var(--accent-contrast);
  --ok-radius: 16px;
  --ok-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
  --ok-line: var(--border);
  --ok-panel: var(--surface);
  --ok-muted: var(--text-muted);
  --ok-accent-soft: rgba(249, 115, 22, 0.14);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent-2);
  --ok-font: "Outfit", system-ui, sans-serif;
  --ok-mono: "IBM Plex Mono", monospace;

  /* 原 body 背景迁移到根元素 */
  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(900px 500px at 85% -10%, rgba(249, 115, 22, 0.15), transparent 60%),
    radial-gradient(800px 500px at 10% -5%, rgba(251, 191, 36, 0.08), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(720px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 1.2rem 0 4rem;
}

/* ---------- 页头 masthead ---------- */
.masthead {
  padding: 1.5rem 0 1.2rem;
}

.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--accent);
  font-weight: 600;
}

h1 {
  margin-top: 0.45rem;
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.55;
  max-width: 58ch;
}

/* ---------- 控制区 ---------- */
.controls {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem 0 1.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.2rem;
}

.sub-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.sub-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
}

.sub-row input {
  flex: 1;
  min-width: 160px;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.sub-row input:focus {
  border-color: var(--accent);
}

.sub-row button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.1rem;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
  cursor: pointer;
}

.sub-row button.ok-btn-ghost {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}

.action-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.action-row .ok-btn-ghost {
  height: 2.2rem;
  padding: 0 0.8rem;
}

.copy-btn {
  margin-left: auto;
}

/* ---------- 梗图卡片 ---------- */
.meme-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  overflow: hidden;
  box-shadow: var(--ok-shadow);
}

.meme-card img {
  width: 100%;
  display: block;
  max-height: 70vh;
  object-fit: contain;
  background: #000;
}

.meme-body {
  padding: 1.2rem;
}

.meme-title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.35;
}

.meme-meta {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: var(--ok-mono);
}

.meme-link {
  display: inline-block;
  margin-top: 0.9rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--accent);
  font-weight: 600;
  font-size: 0.82rem;
}

.meme-link:hover {
  background: var(--ok-accent-soft);
}

/* ---------- 数据来源声明 ---------- */
.data-source {
  margin-top: 1.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

/* ---------- 响应式 ---------- */
@media (max-width: 480px) {
  .sub-label {
    display: none;
  }
  .copy-btn {
    margin-left: 0;
  }
}
</style>
