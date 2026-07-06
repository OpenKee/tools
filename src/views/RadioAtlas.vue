<script setup>
/* ============================================================
   Radio Atlas — 全球电台探索器（Vue 3 SFC）
   数据来源：radio-browser.info 公共 API
   ============================================================ */

import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Global radio explorer', title: 'Radio Atlas',
    lead: 'Tune into live stations from every corner of the world.',
    search: 'Search', random: '🎲 Random', favorites: '⭐ Favorites',
    votes: 'votes', clicks: 'clicks', bitrate: 'kbps',
    play: 'Play', stop: 'Stop', noResults: 'No stations found.',
    loadMore: 'Scroll for more', end: 'End of results', loading: 'Loading stations...',
    nowPlaying: 'Now playing', favsTitle: 'Your favorites',
    removeFav: 'Remove', addFav: 'Save'
  },
  zh: {
    eyebrow: '全球电台探索器', title: 'Radio Atlas',
    lead: '收听世界各地的在线直播电台。',
    search: '搜索', random: '🎲 随机', favorites: '⭐ 收藏',
    votes: '票', clicks: '点击', bitrate: 'kbps',
    play: '播放', stop: '停止', noResults: '没有找到电台。',
    loadMore: '向下滚动加载更多', end: '已全部加载', loading: '加载电台中...',
    nowPlaying: '正在播放', favsTitle: '你的收藏',
    removeFav: '取消', addFav: '收藏'
  }
}
const t = useT(copy)

/* ---------- 常量 ---------- */
const API = 'https://de1.api.radio-browser.info/json'
const PAGE = 40
const FAVS_KEY = 'radio-favs'

/* ---------- 响应式状态 ---------- */
const country = ref('')        // 国家筛选
const tag = ref('')            // 流派筛选
const name = ref('')           // 电台名筛选
const stations = ref([])       // 当前展示的电台列表
const countries = ref([])      // 国家元数据（用于 datalist）
const tags = ref([])           // 流派元数据（用于 datalist）
const playing = ref(null)      // 正在播放的电台对象
const offset = ref(0)          // 分页偏移
const loading = ref(false)     // 加载中标记
const ended = ref(false)       // 已加载到末尾
const showingFavs = ref(false) // 当前是否在展示收藏
const showPlayer = ref(false)  // 是否显示底部播放器
const isAudioPlaying = ref(false) // 音频是否正在播放
const volume = ref(0.8)        // 音量
const initError = ref('')      // 初始化失败消息
const searchError = ref('')    // 搜索失败消息
const favVersion = ref(0)      // 收藏变更版本号（驱动 isFav 重算）

const audioEl = ref(null)      // <audio> 元素引用
const loadMoreEl = ref(null)   // 无限滚动哨兵元素引用

/* favicon 缓存：reactive 以便模板在 blob URL 就绪后响应式刷新 */
const faviconCache = reactive({})
const faviconStarted = new Set() // 已派发的 favicon 请求，避免重复抓取

/* toast 提示 */
const toast = reactive({ visible: false, msg: '' })
let toastTimer = null

let observer = null            // IntersectionObserver 实例

/* ---------- 收藏管理（localStorage 持久化） ---------- */
function getFavs() {
  try { return JSON.parse(lsGet(FAVS_KEY) || '[]') } catch { return [] }
}
function setFavs(f) { lsSet(FAVS_KEY, JSON.stringify(f)) }
function isFav(id) {
  // 读取版本号以建立响应式依赖，收藏切换时模板自动重算
  favVersion.value
  return getFavs().some(s => s.stationuuid === id)
}
function onToggleFav(station) {
  const f = getFavs()
  const idx = f.findIndex(s => s.stationuuid === station.stationuuid)
  if (idx >= 0) f.splice(idx, 1); else f.push(station)
  setFavs(f)
  favVersion.value++
}

/* ---------- favicon 抓取（带缓存，返回 blob URL） ---------- */
async function fetchFavicon(url) {
  const key = url.replace('http://', 'https://')
  try {
    const r = await fetch(key, { mode: 'cors' })
    if (!r.ok) { faviconCache[key] = ''; return '' }
    const blob = await r.blob()
    // 过小的响应通常是占位图，丢弃
    if (blob.size < 100) { faviconCache[key] = ''; return '' }
    const objUrl = URL.createObjectURL(blob)
    faviconCache[key] = objUrl
    return objUrl
  } catch {
    faviconCache[key] = ''
    return ''
  }
}
// 同步返回缓存中的 favicon URL；未缓存则触发异步抓取
function faviconFor(url) {
  const key = (url || '').replace('http://', 'https://')
  if (!key) return ''
  if (key in faviconCache) return faviconCache[key]
  if (!faviconStarted.has(key)) {
    faviconStarted.add(key)
    fetchFavicon(url)
  }
  return ''
}

