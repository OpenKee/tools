<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Download, QrCode } from '@lucide/vue'
import QRCode from 'qrcode'
import { useT } from '../i18n.js'
import { locale } from '../ok.js'
import { buildQrData } from '../lib/qr.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiInput,
  UiLoading,
  UiPage,
  UiPageHead,
  UiRange,
  UiSegmented,
  UiSelect,
  UiSectionHead,
  UiTextarea,
} from '../components/ui/index.js'
import copy from '../copy/qr-forge.js'

defineProps({ embedded: { type: Boolean, default: false } })

const t = useT(copy)

const TYPES = [
  { key: 'text', label: 'typeText' },
  { key: 'url', label: 'typeUrl' },
  { key: 'wifi', label: 'typeWifi' },
  { key: 'email', label: 'typeEmail' },
  { key: 'phone', label: 'typePhone' },
]

const FIELD_CONFIGS = {
  text: [{ key: 'text', label: 'labelText', kind: 'textarea', placeholder: 'placeholderText' }],
  url: [{ key: 'url', label: 'labelUrl', kind: 'input', inputType: 'url', placeholder: 'placeholderUrl' }],
  wifi: [
    { key: 'ssid', label: 'labelSsid', kind: 'input', inputType: 'text', placeholder: 'placeholderSsid' },
    { key: 'password', label: 'labelPassword', kind: 'input', inputType: 'text', placeholder: 'placeholderPassword' },
    {
      key: 'encryption',
      label: 'labelEncryption',
      kind: 'select',
      options: [
        { value: 'WPA', label: 'encWpa' },
        { value: 'WEP', label: 'encWep' },
        { value: 'nopass', label: 'encNone' },
      ],
    },
  ],
  email: [{ key: 'email', label: 'labelEmail', kind: 'input', inputType: 'email', placeholder: 'placeholderEmail' }],
  phone: [{ key: 'phone', label: 'labelPhone', kind: 'input', inputType: 'tel', placeholder: 'placeholderPhone' }],
}

const SIZE_OPTIONS = [128, 256, 512, 1024].map((n) => ({ value: n, label: n + ' px' }))
const ECC_OPTIONS = [
  { value: 'L', label: 'L — 7%' },
  { value: 'M', label: 'M — 15%' },
  { value: 'Q', label: 'Q — 25%' },
  { value: 'H', label: 'H — 30%' },
]

const state = reactive({
  type: 'text',
  inputs: { text: '', url: '', ssid: '', password: '', encryption: 'WPA', email: '', phone: '' },
  options: { size: 256, fgColor: '#1a1a2e', bgColor: '#ffffff', ecc: 'M', margin: 4 },
})

const history = ref([])
const previewState = ref('empty')
const downloading = ref(false)
const downloaded = ref(false)
const downloadError = ref(false)
const qrImgEl = ref(null)

let debounceTimer = null
let currentToken = 0
let skipWatch = false
let downloadedTimer = null
let downloadErrorTimer = null

const currentFields = computed(() => FIELD_CONFIGS[state.type] || [])

const typeOptions = computed(() => TYPES.map((tp) => ({ value: tp.key, label: t.value(tp.label) })))

const downloadDisabled = computed(() => previewState.value !== 'image' || downloading.value)

const qrAlt = computed(() => t.value('type_' + state.type) + ' QR code')

function buildHistoryLabel(type, data) {
  const clean = data
    .replace(/^WIFI:T:.*;S:/, '')
    .replace(/;P:.*;;$/, '')
    .replace(/^mailto:/, '')
    .replace(/^tel:/, '')
  const label = clean || data
  return label.length > 48 ? label.slice(0, 48) + '…' : label
}

function setPreviewState(name) {
  previewState.value = name
}

async function generate() {
  downloaded.value = false
  downloadError.value = false
  const type = state.type
  const inputs = { ...state.inputs }
  const options = { ...state.options }
  const data = buildQrData(type, inputs)

  if (!data || !data.replace(/^(mailto:|tel:)$/, '').trim()) {
    currentToken++
    setPreviewState('empty')
    return
  }

  const token = ++currentToken
  setPreviewState('loading')
  try {
    const url = await QRCode.toDataURL(data, {
      errorCorrectionLevel: options.ecc,
      margin: options.margin,
      width: options.size,
      color: { dark: options.fgColor, light: options.bgColor },
    })
    if (token !== currentToken || !qrImgEl.value) return
    qrImgEl.value.src = url
    setPreviewState('image')
    addToHistory(type, inputs, options, data)
  } catch (e) {
    if (token === currentToken) setPreviewState('error')
  }
}

function scheduleGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(function () {
    generate()
  }, 500)
}

