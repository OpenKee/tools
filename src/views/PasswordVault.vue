<script setup>
/* ============================================================
   Password Vault — 密码生成器（Vue 3 SFC 迁移版）
   - 共享 i18n：i18nState / useT / toggleLang（来自 ../i18n.js）
   - 共享工具：lsGet / lsSet / locale（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   - 所有随机性均来自 crypto.getRandomValues()，确保密码学安全。
   ============================================================ */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { i18nState, toggleLang, useT } from '../i18n.js'
import { lsGet, lsSet, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Security tool',
    title: 'Password Vault',
    lead: 'Generate cryptographically secure passwords with real-time strength analysis, entropy estimation, and crack-time forecasting.',
    lengthLabel: 'Length',
    optionsLabel: 'Character types',
    optUppercase: 'Uppercase (A–Z)',
    optLowercase: 'Lowercase (a–z)',
    optDigits: 'Digits (0–9)',
    optSymbols: 'Symbols (!@#$…)',
    optExcludeSimilar: 'Exclude similar (0/O/1/l/I)',
    generate: 'Generate',
    regenerate: 'Regenerate',
    copy: 'Copy',
    copied: 'Copied',
    copyAll: 'Copy all',
    strengthLabel: 'Strength analysis',
    entropyLabel: 'Entropy',
    bitsUnit: 'bits',
    crackTimeLabel: 'Estimated crack time',
    compositionLabel: 'Character composition',
    compUppercase: 'Uppercase',
    compLowercase: 'Lowercase',
    compDigits: 'Digits',
    compSymbols: 'Symbols',
    levelWeak: 'Weak',
    levelMedium: 'Medium',
    levelStrong: 'Strong',
    levelVeryStrong: 'Very strong',
    batchLabel: 'Batch generate',
    batchGenerate: 'Generate',
    batchResults: 'Batch results',
    historyLabel: 'History',
    clearHistory: 'Clear',
    noHistory: 'No history yet. Generated passwords will appear here.',
    noBatch: 'Generate a batch to see multiple passwords.',
    noOptions: 'Select at least one character type.',
    emptyPassword: '—',
    copyFailed: 'Copy failed',
    timeInstant: 'Instant',
    timeSecond: 'second',
    timeMinute: 'minute',
    timeHour: 'hour',
    timeDay: 'day',
    timeYear: 'year',
    ariaCopy: 'Copy password',
    ariaRegenerate: 'Regenerate password',
    ariaCheckBreach: 'Check password breach',
    checkBreach: 'Check breach',
    breachSafe: 'No breaches found',
    breachFound: 'Found in {n} breaches',
    breachError: 'Check failed',
    ariaLength: 'Password length',
    ariaBatchCount: 'Batch count',
    ariaStrength: 'Password strength',
  },
  zh: {
    eyebrow: '安全工具',
    title: '密码保险箱',
    lead: '生成加密安全的随机密码，提供实时强度分析、熵值估算与破解时间预测。',
    lengthLabel: '长度',
    optionsLabel: '字符类型',
    optUppercase: '大写字母 (A–Z)',
    optLowercase: '小写字母 (a–z)',
    optDigits: '数字 (0–9)',
    optSymbols: '特殊符号 (!@#$…)',
    optExcludeSimilar: '排除相似字符 (0/O/1/l/I)',
    generate: '生成密码',
    regenerate: '重新生成',
    copy: '复制',
    copied: '已复制',
    copyAll: '全部复制',
    strengthLabel: '强度分析',
    entropyLabel: '熵值',
    bitsUnit: '位',
    crackTimeLabel: '预估破解时间',
    compositionLabel: '字符组成',
    compUppercase: '大写',
    compLowercase: '小写',
    compDigits: '数字',
    compSymbols: '符号',
    levelWeak: '弱',
    levelMedium: '中',
    levelStrong: '强',
    levelVeryStrong: '极强',
    batchLabel: '批量生成',
    batchGenerate: '生成',
    batchResults: '批量结果',
    historyLabel: '历史记录',
    clearHistory: '清空',
    noHistory: '暂无历史记录。生成的密码会显示在这里。',
    noBatch: '生成批量密码以查看多个结果。',
    noOptions: '请至少选择一种字符类型。',
    emptyPassword: '—',
    copyFailed: '复制失败',
    timeInstant: '瞬间',
    timeSecond: '秒',
    timeMinute: '分',
    timeHour: '小时',
    timeDay: '天',
    timeYear: '年',
    ariaCopy: '复制密码',
    ariaRegenerate: '重新生成密码',
    ariaCheckBreach: '检查密码是否泄露',
    checkBreach: '检查泄露',
    breachSafe: '未发现泄露',
    breachFound: '发现于 {n} 次泄露中',
    breachError: '检查失败',
    ariaLength: '密码长度',
    ariaBatchCount: '批量数量',
    ariaStrength: '密码强度',
  },
}

