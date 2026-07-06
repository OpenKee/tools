<script setup>
/* ============================================================
   QR Forge — 二维码生成器（Vue 3 SFC 迁移版）
   - 共享 i18n：useT（来自 ../i18n.js），语言切换由 AppHeader 负责
   - 共享工具：locale（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   ============================================================ */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// 语言切换由 AppHeader 内部的 toggleLang 按钮负责，本组件只需 useT 取翻译。

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'QR tool',
    title: 'QR Forge',
    lead: 'Generate and customize QR codes for text, URLs, WiFi, email, and phone — with live preview and PNG download.',
    typeLabel: 'Content type',
    typeText: 'Text',
    typeUrl: 'URL',
    typeWifi: 'WiFi',
    typeEmail: 'Email',
    typePhone: 'Phone',
    labelText: 'Text content',
    labelUrl: 'URL',
    labelSsid: 'Network name (SSID)',
    labelPassword: 'Password',
    labelEncryption: 'Encryption',
    labelEmail: 'Email address',
    labelPhone: 'Phone number',
    placeholderText: 'Enter any text…',
    placeholderUrl: 'https://example.com',
    placeholderSsid: 'MyNetwork',
    placeholderPassword: 'password',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+1 234 567 890',
    encWpa: 'WPA/WPA2',
    encWep: 'WEP',
    encNone: 'None',
    size: 'Size',
    foreground: 'Foreground',
    background: 'Background',
    ecc: 'Error correction',
    margin: 'Margin',
    generate: 'Generate',
    download: 'Download PNG',
    history: 'History',
    clearHistory: 'Clear',
    noHistory: 'No history yet. Generated codes will appear here.',
    reload: 'Reload this QR code',
    previewEmpty: 'Enter content to generate a QR code',
    generating: 'Generating…',
    generateError: 'Failed to generate QR code. Please try again.',
    downloadError: 'Download failed. Please try again.',
    downloaded: 'Downloaded',
    type_text: 'Text',
    type_url: 'URL',
    type_wifi: 'WiFi',
    type_email: 'Email',
    type_phone: 'Phone',
  },
  zh: {
    eyebrow: '二维码工具',
    title: '二维码工坊',
    lead: '为文本、网址、WiFi、邮箱、电话生成并自定义二维码 — 实时预览，支持下载 PNG。',
    typeLabel: '内容类型',
    typeText: '文本',
    typeUrl: '网址',
    typeWifi: 'WiFi',
    typeEmail: '邮箱',
    typePhone: '电话',
    labelText: '文本内容',
    labelUrl: '网址',
    labelSsid: '网络名称 (SSID)',
    labelPassword: '密码',
    labelEncryption: '加密方式',
    labelEmail: '邮箱地址',
    labelPhone: '电话号码',
    placeholderText: '输入任意文本…',
    placeholderUrl: 'https://example.com',
    placeholderSsid: '我的网络',
    placeholderPassword: '密码',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+86 138 0000 0000',
    encWpa: 'WPA/WPA2',
    encWep: 'WEP',
    encNone: '无',
    size: '尺寸',
    foreground: '前景色',
    background: '背景色',
    ecc: '容错级别',
    margin: '边距',
    generate: '生成',
    download: '下载 PNG',
    history: '历史记录',
    clearHistory: '清空',
    noHistory: '暂无历史记录。生成的二维码会显示在这里。',
    reload: '重新加载此二维码',
    previewEmpty: '输入内容以生成二维码',
    generating: '生成中…',
    generateError: '二维码生成失败，请重试。',
    downloadError: '下载失败，请重试。',
    downloaded: '已下载',
    type_text: '文本',
    type_url: '网址',
    type_wifi: 'WiFi',
    type_email: '邮箱',
    type_phone: '电话',
  },
}

// useT 返回 computed ref，模板中 t('key') 自动 unwrap；脚本中用 t.value('key')
const t = useT(copy)

// ---------- 类型 tabs 配置 ----------
const TYPES = [
  { key: 'text', label: 'typeText' },
  { key: 'url', label: 'typeUrl' },
  { key: 'wifi', label: 'typeWifi' },
  { key: 'email', label: 'typeEmail' },
  { key: 'phone', label: 'typePhone' },
]

