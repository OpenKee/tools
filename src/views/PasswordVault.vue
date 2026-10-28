<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Copy, Eye, EyeOff, RefreshCw, ShieldCheck, Sparkles } from '@lucide/vue'
import { i18nState, useT } from '../i18n.js'
import { lsGet, lsRemove, lsSet, locale } from '../ok.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiCheckbox,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiPage,
  UiPageHead,
  UiRange,
  UiSectionHead,
  UiSelect,
} from '../components/ui/index.js'
import copy from '../copy/password-vault.js'

defineProps({ embedded: { type: Boolean, default: false } })

const t = useT(copy)

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?/~'

const SIMILAR = '0Oo1lI|`'

const state = reactive({
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  exclude: false,
  batchCount: 5,
})

const BATCH_OPTIONS = [5, 10, 20].map((n) => ({ value: n, label: String(n) }))

const currentPassword = ref('')
const history = ref([])
const batchPasswords = ref([])
const revealed = ref(true)
const breachState = ref('idle')
const breachCount = ref(0)
const breachChecking = ref(false)
let breachRequestId = 0

const copiedMain = ref(false)
const copiedAll = ref(false)
const copiedBatchIdx = ref(-1)
const copiedHistoryIdx = ref(-1)
let historyCopyTimer = null

const HISTORY_KEY = 'pv-history'
const HISTORY_PERSIST_KEY = 'pv-history-persist'
const persistHistory = ref(lsGet(HISTORY_PERSIST_KEY) === '1')

function loadHistory() {
  try {
    return JSON.parse(lsGet(HISTORY_KEY) || '[]')
  } catch (e) {
    return []
  }
}

function saveHistory() {
  if (!persistHistory.value) {
    lsRemove(HISTORY_KEY)
    return
  }
  lsSet(HISTORY_KEY, JSON.stringify(history.value))
}

function setPersistHistory(on) {
  persistHistory.value = on
  lsSet(HISTORY_PERSIST_KEY, on ? '1' : '0')
  if (on) saveHistory()
  else lsRemove(HISTORY_KEY)
}

function filterSimilar(str) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    if (SIMILAR.indexOf(str[i]) === -1) result += str[i]
  }
  return result
}

function buildSets() {
  const sets = []
  if (state.upper) sets.push(state.exclude ? filterSimilar(UPPER) : UPPER)
  if (state.lower) sets.push(state.exclude ? filterSimilar(LOWER) : LOWER)
  if (state.digits) sets.push(state.exclude ? filterSimilar(DIGITS) : DIGITS)
  if (state.symbols) sets.push(state.exclude ? filterSimilar(SYMBOLS) : SYMBOLS)

  return sets.filter(function (s) {
    return s.length > 0
  })
}

function buildPool(sets) {
  return sets.join('')
}

function secureRandomInt(max) {
  if (max <= 0) return 0
  const range = 4294967296
  const limit = range - (range % max)
  const arr = new Uint32Array(1)
  let x
  do {
    crypto.getRandomValues(arr)
    x = arr[0]
  } while (x >= limit)
  return x % max
}

function generatePassword(length, sets) {
  const pool = buildPool(sets)
  if (!pool || length <= 0) return ''
  const chars = []

  const ensureCount = Math.min(sets.length, length)
  for (let i = 0; i < ensureCount; i++) {
    chars.push(sets[i][secureRandomInt(sets[i].length)])
  }

  for (let j = ensureCount; j < length; j++) {
    chars.push(pool[secureRandomInt(pool.length)])
  }

  for (let k = chars.length - 1; k > 0; k--) {
    const idx = secureRandomInt(k + 1)
    const tmp = chars[k]
    chars[k] = chars[idx]
    chars[idx] = tmp
  }
  return chars.join('')
}

function calcEntropy(length, poolSize) {
  if (poolSize <= 0 || length <= 0) return 0
  return length * Math.log2(poolSize)
}

function strengthFromEntropy(entropy) {
  if (entropy < 35) return 'weak'
  if (entropy < 60) return 'medium'
  if (entropy < 120) return 'strong'
  return 'verystrong'
}

function levelLabel(level) {
  if (level === 'weak') return t.value('levelWeak')
  if (level === 'medium') return t.value('levelMedium')
  if (level === 'strong') return t.value('levelStrong')
  return t.value('levelVeryStrong')
}

