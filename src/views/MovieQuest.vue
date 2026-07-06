<script setup>
/* ============================================================
   Movie Quest — 电影/剧集搜索器（Vue 3 SFC）
   数据源：OMDB (Open Movie Database) API，使用公开测试 key
   ============================================================ */

import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典 ---------- */
const copy = {
  en: {
    eyebrow: 'Cinema discovery',
    title: 'Movie Quest',
    lead: 'Search movies and TV shows, browse what\u2019s trending, and open any title for ratings, plot, and cast.',
    search: 'Search',
    searchPlaceholder: 'Search a movie or TV show\u2026',
    typeAll: 'All',
    typeMovie: 'Movies',
    typeSeries: 'TV',
    genreTitle: 'Filter trending',
    trendingTitle: 'Trending now',
    loadingTrending: 'Loading trending\u2026',
    loading: 'Searching\u2026',
    noResults: 'No results. Try another keyword.',
    error: 'Could not reach the movie database. Please try again.',
    tryAgain: 'Try again',
    loadMore: 'Load more',
    loadingMore: 'Loading\u2026',
    endOfResults: 'End of results',
    results: 'results',
    resultsTitle: 'Search results',
    movie: 'Movie',
    series: 'TV',
    episode: 'Episode',
    released: 'Released',
    runtime: 'Runtime',
    rated: 'Rated',
    director: 'Director',
    actors: 'Cast',
    country: 'Country',
    language: 'Language',
    production: 'Studio',
    awards: 'Awards',
    plot: 'Plot',
    noPlot: 'No plot available for this title.',
    votes: 'votes',
    loadingDetails: 'Loading details\u2026',
    noTrendingMatch: 'No trending titles match this genre.',
    seasons: 'Seasons'
  },
  zh: {
    eyebrow: '电影发现',
    title: '影视搜索',
    lead: '搜索电影和电视剧，浏览热门影片，点开任意条目查看评分、剧情与演职人员。',
    search: '搜索',
    searchPlaceholder: '搜索电影或电视剧…',
    typeAll: '全部',
    typeMovie: '电影',
    typeSeries: '剧集',
    genreTitle: '筛选热门',
    trendingTitle: '正在热映',
    loadingTrending: '正在加载热门…',
    loading: '正在搜索…',
    noResults: '没有找到相关结果，换个关键词试试。',
    error: '无法连接电影数据库，请稍后重试。',
    tryAgain: '重试',
    loadMore: '加载更多',
    loadingMore: '加载中…',
    endOfResults: '已显示全部结果',
    results: '条结果',
    resultsTitle: '搜索结果',
    movie: '电影',
    series: '剧集',
    episode: '单集',
    released: '上映日期',
    runtime: '时长',
    rated: '分级',
    director: '导演',
    actors: '主演',
    country: '国家/地区',
    language: '语言',
    production: '制作公司',
    awards: '获奖',
    plot: '剧情简介',
    noPlot: '暂无该条目的剧情简介。',
    votes: '人评价',
    loadingDetails: '正在加载详情…',
    noTrendingMatch: '当前类型下没有热门影片。',
    seasons: '季数'
  }
}

const t = useT(copy)

/* ---------- 配置 ---------- */
const API = 'https://www.omdbapi.com/'
const API_KEY = 'trilogy'   // 公开测试用 key

/* 热门电影 imdbID 列表（用于初始轮播，逐个拉取详情以获得评分/类型） */
const TRENDING_IDS = [
  'tt0111161', // The Shawshank Redemption
  'tt0468569', // The Dark Knight
  'tt1375666', // Inception
  'tt0133093', // The Matrix
  'tt0109830', // Forrest Gump
  'tt0120737', // The Lord of the Rings: The Fellowship of the Ring
  'tt0816692', // Interstellar
  'tt0114369', // Se7en
  'tt0137523', // Fight Club
  'tt0167260', // The Lord of the Rings: The Return of the King
  'tt0903747', // Breaking Bad（剧集）
  'tt0944947'  // Game of Thrones（剧集）
]