// ---------- 各类型输入字段配置 ----------
const FIELD_CONFIGS = {
  text: [
    { key: 'text', label: 'labelText', kind: 'textarea', placeholder: 'placeholderText' },
  ],
  url: [
    { key: 'url', label: 'labelUrl', kind: 'input', inputType: 'url', placeholder: 'placeholderUrl' },
  ],
  wifi: [
    { key: 'ssid', label: 'labelSsid', kind: 'input', inputType: 'text', placeholder: 'placeholderSsid' },
    { key: 'password', label: 'labelPassword', kind: 'input', inputType: 'text', placeholder: 'placeholderPassword' },
    { key: 'encryption', label: 'labelEncryption', kind: 'select', options: [
      { value: 'WPA', label: 'encWpa' },
      { value: 'WEP', label: 'encWep' },
      { value: 'nopass', label: 'encNone' },
    ] },
  ],
  email: [
    { key: 'email', label: 'labelEmail', kind: 'input', inputType: 'email', placeholder: 'placeholderEmail' },
  ],
  phone: [
    { key: 'phone', label: 'labelPhone', kind: 'input', inputType: 'tel', placeholder: 'placeholderPhone' },
  ],
}

// ---------- 响应式状态 ----------
const state = reactive({
  type: 'text',
  inputs: { text: '', url: '', ssid: '', password: '', encryption: 'WPA', email: '', phone: '' },
  options: { size: 256, fgColor: '#1a1a2e', bgColor: '#ffffff', ecc: 'M', margin: 4 },
})

const history = ref([])            // 历史记录列表
const previewState = ref('empty')  // empty | loading | error | image
const downloading = ref(false)     // 下载中标志
const qrImgEl = ref(null)          // <img> 模板引用，用于赋值 onload/onerror/src

let debounceTimer = null           // 防抖定时器
let currentToken = 0               // 当前请求令牌，用于丢弃过期的图片加载回调
let skipWatch = false              // 从历史恢复时跳过一次 watch 触发，避免覆盖立即生成

// ---------- 计算属性 ----------
// 当前类型对应的输入字段
const currentFields = computed(() => FIELD_CONFIGS[state.type] || [])
// 下载按钮禁用条件：非 image 状态或下载中
const downloadDisabled = computed(() => previewState.value !== 'image' || downloading.value)
// 二维码图片 alt 文案
const qrAlt = computed(() => t.value('type_' + state.type) + ' QR code')

// ---------- 工具函数 ----------
// 根据类型与输入拼装二维码数据
function buildData(type, inputs) {
  switch (type) {
    case 'text':
      return inputs.text || ''
    case 'url':
      return inputs.url || ''
    case 'wifi': {
      const enc = inputs.encryption || 'WPA'
      const ssid = inputs.ssid || ''
      const pass = inputs.password || ''
      // WiFi 二维码标准格式
      return 'WIFI:T:' + enc + ';S:' + ssid + ';P:' + pass + ';;'
    }
    case 'email':
      return 'mailto:' + (inputs.email || '')
    case 'phone':
      return 'tel:' + (inputs.phone || '')
    default:
      return ''
  }
}

// 构造二维码 API 地址（颜色去掉 # 前缀）
function buildQrUrl(data, opts) {
  const size = opts.size
  const color = (opts.fgColor || '#000000').replace('#', '')
  const bgcolor = (opts.bgColor || '#ffffff').replace('#', '')
  const ecc = opts.ecc
  const margin = opts.margin
  const params = new URLSearchParams()
  params.set('size', size + 'x' + size)
  params.set('data', data)
  params.set('color', color)
  params.set('bgcolor', bgcolor)
  params.set('ecc', ecc)
  params.set('margin', String(margin))
  return 'https://api.qrserver.com/v1/create-qr-code/?' + params.toString()
}

// 生成历史条目的展示标签（剥除协议前缀，截断超长文本）
function buildHistoryLabel(type, data) {
  const clean = data
    .replace(/^WIFI:T:.*;S:/, '')
    .replace(/;P:.*;;$/, '')
    .replace(/^mailto:/, '')
    .replace(/^tel:/, '')
  const label = clean || data
  return label.length > 48 ? label.slice(0, 48) + '…' : label
}

// ---------- 预览状态控制 ----------
function setPreviewState(name) {
  previewState.value = name
}

