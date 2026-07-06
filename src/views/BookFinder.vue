<script setup>
/* ============================================================
   Book Finder — 图书搜索器（Vue 3 SFC）
   数据源：Open Library Search API
   ============================================================ */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Book discovery',
    title: 'Book Finder',
    lead: 'Search millions of titles from the Open Library catalog by title, author, or ISBN.',
    search: 'Search',
    searchPlaceholder: 'Search by title, author, ISBN…',
    suggestionsTitle: 'Popular searches',
    loading: 'Searching the shelves…',
    noResults: 'No books found. Try another keyword.',
    error: 'Could not reach Open Library. Please try again.',
    tryAgain: 'Try again',
    loadMore: 'Load more',
    loadingMore: 'Loading…',
    endOfResults: 'End of results',
    results: 'results',
    by: 'by',
    unknownAuthor: 'Unknown author',
    unknownYear: '—',
    firstPublished: 'First published',
    publisher: 'Publisher',
    pages: 'Pages',
    isbn: 'ISBN',
    subjects: 'Subjects',
    language: 'Language',
    description: 'Description',
    noDescription: 'No description available for this title.',
    viewOnOpenLibrary: 'View on Open Library',
    loadingDetails: 'Loading details…',
  },
  zh: {
    eyebrow: '图书发现',
    title: 'Book Finder',
    lead: '在 Open Library 海量目录中按书名、作者或 ISBN 搜索图书。',
    search: '搜索',
    searchPlaceholder: '按书名、作者、ISBN 搜索…',
    suggestionsTitle: '热门搜索',
    loading: '正在检索书架…',
    noResults: '没有找到相关图书，换个关键词试试。',
    error: '无法连接 Open Library，请稍后重试。',
    tryAgain: '重试',
    loadMore: '加载更多',
    loadingMore: '加载中…',
    endOfResults: '已显示全部结果',
    results: '条结果',
    by: '—',
    unknownAuthor: '佚名',
    unknownYear: '—',
    firstPublished: '首次出版',
    publisher: '出版社',
    pages: '页数',
    isbn: 'ISBN',
    subjects: '主题',
    language: '语言',
    description: '简介',
    noDescription: '暂无该书简介。',
    viewOnOpenLibrary: '在 Open Library 中查看',
    loadingDetails: '正在加载详情…',
  },
}

const t = useT(copy)

// ---------- 配置 ----------
const API = 'https://openlibrary.org/search.json'
const COVER = 'https://covers.openlibrary.org/b/id/'
const WORKS = 'https://openlibrary.org'
const PAGE = 12

// 热门搜索建议词
const SUGGESTIONS = [
  'fantasy', 'science fiction', 'history', 'philosophy', 'mystery',
  'biography', 'poetry', 'cooking', 'art', 'travel',
]

// 建议词的展示文案（中英）
const SUGGESTION_LABELS = {
  fantasy: { en: 'Fantasy', zh: '奇幻' },
  'science fiction': { en: 'Science Fiction', zh: '科幻' },
  history: { en: 'History', zh: '历史' },
  philosophy: { en: 'Philosophy', zh: '哲学' },
  mystery: { en: 'Mystery', zh: '悬疑' },
  biography: { en: 'Biography', zh: '传记' },
  poetry: { en: 'Poetry', zh: '诗歌' },
  cooking: { en: 'Cooking', zh: '烹饪' },
  art: { en: 'Art', zh: '艺术' },
  travel: { en: 'Travel', zh: '旅行' },
}

// Open Library 语言代码 → 本地化名称
const LANG_NAMES = {
  eng: { en: 'English', zh: '英语' },
  zho: { en: 'Chinese', zh: '中文' },
  chi: { en: 'Chinese', zh: '中文' },
  spa: { en: 'Spanish', zh: '西班牙语' },
  fre: { en: 'French', zh: '法语' },
  fra: { en: 'French', zh: '法语' },
  ger: { en: 'German', zh: '德语' },
  deu: { en: 'German', zh: '德语' },
  jpn: { en: 'Japanese', zh: '日语' },
  rus: { en: 'Russian', zh: '俄语' },
  por: { en: 'Portuguese', zh: '葡萄牙语' },
  ita: { en: 'Italian', zh: '意大利语' },
  ara: { en: 'Arabic', zh: '阿拉伯语' },
  kor: { en: 'Korean', zh: '韩语' },
  lat: { en: 'Latin', zh: '拉丁语' },
}