/* 类型筛选定义（match 用于匹配 OMDB 的 Genre 字段） */
const GENRES = [
  { key: 'all',       en: 'All',       zh: '全部', match: null },
  { key: 'action',    en: 'Action',    zh: '动作', match: /action/i },
  { key: 'comedy',    en: 'Comedy',    zh: '喜剧', match: /comedy/i },
  { key: 'scifi',     en: 'Sci-Fi',    zh: '科幻', match: /sci-?fi|science fiction/i },
  { key: 'horror',    en: 'Horror',    zh: '恐怖', match: /horror|thriller/i },
  { key: 'romance',   en: 'Romance',   zh: '爱情', match: /romance/i },
  { key: 'animation', en: 'Animation', zh: '动画', match: /animation/i },
  { key: 'drama',     en: 'Drama',     zh: '剧情', match: /drama/i },
  { key: 'crime',     en: 'Crime',     zh: '犯罪', match: /crime/i }
]

/* ---------- 状态 ---------- */
const query = ref('')                // 搜索输入
const currentQuery = ref('')         // 当前实际搜索词
const currentPage = ref(1)           // 当前页码
const currentType = ref('all')       // 搜索媒体类型：all / movie / series
const totalFound = ref(0)            // 搜索结果总数
const lastResults = ref(null)        // 最近一次搜索结果（null = 尚未搜索）
const isLoading = ref(false)         // 搜索加载中（同时充当 loadMore 互斥锁）
const loadingMore = ref(false)       // 加载更多中
const error = ref(false)             // 是否出错
const endReached = ref(false)        // 是否已加载到末尾

const trendingMovies = ref([])       // 热门完整详情列表
const trendingLoading = ref(false)   // 热门加载中
const activeGenre = ref('all')       // 当前选中的类型筛选

const ratings = reactive({})         // imdbID -> 评分（搜索卡片懒加载）
const detailCache = {}               // imdbID -> 详情（非响应式缓存）
const detail = ref(null)             // 当前模态框详情数据
const detailLoading = ref(false)     // 详情加载骨架
const detailError = ref('')          // 详情错误状态：'' | 'noPlot' | 'error'
const modalOpen = ref(false)         // 模态框是否打开

let searchTimer = null               // 防抖搜索定时器

/* ---------- 工具函数 ---------- */

/* 判断字段是否有效（OMDB 大量返回 "N/A"） */
function valid(v) {
  return v != null && v !== '' && v !== 'N/A'
}

/* 媒体类型本地化标签 */
function typeLabel(type) {
  if (type === 'series') return t.value('series')
  if (type === 'episode') return t.value('episode')
  return t.value('movie')
}

/* 类型筛选标签（按当前语言） */
function genreLabel(g) {
  return g[i18nState.lang] || g.en
}

/* 判断电影是否匹配当前选中的类型 */
function matchesGenre(movie, genreKey) {
  if (genreKey === 'all') return true
  const g = GENRES.find((x) => x.key === genreKey)
  if (!g || !g.match) return true
  return g.match.test(movie.Genre || '')
}

/* 图片加载失败时移除元素（替代原内联 onerror） */
function onImgError(e) {
  e.target.remove()
}

/* ---------- 派生状态 ---------- */

/* 热门列表按当前类型筛选 */
const filteredTrending = computed(() =>
  trendingMovies.value.filter((m) => matchesGenre(m, activeGenre.value))
)

/* 结果计数文本 */
const resultCountText = computed(() => {
  if (lastResults.value === null) return ''
  return totalFound.value + ' ' + t.value('results')
})

/* 是否展示热门视图（搜索框为空且未出错） */
const showTrendingView = computed(() => !currentQuery.value && !error.value)

/* 是否展示搜索结果区（已发起搜索） */
const showResultsSection = computed(() => !!currentQuery.value)

/* 大加载圈：仅在首次/重置搜索时显示，加载更多时不显示 */
const showLoading = computed(() => isLoading.value && !loadingMore.value)

const showError = computed(() => error.value)

const showEmpty = computed(
  () => !isLoading.value && !error.value && lastResults.value !== null && lastResults.value.length === 0
)

