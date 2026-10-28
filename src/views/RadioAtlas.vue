<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Pause, Play, SkipBack, SkipForward, Square } from '@lucide/vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale } from '../ok.js'
import { countryName } from '../lib/country-meta.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiIconButton,
  UiInput,
  UiLoading,
  UiPage,
  UiPageHead,
  UiRange,
  UiSelect,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/radio-atlas.js'

const t = useT(copy)

const API_HOSTS = ['https://de1.api.radio-browser.info/json', 'https://de2.api.radio-browser.info/json']
const PAGE = 40
const FAVS_KEY = 'radio-favs'
const VOLUME_KEY = 'radio-volume'

const countryCode = ref('CN')
const tag = ref('')
const name = ref('')
const stations = ref([])
const countries = ref([])
const tags = ref([])
const playing = ref(null)
const offset = ref(0)
const loading = ref(false)
const ended = ref(false)
const initialized = ref(false)
const showingFavs = ref(false)
const isAudioPlaying = ref(false)
const audioLoading = ref(false)
const volume = ref(readVolume())
const loadError = ref('')
const metaError = ref('')
const favVersion = ref(0)
const playerFaviconFailed = ref(false)

const audioEl = ref(null)
const loadMoreEl = ref(null)
const failedFavicons = reactive({})

let searchSeq = 0

const toast = reactive({ visible: false, msg: '' })
let toastTimer = null
let observer = null

function getFavs() {
  try {
    return JSON.parse(lsGet(FAVS_KEY) || '[]')
  } catch {
    return []
  }
}
function setFavs(f) {
  lsSet(FAVS_KEY, JSON.stringify(f))
}
function isFav(id) {
  favVersion.value
  return getFavs().some((s) => s.stationuuid === id)
}
function onToggleFav(station) {
  const f = getFavs()
  const idx = f.findIndex((s) => s.stationuuid === station.stationuuid)
  if (idx >= 0) f.splice(idx, 1)
  else f.push(station)
  setFavs(f)
  favVersion.value++
  if (showingFavs.value) stations.value = getFavs()
}

function readVolume() {
  const v = parseFloat(lsGet(VOLUME_KEY))
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8
}