// useT 返回 computed ref，模板中 t('key') 自动 unwrap；脚本中用 t.value('key')
const t = useT(copy)

// ---------- 字符集定义 ----------
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?/~'
// 排除相似字符集合
const SIMILAR = '0Oo1lI|`'

// ---------- 响应式状态 ----------
const state = reactive({
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  exclude: false,
  batchCount: 5,
})

const currentPassword = ref('')     // 当前展示的密码
const history = ref([])             // 历史记录列表
const batchPasswords = ref([])      // 批量生成的密码
const breachResult = ref('—')       // 泄露检查结果文案
const breachChecking = ref(false)   // 泄露检查进行中

// 复制成功的视觉反馈标志
const copiedMain = ref(false)       // 主复制按钮
const copiedAll = ref(false)        // 全部复制按钮
const copiedBatchIdx = ref(-1)      // 批量项复制按钮（-1 表示无）

// ---------- 历史记录持久化（localStorage） ----------
const HISTORY_KEY = 'pv-history'

function loadHistory() {
  try {
    return JSON.parse(lsGet(HISTORY_KEY) || '[]')
  } catch (e) {
    return []
  }
}

function saveHistory() {
  lsSet(HISTORY_KEY, JSON.stringify(history.value))
}

// ---------- 工具函数 ----------
// 从字符串中移除相似字符
function filterSimilar(str) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    if (SIMILAR.indexOf(str[i]) === -1) result += str[i]
  }
  return result
}

// 基于当前选项构造可用字符集数组（已过滤相似字符）
function buildSets() {
  const sets = []
  if (state.upper) sets.push(state.exclude ? filterSimilar(UPPER) : UPPER)
  if (state.lower) sets.push(state.exclude ? filterSimilar(LOWER) : LOWER)
  if (state.digits) sets.push(state.exclude ? filterSimilar(DIGITS) : DIGITS)
  if (state.symbols) sets.push(state.exclude ? filterSimilar(SYMBOLS) : SYMBOLS)
  // 过滤后可能为空字符串，剔除
  return sets.filter(function (s) { return s.length > 0 })
}

// 拼接完整字符池
function buildPool(sets) {
  return sets.join('')
}

/**
 * 密码学安全的随机整数 [0, max)。
 * 使用拒绝采样消除取模偏差。
 */
function secureRandomInt(max) {
  if (max <= 0) return 0
  const range = 4294967296 // 2^32
  const limit = range - (range % max) // 最大可接受边界
  const arr = new Uint32Array(1)
  let x
  do {
    crypto.getRandomValues(arr)
    x = arr[0]
  } while (x >= limit)
  return x % max
}

/**
 * 生成密码。
 * 保证每个已选字符集至少出现一次（当长度足够时），再用 Fisher-Yates 洗牌。
 */
function generatePassword(length, sets) {
  const pool = buildPool(sets)
  if (!pool || length <= 0) return ''
  const chars = []
  // 先从每个集合各取一个，保证覆盖
  const ensureCount = Math.min(sets.length, length)
  for (let i = 0; i < ensureCount; i++) {
    chars.push(sets[i][secureRandomInt(sets[i].length)])
  }
  // 填充剩余长度
  for (let j = ensureCount; j < length; j++) {
    chars.push(pool[secureRandomInt(pool.length)])
  }
  // Fisher-Yates 洗牌（使用安全随机）
  for (let k = chars.length - 1; k > 0; k--) {
    const idx = secureRandomInt(k + 1)
    const tmp = chars[k]
    chars[k] = chars[idx]
    chars[idx] = tmp
  }
  return chars.join('')
}