/* 是否显示“加载更多” */
const showLoadMore = computed(
  () =>
    !!lastResults.value &&
    lastResults.value.length > 0 &&
    lastResults.value.length < totalFound.value &&
    !endReached.value &&
    !error.value
)

/* 是否显示“已到末尾” */
const showEndText = computed(
  () => endReached.value && !!lastResults.value && lastResults.value.length > 0
)

/* 详情元信息行 */
const detailRows = computed(() => {
  const d = detail.value
  if (!d) return []
  const rows = []
  if (valid(d.Released)) rows.push({ label: t.value('released'), value: d.Released })
  if (valid(d.Runtime)) rows.push({ label: t.value('runtime'), value: d.Runtime })
  if (valid(d.Rated)) rows.push({ label: t.value('rated'), value: d.Rated })
  if (valid(d.totalSeasons)) rows.push({ label: t.value('seasons'), value: d.totalSeasons })
  if (valid(d.Director)) rows.push({ label: t.value('director'), value: d.Director })
  if (valid(d.Actors)) rows.push({ label: t.value('actors'), value: d.Actors })
  if (valid(d.Country)) rows.push({ label: t.value('country'), value: d.Country })
  if (valid(d.Language)) rows.push({ label: t.value('language'), value: d.Language })
  if (valid(d.Production)) rows.push({ label: t.value('production'), value: d.Production })
  if (valid(d.Awards)) rows.push({ label: t.value('awards'), value: d.Awards })
  return rows
})

/* 详情类型标签列表 */
const detailGenres = computed(() => {
  const d = detail.value
  if (!d || !valid(d.Genre)) return []
  return d.Genre.split(',').map((g) => g.trim()).filter(Boolean)
})

/* ---------- 热门轮播 ---------- */
function loadTrending() {
  trendingLoading.value = true
  trendingMovies.value = []
  /* 逐个拉取详情，单个失败不影响整体 */
  const promises = TRENDING_IDS.map((id) =>
    fetchJSON(API + '?i=' + id + '&apikey=' + API_KEY + '&plot=short')
      .then((d) => (d && d.Response !== 'False') ? d : null)
      .catch(() => null)
  )
  Promise.all(promises).then((list) => {
    trendingMovies.value = list.filter((m) => m)
    trendingLoading.value = false
  })
}

function setActiveGenre(key) {
  activeGenre.value = key
}

/* ---------- 搜索 ---------- */

/* 防抖触发搜索 */
function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => doSearch(true), 300)
}

/* 输入框回车：立即搜索 */
function onEnter() {
  clearTimeout(searchTimer)
  doSearch(true)
}

/* 执行搜索 */
function doSearch(reset = true) {
  const q = query.value.trim()
  /* 输入为空时恢复热门视图 */
  if (!q) {
    restoreTrendingView()
    return
  }
  if (isLoading.value) return

  if (reset) {
    currentPage.value = 1
    lastResults.value = null
  }

  currentQuery.value = q
  isLoading.value = true
  error.value = false
  endReached.value = false

  const typeParam = currentType.value && currentType.value !== 'all' ? '&type=' + currentType.value : ''
  const url = API + '?s=' + encodeURIComponent(q) + '&apikey=' + API_KEY +
    '&page=' + currentPage.value + typeParam

  fetchJSON(url)
    .then((data) => {
      if (data.Response === 'False') {
        totalFound.value = 0
        lastResults.value = []
      } else {
        totalFound.value = parseInt(data.totalResults || '0', 10)
        lastResults.value = data.Search || []
      }
    })
    .catch(() => {
      error.value = true
    })
    .then(() => {
      isLoading.value = false
    })
}

/* 恢复热门视图（搜索框清空时） */
function restoreTrendingView() {
  currentQuery.value = ''
  lastResults.value = null
  error.value = false
  endReached.value = false
}