const LEVEL_BADGE_VARIANTS = {
  weak: 'down',
  medium: 'warn',
  strong: 'up',
  verystrong: 'accent',
}
function badgeVariant(level) {
  return LEVEL_BADGE_VARIANTS[level] || 'neutral'
}

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

function unitWord(n, key) {
  const word = t.value(key)
  if (i18nState.lang === 'en' && n !== 1) return word + 's'
  return word
}

function formatCrackTime(entropy) {
  if (entropy <= 0) return t.value('timeInstant')
  const guesses = Math.pow(2, entropy) / 2
  const seconds = guesses / 1e10
  if (!isFinite(seconds) || seconds < 1) return t.value('timeInstant')

  const minute = 60,
    hour = 3600,
    day = 86400,
    year = 31536000
  let val, key
  if (seconds < minute) {
    val = seconds
    key = 'timeSecond'
  } else if (seconds < hour) {
    val = seconds / minute
    key = 'timeMinute'
  } else if (seconds < day) {
    val = seconds / hour
    key = 'timeHour'
  } else if (seconds < year) {
    val = seconds / day
    key = 'timeDay'
  } else {
    val = seconds / year
    key = 'timeYear'
  }

  if (key === 'timeYear' && val >= 1e6) {
    return val.toExponential(2) + ' ' + unitWord(val, key)
  }
  const rounded = val < 10 ? Math.round(val * 10) / 10 : Math.round(val)
  return rounded + ' ' + unitWord(rounded, key)
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function resetBreach() {
  breachRequestId += 1
  breachState.value = 'idle'
  breachCount.value = 0
  breachChecking.value = false
}

async function checkBreach(password) {
  if (!password) return
  const requestId = ++breachRequestId
  breachChecking.value = true
  breachState.value = 'checking'
  try {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-1', encoder.encode(password))
    const hash = bufferToHex(buffer).toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(10000),
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
    if (requestId !== breachRequestId) return
    breachCount.value = found
    breachState.value = found > 0 ? 'found' : 'safe'
  } catch (e) {
    if (requestId === breachRequestId) breachState.value = 'error'
  } finally {
    if (requestId === breachRequestId) breachChecking.value = false
  }
}

const breachText = computed(() => {
  if (breachState.value === 'checking') return t.value('breachChecking')
  if (breachState.value === 'safe') return t.value('breachSafe')
  if (breachState.value === 'found') return t.value('breachFound').replace('{n}', String(breachCount.value))
  if (breachState.value === 'error') return t.value('breachError')
  return t.value('notChecked')
})

const sets = computed(() => buildSets())
const poolSize = computed(() => buildPool(sets.value).length)
const poolIsEmpty = computed(() => sets.value.length === 0)

const composition = computed(() => analyzeComposition(currentPassword.value))

const entropy = computed(() => (currentPassword.value ? calcEntropy(currentPassword.value.length, poolSize.value) : 0))
const level = computed(() => (currentPassword.value ? strengthFromEntropy(entropy.value) : null))

const levelVariant = computed(() => badgeVariant(level.value))

const strengthPct = computed(() => Math.min(100, (entropy.value / 128) * 100))

const entropyText = computed(() => (currentPassword.value ? entropy.value.toFixed(1) : '—'))
const crackTimeText = computed(() => (currentPassword.value ? formatCrackTime(entropy.value) : '—'))
const levelText = computed(() => (level.value ? levelLabel(level.value) : '—'))

function displayPassword(pwd) {
  if (!pwd) return ''
  return revealed.value ? pwd : '•'.repeat(pwd.length)
}

const passwordDisplayText = computed(() => {
  if (!currentPassword.value) {
    return poolIsEmpty.value ? t.value('noOptions') : t.value('emptyPassword')
  }
  return displayPassword(currentPassword.value)
})
const passwordIsEmpty = computed(() => !currentPassword.value)
const passwordIsHidden = computed(() => !passwordIsEmpty.value && !revealed.value)

function copyToClipboard(text) {
  if (!text) return Promise.resolve()
  return navigator.clipboard.writeText(text)
}

function flashMain() {
  copiedMain.value = true
  setTimeout(function () {
    copiedMain.value = false
  }, 1200)
}
function flashAll() {
  copiedAll.value = true
  setTimeout(function () {
    copiedAll.value = false
  }, 1200)
}
function flashBatch(idx) {
  copiedBatchIdx.value = idx
  setTimeout(function () {
    copiedBatchIdx.value = -1
  }, 1200)
}

function onCopyMain() {
  if (!currentPassword.value) return
  copyToClipboard(currentPassword.value).then(flashMain)
}

function onCopyHistory(pwd, idx) {
  if (!pwd) return
  copyToClipboard(pwd).then(function () {
    copiedHistoryIdx.value = idx
    if (historyCopyTimer) clearTimeout(historyCopyTimer)
    historyCopyTimer = setTimeout(function () {
      copiedHistoryIdx.value = -1
    }, 1200)
  })
}

function onCopyBatchItem(idx) {
  const pwd = batchPasswords.value[idx]
  if (!pwd) return
  copyToClipboard(pwd).then(function () {
    flashBatch(idx)
  })
}

function onCopyAll() {
  if (!batchPasswords.value.length) return
  copyToClipboard(batchPasswords.value.join('\n')).then(flashAll)
}

function clampLength() {
  const n = Math.round(Number(state.length))
  state.length = Number.isFinite(n) ? Math.min(64, Math.max(8, n)) : 20
}

function generateAndShow() {
  clampLength()
  resetBreach()
  const s = buildSets()
  if (s.length === 0) {
    currentPassword.value = ''
    return
  }
  const length = Number(state.length)
  const pool = buildPool(s)
  const pwd = generatePassword(length, s)
  currentPassword.value = pwd
  addToHistory(pwd, pool.length)
}

function addToHistory(pwd, poolSz) {
  if (!pwd) return

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

  if (history.value.length > 20) history.value.splice(20)
}

function clearHistory() {
  history.value = []
}

function generateBatch() {
  clampLength()
  const s = buildSets()
  if (s.length === 0) {
    batchPasswords.value = []
    currentPassword.value = ''
    resetBreach()
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

watch(history, saveHistory, { deep: true })

onMounted(function () {
  if (persistHistory.value) history.value = loadHistory()
  else lsRemove(HISTORY_KEY)

  generateAndShow()
})
</script>

<template>
  <UiPage class="pv-app" :title="t('title')" spacing="compact" :embedded="embedded">
    <UiPageHead compact :level="embedded ? 2 : 1" :title="t('title')" :description="t('lead')" />

    <section class="workspace">
      <UiCard as="aside" class="control-panel" padding="sm" aria-label="Password options">
        <UiField class="length-field">
          <template #label>
            <span>{{ t('lengthLabel') }}</span>
            <UiInput
              v-model.number="state.length"
              class="length-input"
              type="number"
              size="sm"
              min="8"
              max="64"
              :aria-label="t('ariaLength')"
              @change="clampLength"
            />
          </template>
          <UiRange v-model="state.length" :min="8" :max="64" :aria-label="t('ariaLength')" />
          <div class="range-marks"><span>8</span><span>64</span></div>
        </UiField>

        <UiField :label="t('optionsLabel')">
          <div class="option-stack">
            <div class="option-grid">
              <UiCheckbox v-model="state.upper" variant="tile" :label="t('optUppercase')" @change="generateAndShow" />
              <UiCheckbox v-model="state.lower" variant="tile" :label="t('optLowercase')" @change="generateAndShow" />
              <UiCheckbox v-model="state.digits" variant="tile" :label="t('optDigits')" @change="generateAndShow" />
              <UiCheckbox v-model="state.symbols" variant="tile" :label="t('optSymbols')" @change="generateAndShow" />
            </div>
            <UiCheckbox
              v-model="state.exclude"
              variant="tile"
              :label="t('optExcludeSimilar')"
              @change="generateAndShow"
            />
          </div>
        </UiField>

        <UiButton variant="primary" block class="generate-btn" @click="generateAndShow">
          <Sparkles :size="15" aria-hidden="true" />
          {{ t('generate') }}
        </UiButton>

        <UiField :label="t('batchLabel')" class="batch-group">
          <div class="batch-row">
            <UiSelect v-model="state.batchCount" :options="BATCH_OPTIONS" :aria-label="t('ariaBatchCount')" />
            <UiButton variant="secondary" @click="generateBatch">
              <Sparkles :size="14" aria-hidden="true" />
              {{ t('batchGenerate') }}
            </UiButton>
          </div>
        </UiField>
      </UiCard>

      <div class="preview-panel">
        <UiCard class="password-card" padding="sm">
          <UiSectionHead :title="t('generatedPassword')">
            <template #meta>
              <UiBadge :variant="levelVariant" size="sm">{{ levelText }}</UiBadge>
            </template>
          </UiSectionHead>
          <div
            class="password-display"
            :class="{ empty: passwordIsEmpty, hidden: passwordIsHidden }"
            aria-live="polite"
            :aria-label="t('generatedPassword')"
          >
            {{ passwordDisplayText }}
          </div>
          <div class="password-actions">
            <UiButton
              variant="soft"
              size="sm"
              :class="{ 'is-copied': copiedMain }"
              :aria-label="t('ariaCopy')"
              :disabled="passwordIsEmpty"
              @click="onCopyMain"
            >
              <Copy :size="14" aria-hidden="true" />
              <span>{{ copiedMain ? t('copied') : t('copy') }}</span>
            </UiButton>
            <UiButton variant="secondary" size="sm" :aria-label="t('ariaRegenerate')" @click="generateAndShow">
              <RefreshCw :size="14" aria-hidden="true" />
              <span>{{ t('regenerate') }}</span>
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :aria-label="t('ariaToggleVisibility')"
              :disabled="passwordIsEmpty"
              @click="revealed = !revealed"
            >
              <component :is="revealed ? EyeOff : Eye" :size="14" aria-hidden="true" />
              <span>{{ revealed ? t('hidePassword') : t('showPassword') }}</span>
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :aria-label="t('ariaCheckBreach')"
              :disabled="breachChecking || passwordIsEmpty"
              :loading="breachChecking"
              @click="checkBreach(currentPassword)"
            >
              <ShieldCheck :size="14" aria-hidden="true" />
              <span>{{ t('checkBreach') }}</span>
            </UiButton>
          </div>
        </UiCard>

        <UiCard class="strength-card" padding="sm">
          <UiSectionHead
            :title="t('strengthLabel')"
            :meta="passwordIsEmpty ? '' : currentPassword.length + ' ' + t('characters')"
          />
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
          <div class="metric-row">
            <div class="metric">
              <span class="metric-label">{{ t('entropyLabel') }}</span>
              <span class="metric-value"
                >{{ entropyText }} <small>{{ t('bitsUnit') }}</small></span
              >
            </div>
            <div class="metric">
              <span class="metric-label">{{ t('crackTimeLabel') }}</span>
              <span class="metric-value">{{ crackTimeText }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">{{ t('breachStatus') }}</span>
              <span class="metric-value" :class="'breach-' + breachState" :title="breachText">{{ breachText }}</span>
            </div>
          </div>
          <div class="composition">
            <span class="comp-label">{{ t('compositionLabel') }}</span>
            <div class="comp-bar" aria-hidden="true">
              <span class="comp-seg upper" :style="{ flexGrow: composition.upper }"></span>
              <span class="comp-seg lower" :style="{ flexGrow: composition.lower }"></span>
              <span class="comp-seg digit" :style="{ flexGrow: composition.digit }"></span>
              <span class="comp-seg symbol" :style="{ flexGrow: composition.symbol }"></span>
            </div>
            <div class="comp-legend">
              <span class="comp-item">
                <span class="comp-dot upper" aria-hidden="true"></span>
                {{ t('compUppercase') }} <b>{{ composition.upper }}</b>
              </span>
              <span class="comp-item">
                <span class="comp-dot lower" aria-hidden="true"></span>
                {{ t('compLowercase') }} <b>{{ composition.lower }}</b>
              </span>
              <span class="comp-item">
                <span class="comp-dot digit" aria-hidden="true"></span>
                {{ t('compDigits') }} <b>{{ composition.digit }}</b>
              </span>
              <span class="comp-item">
                <span class="comp-dot symbol" aria-hidden="true"></span>
                {{ t('compSymbols') }} <b>{{ composition.symbol }}</b>
              </span>
            </div>
          </div>
        </UiCard>

        <UiCard v-if="batchPasswords.length" class="batch-section" padding="sm">
          <UiSectionHead :title="t('batchResults')">
            <template #actions>
              <UiButton
                v-if="batchPasswords.length"
                variant="ghost"
                size="sm"
                class="copy-all"
                :class="{ 'is-copied': copiedAll }"
                @click="onCopyAll"
              >
                <Copy :size="12" aria-hidden="true" />
                {{ t('copyAll') }}
              </UiButton>
            </template>
          </UiSectionHead>
          <div class="batch-list" aria-live="polite">
            <div v-for="(pwd, i) in batchPasswords" :key="i" class="batch-item">
              <span class="batch-idx">{{ i + 1 }}</span>
              <span class="batch-pwd">{{ displayPassword(pwd) }}</span>
              <UiIconButton
                :label="t('copy')"
                variant="secondary"
                size="sm"
                :class="{ 'is-copied': copiedBatchIdx === i }"
                @click="onCopyBatchItem(i)"
              >
                <Copy aria-hidden="true" />
              </UiIconButton>
            </div>
          </div>
        </UiCard>

        <UiCard class="history-section" padding="sm">
          <UiSectionHead :title="t('historyLabel')">
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
          <UiCheckbox
            class="history-persist"
            :model-value="persistHistory"
            :label="t('persistHistory')"
            @update:model-value="setPersistHistory"
          />
          <p class="history-note">{{ t('historyNote') }}</p>
          <div class="history-list" aria-live="polite">
            <UiEmptyState v-if="!history.length" compact :description="t('noHistory')" />
            <button
              v-for="(h, i) in history"
              :key="i"
              class="history-item"
              :class="{ copied: copiedHistoryIdx === i }"
              type="button"
              :aria-label="t('copy')"
              :title="t('copy')"
              @click="onCopyHistory(h.password, i)"
            >
              <UiBadge :variant="badgeVariant(h.level)" size="sm">{{ levelLabel(h.level) }}</UiBadge>
              <span class="history-pwd" :title="revealed ? h.password : ''">{{ displayPassword(h.password) }}</span>
              <span class="history-time">{{ h.timeStr }}</span>
            </button>
          </div>
        </UiCard>
      </div>
    </section>
  </UiPage>
</template>

<style scoped>
.pv-app {
  --warn: #b45309;
  --warn-soft: #fff7ed;
  --purple: #8250df;
}

:global(:root[data-theme='dark']) .pv-app {
  --warn: #d29922;
  --warn-soft: rgba(210, 153, 34, 0.14);
  --purple: #a371f7;
}

.workspace {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
}

.workspace .control-panel {
  position: sticky;
  top: calc(var(--ok-topbar-h, 3.4rem) + 0.75rem);
  height: auto;
}

.preview-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.6rem;
}

.length-field :deep(.ui-field-label) {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.length-field .length-input {
  width: 3.6rem;
  flex: none;
  letter-spacing: 0;
  text-transform: none;
}

.length-field .length-input :deep(input) {
  font-family: var(--ok-mono);
  text-align: center;
}

.range-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2rem;
  font-family: var(--ok-mono);
  font-size: 0.64rem;
  color: var(--ok-muted);
}

.option-stack {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
}

.option-stack :deep(.ui-check--tile) {
  padding: 0.42rem 0.5rem;
}

.generate-btn {
  margin-top: 0.15rem;
}

.batch-group {
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--ok-line);
}

.batch-row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.4rem;
}

.password-card :deep(.ui-section-head),
.strength-card :deep(.ui-section-head) {
  margin-bottom: 0;
}

.password-card :deep(.ui-card-body) {
  gap: 0.7rem;
}

.strength-card :deep(.ui-card-body) {
  gap: 0.55rem;
}

.batch-section :deep(.ui-card-body),
.history-section :deep(.ui-card-body) {
  gap: 0;
}

.password-display {
  font-family: var(--ok-mono);
  font-size: 1.12rem;
  font-weight: 600;
  letter-spacing: 0.015em;
  color: var(--ok-text);
  word-break: break-all;
  line-height: 1.45;
  min-height: 2.1rem;
  padding: 0.55rem 0.7rem;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  user-select: all;
}

.password-display.hidden {
  letter-spacing: 0.16em;
}

.password-display.empty {
  color: var(--ok-muted);
  font-family: var(--ok-font);
  font-size: 0.86rem;
  font-weight: 400;
  user-select: none;
}

.password-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.password-actions .is-copied,
.copy-all.is-copied {
  border-color: var(--ok-up);
  background: var(--ok-up-bg);
  color: var(--ok-up);
}

.strength-bar {
  height: 6px;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  border-radius: 3px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  width: 0%;
  border-radius: 3px;
  transition:
    width 0.4s ease,
    background 0.3s;
  background: var(--ok-line);
}

.strength-fill.level-weak {
  background: var(--ok-down);
}
.strength-fill.level-medium {
  background: var(--warn);
}
.strength-fill.level-strong {
  background: var(--ok-up);
}
.strength-fill.level-verystrong {
  background: var(--ok-accent);
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.2rem;
  border-top: 1px solid var(--ok-line);
  border-bottom: 1px solid var(--ok-line);
}

.metric {
  min-width: 0;
  padding: 0.45rem 0.6rem;
}

.metric + .metric {
  border-left: 1px solid var(--ok-line);
}

.metric-label {
  display: block;
  font-size: 0.68rem;
  color: var(--ok-muted);
  margin-bottom: 0.15rem;
}

.metric-value {
  display: block;
  font-family: var(--ok-mono);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ok-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-value small {
  font-size: 0.66rem;
  font-weight: 400;
  color: var(--ok-muted);
}

.breach-safe {
  color: var(--ok-up);
}
.breach-found,
.breach-error {
  color: var(--ok-down);
}
.breach-checking,
.breach-idle {
  color: var(--ok-muted);
}

.composition {
  margin-top: 0.15rem;
}

.comp-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ok-muted);
  margin-bottom: 0.4rem;
}