// ---------- 状态 ----------
const query = ref('')                       // 搜索输入
const currentQuery = ref('')                // 当前实际搜索的查询词
const currentPage = ref(1)                  // 当前页码
const totalFound = ref(0)                   // 搜索结果总数
const lastResults = ref(null)               // 最近一次结果（null 表示尚未搜索）
const isLoading = ref(false)                // 首次/重置搜索加载中
const loadingMore = ref(false)              // 加载更多中
const error = ref(false)                    // 是否出错
const hasSearched = ref(false)              // 是否已执行过搜索（搜索后隐藏建议区）
const endReached = ref(false)               // 是否已加载到末尾

// 详情抽屉
const drawerOpen = ref(false)               // 抽屉是否打开
const detailBook = ref(null)                // 当前查看的书籍
const detailDesc = ref(null)                // 详情简介：null=加载中，''=无简介，非空=简介文本

let searchTimer = null                      // 防抖搜索定时器

// ---------- 工具函数 ----------

// 拼接封面 URL
function coverUrl(coverI, size) {
  return coverI ? COVER + coverI + '-' + size + '.jpg' : ''
}

// Open Library 语言代码 → 本地化名称
function langName(code) {
  const e = LANG_NAMES[code]
  return e ? e[i18nState.lang] : code
}

// 建议词展示文案
function suggestionLabel(s) {
  return (SUGGESTION_LABELS[s] && SUGGESTION_LABELS[s][i18nState.lang]) || s
}

// 卡片 aria-label
function cardAriaLabel(book) {
  const author = (book.author_name && book.author_name[0]) ? book.author_name[0] : t.value('unknownAuthor')
  return (book.title || '') + ' ' + t.value('by') + ' ' + author
}

// 详情作者名
function detailAuthor(b) {
  return (b.author_name && b.author_name[0]) ? b.author_name[0] : t.value('unknownAuthor')
}

// 作者照片 URL
function authorPhoto(b) {
  const k = (b.author_key && b.author_key[0]) || ''
  return k ? 'https://covers.openlibrary.org/a/olid/' + k + '-M.jpg' : ''
}

// Open Library 作品页链接
function openLink(b) {
  return b.key ? 'https://openlibrary.org' + b.key : ''
}

// 提取简介文本（Open Library 的 description 可能是字符串或对象）
function extractDescription(d) {
  if (!d) return ''
  if (typeof d === 'string') return d
  if (d.value) return d.value
  return ''
}

// 图片加载失败时移除元素（替代原内联 onerror）
function onImgError(e) {
  e.target.remove()
}

// ---------- computed ----------

// 结果计数文本
const resultCountText = computed(() => {
  if (lastResults.value === null) return ''
  return totalFound.value + ' ' + t.value('results')
})

// 是否显示加载状态
const showLoading = computed(() => isLoading.value)

// 是否显示错误状态
const showError = computed(() => error.value)

// 是否显示空结果
const showEmpty = computed(
  () => !isLoading.value && !error.value && lastResults.value !== null && lastResults.value.length === 0,
)

// 是否显示热门建议（搜索后隐藏）
const showSuggestions = computed(() => !hasSearched.value)

// 是否显示"加载更多"
const showLoadMore = computed(
  () =>
    hasSearched.value &&
    !isLoading.value &&
    !error.value &&
    lastResults.value !== null &&
    lastResults.value.length > 0 &&
    lastResults.value.length < totalFound.value &&
    !endReached.value,
)

// 是否显示"已到末尾"
const showEndText = computed(
  () => endReached.value && lastResults.value !== null && lastResults.value.length > 0,
)