// 计算熵值（bits）= 长度 * log2(字符池大小)
function calcEntropy(length, poolSize) {
  if (poolSize <= 0 || length <= 0) return 0
  return length * Math.log2(poolSize)
}

// 根据熵值判定强度等级
function strengthFromEntropy(entropy) {
  if (entropy < 35) return 'weak'
  if (entropy < 60) return 'medium'
  if (entropy < 120) return 'strong'
  return 'verystrong'
}

// 强度等级文案
function levelLabel(level) {
  if (level === 'weak') return t.value('levelWeak')
  if (level === 'medium') return t.value('levelMedium')
  if (level === 'strong') return t.value('levelStrong')
  return t.value('levelVeryStrong')
}

// 分析密码字符组成
function analyzeComposition(pwd) {
  const counts = { upper: 0, lower: 0, digit: 0, symbol: 0 }
  for (let i = 0; i < pwd.length; i++) {
    const ch = pwd[i]
    if (UPPER.indexOf(ch) !== -1) counts.upper++
    else if (LOWER.indexOf(ch) !== -1) counts.lower++
    else if (DIGITS.indexOf(ch) !== -1) counts.digit++
    else counts.symbol++
  }
  return counts
}

// 时间单位单词（处理英文复数）
function unitWord(n, key) {
  const word = t.value(key)
  if (i18nState.lang === 'en' && n !== 1) return word + 's'
  return word
}

/**
 * 估算破解时间。
 * 假设离线快速攻击 1e10 次/秒，平均需要尝试 2^entropy / 2 次。
 */
function formatCrackTime(entropy) {
  if (entropy <= 0) return t.value('timeInstant')
  const guesses = Math.pow(2, entropy) / 2
  const seconds = guesses / 1e10
  if (!isFinite(seconds) || seconds < 1) return t.value('timeInstant')

  const minute = 60, hour = 3600, day = 86400, year = 31536000
  let val, key
  if (seconds < minute) { val = seconds; key = 'timeSecond' }
  else if (seconds < hour) { val = seconds / minute; key = 'timeMinute' }
  else if (seconds < day) { val = seconds / hour; key = 'timeHour' }
  else if (seconds < year) { val = seconds / day; key = 'timeDay' }
  else { val = seconds / year; key = 'timeYear' }

  // 极大年数使用科学计数法
  if (key === 'timeYear' && val >= 1e6) {
    return val.toExponential(2) + ' ' + unitWord(val, key)
  }
  const rounded = val < 10 ? Math.round(val * 10) / 10 : Math.round(val)
  return rounded + ' ' + unitWord(rounded, key)
}

// ---------- 泄露检查（Have I Been Pwned k-Anonymity） ----------
function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

async function checkBreach(password) {
  if (!password || password === '—') {
    breachResult.value = t.value('breachError')
    return
  }
  breachChecking.value = true
  breachResult.value = '…'
  try {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-1', encoder.encode(password))
    const hash = bufferToHex(buffer).toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
      headers: { Accept: 'text/plain' },
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const text = await res.text()
    const lines = text.split('\n')
    let found = 0
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(':')
      if (parts.length === 2 && parts[0] === suffix) {
        found = parseInt(parts[1], 10) || 0
        break
      }
    }
    breachResult.value = found > 0
      ? t.value('breachFound').replace('{n}', String(found))
      : t.value('breachSafe')
  } catch (e) {
    breachResult.value = t.value('breachError')
  } finally {
    breachChecking.value = false
  }
}

// ---------- 计算属性 ----------
// 当前选项下的字符集与字符池大小
const sets = computed(() => buildSets())
const poolSize = computed(() => buildPool(sets.value).length)
const poolIsEmpty = computed(() => sets.value.length === 0)

// 字符组成
const composition = computed(() => analyzeComposition(currentPassword.value))