async function radioJSON(path) {
  let lastErr = null
  for (const base of API_HOSTS) {
    try {
      return await fetchJSON(base + path, { timeout: 8000 })
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('radio api unavailable')
}

const countryOptions = computed(() => {
  const lang = i18nState.lang
  return countries.value
    .filter((c) => c && c.iso_3166_1)
    .map((c) => ({ code: c.iso_3166_1, label: countryName(c.iso_3166_1, lang) || c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, locale()))
})

const tagOptions = computed(() =>
  tags.value
    .filter((tg) => tg && tg.name)
    .slice()
    .sort((a, b) => (b.stationcount || 0) - (a.stationcount || 0))
    .slice(0, 160),
)

const countrySelectOptions = computed(() => [
  { value: '', label: t.value('allCountries') },
  ...countryOptions.value.map((c) => ({ value: c.code, label: c.label })),
])

const genreSelectOptions = computed(() => [
  { value: '', label: t.value('allGenres') },
  ...tagOptions.value.map((tg) => ({ value: tg.name, label: tg.name })),
])

function parseTags(tagsStr) {
  return (tagsStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function countryLabel(nameValue, code) {
  if (code) return countryName(code, i18nState.lang) || nameValue || ''
  return nameValue || ''
}

function stationInitial(nameValue) {
  const str = String(nameValue || '').trim()
  return str ? Array.from(str)[0].toUpperCase() : '?'
}

function faviconUrl(station) {
  const u = station && station.favicon
  if (!u) return ''
  return String(u).replace(/^http:\/\//i, 'https://')
}

function onFaviconError(station) {
  failedFavicons[station.stationuuid] = true
}

function showToast(msg) {
  toast.msg = msg
  toast.visible = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
  }, 3200)
}

const resultCountText = computed(() => {
  const key = showingFavs.value ? 'favStations' : 'allStations'
  return t.value(key).replace('{n}', stations.value.length)
})

const playerMeta = computed(() => {
  const s = playing.value
  if (!s) return ''
  return [countryLabel(s.country, s.countrycode), s.language, parseTags(s.tags)[0]].filter(Boolean).join(' · ')
})

const playerFavicon = computed(() => (playing.value ? faviconUrl(playing.value) : ''))

const playingIndex = computed(() =>
  playing.value ? stations.value.findIndex((s) => s.stationuuid === playing.value.stationuuid) : -1,
)
const canPrev = computed(() => playingIndex.value > 0)
const canNext = computed(() => playingIndex.value >= 0 && playingIndex.value < stations.value.length - 1)

const playbackLabel = computed(() => {
  if (audioLoading.value) return t.value('loading')
  if (isAudioPlaying.value) return t.value('pause')
  return playing.value ? t.value('resume') : t.value('play')
})

function isCurrent(station) {
  return !!playing.value && playing.value.stationuuid === station.stationuuid
}

function cardPlayLabel(station) {
  if (isCurrent(station)) return isAudioPlaying.value ? t.value('pause') : t.value('resume')
  return t.value('play')
}

function mergeUnique(base, extra) {
  const map = new Map(base.map((s) => [s.stationuuid, s]))
  for (const s of extra) {
    if (!map.has(s.stationuuid)) map.set(s.stationuuid, s)
  }
  return Array.from(map.values())
}

async function search(reset = true) {
  if (!reset && loading.value) return
  const seq = ++searchSeq
  loading.value = true
  showingFavs.value = false
  loadError.value = ''
  if (reset) {
    stations.value = []
    offset.value = 0
    ended.value = false
  }
  const requestOffset = offset.value
  try {
    const params = new URLSearchParams({
      hidebroken: 'true',
      limit: String(PAGE),
      offset: String(requestOffset),
      order: 'clickcount',
      reverse: 'true',
    })
    if (countryCode.value) params.set('countrycode', countryCode.value)
    if (tag.value) params.set('tag', tag.value)
    if (name.value.trim()) params.set('name', name.value.trim())

    const chunk = await radioJSON('/stations/search?' + params.toString())
    if (seq !== searchSeq) return
    const list = Array.isArray(chunk) ? chunk : []
    stations.value = reset ? mergeUnique([], list) : mergeUnique(stations.value, list)
    offset.value = requestOffset + list.length
    if (list.length < PAGE) ended.value = true
  } catch (e) {
    if (seq !== searchSeq) return
    console.warn('Radio Browser search failed:', e)
    if (reset || !stations.value.length) {
      loadError.value = t.value('errorLoad')
      if (reset) stations.value = []
    } else {
      showToast(t.value('errorLoad'))
    }
    ended.value = true
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

async function loadMeta() {
  const [cRes, tRes] = await Promise.allSettled([radioJSON('/countries'), radioJSON('/tags')])
  if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) countries.value = cRes.value
  if (tRes.status === 'fulfilled' && Array.isArray(tRes.value)) tags.value = tRes.value
  metaError.value = !countries.value.length && !tags.value.length ? t.value('filtersUnavailable') : ''

  if (countries.value.length) {
    const hasCurrent = countries.value.some((c) => c.iso_3166_1 === countryCode.value)
    if (!hasCurrent) {
      countryCode.value = countries.value.some((c) => c.iso_3166_1 === 'CN') ? 'CN' : ''
    }
  } else {
    countryCode.value = ''
  }
}

async function init() {
  loadError.value = ''
  await loadMeta()
  await search(true)
  initialized.value = true
}

function retry() {
  if (!countries.value.length || !tags.value.length) init()
  else search(true)
}

function showFavs() {
  searchSeq++
  loading.value = false
  showingFavs.value = true
  loadError.value = ''
  stations.value = getFavs()
  ended.value = true
}
function onFavBtnClick() {
  if (showingFavs.value) search(true)
  else showFavs()
}

function onRandomClick() {
  if (countryOptions.value.length) {
    const list = countryOptions.value
    countryCode.value = list[Math.floor(Math.random() * list.length)].code
  } else if (tagOptions.value.length) {
    const list = tagOptions.value
    tag.value = list[Math.floor(Math.random() * list.length)].name
  }
  name.value = ''
  search(true)
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return
  if (!playing.value) {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
    return
  }
  if (typeof MediaMetadata !== 'undefined') {
    const art = faviconUrl(playing.value)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: playing.value.name || '',
      artist: playerMeta.value,
      artwork: art ? [{ src: art }] : [],
    })
  }
  navigator.mediaSession.playbackState = isAudioPlaying.value ? 'playing' : 'paused'
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return
  const set = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch (e) {}
  }
  set('play', () => {
    audioEl.value && audioEl.value.play().catch(() => {})
  })
  set('pause', () => {
    audioEl.value && audioEl.value.pause()
  })
  set('previoustrack', onPrev)
  set('nexttrack', onNext)
  set('stop', stopPlayback)
}

function playStation(station) {
  if (!station) return
  const audio = audioEl.value
  const same = playing.value && playing.value.stationuuid === station.stationuuid
  playing.value = station
  if (!same) {
    failedFavicons[station.stationuuid] = false
    audio.src = station.url_resolved || station.url
    audioLoading.value = true
  }
  audio.play().catch(() => {
    audioLoading.value = false
    showToast((station.name || '') + ' — ' + t.value('streamUnavailable'))
  })
}

function stopPlayback() {
  const audio = audioEl.value
  playing.value = null
  isAudioPlaying.value = false
  audioLoading.value = false
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  updateMediaSession()
}

function onPlayClick() {
  const audio = audioEl.value
  if (!playing.value) {
    if (stations.value.length) playStation(stations.value[0])
    return
  }
  if (!audio.src) {
    playStation(playing.value)
    return
  }
  if (audio.paused) {
    audio.play().catch(() => {
      audioLoading.value = false
      showToast((playing.value.name || '') + ' — ' + t.value('streamUnavailable'))
    })
  } else {
    audio.pause()
  }
}

function onCardPlay(station) {
  if (isCurrent(station)) {
    onPlayClick()
    return
  }
  playStation(station)
}

function onPrev() {
  if (canPrev.value) playStation(stations.value[playingIndex.value - 1])
}

function onNext() {
  if (canNext.value) playStation(stations.value[playingIndex.value + 1])
}

function onAudioPlay() {
  isAudioPlaying.value = true
  audioLoading.value = false
}
function onAudioPause() {
  isAudioPlaying.value = false
  audioLoading.value = false
}
function onAudioError() {
  audioLoading.value = false
  isAudioPlaying.value = false
  if (playing.value) {
    showToast((playing.value.name || '') + ' — ' + t.value('streamUnavailable'))
  }
}

watch(volume, (v) => {
  if (audioEl.value) audioEl.value.volume = v
  lsSet(VOLUME_KEY, String(v))
})

watch(playing, () => {
  playerFaviconFailed.value = false
  updateMediaSession()
})

watch(isAudioPlaying, updateMediaSession)

watch(
  () => i18nState.lang,
  () => {
    if (playing.value) updateMediaSession()
  },
)

onMounted(() => {
  audioEl.value.volume = volume.value
  setupMediaSession()

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && initialized.value && !loading.value && !ended.value && !showingFavs.value) {
        search(false)
      }
    },
    { rootMargin: '500px' },
  )
  observer.observe(loadMoreEl.value)

  init()
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  clearTimeout(toastTimer)
  if (audioEl.value) {
    audioEl.value.pause()
    audioEl.value.removeAttribute('src')
  }
  if ('mediaSession' in navigator) {
    ;['play', 'pause', 'previoustrack', 'nexttrack', 'stop'].forEach((action) => {
      try {
        navigator.mediaSession.setActionHandler(action, null)
      } catch (e) {}
    })
  }
})
</script>