// 详情元信息行
const detailRows = computed(() => {
  if (!detailBook.value) return []
  const b = detailBook.value
  const rows = []
  if (b.first_publish_year) rows.push({ label: t.value('firstPublished'), value: b.first_publish_year })
  const publishers = (b.publisher && b.publisher.slice(0, 3).join(', ')) || ''
  if (publishers) rows.push({ label: t.value('publisher'), value: publishers })
  if (b.number_of_pages_median) rows.push({ label: t.value('pages'), value: b.number_of_pages_median })
  if (b.isbn && b.isbn[0]) rows.push({ label: t.value('isbn'), value: b.isbn[0] })
  const langs = (b.language && b.language.slice(0, 3).map(langName).join(', ')) || ''
  if (langs) rows.push({ label: t.value('language'), value: langs })
  return rows
})

// 详情主题标签
const detailSubjects = computed(() => {
  if (!detailBook.value) return []
  return (detailBook.value.subject || []).slice(0, 8)
})

// ---------- 搜索 ----------

// 防抖触发搜索
function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => doSearch(true), 300)
}

// 输入框回车：立即搜索
function onEnter() {
  clearTimeout(searchTimer)
  doSearch(true)
}

// 执行搜索
function doSearch(reset = true) {
  clearTimeout(searchTimer)
  const q = query.value.trim()
  if (!q) return
  if (isLoading.value) return

  if (reset) {
    currentPage.value = 1
    lastResults.value = null
  }
  currentQuery.value = q
  isLoading.value = true
  error.value = false
  endReached.value = false
  hasSearched.value = true

  const url = API + '?q=' + encodeURIComponent(q) + '&limit=' + PAGE + '&page=' + currentPage.value

  fetchJSON(url)
    .then((data) => {
      totalFound.value = data.numFound || 0
      lastResults.value = data.docs || []
    })
    .catch(() => {
      error.value = true
      lastResults.value = null
    })
    .then(() => {
      isLoading.value = false
    })
}

// 加载更多
function loadMore() {
  if (loadingMore.value || isLoading.value || !currentQuery.value) return
  currentPage.value += 1
  loadingMore.value = true

  const url =
    API +
    '?q=' +
    encodeURIComponent(currentQuery.value) +
    '&limit=' +
    PAGE +
    '&page=' +
    currentPage.value

  fetchJSON(url)
    .then((data) => {
      const docs = data.docs || []
      if (!docs.length) {
        endReached.value = true
        return
      }
      lastResults.value = (lastResults.value || []).concat(docs)
      if (lastResults.value.length >= totalFound.value) {
        endReached.value = true
      }
    })
    .catch(() => {
      // 加载更多失败时恢复按钮，便于重试
    })
    .then(() => {
      loadingMore.value = false
    })
}

// 点击建议词
function pickSuggestion(s) {
  query.value = s
  doSearch(true)
}

// ---------- 详情面板 ----------

function openDetail(key) {
  // 从已保存结果中查找该书
  const book = (lastResults.value || []).find((b) => b.key === key) || null
  detailBook.value = book
  detailDesc.value = null
  drawerOpen.value = true
  document.body.style.overflow = 'hidden'

  if (!book) return

  // 异步拉取作品详情（简介等）
  fetchJSON(WORKS + book.key + '.json')
    .then((work) => {
      detailDesc.value = extractDescription(work.description) || ''
    })
    .catch(() => {
      detailDesc.value = ''
    })
}

function closeDrawer() {
  drawerOpen.value = false
  document.body.style.overflow = ''
}

// 卡片键盘事件：Enter / Space 触发详情
function onCardKeydown(e, key) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openDetail(key)
  }
}

// 文档级键盘事件：Escape 关闭抽屉
function onDocKeydown(e) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}

// ---------- 生命周期 ----------

// 输入变化时防抖搜索
watch(query, () => scheduleSearch())