// 熵值与强度等级
const entropy = computed(() =>
  currentPassword.value ? calcEntropy(currentPassword.value.length, poolSize.value) : 0,
)
const level = computed(() =>
  currentPassword.value ? strengthFromEntropy(entropy.value) : null,
)

// 强度条填充宽度（熵值映射到 0-128 bits 区间）
const strengthPct = computed(() => Math.min(100, (entropy.value / 128) * 100))

// 熵值、破解时间、等级文案
const entropyText = computed(() => currentPassword.value ? entropy.value.toFixed(1) : '—')
const crackTimeText = computed(() => currentPassword.value ? formatCrackTime(entropy.value) : '—')
const levelText = computed(() => level.value ? levelLabel(level.value) : '—')

// 密码区展示文案：无密码时根据选项状态给出提示
const passwordDisplayText = computed(() => {
  if (!currentPassword.value) {
    return poolIsEmpty.value ? t.value('noOptions') : t.value('emptyPassword')
  }
  return currentPassword.value
})
const passwordIsEmpty = computed(() => !currentPassword.value)

// ---------- 复制功能 ----------
function copyToClipboard(text) {
  if (!text) return Promise.resolve()
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () {
      return fallbackCopy(text)
    })
  }
  return fallbackCopy(text)
}

// 降级复制方案
function fallbackCopy(text) {
  return new Promise(function (resolve) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (e) { /* 静默失败 */ }
    document.body.removeChild(ta)
    resolve()
  })
}

// 复制成功后的视觉反馈
function flashMain() {
  copiedMain.value = true
  setTimeout(function () { copiedMain.value = false }, 1200)
}
function flashAll() {
  copiedAll.value = true
  setTimeout(function () { copiedAll.value = false }, 1200)
}
function flashBatch(idx) {
  copiedBatchIdx.value = idx
  setTimeout(function () { copiedBatchIdx.value = -1 }, 1200)
}

function onCopyMain() {
  if (!currentPassword.value) return
  copyToClipboard(currentPassword.value).then(flashMain)
}

function onCopyHistory(pwd) {
  if (!pwd) return
  // 点击历史项复制该密码，同时闪烁主复制按钮作为反馈
  copyToClipboard(pwd).then(flashMain)
}

function onCopyBatchItem(idx) {
  const pwd = batchPasswords.value[idx]
  if (!pwd) return
  copyToClipboard(pwd).then(function () { flashBatch(idx) })
}

function onCopyAll() {
  if (!batchPasswords.value.length) return
  copyToClipboard(batchPasswords.value.join('\n')).then(flashAll)
}

// ---------- 生成并展示 ----------
function generateAndShow() {
  const s = buildSets()
  if (s.length === 0) {
    // 未选择任何字符类型，清空密码区以显示提示
    currentPassword.value = ''
    return
  }
  const length = Number(state.length)
  const pool = buildPool(s)
  const pwd = generatePassword(length, s)
  currentPassword.value = pwd
  addToHistory(pwd, pool.length)
}

// ---------- 历史记录 ----------
function addToHistory(pwd, poolSz) {
  if (!pwd) return
  // 与最近一条相同则跳过
  if (history.value.length && history.value[0].password === pwd) return

  const ent = calcEntropy(pwd.length, poolSz)
  const lvl = strengthFromEntropy(ent)
  const timeStr = new Date().toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  })

  history.value.unshift({
    password: pwd,
    entropy: ent,
    level: lvl,
    timeStr: timeStr,
  })
  // 最多保留 20 条
  if (history.value.length > 20) history.value.splice(20)
}

function clearHistory() {
  history.value = []
}

// ---------- 批量生成 ----------
function generateBatch() {
  const s = buildSets()
  if (s.length === 0) {
    batchPasswords.value = []
    currentPassword.value = '' // 触发密码区显示 noOptions 提示
    return
  }
  const length = Number(state.length)
  const count = Number(state.batchCount)
  const arr = []
  for (let i = 0; i < count; i++) {
    arr.push(generatePassword(length, s))
  }
  batchPasswords.value = arr
}

// ---------- 副作用：历史记录变化时持久化 ----------
watch(history, saveHistory, { deep: true })