// ---------- 生成二维码 ----------
function generate() {
  const data = buildData(state.type, state.inputs)
  // 数据为空时显示空状态（剥除 mailto:/tel: 空协议后判断）
  if (!data || !data.replace(/^(mailto:|tel:)$/, '').trim()) {
    setPreviewState('empty')
    return
  }

  const url = buildQrUrl(data, state.options)
  const token = ++currentToken
  setPreviewState('loading')

  const img = qrImgEl.value
  if (!img) return

  // 图片加载成功（过期请求丢弃）
  img.onload = function () {
    if (token !== currentToken) return
    setPreviewState('image')
    addToHistory(state.type, state.inputs, state.options, data)
  }

  // 图片加载失败（过期请求丢弃）
  img.onerror = function () {
    if (token !== currentToken) return
    setPreviewState('error')
  }

  // 赋值 src 触发加载（加时间戳避免缓存导致 onload 不触发）
  img.src = url + '&_t=' + token
}

// 防抖生成（500ms）
function scheduleGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(function () {
    generate()
  }, 500)
}

// ---------- 历史记录 ----------
function addToHistory(type, inputs, options, data) {
  // 生成签名用于去重（与最近一条比较）
  const signature = type + '|' + data + '|' + options.size + '|' +
    options.fgColor + '|' + options.bgColor + '|' + options.ecc + '|' + options.margin
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

  // 最多保留 20 条
  if (history.value.length > 20) history.value.splice(20)
}

// 从历史记录恢复并重新生成
function loadFromHistory(idx) {
  const h = history.value[idx]
  if (!h) return
  // 跳过 watch 触发的防抖生成，由下面的 generate() 立即生成
  skipWatch = true
  state.type = h.type
  Object.assign(state.inputs, h.inputs)
  Object.assign(state.options, h.options)
  generate()
}

// 清空历史
function clearHistory() {
  history.value = []
}

// ---------- 类型 tab 切换 ----------
function selectType(type) {
  if (type === state.type) return
  state.type = type
  // watch 会触发 scheduleGenerate
}

// ---------- 生成按钮（立即生成，取消挂起的防抖） ----------
function onGenerateClick() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  generate()
}

// ---------- 下载 PNG ----------
async function downloadPng() {
  if (downloadDisabled.value || !qrImgEl.value || !qrImgEl.value.src) return
  downloading.value = true
  try {
    // 通过 fetch 获取图片 blob 再触发下载
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
    // 释放 blob URL
    setTimeout(function () { URL.revokeObjectURL(blobUrl) }, 1000)
  } catch (e) {
    alert(t.value('downloadError'))
  } finally {
    downloading.value = false
  }
}

// ---------- 响应式副作用：输入/选项变化时防抖重新生成 ----------
watch(
  () => [state.type, JSON.stringify(state.inputs), JSON.stringify(state.options)],
  () => {
    if (skipWatch) { skipWatch = false; return }
    scheduleGenerate()
  },
)

// ---------- 初始化：首次生成 ----------
onMounted(function () {
  generate()
})
</script>