onMounted(() => {
  document.addEventListener('keydown', onDocKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  clearTimeout(searchTimer)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="book-finder-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索区 -->
      <section class="search" aria-label="Search books">
        <div class="search-row">
          <input
            v-model="query"
            type="search"
            class="search-input"
            :aria-label="t('search')"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            @keydown.enter.prevent="onEnter"
          />
          <button class="search-btn" type="button" @click="doSearch(true)">{{ t('search') }}</button>
        </div>
        <p class="result-count" aria-live="polite">{{ resultCountText }}</p>
      </section>

      <!-- 热门搜索建议 -->
      <section v-if="showSuggestions" class="suggestions" aria-label="Popular searches">
        <p class="suggestions-title">{{ t('suggestionsTitle') }}</p>
        <div class="chips">
          <button
            v-for="s in SUGGESTIONS"
            :key="s"
            class="chip"
            type="button"
            :aria-label="suggestionLabel(s)"
            @click="pickSuggestion(s)"
          >{{ suggestionLabel(s) }}</button>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="showLoading" class="state loading">
        <div class="spinner" aria-hidden="true"></div>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 错误状态 -->
      <div v-if="showError" class="state error">
        <p>{{ t('error') }}</p>
        <button class="btn-ghost" type="button" @click="doSearch(true)">{{ t('tryAgain') }}</button>
      </div>

      <!-- 结果网格 -->
      <section
        v-if="lastResults && lastResults.length"
        class="grid"
        aria-label="Search results"
      >
        <article
          v-for="(book, index) in lastResults"
          :key="book.key || ('b-' + index)"
          class="card"
          tabindex="0"
          role="button"
          :aria-label="cardAriaLabel(book)"
          @click="openDetail(book.key)"
          @keydown="onCardKeydown($event, book.key)"
        >
          <div class="cover">
            <img
              v-if="coverUrl(book.cover_i, 'M')"
              :src="coverUrl(book.cover_i, 'M')"
              :alt="book.title || ''"
              loading="lazy"
              @error="onImgError"
            />
            <div class="cover-placeholder" aria-hidden="true"></div>
          </div>
          <div class="card-meta">
            <h3 class="card-title">{{ book.title || '' }}</h3>
            <p class="card-author">{{
              book.author_name && book.author_name[0] ? book.author_name[0] : t('unknownAuthor')
            }}</p>
            <p v-if="book.first_publish_year" class="card-year">{{ book.first_publish_year }}</p>
          </div>
        </article>
      </section>

      <!-- 空结果 -->
      <div v-if="showEmpty" class="state empty">
        <div class="empty-icon" aria-hidden="true"></div>
        <p>{{ t('noResults') }}</p>
      </div>

      <!-- 加载更多 -->
      <div v-if="showLoadMore" class="load-more">
        <button class="btn-ghost" type="button" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? t('loadingMore') : t('loadMore') }}
        </button>
      </div>

      <!-- 已显示全部结果 -->
      <div v-if="showEndText" class="load-more">
        <p class="end-text">{{ t('endOfResults') }}</p>
      </div>
    </main>

    <!-- 详情抽屉（侧边滑出面板） -->
    <aside
      class="drawer"
      :class="{ open: drawerOpen }"
      :aria-hidden="drawerOpen ? 'false' : 'true'"
      aria-label="Book details"
    >
      <div class="drawer-backdrop" @click="closeDrawer"></div>
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
        <button class="drawer-close" type="button" aria-label="Close details" @click="closeDrawer">×</button>
        <div class="drawer-body">
          <!-- 未找到书籍：仅显示加载态 -->
          <div v-if="!detailBook" class="detail-loading">
            <div class="spinner"></div>
            <p>{{ t('loadingDetails') }}</p>
          </div>

          <template v-else>
            <div class="detail-head">
              <div class="detail-cover">
                <img
                  v-if="coverUrl(detailBook.cover_i, 'L')"
                  :src="coverUrl(detailBook.cover_i, 'L')"
                  :alt="detailBook.title || ''"
                  @error="onImgError"
                />
                <div class="cover-placeholder large" aria-hidden="true"></div>
              </div>
              <div class="detail-titles">
                <h2 id="detailTitle" class="detail-title">{{ detailBook.title || '' }}</h2>
                <div class="detail-author">
                  <img
                    v-if="authorPhoto(detailBook)"
                    class="author-photo"
                    :src="authorPhoto(detailBook)"
                    alt=""
                    @error="onImgError"
                  />
                  <span>{{ t('by') }} {{ detailAuthor(detailBook) }}</span>
                </div>
                <div v-if="detailRows.length" class="detail-rows">
                  <div v-for="(row, i) in detailRows" :key="i" class="detail-row">
                    <span class="detail-label">{{ row.label }}</span>
                    <span>{{ row.value }}</span>
                  </div>
                </div>
                <a
                  v-if="openLink(detailBook)"
                  class="detail-link"
                  :href="openLink(detailBook)"
                  target="_blank"
                  rel="noreferrer"
                >{{ t('viewOnOpenLibrary') }} ↗</a>
              </div>
            </div>

            <div class="detail-section">
              <h3 class="detail-h">{{ t('description') }}</h3>
              <div id="detailDescription">
                <div v-if="detailDesc === null" class="detail-loading">
                  <div class="spinner small"></div>
                </div>
                <p v-else-if="detailDesc">{{ detailDesc }}</p>
                <p v-else class="muted">{{ t('noDescription') }}</p>
              </div>
            </div>

            <div v-if="detailSubjects.length" class="detail-section">
              <h3 class="detail-h">{{ t('subjects') }}</h3>
              <div class="detail-subjects">
                <span v-for="(s, i) in detailSubjects" :key="i" class="subject-tag">{{ s }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </aside>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Book Finder — 浅色暖色调主题（图书馆 / 书卷感）
   原 :root 变量迁移到组件根类 .book-finder-app，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.book-finder-app {
  --bg: #faf7f2;
  --panel: #ffffff;
  --line: #e5ddd0;
  --text: #2c2418;
  --muted: #7a6f5d;
  --accent: #b45309;
  --accent-soft: #fef3c7;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);
  color-scheme: light;

  /* 本 app 专用 token */
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  --sans: "Inter", system-ui, -apple-system, sans-serif;
  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 1px 2px rgba(44, 36, 24, 0.04), 0 4px 14px rgba(44, 36, 24, 0.06);
  --shadow-hover: 0 2px 6px rgba(44, 36, 24, 0.08), 0 10px 28px rgba(44, 36, 24, 0.12);

  min-height: 100vh;
  margin: 0;
  font-family: var(--sans);
  color: var(--text);
  background:
    radial-gradient(circle at 12% -10%, rgba(180, 83, 9, 0.06), transparent 40%),
    radial-gradient(circle at 100% 0%, rgba(180, 83, 9, 0.04), transparent 35%),
    var(--bg);
  -webkit-font-smoothing: antialiased;
}

.book-finder-app * { box-sizing: border-box; }

.book-finder-app a { color: var(--accent); text-decoration: none; }
.book-finder-app a:hover { text-decoration: underline; }
.book-finder-app h1, .book-finder-app h2, .book-finder-app h3,
.book-finder-app p, .book-finder-app strong, .book-finder-app span,
.book-finder-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1080px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  padding: 0.4rem 0 1.1rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-family: var(--serif);
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
  font-weight: 700;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 52ch;
}

/* ---------- 搜索区 ---------- */
.search { margin-top: 1.1rem; }

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  font: inherit;
  height: 2.7rem;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input::placeholder { color: var(--muted); }

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-btn {
  font: inherit;
  height: 2.7rem;
  padding: 0 1.3rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  transition: background 0.15s;
}

.search-btn:hover { background: #974507; }

.result-count {
  margin-top: 0.6rem;
  font-size: 0.8rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

/* ---------- 热门建议 ---------- */
.suggestions {
  margin-top: 1.4rem;
  padding: 1.1rem 1.2rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.suggestions-title {
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.7rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  font: inherit;
  height: 2rem;
  padding: 0 0.85rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.82rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

/* ---------- 通用按钮 ---------- */
.btn-ghost {
  font: inherit;
  height: 2.4rem;
  padding: 0 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: border-color 0.15s, color 0.15s;
}

.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-ghost:disabled { opacity: 0.5; cursor: default; }

/* ---------- 状态提示 ---------- */
.state {
  margin-top: 1.4rem;
  padding: 1.6rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
}

.state.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
}

.state.error {
  background: #fef2f2;
  border: 1px solid rgba(180, 30, 30, 0.18);
  border-radius: var(--radius-sm);
  color: #9a2424;
}

.state.error p { margin-bottom: 0.7rem; }

.state.empty p { margin-top: 0.8rem; }

.empty-icon {
  width: 46px;
  height: 62px;
  margin: 0 auto;
  border: 2px solid var(--line);
  border-left: 9px solid var(--line);
  border-radius: 1px 4px 4px 1px;
  background: var(--panel);
  opacity: 0.7;
}

/* 旋转加载圈 */
.spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: bf-spin 0.7s linear infinite;
}

.spinner.small { width: 0.9rem; height: 0.9rem; border-width: 2px; }

@keyframes bf-spin { to { transform: rotate(360deg); } }

/* ---------- 结果网格 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 1.1rem;
  margin-top: 1.4rem;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  display: flex;
  flex-direction: column;
}

.card:hover,
.card:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
  border-color: var(--accent);
  outline: none;
}

/* 封面区（含 CSS 占位书） */
.cover {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--accent-soft);
  overflow: hidden;
}

.cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 无封面时的 CSS 书本图标 */
.cover-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.cover-placeholder::before {
  content: "";
  width: 34px;
  height: 46px;
  border: 2px solid var(--accent);
  border-left: 7px solid var(--accent);
  border-radius: 1px 3px 3px 1px;
  background: var(--panel);
  opacity: 0.5;
}

.cover-placeholder.large::before {
  width: 64px;
  height: 88px;
  border-left-width: 13px;
  opacity: 0.6;
}

.card-meta {
  padding: 0.7rem 0.8rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.card-title {
  font-family: var(--serif);
  font-size: 0.98rem;
  line-height: 1.25;
  font-weight: 600;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-author {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-year {
  font-size: 0.72rem;
  color: var(--accent);
  letter-spacing: 0.02em;
  margin-top: 0.1rem;
}

/* ---------- 加载更多 ---------- */
.load-more {
  margin-top: 1.6rem;
  text-align: center;
}

.end-text {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--muted);
}

/* ---------- 详情抽屉 ---------- */
.drawer {
  position: fixed;
  inset: 0;
  z-index: 200;
  visibility: hidden;
  pointer-events: none;
}

.drawer.open { visibility: visible; pointer-events: auto; }

.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(44, 36, 24, 0.4);
  opacity: 0;
  transition: opacity 0.25s;
}

.drawer.open .drawer-backdrop { opacity: 1; }

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: min(460px, 92vw);
  background: var(--bg);
  box-shadow: -10px 0 40px rgba(44, 36, 24, 0.18);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
  display: flex;
  flex-direction: column;
}

.drawer.open .drawer-panel { transform: translateX(0); }

.drawer-close {
  position: absolute;
  top: 0.7rem;
  right: 0.8rem;
  z-index: 2;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--panel);
  color: var(--text);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.drawer-close:hover { border-color: var(--accent); color: var(--accent); }

.drawer-body {
  overflow-y: auto;
  padding: 1.6rem 1.5rem 2.5rem;
}

/* 详情头部 */
.detail-head {
  display: flex;
  gap: 1.1rem;
  align-items: flex-start;
}

.detail-cover {
  position: relative;
  width: 110px;
  flex-shrink: 0;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow);
  background: var(--accent-soft);
}

.detail-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-titles { flex: 1; min-width: 0; }

.detail-title {
  font-family: var(--serif);
  font-size: 1.5rem;
  line-height: 1.15;
  font-weight: 700;
  color: var(--text);
  padding-right: 1.5rem;
}

.detail-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.88rem;
  color: var(--muted);
}

.author-photo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--line);
  flex-shrink: 0;
}

.detail-rows {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.detail-label {
  flex-shrink: 0;
  width: 5.5rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.7rem;
  padding-top: 0.1rem;
}

.detail-row span:last-child { color: var(--text); word-break: break-word; }

.detail-link {
  display: inline-block;
  margin-top: 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent);
}

/* 详情分区 */
.detail-section { margin-top: 1.6rem; }

.detail-h {
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.55rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line);
}

#detailDescription p {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--text);
}

#detailDescription p.muted { color: var(--muted); font-style: italic; }

.detail-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.detail-subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.subject-tag {
  font-size: 0.74rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: flex-start; gap: 0.7rem; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.8rem; }
  .detail-head { flex-direction: column; }
  .detail-cover { width: 120px; }
  .detail-title { padding-right: 2rem; }
}

@media (max-width: 380px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}
</style>