function addToHistory(type, inputs, options, data) {
  const signature =
    type +
    '|' +
    data +
    '|' +
    options.size +
    '|' +
    options.fgColor +
    '|' +
    options.bgColor +
    '|' +
    options.ecc +
    '|' +
    options.margin
  if (history.value.length && history.value[0].signature === signature) return

  const timeStr = new Date().toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  })

  history.value.unshift({
    signature: signature,
    type: type,
    inputs: Object.assign({}, inputs),
    options: Object.assign({}, options),
    data: data,
    label: buildHistoryLabel(type, data),
    timeStr: timeStr,
  })

  if (history.value.length > 20) history.value.splice(20)
}

function loadFromHistory(idx) {
  const h = history.value[idx]
  if (!h) return

  skipWatch = true
  state.type = h.type
  Object.assign(state.inputs, h.inputs)
  Object.assign(state.options, h.options)
  generate()
}

function clearHistory() {
  history.value = []
}

function onGenerateClick() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  generate()
}

async function downloadPng() {
  if (downloadDisabled.value || !qrImgEl.value || !qrImgEl.value.src) return
  downloading.value = true
  downloadError.value = false
  downloaded.value = false
  try {
    const res = await fetch(qrImgEl.value.src)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = 'qr-' + Date.now() + '.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(function () {
      URL.revokeObjectURL(blobUrl)
    }, 1000)
    downloaded.value = true
    if (downloadedTimer) clearTimeout(downloadedTimer)
    downloadedTimer = setTimeout(function () {
      downloaded.value = false
    }, 1800)
  } catch (e) {
    downloadError.value = true
    if (downloadErrorTimer) clearTimeout(downloadErrorTimer)
    downloadErrorTimer = setTimeout(function () {
      downloadError.value = false
    }, 4000)
  } finally {
    downloading.value = false
  }
}

watch(
  () => [state.type, JSON.stringify(state.inputs), JSON.stringify(state.options)],
  () => {
    if (skipWatch) {
      skipWatch = false
      return
    }
    scheduleGenerate()
  },
)

onMounted(function () {
  generate()
})

onBeforeUnmount(function () {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (downloadedTimer) clearTimeout(downloadedTimer)
  if (downloadErrorTimer) clearTimeout(downloadErrorTimer)
})
</script>