// ---------- 初始化 ----------
onMounted(function () {
  history.value = loadHistory()
  // 首次生成
  generateAndShow()
})
</script>

<template>
  <div class="pv-app">
    <AppHeader :show-lang-toggle="false" />
    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <button class="ok-lang-toggle" type="button" @click="toggleLang">
            {{ i18nState.lang === 'en' ? '中文' : 'EN' }}
          </button>
        </div>
      </header>

      <section class="workspace">
        <!-- 左侧控制面板 -->
        <aside class="control-panel" aria-label="Password options">
          <!-- 长度滑块 -->
          <div class="field-group">
            <div class="field-head">
              <label class="field-label" for="lengthRange">{{ t('lengthLabel') }}</label>
              <span class="length-value">{{ state.length }}</span>
            </div>
            <div class="range-input">
              <input
                id="lengthRange"
                v-model.number="state.length"
                type="range"
                min="8"
                max="64"
                :aria-label="t('ariaLength')"
              />
            </div>
            <div class="range-marks"><span>8</span><span>64</span></div>
          </div>

          <!-- 字符类型选项 -->
          <div class="field-group">
            <span class="field-label">{{ t('optionsLabel') }}</span>
            <div class="option-list">
              <label class="option">
                <input v-model="state.upper" type="checkbox" @change="generateAndShow" />
                <span class="option-box" aria-hidden="true"></span>
                <span class="option-text">{{ t('optUppercase') }}</span>
              </label>
              <label class="option">
                <input v-model="state.lower" type="checkbox" @change="generateAndShow" />
                <span class="option-box" aria-hidden="true"></span>
                <span class="option-text">{{ t('optLowercase') }}</span>
              </label>
              <label class="option">
                <input v-model="state.digits" type="checkbox" @change="generateAndShow" />
                <span class="option-box" aria-hidden="true"></span>
                <span class="option-text">{{ t('optDigits') }}</span>
              </label>
              <label class="option">
                <input v-model="state.symbols" type="checkbox" @change="generateAndShow" />
                <span class="option-box" aria-hidden="true"></span>
                <span class="option-text">{{ t('optSymbols') }}</span>
              </label>
            </div>
          </div>

          <!-- 排除相似字符 -->
          <div class="field-group">
            <label class="option">
              <input v-model="state.exclude" type="checkbox" @change="generateAndShow" />
              <span class="option-box" aria-hidden="true"></span>
              <span class="option-text">{{ t('optExcludeSimilar') }}</span>
            </label>
          </div>

          <button class="ok-btn-primary generate-btn" type="button" @click="generateAndShow">
            {{ t('generate') }}
          </button>

          <!-- 批量生成 -->
          <div class="field-group batch-group">
            <span class="field-label">{{ t('batchLabel') }}</span>
            <div class="batch-row">
              <select
                v-model.number="state.batchCount"
                class="text-input"
                :aria-label="t('ariaBatchCount')"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
              </select>
              <button class="ok-btn-ghost batch-btn" type="button" @click="generateBatch">
                {{ t('batchGenerate') }}
              </button>
            </div>
          </div>
        </aside>

        <!-- 右侧密码显示与强度分析 -->
        <div class="preview-panel">
          <!-- 密码显示 -->
          <div class="password-card">
            <div
              class="password-display"
              :class="{ empty: passwordIsEmpty }"
              aria-live="polite"
              aria-label="Generated password"
            >{{ passwordDisplayText }}</div>
            <div class="password-actions">
              <button
                class="icon-btn"
                :class="{ copied: copiedMain }"
                type="button"
                :aria-label="t('ariaCopy')"
                @click="onCopyMain"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span class="icon-btn-text">{{ copiedMain ? t('copied') : t('copy') }}</span>
              </button>
              <button
                class="icon-btn"
                type="button"
                :aria-label="t('ariaRegenerate')"
                @click="generateAndShow"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span class="icon-btn-text">{{ t('regenerate') }}</span>
              </button>
              <button
                class="icon-btn"
                type="button"
                :aria-label="t('ariaCheckBreach')"
                :disabled="breachChecking"
                @click="checkBreach(currentPassword)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span class="icon-btn-text">{{ t('checkBreach') }}</span>
              </button>
            </div>
          </div>

          <!-- 强度分析 -->
          <div class="strength-card">
            <div class="section-head">
              <h2>{{ t('strengthLabel') }}</h2>
              <span class="strength-level" :class="level ? 'level-' + level : ''">{{ levelText }}</span>
            </div>
            <div
              class="strength-bar"
              role="meter"
              aria-valuemin="0"
              aria-valuemax="128"
              :aria-valuenow="String(Math.round(entropy))"
              :aria-label="t('ariaStrength')"
            >
              <div
                class="strength-fill"
                :class="level ? 'level-' + level : ''"
                :style="{ width: strengthPct + '%' }"
              ></div>
            </div>
            <div class="strength-stats">
              <div class="stat">
                <span class="stat-label">{{ t('entropyLabel') }}</span>
                <span class="stat-value">{{ entropyText }} <small>{{ t('bitsUnit') }}</small></span>
              </div>
              <div class="stat">
                <span class="stat-label">{{ t('crackTimeLabel') }}</span>
                <span class="stat-value">{{ crackTimeText }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">{{ t('checkBreach') }}</span>
                <span class="stat-value">{{ breachResult }}</span>
              </div>
            </div>
            <div class="composition">
              <span class="field-label">{{ t('compositionLabel') }}</span>
              <div class="comp-grid">
                <div class="comp-item">
                  <span class="comp-dot upper" aria-hidden="true"></span>
                  <span class="comp-name">{{ t('compUppercase') }}</span>
                  <span class="comp-count">{{ composition.upper }}</span>
                </div>
                <div class="comp-item">
                  <span class="comp-dot lower" aria-hidden="true"></span>
                  <span class="comp-name">{{ t('compLowercase') }}</span>
                  <span class="comp-count">{{ composition.lower }}</span>
                </div>
                <div class="comp-item">
                  <span class="comp-dot digit" aria-hidden="true"></span>
                  <span class="comp-name">{{ t('compDigits') }}</span>
                  <span class="comp-count">{{ composition.digit }}</span>
                </div>
                <div class="comp-item">
                  <span class="comp-dot symbol" aria-hidden="true"></span>
                  <span class="comp-name">{{ t('compSymbols') }}</span>
                  <span class="comp-count">{{ composition.symbol }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 批量结果 -->
          <div class="batch-section">
            <div class="section-head">
              <h2>{{ t('batchResults') }}</h2>
              <button
                class="link-btn"
                :class="{ copied: copiedAll }"
                type="button"
                @click="onCopyAll"
              >{{ t('copyAll') }}</button>
            </div>
            <div class="batch-list" aria-live="polite">
              <p v-if="!batchPasswords.length" class="batch-empty">{{ t('noBatch') }}</p>
              <div v-for="(pwd, i) in batchPasswords" :key="i" class="batch-item">
                <span class="batch-idx">{{ i + 1 }}</span>
                <span class="batch-pwd">{{ pwd }}</span>
                <button
                  class="batch-copy"
                  :class="{ copied: copiedBatchIdx === i }"
                  type="button"
                  :aria-label="t('copy')"
                  @click="onCopyBatchItem(i)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 历史记录 -->
          <div class="history-section">
            <div class="section-head">
              <h2>{{ t('historyLabel') }}</h2>
              <button
                class="link-btn"
                type="button"
                :aria-label="t('clearHistory')"
                @click="clearHistory"
              >{{ t('clearHistory') }}</button>
            </div>
            <div class="history-list" aria-live="polite">
              <p v-if="!history.length" class="history-empty">{{ t('noHistory') }}</p>
              <button
                v-for="(h, i) in history"
                :key="i"
                class="history-item"
                type="button"
                :aria-label="t('copy')"
                @click="onCopyHistory(h.password)"
              >
                <span class="history-level" :class="'level-' + h.level">{{ levelLabel(h.level) }}</span>
                <span class="history-pwd" :title="h.password">{{ h.password }}</span>
                <span class="history-time">{{ h.timeStr }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   深色安全主题（GitHub Dark 风格）。
   原 :root 中的自定义变量迁移到组件根类 .pv-app，
   同时把 --ok-* 共享 token 映射到本应用主题色，
   通过 CSS 变量继承影响 AppHeader / AppFooter 等子组件。
   ============================================================ */
.pv-app {
  --bg: #0d1117;
  --panel: #161b22;
  --line: #30363d;
  --text: #e6edf3;
  --muted: #7d8590;
  --accent: #2f81f7;
  --accent-soft: rgba(47, 129, 247, 0.12);
  --green: #3fb950;
  --yellow: #d29922;
  --red: #f85149;

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

  background: var(--bg);
  color: var(--text);
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.pv-app a { color: var(--accent); text-decoration: none; }

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

.header-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* ---------- 工作区两栏布局 ---------- */
.workspace {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

/* ---------- 控制面板 ---------- */
.control-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.25rem;
  border-radius: 8px;
  position: sticky;
  top: 1rem;
}

.field-group {
  margin-bottom: 1.1rem;
}

.field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.field-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.length-value {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
}

/* ---------- 滑块 ---------- */
.range-input {
  border: 1px solid var(--line);
  background: var(--bg);
  padding: 0.55rem 0.7rem;
  border-radius: 4px;
}

.range-input input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}

.range-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 0.35rem;
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.68rem;
  color: var(--muted);
}

/* ---------- 自定义选项（checkbox） ---------- */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.option:hover {
  border-color: var(--accent);
}

.option input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.option-box {
  position: relative;
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  border: 1.5px solid var(--muted);
  border-radius: 3px;
  background: var(--bg);
  transition: border-color 0.15s, background 0.15s;
}

.option-box::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform 0.12s;
}

.option input:checked + .option-box {
  background: var(--accent);
  border-color: var(--accent);
}

.option input:checked + .option-box::after {
  transform: rotate(45deg) scale(1);
}

.option input:focus-visible + .option-box {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.option-text {
  font-size: 0.85rem;
  color: var(--text);
}

/* ---------- 生成按钮 ---------- */
.generate-btn {
  width: 100%;
  margin-top: 0.25rem;
}

.generate-btn:active {
  transform: translateY(1px);
}

/* ---------- 批量生成 ---------- */
.batch-group {
  margin-top: 1.4rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line);
}

.batch-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.batch-btn {
  height: auto;
  padding: 0 0.9rem;
  font-weight: 600;
}

/* ---------- 通用文本输入 ---------- */
.text-input {
  font: inherit;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  border-radius: 4px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

select.text-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%237d8590' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
}

/* ---------- 右侧面板 ---------- */
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- 密码显示卡片 ---------- */
.password-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.password-display {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: clamp(1rem, 2.4vw, 1.35rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
  word-break: break-all;
  line-height: 1.5;
  min-height: 2.4em;
  padding: 0.85rem 1rem;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  user-select: all;
}

.password-display.empty {
  color: var(--muted);
  user-select: none;
}

.password-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.icon-btn {
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 4px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.icon-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}

.icon-btn.copied {
  border-color: var(--green);
  color: var(--green);
}

.icon-btn svg {
  flex-shrink: 0;
}

/* ---------- 强度分析卡片 ---------- */
.strength-card,
.batch-section,
.history-section {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 1.1rem 1.25rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.85rem;
  gap: 0.5rem;
}

.section-head h2 {
  font-size: 0.95rem;
  font-weight: 700;
}

/* ---------- 强度条 ---------- */
.strength-bar {
  position: relative;
  height: 10px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  width: 0%;
  border-radius: 6px;
  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s;
  background: var(--line);
}

/* 各强度等级渐变色：红 → 黄 → 绿 → 蓝 */
.strength-fill.level-weak {
  background: linear-gradient(90deg, #f85149, #ff7b72);
  box-shadow: 0 0 12px rgba(248, 81, 73, 0.45);
}
.strength-fill.level-medium {
  background: linear-gradient(90deg, #d29922, #e3b341);
  box-shadow: 0 0 12px rgba(210, 153, 34, 0.45);
}
.strength-fill.level-strong {
  background: linear-gradient(90deg, #3fb950, #56d364);
  box-shadow: 0 0 12px rgba(63, 185, 80, 0.45);
}
.strength-fill.level-verystrong {
  background: linear-gradient(90deg, #2f81f7, #58a6ff);
  box-shadow: 0 0 14px rgba(47, 129, 247, 0.55);
}

.strength-level {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.strength-level.level-weak { color: var(--red); border-color: rgba(248, 81, 73, 0.4); }
.strength-level.level-medium { color: var(--yellow); border-color: rgba(210, 153, 34, 0.4); }
.strength-level.level-strong { color: var(--green); border-color: rgba(63, 185, 80, 0.4); }
.strength-level.level-verystrong { color: var(--accent); border-color: rgba(47, 129, 247, 0.4); }

/* ---------- 强度统计 ---------- */
.strength-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1rem;
}

.stat {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.7rem 0.85rem;
}

.stat-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.3rem;
}

.stat-value {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  word-break: break-word;
}

.stat-value small {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted);
}

/* ---------- 字符组成 ---------- */
.composition {
  margin-top: 1rem;
}

.composition .field-label {
  margin-bottom: 0.55rem;
}

.comp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.comp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.6rem 0.4rem;
}

.comp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
}

.comp-dot.upper { background: var(--accent); }
.comp-dot.lower { background: var(--green); }
.comp-dot.digit { background: var(--yellow); }
.comp-dot.symbol { background: #a371f7; }

.comp-name {
  font-size: 0.66rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.comp-count {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

/* ---------- 批量结果 ---------- */
.batch-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 360px;
  overflow-y: auto;
}

.batch-empty {
  color: var(--muted);
  font-size: 0.82rem;
  padding: 0.5rem 0;
}

.batch-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: 4px;
}

.batch-idx {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.72rem;
  color: var(--muted);
  min-width: 1.4rem;
}

.batch-pwd {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.82rem;
  color: var(--text);
  word-break: break-all;
}

.batch-copy {
  font: inherit;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0.3rem 0.45rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  transition: border-color 0.15s, color 0.15s;
}

.batch-copy:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.batch-copy.copied {
  border-color: var(--green);
  color: var(--green);
}

/* ---------- 历史记录 ---------- */
.link-btn {
  font: inherit;
  font-size: 0.76rem;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.link-btn:hover {
  color: var(--accent);
}

.link-btn.copied {
  color: var(--green);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 340px;
  overflow-y: auto;
}

.history-empty {
  color: var(--muted);
  font-size: 0.82rem;
  padding: 0.5rem 0;
}

.history-item {
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
  border-radius: 4px;
  transition: border-color 0.15s, background 0.15s;
}

.history-item:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.history-level {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  white-space: nowrap;
}

.history-level.level-weak { color: var(--red); background: rgba(248, 81, 73, 0.12); }
.history-level.level-medium { color: var(--yellow); background: rgba(210, 153, 34, 0.12); }
.history-level.level-strong { color: var(--green); background: rgba(63, 185, 80, 0.12); }
.history-level.level-verystrong { color: var(--accent); background: rgba(47, 129, 247, 0.12); }

.history-pwd {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.8rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  font-size: 0.68rem;
  color: var(--muted);
  white-space: nowrap;
}

/* ---------- 滚动条 ---------- */
.history-list::-webkit-scrollbar,
.batch-list::-webkit-scrollbar {
  width: 6px;
}

.history-list::-webkit-scrollbar-thumb,
.batch-list::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}

/* ---------- 响应式 ---------- */
@media (max-width: 860px) {
  .workspace {
    grid-template-columns: 1fr;
  }
  .control-panel {
    position: static;
  }
}

@media (max-width: 520px) {
  .comp-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .strength-stats {
    grid-template-columns: 1fr;
  }
  .icon-btn-text {
    display: none;
  }
  .icon-btn {
    padding: 0.55rem 0.7rem;
  }
  .history-item {
    grid-template-columns: auto 1fr;
  }
  .history-time {
    grid-column: 1 / -1;
    font-size: 0.64rem;
  }
}
</style>