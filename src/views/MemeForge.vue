<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiErrorState,
  UiField,
  UiInput,
  UiLoading,
  UiPage,
  UiPageHead,
} from '../components/ui/index.js'
import copy from '../copy/meme-forge.js'

const t = useT(copy)

const API_BASE = 'https://meme-api.com/gimme'

const subInput = ref('')
const currentMeme = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const loading = ref(false)
const hasError = ref(false)
const copied = ref(false)
const copyError = ref(false)
let copyTimer = null
const imageSrc = ref('')
const imageFallbackUsed = ref(false)
const imageBroken = ref(false)
const imageLoading = ref(false)
let imageTimer = null

const prevDisabled = computed(() => loading.value || historyIndex.value <= 0)

const nextDisabled = computed(() => loading.value)

const copyBtnText = computed(() => (copied.value ? t.value('copied') : t.value('copyLink')))

function formatUps(value) {
  return Number(value || 0).toLocaleString()
}

function clearImageTimer() {
  if (imageTimer) clearTimeout(imageTimer)
  imageTimer = null
}

function armImageTimer() {
  clearImageTimer()
  imageTimer = setTimeout(function () {
    if (imageLoading.value && !imageBroken.value) onImageError()
  }, 10000)
}

function showMeme(meme) {
  copied.value = false
  copyError.value = false
  currentMeme.value = meme
  imageSrc.value = meme.url || ''
  imageFallbackUsed.value = false
  imageBroken.value = false
  imageLoading.value = Boolean(imageSrc.value)
  hasError.value = false
  if (imageLoading.value) armImageTimer()
}

function onImageLoad() {
  imageLoading.value = false
  clearImageTimer()
}

function onImageError() {
  const previews = currentMeme.value && currentMeme.value.preview
  if (!imageFallbackUsed.value && Array.isArray(previews) && previews.length) {
    imageFallbackUsed.value = true
    imageSrc.value = previews[previews.length - 1]
    imageLoading.value = true
    armImageTimer()
  } else {
    imageLoading.value = false
    imageBroken.value = true
    clearImageTimer()
  }
}

function apiUrl(subreddit) {
  let url = API_BASE
  if (subreddit) url += '/' + encodeURIComponent(subreddit)
  return url
}

function getSubreddit() {
  return subInput.value.trim().replace(/^r\//, '')
}

async function fetchMeme(subreddit) {
  if (loading.value) return
  loading.value = true
  currentMeme.value = null
  hasError.value = false
  imageBroken.value = false
  imageLoading.value = false
  clearImageTimer()
  try {
    const data = await fetchJSON(apiUrl(subreddit), { timeout: 15000 })
    loading.value = false
    if (!data || !data.url) {
      hasError.value = true
      return
    }
    showMeme(data)

    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(data)
    historyIndex.value = history.value.length - 1
  } catch (err) {
    loading.value = false
    hasError.value = true
    console.warn('Meme load failed:', err)
  }
}

function goBack() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    showMeme(history.value[historyIndex.value])
  }
}

function goForward() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    showMeme(history.value[historyIndex.value])
  } else {
    fetchMeme(getSubreddit())
  }
}

function copyLink() {
  if (!currentMeme.value || !currentMeme.value.url) return
  copied.value = false
  copyError.value = false
  navigator.clipboard.writeText(currentMeme.value.url).then(showCopied, () => {
    copyError.value = true
  })
}

function showCopied() {
  copyError.value = false
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(function () {
    copied.value = false
  }, 1500)
}

function onSubmit() {
  if (loading.value) return
  history.value = []
  historyIndex.value = -1
  fetchMeme(getSubreddit())
}

function onRandom() {
  if (loading.value) return
  subInput.value = ''
  history.value = []
  historyIndex.value = -1
  fetchMeme('')
}

onMounted(function () {
  fetchMeme('')
})

onBeforeUnmount(() => {
  clearImageTimer()
  clearTimeout(copyTimer)
})
</script>