/* 加载更多 */
function loadMore() {
  if (isLoading.value || !currentQuery.value) return
  currentPage.value += 1
  isLoading.value = true
  loadingMore.value = true

  const typeParam = currentType.value && currentType.value !== 'all' ? '&type=' + currentType.value : ''
  const url = API + '?s=' + encodeURIComponent(currentQuery.value) + '&apikey=' + API_KEY +
    '&page=' + currentPage.value + typeParam

  fetchJSON(url)
    .then((data) => {
      if (data.Response === 'False') {
        endReached.value = true
      } else {
        const items = data.Search || []
        lastResults.value = (lastResults.value || []).concat(items)
        if (lastResults.value.length >= totalFound.value) {
          endReached.value = true
        }
      }
    })
    .catch(() => {
      /* 加载更多失败时恢复按钮，便于重试 */
    })
    .then(() => {
      isLoading.value = false
      loadingMore.value = false
    })
}

/* 媒体类型切换 */
function setType(type) {
  currentType.value = type
  /* 若当前已有查询，则按新类型重新搜索 */
  if (query.value.trim()) doSearch(true)
}

/* 错误重试：若已有查询则重新搜索，否则重载热门 */
function retry() {
  if (currentQuery.value) doSearch(true)
  else { error.value = false; loadTrending() }
}

/* ---------- 评分懒加载 ---------- */
function fetchRatingForCard(imdbID) {
  if (imdbID in ratings) return
  fetchJSON(API + '?i=' + imdbID + '&apikey=' + API_KEY + '&plot=short')
    .then((d) => {
      if (!d || d.Response === 'False') return
      detailCache[imdbID] = d
      ratings[imdbID] = valid(d.imdbRating) ? d.imdbRating : ''
    })
    .catch(() => { /* 评分加载失败时静默，徽章保持隐藏 */ })
}

/* ---------- 详情模态框 ---------- */
function openDetail(imdbID) {
  modalOpen.value = true
  document.body.style.overflow = 'hidden'
  detailError.value = ''

  /* 命中缓存则先渲染，再后台刷新完整剧情 */
  if (detailCache[imdbID]) {
    detail.value = detailCache[imdbID]
    detailLoading.value = false
  } else {
    detail.value = null
    detailLoading.value = true
  }

  fetchJSON(API + '?i=' + imdbID + '&apikey=' + API_KEY + '&plot=full')
    .then((d) => {
      if (d && d.Response !== 'False') {
        detailCache[imdbID] = d
        detail.value = d
        detailLoading.value = false
      } else {
        detail.value = null
        detailLoading.value = false
        detailError.value = 'noPlot'
      }
    })
    .catch(() => {
      detail.value = null
      detailLoading.value = false
      detailError.value = 'error'
    })
}

function closeModal() {
  modalOpen.value = false
  document.body.style.overflow = ''
}

/* 卡片键盘事件：Enter / Space 触发详情 */
function onCardKeydown(e, id) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openDetail(id)
  }
}

/* 文档级键盘事件：Escape 关闭模态框 */
function onDocKeydown(e) {
  if (e.key === 'Escape' && modalOpen.value) closeModal()
}

/* ---------- 副作用 ---------- */
// 输入变化时防抖搜索
watch(query, () => scheduleSearch())