.comp-bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  border-radius: 3px;
}

.comp-seg {
  flex-basis: 0;
  min-width: 0;
  height: 100%;
}

.comp-seg + .comp-seg {
  border-left: 1px solid var(--ok-panel);
}
.comp-seg.upper {
  background: var(--ok-accent);
}
.comp-seg.lower {
  background: var(--ok-up);
}
.comp-seg.digit {
  background: var(--warn);
}
.comp-seg.symbol {
  background: var(--purple);
}

.comp-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin-top: 0.45rem;
}

.comp-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  color: var(--ok-muted);
}

.comp-item b {
  font-family: var(--ok-mono);
  font-weight: 500;
  color: var(--ok-text);
}

.comp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.comp-dot.upper {
  background: var(--ok-accent);
}
.comp-dot.lower {
  background: var(--ok-up);
}
.comp-dot.digit {
  background: var(--warn);
}
.comp-dot.symbol {
  background: var(--purple);
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 230px;
  overflow-y: auto;
}

.batch-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-bg);
  border-radius: var(--ok-radius-sm);
}

.batch-idx {
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  color: var(--ok-muted);
  min-width: 1.2rem;
}

.batch-pwd {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  color: var(--ok-text);
  word-break: break-all;
}

.batch-item .is-copied {
  border-color: var(--ok-up);
  color: var(--ok-up);
}