<template>
  <UiPage
    class="meme-forge-app"
    :title="t('title')"
    :sources="[
      { name: 'Meme API', url: 'https://meme-api.com/' },
      { name: 'Reddit', url: 'https://www.reddit.com/' },
    ]"
    spacing="compact"
  >
    <UiPageHead :description="t('lead')" />

    <section class="workspace">
      <UiCard as="aside" class="control-panel" padding="sm" aria-label="Meme navigation">
        <form class="sub-form" @submit.prevent="onSubmit">
          <UiField :label="t('subredditLabel')" label-for="subredditInput">
            <div class="sub-row">
              <span class="sub-prefix" aria-hidden="true">r/</span>
              <UiInput
                id="subredditInput"
                v-model="subInput"
                type="text"
                :placeholder="t('subPlaceholder')"
                autocomplete="off"
                :aria-label="t('subredditLabel')"
                :disabled="loading"
              />
              <UiButton type="submit" variant="primary" :disabled="loading">{{ t('load') }}</UiButton>
            </div>
          </UiField>
        </form>

        <div class="control-actions">
          <UiButton variant="ghost" size="sm" class="control-btn" :disabled="loading" @click="onRandom">
            {{ t('random') }}
          </UiButton>
          <UiButton variant="ghost" size="sm" class="control-btn" :disabled="prevDisabled" @click="goBack">
            {{ t('prev') }}
          </UiButton>
          <UiButton variant="ghost" size="sm" class="control-btn" :disabled="nextDisabled" @click="goForward">
            {{ t('next') }}
          </UiButton>
        </div>

        <p v-if="history.length" class="history-pos">{{ historyIndex + 1 }} / {{ history.length }}</p>
      </UiCard>

      <div class="viewer-panel">
        <UiCard v-if="loading" class="viewer-state">
          <UiLoading :label="t('loading')" />
        </UiCard>

        <UiCard v-else-if="hasError" class="viewer-state">
          <UiErrorState
            variant="block"
            :message="t('fetchError')"
            :retry-label="t('retry')"
            @retry="fetchMeme(getSubreddit())"
          />
        </UiCard>

        <UiCard v-else-if="currentMeme" class="meme-card" padding="none">
          <div class="meme-image-wrap">
            <img
              v-if="!imageBroken"
              v-show="!imageLoading"
              :src="imageSrc"
              :alt="currentMeme.title || ''"
              @load="onImageLoad"
              @error="onImageError"
            />
            <UiLoading
              v-if="imageLoading && !imageBroken"
              inline
              compact
              class="image-loading"
              :label="t('imageLoading')"
            />
            <div v-else-if="imageBroken" class="image-fallback">
              <p>{{ t('imageError') }}</p>
              <UiButton v-if="currentMeme.postLink" variant="link" :href="currentMeme.postLink" target="_blank">
                {{ t('viewPost') }}
              </UiButton>
            </div>
          </div>
          <div class="meme-body">
            <h2 v-if="currentMeme.title" class="meme-title">{{ currentMeme.title }}</h2>
            <div class="meme-meta">
              <UiBadge v-if="currentMeme.subreddit" size="sm" mono>r/{{ currentMeme.subreddit }}</UiBadge>
              <UiBadge variant="accent" size="sm" mono> {{ formatUps(currentMeme.ups) }} {{ t('upvotes') }} </UiBadge>
              <UiBadge v-if="currentMeme.author" size="sm" mono> {{ t('by') }} u/{{ currentMeme.author }} </UiBadge>
            </div>
            <div class="meme-actions">
              <UiButton
                v-if="currentMeme.postLink"
                variant="link"
                :href="currentMeme.postLink"
                target="_blank"
                rel="noopener"
              >
                {{ t('viewPost') }}
              </UiButton>
              <UiButton size="sm" :variant="copied ? 'soft' : 'secondary'" @click="copyLink">
                {{ copyBtnText }}
              </UiButton>
            </div>
            <p v-if="copyError" role="alert">{{ t('copyFailed') }}</p>
          </div>
        </UiCard>
      </div>
    </section>
  </UiPage>
</template>

<style scoped>
.meme-forge-app {
  -webkit-font-smoothing: antialiased;
}

.workspace {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.control-panel {
  position: sticky;
  top: calc(var(--ok-topbar-h, 3.4rem) + 1rem);
  height: auto;
  align-self: start;
}

.sub-form :deep(.ui-field-label) {
  font-size: 0.72rem;
  letter-spacing: 0;
  text-transform: none;
}

.sub-form {
  margin: 0;
}

.sub-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.35rem;
  align-items: center;
}

.sub-prefix {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.8rem;
}

.control-actions {
  display: flex;
  gap: 0.35rem;
}

.control-actions .control-btn {
  flex: 1;
  min-width: 0;
  padding: 0 0.4rem;
}

.history-pos {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.66rem;
}

.viewer-panel {
  min-width: 0;
}

.viewer-state {
  min-height: 360px;
}

.viewer-state :deep(.ui-card-body) {
  align-items: center;
  justify-content: center;
  gap: 0;
}

.viewer-state :deep(.ui-error--block) {
  width: 100%;
}

.meme-card {
  overflow: hidden;
  min-width: 0;
}

.meme-card :deep(.ui-card-body) {
  gap: 0;
}

.meme-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  background: var(--ok-bg);
}

.meme-card img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: min(62vh, 620px);
  width: auto;
  height: auto;
}

.meme-image-wrap .image-loading {
  justify-content: center;
  padding: 2rem 1rem;
  font-size: 0.78rem;
}

.image-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--ok-muted);
  font-size: 0.8rem;
  text-align: center;
}

.meme-body {
  padding: 1rem;
}

.meme-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.meme-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
  overflow-wrap: anywhere;
}

.meme-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

@media (max-width: 860px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .control-panel {
    position: static;
  }
  .meme-card img {
    max-height: 70vh;
  }
}

@media (max-width: 520px) {
  .meme-body {
    padding: 0.85rem;
  }
  .meme-image-wrap {
    min-height: 180px;
  }
  .meme-card img {
    max-height: 60vh;
  }
  .meme-actions {
    justify-content: flex-start;
  }
  .viewer-state {
    min-height: 280px;
  }
}
</style>