<template>
  <UiPage :title="t('title')" spacing="compact" :embedded="embedded">
    <UiPageHead compact :level="embedded ? 2 : 1" :title="t('title')" :description="t('lead')" />

    <section class="workspace">
      <UiCard class="control-panel" padding="sm">
        <UiField :label="t('typeLabel')">
          <UiSegmented
            v-model="state.type"
            class="type-tabs"
            size="sm"
            :options="typeOptions"
            :aria-label="t('typeLabel')"
          />
        </UiField>

        <div aria-live="polite">
          <UiField v-for="f in currentFields" :key="f.key" :label="t(f.label)" :label-for="'inp-' + f.key">
            <UiTextarea
              v-if="f.kind === 'textarea'"
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              :rows="3"
              :placeholder="t(f.placeholder)"
              :aria-label="t(f.label)"
              :monospace="false"
            />
            <UiSelect
              v-else-if="f.kind === 'select'"
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              :options="f.options.map((o) => ({ value: o.value, label: t(o.label) }))"
              :aria-label="t(f.label)"
            />
            <UiInput
              v-else
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              :type="f.inputType || 'text'"
              :placeholder="t(f.placeholder)"
              :aria-label="t(f.label)"
            />
          </UiField>
        </div>

        <div class="field-row">
          <UiField :label="t('size')" label-for="sizeSelect">
            <UiSelect id="sizeSelect" v-model="state.options.size" :options="SIZE_OPTIONS" :aria-label="t('size')" />
          </UiField>
          <UiField :label="t('ecc')" label-for="eccSelect">
            <UiSelect id="eccSelect" v-model="state.options.ecc" :options="ECC_OPTIONS" :aria-label="t('ecc')" />
          </UiField>
        </div>

        <div class="field-row">
          <UiField :label="t('foreground')" label-for="fgColor">
            <div class="color-input">
              <input id="fgColor" v-model="state.options.fgColor" type="color" :aria-label="t('foreground')" />
              <span class="color-value">{{ state.options.fgColor }}</span>
            </div>
          </UiField>
          <UiField :label="t('background')" label-for="bgColor">
            <div class="color-input">
              <input id="bgColor" v-model="state.options.bgColor" type="color" :aria-label="t('background')" />
              <span class="color-value">{{ state.options.bgColor }}</span>
            </div>
          </UiField>
        </div>

        <UiField :label="t('margin')">
          <UiRange v-model="state.options.margin" :min="1" :max="10" show-value :aria-label="t('margin')" />
        </UiField>

        <UiButton variant="primary" block class="generate-btn" @click="onGenerateClick">
          <QrCode :size="15" aria-hidden="true" />
          {{ t('generate') }}
        </UiButton>
      </UiCard>

      <div class="preview-panel">
        <UiCard class="preview-card" padding="sm">
          <UiSectionHead :title="t('preview')">
            <template #actions>
              <UiButton
                variant="ghost"
                size="sm"
                class="preview-download"
                :class="{ downloaded }"
                :disabled="downloadDisabled"
                @click="downloadPng"
              >
                <Download :size="15" aria-hidden="true" />
                <span>{{ downloading ? t('downloading') : downloaded ? t('downloaded') : t('download') }}</span>
              </UiButton>
            </template>
          </UiSectionHead>

          <UiErrorState v-if="downloadError" class="download-error" retry-label="" :message="t('downloadError')" />

          <div class="preview-stage">
            <UiEmptyState v-show="previewState === 'empty'" compact :description="t('previewEmpty')" />
            <img v-show="previewState === 'image'" ref="qrImgEl" class="qr-image" :alt="qrAlt" />
            <UiLoading v-show="previewState === 'loading'" :label="t('generating')" />
            <UiErrorState
              v-show="previewState === 'error'"
              variant="block"
              retry-label=""
              :message="t('generateError')"
            />
          </div>

          <div v-if="previewState === 'image'" class="preview-meta">
            <span>{{ state.options.size }} × {{ state.options.size }} px</span>
            <span>PNG · ECC {{ state.options.ecc }} · {{ t('margin') }} {{ state.options.margin }}</span>
          </div>
        </UiCard>

        <UiCard class="history-section" padding="sm">
          <UiSectionHead :title="t('history')">
            <template #actions>
              <UiButton
                v-if="history.length"
                variant="ghost"
                size="sm"
                :aria-label="t('clearHistory')"
                @click="clearHistory"
              >
                {{ t('clearHistory') }}
              </UiButton>
            </template>
          </UiSectionHead>

          <div class="history-list" aria-live="polite">
            <UiEmptyState v-if="!history.length" compact :description="t('noHistory')" />
            <button
              v-for="(h, i) in history"
              :key="h.signature"
              class="history-item"
              type="button"
              :aria-label="t('reload')"
              :title="t('reload')"
              @click="loadFromHistory(i)"
            >
              <UiBadge variant="accent" size="sm">{{ t('type_' + h.type) }}</UiBadge>
              <span class="history-label" :title="h.label">{{ h.label }}</span>
              <span class="history-time">{{ h.timeStr }}</span>
            </button>
          </div>
        </UiCard>
      </div>
    </section>
  </UiPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.workspace .control-panel {
  position: sticky;
  top: calc(var(--ok-topbar-h, 3.4rem) + 1rem);
  height: auto;
}

.control-panel .type-tabs {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.type-tabs :deep(.ui-segmented-item) {
  justify-content: center;
  padding: 0.3rem 0.15rem;
  font-size: 0.72rem;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel);
}

.color-input input[type='color'] {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.color-input input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input input[type='color']::-webkit-color-swatch {
  border: 1px solid var(--ok-line);
  border-radius: 3px;
}

.color-value {
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--ok-text);
  text-transform: uppercase;
}

.generate-btn {
  margin-top: 0.15rem;
}

.preview-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.8rem;
}

.preview-download.downloaded {
  color: var(--ok-up);
}

.preview-card :deep(.ui-section-head) {
  margin-bottom: 0;
}

.preview-card :deep(.ui-card-body) {
  gap: 0.65rem;
}

.history-section :deep(.ui-card-body) {
  gap: 0;
}

.download-error {
  margin-bottom: 0.1rem;
}

.preview-stage {
  display: flex;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
}

.preview-stage :deep(.ui-empty) {
  padding: 0.75rem;
  border: 0;
  background: transparent;
}

.preview-stage :deep(.ui-loading) {
  justify-content: center;
}

.qr-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 340px;
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.3rem 0.8rem;
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  color: var(--ok-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 280px;
  overflow-y: auto;
}

.history-item {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.42rem 0.55rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
  color: var(--ok-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.history-item:hover {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
}

.history-label {
  overflow: hidden;
  color: var(--ok-text);
  font-family: var(--ok-mono);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  white-space: nowrap;
}

@media (max-width: 860px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .workspace .control-panel {
    position: static;
  }
  .preview-stage {
    min-height: 260px;
  }
}

@media (max-width: 520px) {
  .preview-stage {
    min-height: 240px;
    padding: 0.75rem;
  }
  .preview-meta {
    font-size: 0.64rem;
  }
  .type-tabs :deep(.ui-segmented-item) {
    padding: 0.28rem 0.1rem;
    font-size: 0.66rem;
  }
  .history-item {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .history-time {
    grid-column: 1 / -1;
    font-size: 0.62rem;
  }
}
</style>