/* ---------- 标签解析（取前 3 个） ---------- */
function parseTags(tagsStr) {
  return (tagsStr || '').split(',').filter(Boolean).map(s => s.trim()).slice(0, 3)
}

/* ---------- 派生状态 ---------- */
const playIcon = computed(() => (isAudioPlaying.value ? '⏸' : '▶'))
const playerFaviconUrl = computed(() => (playing.value ? faviconFor(playing.value.favicon) : ''))
const playerMeta = computed(() => {
  if (!playing.value) return ''
  const s = playing.value
  const firstTag = (s.tags || '').split(',')[0] || ''
  return `${s.country || ''} · ${s.language || ''} · ${firstTag}`
})
const loadMoreText = computed(() => {
  if (showingFavs.value) return ''
  return ended.value ? t.value('end') : t.value('loadMore')
})
const resultCountText = computed(() => {
  if (showingFavs.value) return `${stations.value.length} ${t.value('favorites')}`
  return `${stations.value.length} stations`
})

/* ---------- 播放控制 ---------- */
function playStation(s) {
  playing.value = s
  const audio = audioEl.value
  audio.src = s.url_resolved || s.url
  audio.play().catch(() => {})
  showPlayer.value = true
  isAudioPlaying.value = true
}
function stopPlayback() {
  const audio = audioEl.value
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  playing.value = null
  isAudioPlaying.value = false
}
function onPlayClick() {
  const audio = audioEl.value
  // 无源且列表非空时，播放第一首
  if (!audio.src && stations.value.length) { playStation(stations.value[0]); return }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause()
}
function onPrev() {
  if (!playing.value || !stations.value.length) return
  const idx = stations.value.findIndex(s => s.stationuuid === playing.value.stationuuid)
  if (idx > 0) playStation(stations.value[idx - 1])
}
function onNext() {
  if (!playing.value || !stations.value.length) return
  const idx = stations.value.findIndex(s => s.stationuuid === playing.value.stationuuid)
  if (idx < stations.value.length - 1) playStation(stations.value[idx + 1])
}
function onAudioPlay() { isAudioPlaying.value = true }
function onAudioPause() { isAudioPlaying.value = false }
function onAudioError() {
  isAudioPlaying.value = false
  if (playing.value) showToast('⚠ ' + playing.value.name + ' — stream unavailable')
}

/* ---------- 搜索 ---------- */
async function search(reset = true) {
  if (loading.value) return
  loading.value = true
  showingFavs.value = false
  searchError.value = ''
  if (reset) {
    stations.value = []
    offset.value = 0
    ended.value = false
  }
  try {
    const params = new URLSearchParams({
      hidebroken: 'true',
      limit: PAGE,
      offset: offset.value,
      order: 'clickcount',
      reverse: 'true'
    })
    const c = country.value.trim()
    const tg = tag.value.trim()
    const nm = name.value.trim()
    if (c) params.set('country', c)
    if (tg) params.set('tag', tg)
    if (nm) params.set('name', nm)
    const chunk = await fetchJSON(`${API}/stations/search?${params}`)
    stations.value = reset ? chunk : [...stations.value, ...chunk]
    offset.value += chunk.length
    if (chunk.length < PAGE) ended.value = true
  } catch (e) {
    searchError.value = t.value('noResults')
    if (reset) stations.value = []
  } finally {
    loading.value = false
  }
}

/* ---------- 收藏视图 ---------- */
function showFavs() {
  showingFavs.value = true
  stations.value = getFavs()
  ended.value = true
}
function onFavBtnClick() {
  // 已在收藏视图时点击则返回搜索结果
  if (showingFavs.value) { search(true); return }
  showFavs()
}

/* ---------- 随机电台 ---------- */
function onRandomClick() {
  if (!countries.value.length) return
  country.value = countries.value[Math.floor(Math.random() * countries.value.length)].name
  tag.value = ''
  name.value = ''
  search(true)
}

/* ---------- 元数据加载（国家 / 流派列表） ---------- */
async function loadMeta() {
  const [c, tg] = await Promise.all([
    fetchJSON(`${API}/countries`),
    fetchJSON(`${API}/tags`)
  ])
  countries.value = c
  tags.value = tg
}

/* ---------- toast ---------- */
function showToast(msg) {
  toast.msg = msg
  toast.visible = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, 3000)
}

/* ---------- 卡片图标加载失败：隐藏该 img ---------- */
function onImgError(e) { e.target.style.display = 'none' }