<template>
  <UiPage
    class="radio-atlas"
    :class="{ 'has-player': !!playing }"
    :title="t('title')"
    :sources="[{ name: 'Radio Browser', url: 'https://www.radio-browser.info/' }]"
  >
    <UiPageHead :description="t('lead')" />

    <UiCard class="filter-panel">
      <form class="filter-grid" @submit.prevent="search(true)">
        <UiField :label="t('country')" label-for="countrySelect">
          <UiSelect
            id="countrySelect"
            v-model="countryCode"
            :options="countrySelectOptions"
            :aria-label="t('country')"
          />
        </UiField>
        <UiField :label="t('genre')" label-for="genreSelect">
          <UiSelect id="genreSelect" v-model="tag" :options="genreSelectOptions" :aria-label="t('genre')" />
        </UiField>
        <UiField class="field-name" :label="t('stationName')" label-for="stationNameInput">
          <UiInput
            id="stationNameInput"
            v-model="name"
            type="search"
            autocomplete="off"
            :placeholder="t('stationNamePh')"
            :aria-label="t('stationName')"
          />
        </UiField>
        <UiButton type="submit" variant="primary" class="search-btn">{{ t('search') }}</UiButton>
      </form>

      <div class="filter-actions">
        <UiButton variant="ghost" size="sm" :aria-label="t('randomAria')" @click="onRandomClick">
          {{ t('random') }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          class="fav-toggle"
          toggle
          :active="showingFavs"
          :aria-label="t('favoritesAria')"
          @click="onFavBtnClick"
        >
          {{ t('favorites') }}
        </UiButton>
        <span class="result-count">{{ resultCountText }}</span>
      </div>
    </UiCard>

    <UiErrorState v-if="metaError" class="inline-alert" :message="metaError" :retry-label="t('retry')" @retry="retry" />

    <UiCard v-if="loading && !stations.length && !showingFavs" class="state-panel">
      <UiLoading :label="t('loading')" />
    </UiCard>
    <UiErrorState
      v-else-if="loadError && !stations.length"
      class="state-error"
      variant="block"
      :message="loadError"
      :retry-label="t('retry')"
      @retry="retry"
    />
    <UiEmptyState v-else-if="!stations.length" compact :title="showingFavs ? t('noFavorites') : t('noResults')" />

    <section v-else class="station-grid" aria-live="polite">
      <UiCard
        v-for="s in stations"
        :key="s.stationuuid"
        as="article"
        interactive
        padding="sm"
        class="station-card"
        :class="{ playing: isCurrent(s) }"
      >
        <div class="station-head">
          <div class="station-avatar" aria-hidden="true">
            <span>{{ stationInitial(s.name) }}</span>
            <img
              v-if="faviconUrl(s) && !failedFavicons[s.stationuuid]"
              :src="faviconUrl(s)"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onFaviconError(s)"
            />
          </div>
          <div class="station-title">
            <div class="station-name">{{ s.name }}</div>
            <div class="station-sub">
              {{ countryLabel(s.country, s.countrycode) }}<template v-if="s.language"> · {{ s.language }}</template>
            </div>
          </div>
          <UiBadge v-if="isCurrent(s) && isAudioPlaying" class="now-badge" variant="accent" size="sm" dot>
            {{ t('nowPlaying') }}
          </UiBadge>
        </div>

        <div v-if="parseTags(s.tags).length" class="station-tags">
          <UiBadge v-for="tagItem in parseTags(s.tags)" :key="tagItem" size="sm">{{ tagItem }}</UiBadge>
        </div>

        <div class="station-stats">
          <UiStat compact :label="t('votes')" :value="s.votes || 0" />
          <UiStat compact :label="t('clicks')" :value="s.clickcount || 0" />
          <UiStat v-if="s.bitrate" compact :label="t('bitrate')" :value="s.bitrate" />
        </div>

        <div class="station-actions">
          <UiButton size="sm" :variant="isCurrent(s) ? 'soft' : 'secondary'" @click="onCardPlay(s)">
            {{ cardPlayLabel(s) }}
          </UiButton>
          <UiIconButton
            class="fav-btn"
            size="sm"
            :label="isFav(s.stationuuid) ? t('removeFav') : t('addFav')"
            toggle
            :active="isFav(s.stationuuid)"
            @click="onToggleFav(s)"
          >
            {{ isFav(s.stationuuid) ? '★' : '☆' }}
          </UiIconButton>
        </div>
      </UiCard>
    </section>

    <div ref="loadMoreEl" class="load-more">
      <UiLoading v-if="loading && stations.length" inline compact :label="t('loading')" />
      <span v-else-if="!showingFavs && !ended && stations.length">{{ t('loadMore') }}</span>
      <span v-else-if="!showingFavs && ended && stations.length">{{ t('end') }}</span>
    </div>

    <footer v-if="playing" class="player-bar">
      <div class="player-inner">
        <div class="player-info">
          <div class="player-avatar" aria-hidden="true">
            <span>{{ stationInitial(playing.name) }}</span>
            <img
              v-if="playerFavicon && !playerFaviconFailed"
              :src="playerFavicon"
              alt=""
              referrerpolicy="no-referrer"
              @error="playerFaviconFailed = true"
            />
          </div>
          <div class="player-text">
            <strong>{{ playing.name }}</strong>
            <p>{{ playerMeta }}</p>
          </div>
        </div>

        <div class="player-controls">
          <UiIconButton variant="secondary" :label="t('previous')" :disabled="!canPrev" @click="onPrev">
            <SkipBack aria-hidden="true" />
          </UiIconButton>
          <UiIconButton variant="secondary" class="play-toggle" :label="playbackLabel" @click="onPlayClick">
            <span v-if="audioLoading" class="ui-spinner" aria-hidden="true"></span>
            <Pause v-else-if="isAudioPlaying" aria-hidden="true" />
            <Play v-else aria-hidden="true" />
          </UiIconButton>
          <UiIconButton variant="secondary" :label="t('next')" :disabled="!canNext" @click="onNext">
            <SkipForward aria-hidden="true" />
          </UiIconButton>
          <UiIconButton variant="secondary" :label="t('stop')" @click="stopPlayback">
            <Square aria-hidden="true" />
          </UiIconButton>
        </div>

        <div class="player-right">
          <span class="volume-label">{{ t('volume') }}</span>
          <UiRange v-model="volume" class="volume-range" :min="0" :max="1" :step="0.05" :aria-label="t('volume')" />
          <span class="volume-value">{{ Math.round(volume * 100) }}</span>
        </div>
      </div>
    </footer>

    <audio
      ref="audioEl"
      preload="none"
      @play="onAudioPlay"
      @pause="onAudioPause"
      @waiting="audioLoading = true"
      @playing="audioLoading = false"
      @canplay="audioLoading = false"
      @error="onAudioError"
    ></audio>

    <div class="toast" role="status" aria-live="polite" :class="{ show: toast.visible }">{{ toast.msg }}</div>
  </UiPage>
</template>

<style scoped>
.radio-atlas {
  -webkit-font-smoothing: antialiased;
}

.radio-atlas.has-player {
  padding-bottom: 4.8rem;
}

.filter-panel {
  margin-bottom: 0.8rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.1fr 1.5fr auto;
  gap: 0.6rem;
  align-items: end;
}

.filter-grid :deep(.ui-field-label) {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
}

.result-count {
  margin-left: auto;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.7rem;
}

.inline-alert {
  margin-bottom: 0.8rem;
}

.state-panel {
  min-height: 180px;
}

.state-panel :deep(.ui-card-body) {
  align-items: center;
  justify-content: center;
  gap: 0;
}

.state-error {
  margin-bottom: 0.8rem;
}

.station-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.8rem;
}