// 搜索结果变化时为每张卡片懒加载评分
watch(lastResults, (items) => {
  if (!items) return
  items.forEach((item) => {
    if (item.imdbID) fetchRatingForCard(item.imdbID)
  })
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  document.addEventListener('keydown', onDocKeydown)
  loadTrending()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  clearTimeout(searchTimer)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="movie-quest-app">
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索区 -->
      <section class="search" aria-label="Search movies and TV">
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
        <!-- 媒体类型切换（全部 / 电影 / 剧集） -->
        <div class="type-toggle" role="group" aria-label="Media type">
          <button class="type-btn" :class="{ active: currentType === 'all' }" type="button" @click="setType('all')">{{ t('typeAll') }}</button>
          <button class="type-btn" :class="{ active: currentType === 'movie' }" type="button" @click="setType('movie')">{{ t('typeMovie') }}</button>
          <button class="type-btn" :class="{ active: currentType === 'series' }" type="button" @click="setType('series')">{{ t('typeSeries') }}</button>
        </div>
        <p class="result-count" aria-live="polite">{{ resultCountText }}</p>
      </section>

      <!-- 类型筛选（作用于热门轮播） -->
      <section v-if="showTrendingView" class="genre-filter" aria-label="Filter trending by genre">
        <p class="filter-title">{{ t('genreTitle') }}</p>
        <div class="chips">
          <button
            v-for="g in GENRES"
            :key="g.key"
            class="chip"
            :class="{ active: activeGenre === g.key }"
            type="button"
            :aria-pressed="activeGenre === g.key ? 'true' : 'false'"
            :aria-label="genreLabel(g)"
            @click="setActiveGenre(g.key)"
          >{{ genreLabel(g) }}</button>
        </div>
      </section>

      <!-- 热门轮播 -->
      <section v-if="showTrendingView" class="trending" aria-label="Trending movies">
        <h2 class="section-title">{{ t('trendingTitle') }}</h2>
        <div v-if="trendingLoading" class="state loading">
          <div class="spinner" aria-hidden="true"></div>
          <span>{{ t('loadingTrending') }}</span>
        </div>
        <p v-else-if="!filteredTrending.length" class="trending-empty">{{ t('noTrendingMatch') }}</p>
        <div v-else class="trending-row">
          <article
            v-for="m in filteredTrending"
            :key="m.imdbID"
            class="card"
            tabindex="0"
            role="button"
            :aria-label="(m.Title || '') + (m.Year ? ' ' + m.Year : '')"
            @click="openDetail(m.imdbID)"
            @keydown="onCardKeydown($event, m.imdbID)"
          >
            <div class="poster">
              <div class="poster-placeholder" aria-hidden="true"></div>
              <img v-if="valid(m.Poster)" :src="m.Poster" :alt="m.Title || ''" loading="lazy" @error="onImgError" />
              <span v-if="valid(m.imdbRating)" class="rating-badge">★ {{ m.imdbRating }}</span>
              <span class="type-badge">{{ typeLabel(m.Type) }}</span>
            </div>
            <div class="card-meta">
              <h3 class="card-title">{{ m.Title || '' }}</h3>
              <p v-if="m.Year" class="card-year">{{ m.Year }}</p>
            </div>
          </article>
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
        <button class="btn-ghost" type="button" @click="retry">{{ t('tryAgain') }}</button>
      </div>

      <!-- 搜索结果网格 -->
      <section v-if="showResultsSection" class="results-section">
        <h2 class="section-title">{{ t('resultsTitle') }}</h2>
        <div v-if="lastResults && lastResults.length" class="grid" aria-label="Search results">
          <article
            v-for="(item, i) in lastResults"
            :key="item.imdbID || ('r-' + i)"
            class="card"
            tabindex="0"
            role="button"
            :aria-label="(item.Title || '') + (item.Year ? ' ' + item.Year : '')"
            @click="openDetail(item.imdbID)"
            @keydown="onCardKeydown($event, item.imdbID)"
          >
            <div class="poster">
              <div class="poster-placeholder" aria-hidden="true"></div>
              <img v-if="valid(item.Poster)" :src="item.Poster" :alt="item.Title || ''" loading="lazy" @error="onImgError" />
              <span class="rating-badge" :class="{ 'rating-pending': !ratings[item.imdbID] }">★ {{ ratings[item.imdbID] || '' }}</span>
              <span class="type-badge">{{ typeLabel(item.Type) }}</span>
            </div>
            <div class="card-meta">
              <h3 class="card-title">{{ item.Title || '' }}</h3>
              <p v-if="item.Year" class="card-year">{{ item.Year }}</p>
            </div>
          </article>
        </div>
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

    <!-- 详情模态框 -->
    <div
      class="modal"
      :class="{ open: modalOpen }"
      :aria-hidden="modalOpen ? 'false' : 'true'"
      aria-label="Title details"
    >
      <div class="modal-backdrop" @click="closeModal"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
        <button class="modal-close" type="button" aria-label="Close details" @click="closeModal">×</button>
        <div class="modal-body">
          <!-- 加载骨架 -->
          <div v-if="detailLoading" class="detail-loading">
            <div class="spinner"></div>
            <p>{{ t('loadingDetails') }}</p>
          </div>

          <!-- 详情内容 -->
          <template v-else-if="detail">
            <div class="detail-head">
              <div class="detail-poster">
                <div class="poster-placeholder large" aria-hidden="true"></div>
                <img v-if="valid(detail.Poster)" :src="detail.Poster" :alt="detail.Title || ''" @error="onImgError" />
              </div>
              <div class="detail-info">
                <h2 id="detailTitle" class="detail-title">{{ detail.Title || '' }}</h2>
                <p v-if="detail.Year" class="detail-year">{{ detail.Year }}</p>
                <div v-if="valid(detail.imdbRating)" class="detail-rating">
                  <span class="star">★</span>
                  <span class="rating-num">{{ detail.imdbRating }}</span>
                  <span class="rating-max">/10</span>
                  <span v-if="valid(detail.imdbVotes)" class="rating-votes">{{ detail.imdbVotes }} {{ t('votes') }}</span>
                </div>
                <span v-if="valid(detail.Metascore)" class="metascore">
                  <span class="ms-label">Metascore</span>
                  <span class="ms-val">{{ detail.Metascore }}</span>
                </span>
                <div v-if="detailGenres.length" class="detail-genres">
                  <span v-for="(g, i) in detailGenres" :key="i" class="genre-tag">{{ g }}</span>
                </div>
              </div>
            </div>

            <div v-if="detailRows.length" class="detail-rows">
              <div v-for="(row, i) in detailRows" :key="i" class="detail-row">
                <span class="detail-label">{{ row.label }}</span>
                <span class="detail-value">{{ row.value }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3 class="detail-h">{{ t('plot') }}</h3>
              <p v-if="valid(detail.Plot)" class="detail-plot">{{ detail.Plot }}</p>
              <p v-else class="detail-plot muted">{{ t('noPlot') }}</p>
            </div>
          </template>

          <!-- 详情错误 / 无剧情 -->
          <p v-else class="detail-plot muted">{{ detailError === 'noPlot' ? t('noPlot') : t('error') }}</p>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Movie Quest — 深色电影主题（深蓝/黑底 + 红色强调 + 金色评分）
   原 :root 变量迁移到组件根类 .movie-quest-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.movie-quest-app {
  --bg: #0f0f1a;
  --panel: #1a1a2e;
  --line: rgba(255,255,255,0.08);
  --text: #e8e8f0;
  --muted: #8888a0;
  --accent: #e94560;
  --accent-soft: rgba(233,69,96,0.12);
  --gold: #f5c518;
  --green: #46d369;

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
  --ok-topbar-line: var(--line);
  color-scheme: dark;

  /* 本 app 专用 token */
  --sans: "Inter", system-ui, -apple-system, sans-serif;
  --display: "Poppins", "Inter", system-ui, sans-serif;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 2px 8px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.28);
  --shadow-hover: 0 4px 14px rgba(0,0,0,0.45), 0 18px 44px rgba(0,0,0,0.5);

  margin: 0;
  font-family: var(--sans);
  color: var(--text);
  /* 深空背景：红色辉光 + 深蓝渐变 */
  background:
    radial-gradient(circle at 85% -5%, rgba(233,69,96,0.16), transparent 42%),
    radial-gradient(circle at 0% 0%, rgba(70,90,200,0.12), transparent 40%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.movie-quest-app * { box-sizing: border-box; }

.movie-quest-app a { color: var(--accent); text-decoration: none; }
.movie-quest-app a:hover { text-decoration: underline; }
.movie-quest-app h1, .movie-quest-app h2, .movie-quest-app h3,
.movie-quest-app p, .movie-quest-app strong, .movie-quest-app span,
.movie-quest-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1200px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  padding: 0.5rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-family: var(--display);
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
  font-weight: 800;
}

.lead {
  margin-top: 0.55rem;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 56ch;
}

/* ---------- 搜索区 ---------- */
.search { margin-top: 1.2rem; }

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  font: inherit;
  height: 2.8rem;
  padding: 0 1rem;
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
  height: 2.8rem;
  padding: 0 1.4rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  transition: background 0.15s, transform 0.1s;
}

.search-btn:hover { background: #d63851; }
.search-btn:active { transform: scale(0.98); }

/* 媒体类型切换 */
.type-toggle {
  display: inline-flex;
  margin-top: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.2rem;
  background: var(--panel);
}

.type-btn {
  font: inherit;
  height: 1.9rem;
  padding: 0 0.95rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}

.type-btn:hover { color: var(--text); }

.type-btn.active {
  background: var(--accent);
  color: #fff;
}

.result-count {
  margin-top: 0.7rem;
  font-size: 0.8rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

/* ---------- 类型筛选 ---------- */
.genre-filter {
  margin-top: 1.5rem;
}

.filter-title {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin-bottom: 0.6rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  font: inherit;
  height: 2rem;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* ---------- 区块标题 ---------- */
.section-title {
  font-family: var(--display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  margin-top: 1.8rem;
  margin-bottom: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 1.05rem;
  background: var(--accent);
  border-radius: 2px;
}

/* ---------- 热门轮播（横向滚动） ---------- */
.trending-row {
  display: flex;
  gap: 0.9rem;
  overflow-x: auto;
  padding: 0.3rem 0 0.9rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.trending-row::-webkit-scrollbar { height: 8px; }
.trending-row::-webkit-scrollbar-track { background: transparent; }
.trending-row::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 4px;
}
.trending-row::-webkit-scrollbar-thumb:hover { background: var(--muted); }

/* 轮播卡片固定宽度 */
.trending-row .card {
  flex: 0 0 150px;
  scroll-snap-align: start;
}

.trending-empty {
  color: var(--muted);
  font-size: 0.88rem;
  padding: 1rem 0;
}

/* ---------- 通用按钮 ---------- */
.btn-ghost {
  font: inherit;
  height: 2.4rem;
  padding: 0 1.2rem;
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
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.25);
  border-radius: var(--radius-sm);
  color: #ff8a8a;
}

.state.error p { margin-bottom: 0.7rem; }

.state.empty p { margin-top: 0.9rem; }

/* 空状态胶片图标 */
.empty-icon {
  width: 56px;
  height: 72px;
  margin: 0 auto;
  border-radius: 5px;
  background:
    repeating-linear-gradient(to right, transparent 0 7px, var(--bg) 7px 12px) top / 100% 10px no-repeat,
    repeating-linear-gradient(to right, transparent 0 7px, var(--bg) 7px 12px) bottom / 100% 10px no-repeat,
    var(--muted);
  opacity: 0.5;
}

/* 旋转加载圈 */
.spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: mq-spin 0.7s linear infinite;
}

.spinner.small { width: 0.9rem; height: 0.9rem; border-width: 2px; }

@keyframes mq-spin { to { transform: rotate(360deg); } }

/* ---------- 结果网格 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-top: 0.4rem;
}

/* ---------- 海报卡片 ---------- */
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
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
  border-color: var(--accent);
  outline: none;
}

/* 海报区 */
.poster {
  position: relative;
  aspect-ratio: 2 / 3;
  background: #14142a;
  overflow: hidden;
}

.poster img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 无海报时的 CSS 胶片图标 */
.poster-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.poster-placeholder::before {
  content: "";
  width: 46px;
  height: 60px;
  border-radius: 4px;
  /* 顶/底两条胶片齿孔条 + 中部胶片底色 */
  background:
    repeating-linear-gradient(to right, transparent 0 5px, var(--bg) 5px 9px) top / 100% 8px no-repeat,
    repeating-linear-gradient(to right, transparent 0 5px, var(--bg) 5px 9px) bottom / 100% 8px no-repeat,
    var(--muted);
  opacity: 0.45;
}

.poster-placeholder.large::before {
  width: 70px;
  height: 92px;
  opacity: 0.55;
}

/* 评分徽章（金色星标） */
.rating-badge {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  background: rgba(0,0,0,0.72);
  color: var(--gold);
  font-size: 0.74rem;
  font-weight: 700;
  border-radius: 999px;
  backdrop-filter: blur(4px);
  letter-spacing: 0.02em;
}

.rating-badge.rating-pending { display: none; }

/* 媒体类型徽章 */
.type-badge {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  padding: 0.18rem 0.5rem;
  background: rgba(0,0,0,0.72);
  color: var(--green);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.card-meta {
  padding: 0.65rem 0.75rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.card-title {
  font-size: 0.9rem;
  line-height: 1.25;
  font-weight: 600;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-year {
  font-size: 0.74rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

/* ---------- 加载更多 ---------- */
.load-more {
  margin-top: 1.8rem;
  text-align: center;
}

.end-text {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--muted);
}

/* ---------- 详情模态框 ---------- */
.modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  visibility: hidden;
  pointer-events: none;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.modal.open { visibility: visible; pointer-events: auto; }

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 5, 12, 0.78);
  opacity: 0;
  transition: opacity 0.25s;
  backdrop-filter: blur(3px);
}

.modal.open .modal-backdrop { opacity: 1; }

.modal-panel {
  position: relative;
  width: min(720px, 100%);
  max-height: 90vh;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  transform: translateY(12px) scale(0.98);
  opacity: 0;
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal.open .modal-panel {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.modal-close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  z-index: 3;
  width: 2.3rem;
  height: 2.3rem;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: var(--text);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.modal-close:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(0,0,0,0.75);
}

.modal-body {
  overflow-y: auto;
  padding: 1.5rem 1.5rem 2.2rem;
}

/* 详情头部 */
.detail-head {
  display: flex;
  gap: 1.2rem;
  align-items: flex-start;
}

.detail-poster {
  position: relative;
  width: 130px;
  flex-shrink: 0;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow);
  background: #14142a;
}

.detail-poster img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info { flex: 1; min-width: 0; }

.detail-title {
  font-family: var(--display);
  font-size: 1.55rem;
  line-height: 1.15;
  font-weight: 700;
  color: var(--text);
  padding-right: 2rem;
}

.detail-year {
  margin-top: 0.35rem;
  font-size: 0.88rem;
  color: var(--muted);
}

/* 评分行 */
.detail-rating {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin-top: 0.7rem;
}

.detail-rating .star { color: var(--gold); font-size: 1.05rem; }
.detail-rating .rating-num { font-size: 1.3rem; font-weight: 800; color: var(--gold); }
.detail-rating .rating-max { font-size: 0.8rem; color: var(--muted); }
.detail-rating .rating-votes {
  margin-left: 0.5rem;
  font-size: 0.76rem;
  color: var(--muted);
}

/* Metascore 徽章 */
.metascore {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.7rem;
  padding: 0.2rem 0.5rem;
  background: rgba(70,211,105,0.14);
  border: 1px solid rgba(70,211,105,0.3);
  border-radius: var(--radius-sm);
}

.metascore .ms-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.metascore .ms-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--green);
}

/* 类型标签 */
.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.85rem;
}

.genre-tag {
  font-size: 0.74rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255,255,255,0.03);
  color: var(--text);
}

/* 详情元信息行 */
.detail-rows {
  margin-top: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.detail-row {
  display: flex;
  gap: 0.7rem;
  font-size: 0.85rem;
  line-height: 1.45;
}

.detail-label {
  flex-shrink: 0;
  width: 5.5rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.7rem;
  padding-top: 0.12rem;
}

.detail-row .detail-value { color: var(--text); word-break: break-word; flex: 1; }

/* 详情分区 */
.detail-section { margin-top: 1.5rem; }

.detail-h {
  font-family: var(--display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.55rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--line);
}

.detail-plot {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text);
}

.detail-plot.muted { color: var(--muted); font-style: italic; }

.detail-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.88rem;
  padding: 2rem 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: flex-start; gap: 0.7rem; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 0.8rem; }
  .detail-head { flex-direction: column; align-items: stretch; }
  .detail-poster { width: 110px; }
  .detail-title { padding-right: 2rem; }
  .modal-body { padding: 1.2rem 1.1rem 1.8rem; }
}

@media (max-width: 380px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
  .trending-row .card { flex-basis: 130px; }
}
</style>