/* ---------- 音量同步到 audio 元素 ---------- */
watch(volume, (v) => { if (audioEl.value) audioEl.value.volume = v })

/* ---------- 生命周期 ---------- */
onMounted(() => {
  audioEl.value.volume = 0.8

  // 无限滚动：哨兵进入视口时加载下一页
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loading.value && !ended.value && !showingFavs.value) {
      search(false)
    }
  }, { rootMargin: '500px' })
  observer.observe(loadMoreEl.value)

  // 初始化：加载元数据后默认筛选中国电台
  loadMeta()
    .then(() => { country.value = 'China'; search(true) })
    .catch(() => { initError.value = 'API unreachable. Try again later.' })
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="radio-atlas">
    <AppHeader title="Radio Atlas" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索控件 -->
      <section class="controls">
        <div class="control-row">
          <input
            v-model="country"
            list="countryList"
            placeholder="Country…"
            aria-label="Country"
            @keydown.enter="search(true)"
          />
          <datalist id="countryList">
            <option v-for="c in countries.slice(0, 200)" :key="c.name" :value="c.name" />
          </datalist>
          <input
            v-model="tag"
            list="tagList"
            placeholder="Genre…"
            aria-label="Genre"
            @keydown.enter="search(true)"
          />
          <datalist id="tagList">
            <option v-for="tg in tags.slice(0, 200)" :key="tg.name" :value="tg.name" />
          </datalist>
          <input
            v-model="name"
            type="text"
            placeholder="Station name…"
            aria-label="Station name"
            @keydown.enter="search(true)"
          />
          <button @click="search(true)">{{ t('search') }}</button>
        </div>
        <div class="control-extras">
          <button class="btn-ghost" aria-label="Random station" @click="onRandomClick">{{ t('random') }}</button>
          <button class="btn-ghost" aria-label="Favorites" @click="onFavBtnClick">{{ t('favorites') }}</button>
          <span class="result-count">{{ resultCountText }}</span>
        </div>
      </section>

      <!-- 加载指示器 -->
      <div v-if="loading && stations.length === 0" class="loading-indicator">
        <div class="loading-spinner"></div>
        <p>{{ t('loading') }}</p>
      </div>

      <!-- 电台网格 -->
      <section class="station-grid">
        <div v-if="searchError" class="empty-state">{{ searchError }}</div>
        <template v-else>
          <div v-if="stations.length === 0 && !loading" class="empty-state">{{ initError || t('noResults') }}</div>
          <div
            v-for="s in stations"
            :key="s.stationuuid"
            class="station-card"
            :class="{ playing: playing && playing.stationuuid === s.stationuuid }"
          >
            <div class="card-top">
              <img
                v-if="faviconFor(s.favicon)"
                class="card-favicon"
                :src="faviconFor(s.favicon)"
                alt=""
                loading="lazy"
                @error="onImgError"
              />
              <div class="card-info">
                <div class="card-name">{{ s.name }}</div>
                <div class="card-sub">
                  {{ s.country || '' }}<template v-if="s.language"> · {{ s.language }}</template>
                </div>
              </div>
            </div>
            <div v-if="parseTags(s.tags).length" class="card-tags">
              <span v-for="tagItem in parseTags(s.tags)" :key="tagItem" class="card-tag">{{ tagItem }}</span>
            </div>
            <div class="card-stats">
              <span>★ {{ s.votes || 0 }} {{ t('votes') }}</span>
              <span>▸ {{ s.clickcount || 0 }} {{ t('clicks') }}</span>
              <span v-if="s.bitrate">{{ s.bitrate }} {{ t('bitrate') }}</span>
            </div>
            <div class="card-actions">
              <button class="play-action" @click="playStation(s)">▶ {{ t('play') }}</button>
              <button
                class="fav-action"
                :class="{ active: isFav(s.stationuuid) }"
                @click="onToggleFav(s)"
              >★</button>
            </div>
          </div>
        </template>
      </section>

      <div ref="loadMoreEl" class="load-more">{{ loadMoreText }}</div>
    </main>

    <!-- 底部播放器 -->
    <footer v-if="showPlayer" class="player-bar">
      <div class="player-inner">
        <div class="player-info">
          <img v-if="playerFaviconUrl" class="player-favicon" :src="playerFaviconUrl" alt="" />
          <div>
            <strong>{{ playing ? playing.name : '' }}</strong>
            <p>{{ playerMeta }}</p>
          </div>
        </div>
        <div class="player-controls">
          <button class="ctrl-btn" title="Previous" @click="onPrev">⏮</button>
          <button class="ctrl-btn ctrl-main" :title="t('play')" @click="onPlayClick">{{ playIcon }}</button>
          <button class="ctrl-btn" title="Next" @click="onNext">⏭</button>
        </div>
        <div class="player-right">
          <input v-model.number="volume" type="range" min="0" max="1" step="0.05" aria-label="Volume" />
          <button class="ctrl-btn" :title="t('stop')" @click="stopPlayback">⏹</button>
        </div>
      </div>
    </footer>

    <audio ref="audioEl" @play="onAudioPlay" @pause="onAudioPause" @error="onAudioError"></audio>

    <!-- Toast 提示 -->
    <div class="toast" :class="{ show: toast.visible }">{{ toast.msg }}</div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Radio Atlas — 暖色调浅色主题
   原 :root 变量与 body 样式迁移到组件根类 .radio-atlas，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.radio-atlas {
  --ink: #101217;
  --muted: #697487;
  --line: rgba(16, 18, 23, .1);
  --panel: rgba(255, 255, 255, .86);
  --accent: #ff6b2c;
  --accent-soft: rgba(255, 107, 44, .08);
  --bg: #f6f2ea;
  --green: #16a34a;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-text: var(--ink);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  /* 原 body 样式迁移到根元素 */
  margin: 0;
  font-family: "Manrope", system-ui, sans-serif;
  color: var(--ink);
  background: radial-gradient(circle at top left, rgba(255, 107, 44, .12), transparent 25%),
              linear-gradient(180deg, #fcfaf6 0%, var(--bg) 100%);
  padding-bottom: 80px;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
h1, h2, p, strong, span, small { margin: 0; }

.shell {
  width: min(1100px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 2rem;
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
  color: var(--accent);
}

h1 {
  margin-top: 0.3rem;
  font-size: clamp(2.2rem, 6vw, 3.5rem);
  line-height: 0.92;
  letter-spacing: -0.05em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.88rem;
}

/* Controls */
.controls {
  margin-top: 0.8rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.control-row {
  display: flex;
  gap: 0.4rem;
}

.control-row input {
  flex: 1;
  font: inherit;
  height: 2.4rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .5);
  font-size: 0.85rem;
}

.control-row button {
  font: inherit;
  height: 2.4rem;
  padding: 0 1rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}

.control-extras {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.btn-ghost {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
}

.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.result-count {
  margin-left: auto;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  color: var(--muted);
}

/* Station grid */
.station-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.6rem;
  margin-top: 0.8rem;
}

.station-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: border-color 150ms;
}

.station-card:hover { border-color: var(--accent); }

.station-card.playing {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.card-top {
  display: flex;
  gap: 0.6rem;
  align-items: start;
}

.card-favicon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--line);
  flex-shrink: 0;
  object-fit: cover;
  background: #eee;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-weight: 600;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-sub {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 0.1rem;
}

.card-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.card-tag {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--line);
  color: var(--muted);
  text-transform: uppercase;
}