.station-card {
  height: 100%;
}

.station-card.playing {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
}

.station-card :deep(.ui-card-body) {
  gap: 0.6rem;
}

.station-head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.station-avatar,
.player-avatar {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  font-weight: 600;
  overflow: hidden;
}

.station-avatar {
  width: 40px;
  height: 40px;
  font-size: 0.9rem;
}

.station-avatar img,
.player-avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.station-title {
  min-width: 0;
  flex: 1;
}

.station-name {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.station-sub {
  margin-top: 0.1rem;
  font-size: 0.72rem;
  color: var(--ok-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-head .now-badge {
  flex-shrink: 0;
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.station-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.station-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
}

.station-stats :deep(.ui-stat) {
  padding: 0;
}

.station-stats :deep(.ui-stat-label) {
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.station-stats :deep(.ui-stat-value) {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
}

.station-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.55rem;
  border-top: 1px solid var(--ok-line);
}

.station-actions .fav-btn {
  margin-left: auto;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3rem;
  margin-top: 0.8rem;
  color: var(--ok-muted);
  font-size: 0.7rem;
}

.player-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  background: var(--ok-panel);
  border-top: 1px solid var(--ok-line);
  padding-bottom: env(safe-area-inset-bottom);
}

.player-inner {
  width: min(var(--ok-content-width, 1100px), calc(100% - var(--ok-content-gutter, 1.25rem)));
  min-height: 4.5rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.player-avatar {
  width: 36px;
  height: 36px;
  font-size: 0.8rem;
}

.player-text {
  min-width: 0;
}

.player-text strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-text p {
  margin-top: 0.1rem;
  font-size: 0.68rem;
  color: var(--ok-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.player-controls .play-toggle {
  width: 2.2rem;
  height: 2.2rem;
  border-color: var(--ok-accent);
  background: var(--ok-accent);
  color: var(--ok-bg);
}

.player-controls .play-toggle:hover:not(:disabled) {
  border-color: var(--ok-accent);
  color: var(--ok-bg);
  filter: brightness(1.05);
}

.player-controls .play-toggle :deep(svg) {
  fill: currentColor;
}

.player-controls .play-toggle .ui-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border-color: rgba(0, 0, 0, 0.25);
  border-top-color: currentColor;
}

.player-right {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.volume-label {
  font-size: 0.66rem;
  color: var(--ok-muted);
}

.volume-range {
  width: 90px;
}

.volume-value {
  width: 2rem;
  text-align: right;
  font-family: var(--ok-mono);
  font-size: 0.64rem;
  color: var(--ok-muted);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(5.4rem + env(safe-area-inset-bottom));
  transform: translate(-50%, 8px);
  z-index: 40;
  max-width: calc(100% - 2rem);
  padding: 0.5rem 0.8rem;
  border-radius: var(--ok-radius-sm);
  background: var(--ok-text);
  color: var(--ok-bg);
  font-size: 0.74rem;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (max-width: 860px) {
  .filter-grid {
    grid-template-columns: 1fr 1fr;
  }
  .field-name {
    grid-column: 1 / -1;
  }
  .search-btn {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .player-inner {
    gap: 0.5rem;
    min-height: 4.2rem;
  }
  .player-text p {
    display: none;
  }
  .player-right {
    display: none;
  }
  .player-info {
    gap: 0.45rem;
  }
  .station-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
  .field-name {
    grid-column: auto;
  }
  .search-btn {
    grid-column: auto;
  }
  .result-count {
    margin-left: 0;
    width: 100%;
  }
  .player-avatar {
    width: 32px;
    height: 32px;
  }
  .player-controls {
    gap: 0.2rem;
  }
  .player-controls .play-toggle {
    width: 2rem;
    height: 2rem;
  }
  .radio-atlas.has-player {
    padding-bottom: 4.5rem;
  }
  .toast {
    bottom: calc(5rem + env(safe-area-inset-bottom));
  }
}
</style>