<template>
  <AppHeader />
  <main class="shell qr-app">
    <!-- 页头 -->
    <header class="masthead">
      <div>
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </div>
    </header>

    <section class="workspace">
      <!-- 左侧控制面板 -->
      <div class="control-panel">
        <!-- 类型选择 tabs -->
        <div class="field-group">
          <span class="field-label">{{ t('typeLabel') }}</span>
          <div class="type-tabs" role="tablist" aria-label="QR content type">
            <button
              v-for="tp in TYPES"
              :key="tp.key"
              class="type-tab"
              :class="{ active: state.type === tp.key }"
              type="button"
              role="tab"
              :aria-selected="state.type === tp.key ? 'true' : 'false'"
              @click="selectType(tp.key)"
            >{{ t(tp.label) }}</button>
          </div>
        </div>

        <!-- 动态输入区 -->
        <div class="input-area" aria-live="polite">
          <div v-for="f in currentFields" :key="f.key" class="field-group">
            <label class="field-label" :for="'inp-' + f.key">{{ t(f.label) }}</label>
            <textarea
              v-if="f.kind === 'textarea'"
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              class="text-input"
              rows="3"
              :placeholder="t(f.placeholder)"
              :aria-label="t(f.label)"
            ></textarea>
            <select
              v-else-if="f.kind === 'select'"
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              class="text-input"
              :aria-label="t(f.label)"
            >
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ t(o.label) }}</option>
            </select>
            <input
              v-else
              :id="'inp-' + f.key"
              v-model="state.inputs[f.key]"
              class="text-input"
              :type="f.inputType || 'text'"
              :placeholder="t(f.placeholder)"
              :aria-label="t(f.label)"
            />
          </div>
        </div>

        <!-- 尺寸 -->
        <div class="field-group">
          <label class="field-label" for="sizeSelect">{{ t('size') }}</label>
          <select id="sizeSelect" v-model="state.options.size" class="text-input" aria-label="QR size">
            <option :value="128">128 px</option>
            <option :value="256">256 px</option>
            <option :value="512">512 px</option>
            <option :value="1024">1024 px</option>
          </select>
        </div>

        <!-- 前景色 / 背景色 -->
        <div class="field-row">
          <div class="field-group">
            <label class="field-label" for="fgColor">{{ t('foreground') }}</label>
            <div class="color-input">
              <input id="fgColor" v-model="state.options.fgColor" type="color" aria-label="Foreground color" />
              <span class="color-value">{{ state.options.fgColor }}</span>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="bgColor">{{ t('background') }}</label>
            <div class="color-input">
              <input id="bgColor" v-model="state.options.bgColor" type="color" aria-label="Background color" />
              <span class="color-value">{{ state.options.bgColor }}</span>
            </div>
          </div>
        </div>

        <!-- 容错级别 / 边距 -->
        <div class="field-row">
          <div class="field-group">
            <label class="field-label" for="eccSelect">{{ t('ecc') }}</label>
            <select id="eccSelect" v-model="state.options.ecc" class="text-input" aria-label="Error correction level">
              <option value="L">L — 7%</option>
              <option value="M">M — 15%</option>
              <option value="Q">Q — 25%</option>
              <option value="H">H — 30%</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="marginRange">{{ t('margin') }}</label>
            <div class="range-input">
              <input
                id="marginRange"
                v-model.number="state.options.margin"
                type="range"
                min="1"
                max="10"
                aria-label="Quiet zone margin"
              />
              <span class="range-value">{{ state.options.margin }}</span>
            </div>
          </div>
        </div>

        <button class="ok-btn-primary generate-btn" type="button" @click="onGenerateClick">{{ t('generate') }}</button>
      </div>

      <!-- 右侧预览区 -->
      <div class="preview-panel">
        <div class="preview-card">
          <div v-show="previewState === 'empty'" class="preview-empty">{{ t('previewEmpty') }}</div>
          <img
            v-show="previewState === 'image'"
            ref="qrImgEl"
            class="qr-image"
            :alt="qrAlt"
          />
          <div v-show="previewState === 'loading'" class="preview-loading">
            <span class="spinner"></span>
            <span>{{ t('generating') }}</span>
          </div>
          <div v-show="previewState === 'error'" class="preview-error">{{ t('generateError') }}</div>
        </div>

        <button
          class="ok-btn-primary download-btn"
          type="button"
          :disabled="downloadDisabled"
          @click="downloadPng"
        >{{ t('download') }}</button>

        <!-- 历史 -->
        <div class="history-section">
          <div class="section-head">
            <h2>{{ t('history') }}</h2>
            <button class="link-btn" type="button" :aria-label="t('clearHistory')" @click="clearHistory">{{ t('clearHistory') }}</button>
          </div>
          <div class="history-list" aria-live="polite">
            <p v-if="!history.length" class="history-empty">{{ t('noHistory') }}</p>
            <button
              v-for="(h, i) in history"
              :key="h.signature"
              class="history-item"
              type="button"
              :aria-label="t('reload')"
              @click="loadFromHistory(i)"
            >
              <span class="history-type">{{ t('type_' + h.type) }}</span>
              <span class="history-label" :title="h.label">{{ h.label }}</span>
              <span class="history-time">{{ h.timeStr }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
  <AppFooter />
</template>

<style scoped>
/* ============================================================
   主题变量：原 :root 中的自定义变量迁移到组件根类 .qr-app，
   同时把 --ok-* 共享 token 映射到本应用主题色（影响 .qr-app 内
   所有使用 var(--ok-*) 的元素，包括 ok-btn-primary 等共享类）。
   ============================================================ */
.qr-app {
  --bg: #f8f9fa;
  --panel: #ffffff;
  --line: #e0e4e8;
  --text: #1a1a2e;
  --muted: #6c757d;
  --accent: #4361ee;
  --accent-soft: #e8ecff;
  --dark: #1a1a2e;
  --light: #ffffff;

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
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1100px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
  gap: 1rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

h1 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 55ch;
}

/* ---------- 工作区两栏布局 ---------- */
.workspace {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

/* ---------- 控制面板 ---------- */
.control-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.25rem;
  border-radius: var(--ok-radius, 8px);
}

.field-group {
  margin-bottom: 1rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field-row .field-group {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
}

/* ---------- 类型 tabs ---------- */
.type-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  background: var(--bg);
  border: 1px solid var(--line);
  padding: 0.25rem;
  border-radius: var(--ok-radius-sm, 4px);
}

.type-tab {
  flex: 1 1 auto;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.45rem 0.5rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: var(--ok-radius-sm, 4px);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  min-width: 56px;
}

.type-tab:hover {
  color: var(--text);
}

.type-tab.active {
  background: var(--panel);
  border-color: var(--line);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* ---------- 输入区 ---------- */
.input-area {
  margin-bottom: 0.5rem;
}

.text-input {
  font: inherit;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-size: 0.88rem;
  border-radius: var(--ok-radius-sm, 4px);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

textarea.text-input {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

select.text-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236c757d' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
}

/* ---------- 颜色选择器 ---------- */
.color-input {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--line);
  background: var(--bg);
  padding: 0.3rem 0.6rem;
  border-radius: var(--ok-radius-sm, 4px);
}

.color-input input[type="color"] {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
}

.color-input input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input input[type="color"]::-webkit-color-swatch {
  border: 1px solid var(--line);
  border-radius: 4px;
}

.color-value {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.8rem;
  color: var(--text);
  text-transform: uppercase;
}

/* ---------- 滑块 ---------- */
.range-input {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--line);
  background: var(--bg);
  padding: 0.5rem 0.7rem;
  border-radius: var(--ok-radius-sm, 4px);
}

.range-input input[type="range"] {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.range-value {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent);
  min-width: 1.2rem;
  text-align: center;
}

/* ---------- 生成按钮 ---------- */
.generate-btn {
  width: 100%;
  margin-top: 0.25rem;
}

/* ---------- 预览区 ---------- */
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--ok-radius, 8px);
  padding: 2rem;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(26, 26, 46, 0.06);
  position: relative;
}