.card-stats {
  display: flex;
  gap: 0.5rem;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  color: var(--muted);
}

.card-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.card-actions button {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
}

.card-actions .play-action {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.card-actions .play-action:hover {
  background: var(--accent);
  color: white;
}

.card-actions .fav-action.active {
  color: var(--accent);
}

/* 空状态 / 错误状态 */
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

/* Load more */
.load-more {
  padding: 1rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--muted);
}

/* Sticky player */
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--ink);
  color: white;
  z-index: 100;
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.2);
}

.player-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.player-favicon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: cover;
  background: #333;
}

.player-info strong {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.player-info p {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, .5);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.ctrl-btn {
  width: 2.2rem;
  height: 2.2rem;
  border: none;
  background: transparent;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 150ms;
}

.ctrl-btn:hover { background: rgba(255, 255, 255, .1); }

.ctrl-main {
  width: 2.8rem;
  height: 2.8rem;
  background: var(--accent);
  font-size: 1.1rem;
}

.ctrl-main:hover { background: #e55a1f; }

.player-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.player-right input[type="range"] {
  width: 80px;
  accent-color: var(--accent);
}

/* EQ 动画：正在播放的卡片图标呼吸 */
.playing .card-favicon {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (max-width: 720px) {
  .masthead { flex-direction: column; gap: 0.5rem; }
  .control-row { flex-wrap: wrap; }
  .control-row input { min-width: 0; }
  .station-grid { grid-template-columns: 1fr; }
  .player-info { flex: 1; }
  .player-right { display: none; }
}

/* Loading */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.85rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent, #ff6b2c);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 0.8rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toast */
.toast {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #dc2626;
  color: #fff;
  padding: 0.7rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s, transform 0.3s;
  z-index: 100;
  white-space: nowrap;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