.history-persist {
  margin-bottom: 0.3rem;
  font-size: 0.74rem;
}

.history-note {
  color: var(--ok-muted);
  font-size: 0.68rem;
  line-height: 1.45;
  margin-bottom: 0.5rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 230px;
  overflow-y: auto;
}

.history-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 0.42rem 0.55rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-bg);
  color: var(--ok-text);
  cursor: pointer;
  border-radius: var(--ok-radius-sm);
  transition:
    border-color 0.15s,
    background 0.15s;
}

.history-item:hover {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
}

.history-item.copied {
  border-color: var(--ok-up);
  background: var(--ok-up-bg);
}

.history-pwd {
  font-family: var(--ok-mono);
  font-size: 0.76rem;
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  color: var(--ok-muted);
  white-space: nowrap;
}

@media (max-width: 860px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .workspace .control-panel {
    position: static;
  }
}

@media (max-width: 520px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metric:nth-child(3) {
    grid-column: 1 / -1;
    border-left: none;
    border-top: 1px solid var(--ok-line);
  }
  .password-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .comp-legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.3rem 0.6rem;
  }
  .history-item {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .history-time {
    grid-column: 1 / -1;
    font-size: 0.63rem;
  }
}

@media (max-width: 380px) {
  .option-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .metric-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .metric + .metric {
    border-left: none;
    border-top: 1px solid var(--ok-line);
  }
}
</style>