/* 以下三个 overlay 与 img 的显隐由 v-show 控制，base 即为「显示态」样式 */
.qr-image {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: 360px;
  border-radius: 4px;
}

.preview-empty,
.preview-error {
  display: block;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  padding: 2rem 1rem;
}

.preview-error {
  color: #dc2626;
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  padding: 2rem 1rem;
}

/* 预览加载 spinner */
.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: qr-spin 0.6s linear infinite;
}

@keyframes qr-spin { to { transform: rotate(360deg); } }

/* ---------- 下载按钮 ---------- */
.download-btn {
  width: 100%;
}

.download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---------- 历史区 ---------- */
.history-section {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--ok-radius, 8px);
  padding: 1rem 1.25rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-head h2 {
  font-size: 1rem;
  font-weight: 700;
}

.link-btn {
  font: inherit;
  font-size: 0.76rem;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--ok-radius-sm, 4px);
}

.link-btn:hover {
  color: var(--accent);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 320px;
  overflow-y: auto;
}

.history-empty {
  color: var(--muted);
  font-size: 0.82rem;
  padding: 0.5rem 0;
}

.history-item {
  font: inherit;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  border-radius: var(--ok-radius-sm, 4px);
  transition: border-color 0.15s, background 0.15s;
}

.history-item:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.history-type {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  white-space: nowrap;
}

.history-label {
  font-size: 0.82rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
}

.history-time {
  font-size: 0.7rem;
  color: var(--muted);
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  white-space: nowrap;
}

/* ---------- 响应式 ---------- */
@media (max-width: 820px) {
  .workspace {
    grid-template-columns: 1fr;
  }
  .preview-card {
    min-height: 260px;
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .field-row {
    grid-template-columns: 1fr;
  }
  .type-tab {
    font-size: 0.72rem;
    padding: 0.4rem 0.3rem;
  }
  .history-item {
    grid-template-columns: auto 1fr;
  }
  .history-time {
    grid-column: 1 / -1;
    font-size: 0.66rem;
  }
}
</style>
