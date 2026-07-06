<script setup>
/* ============================================================
   Node Atlas — IP & 域名情报（Vue 3 SFC）
   数据源：
     · ipquery.io（IP 地理位置查询）
     · dns.google（DNS 解析记录查询）
     · crt.sh（SSL 证书透明度查询）
   - 历史记录持久化到 localStorage
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, reactive, computed, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典 ---------- */
const copy = {
  en: {
    eyebrow: 'Network intelligence', title: 'Node Atlas',
    lead: 'Lookup IPs and domains — DNS, geo, headers, SSL, latency.',
    scan: 'Scan', geolocation: 'Geolocation', dnsRecords: 'DNS Records',
    latency: 'Latency', httpHeaders: 'HTTP Response', sslCerts: 'SSL Certificates',
    scanning: 'Scanning\u2026', done: 'Done', error: 'Error',
    ip: 'IP', country: 'Country', region: 'Region', city: 'City',
    isp: 'ISP', org: 'Organization', timezone: 'Timezone',
    coords: 'Coordinates', reverseDns: 'Reverse DNS',
    mapLink: 'Open in map', noData: 'No data',
    dnsLookup: 'DNS lookup', httpFetch: 'HTTP fetch', sslFetch: 'SSL check',
    total: 'Total', waiting: 'Waiting\u2026',
    issued: 'Issued', expires: 'Expires', issuer: 'Issuer',
  },
  zh: {
    eyebrow: '网络情报', title: 'Node Atlas',
    lead: '查询 IP 和域名 — DNS、地理位置、HTTP 头、SSL、延迟。',
    scan: '扫描', geolocation: '地理位置', dnsRecords: 'DNS 记录',
    latency: '延迟', httpHeaders: 'HTTP 响应', sslCerts: 'SSL 证书',
    scanning: '扫描中\u2026', done: '完成', error: '错误',
    ip: 'IP', country: '国家', region: '地区', city: '城市',
    isp: '运营商', org: '组织', timezone: '时区',
    coords: '坐标', reverseDns: '反向 DNS',
    mapLink: '在地图中打开', noData: '无数据',
    dnsLookup: 'DNS 查询', httpFetch: 'HTTP 请求', sslFetch: 'SSL 检查',
    total: '总计', waiting: '等待中\u2026',
    issued: '签发于', expires: '过期于', issuer: '签发者',
  },
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const HISTORY_KEY = 'node-atlas-history'
const HISTORY_LIMIT = 20
const HISTORY_VISIBLE = 8

/* ---------- 状态 ---------- */
const target = ref('')                        // 搜索框输入
const history = ref(loadHistory())            // 历史记录列表
const statusText = ref('')                    // 状态条文本
const statusClass = ref('')                   // 状态条样式：scanning/done/error/''
const showResults = ref(false)                // 是否展示结果区域
const geo = ref(null)                         // 地理位置数据
const dnsRecords = ref([])                    // DNS 记录数组
const latency = reactive({ dns: 0, http: 0, ssl: 0, total: 0 })  // 延迟统计
const httpInfo = ref(null)                    // HTTP 响应信息
const sslCerts = ref([])                      // SSL 证书数组

/* ---------- 历史记录持久化 ---------- */
function loadHistory() {
  const raw = lsGet(HISTORY_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveHistory() {
  lsSet(HISTORY_KEY, JSON.stringify(history.value))
}

function addToHistory(value) {
  history.value = [value, ...history.value.filter(h => h !== value)].slice(0, HISTORY_LIMIT)
  saveHistory()
}

/* ---------- computed 派生 ---------- */
// 历史条只展示前 8 条
const visibleHistory = computed(() => history.value.slice(0, HISTORY_VISIBLE))

// 地图链接（仅在有坐标时生成）
const mapUrl = computed(() => {
  const g = geo.value
  if (!g || g.lat == null) return ''
  return `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=10/${g.lat}/${g.lon}`
})

// 延迟展示单元
const latencyItems = computed(() => [
  { label: t.value('dnsLookup'), value: latency.dns, cls: latClass(latency.dns) },
  { label: t.value('httpFetch'), value: latency.http, cls: latClass(latency.http) },
  { label: t.value('sslFetch'), value: latency.ssl, cls: latClass(latency.ssl) },
  { label: t.value('total'), value: latency.total, cls: latClass(latency.total) },
])

/* ---------- 工具函数 ---------- */
function isIp(v) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(v.trim()) }

function latClass(ms) { return ms < 100 ? 'fast' : ms < 500 ? 'mid' : 'slow' }

// 签发者：优先取 CN= 之后的部分，否则用完整 issuer，再否则占位
function sslIssuer(c) {
  return c.issuer?.split('CN=')[1] || c.issuer || '—'
}

// 日期截取为 YYYY-MM-DD
function sslDateShort(s) {
  return s?.slice(0, 10) || '—'
}

/* ---------- 网络请求 ----------
   用共享 fetchJSON 包一层 safeFetch：失败/非 2xx 返回 null，
   行为对齐原版 OK 时代的 safeFetch。 */
async function safeFetch(url, opts = {}) {
  try {
    return await fetchJSON(url, opts)
  } catch {
    return null
  }
}

async function geoLookup(ip) {
  const d = await safeFetch(`https://api.ipquery.io/${ip}`)
  if (!d) return null
  return {
    ip,
    country: d.location?.country,
    countryCode: d.location?.country_code,
    region: d.location?.state,
    city: d.location?.city,
    lat: d.location?.latitude,
    lon: d.location?.longitude,
    tz: d.location?.timezone,
    isp: d.isp?.isp,
    org: d.isp?.org,
  }
}

async function dnsLookup(domain) {
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA']
  const results = await Promise.all(types.map(async (type) => {
    const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`)
    return { type, values: (d?.Answer || []).map((a) => a.data) }
  }))
  return results.filter((r) => r.values.length)
}

async function fetchHeaders(domain) {
  try {
    const start = performance.now()
    // no-cors 模式返回 opaque 响应（res.ok=false），不能复用 fetchJSON，需直接 fetch
    const r = await fetch(`https://${domain}`, { mode: 'no-cors', cache: 'no-store' })
    const ms = Math.round(performance.now() - start)
    return { status: r.status || 'opaque', type: r.type, ms }
  } catch (e) {
    return { error: e.message }
  }
}

async function fetchSSL(domain) {
  try {
    const certs = await fetchJSON(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`)
    if (!Array.isArray(certs)) return []
    return certs.slice(0, 5).map((c) => ({
      name: c.common_name,
      issuer: c.issuer_name,
      issued: c.not_before,
      expires: c.not_after,
      id: c.id,
    }))
  } catch {
    return []
  }
}

/* ---------- 主查询流程 ---------- */
async function lookup(value) {
  const trimmed = value.trim()
  if (!trimmed) return
  addToHistory(trimmed)

  // 重置 UI 为扫描中
  showResults.value = false
  statusClass.value = 'scanning'
  statusText.value = t.value('scanning')

  const totalStart = performance.now()
  const domain = isIp(trimmed) ? null : trimmed

  try {
    // 并发启动 DNS / HTTP / SSL 任务
    const dnsStart = performance.now()
    const dnsPromise = domain ? dnsLookup(domain) : Promise.resolve([])
    const httpPromise = domain ? fetchHeaders(domain) : Promise.resolve(null)
    const sslPromise = domain ? fetchSSL(domain) : Promise.resolve([])

    // 先解析 IP 用于地理位置查询
    let ip = trimmed
    if (domain) {
      const dnsResult = await dnsPromise
      const aRecord = dnsResult.find((r) => r.type === 'A')
      ip = aRecord?.values[0] || trimmed
    }

    const [geoData, dnsResult, httpData, sslData] = await Promise.all([
      geoLookup(ip),
      dnsPromise,
      httpPromise,
      sslPromise,
    ])

    const dnsMs = Math.round(performance.now() - dnsStart)
    const totalMs = Math.round(performance.now() - totalStart)
    const httpMs = httpData?.ms || 0

    // 渲染结果
    showResults.value = true
    geo.value = geoData
    dnsRecords.value = dnsResult
    latency.dns = dnsMs
    latency.http = httpMs
    // 与原版一致：展示的 SSL 时间用 total - dns - http 推算
    latency.ssl = Math.max(0, totalMs - dnsMs - httpMs)
    latency.total = totalMs
    httpInfo.value = httpData
    sslCerts.value = sslData

    statusClass.value = 'done'
    statusText.value = `${t.value('done')} — ${totalMs}ms`
  } catch (e) {
    statusClass.value = 'error'
    statusText.value = `${t.value('error')}: ${e.message}`
  }
}

/* ---------- 事件处理 ---------- */
function onSubmit() {
  lookup(target.value)
}

function onChipClick(value) {
  target.value = value
  lookup(value)
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  // 与原版一致：进入页面即查询 8.8.8.8
  target.value = '8.8.8.8'
  lookup('8.8.8.8')
})
</script>

<template>
  <div class="node-atlas-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索栏 -->
      <section class="search-bar">
        <form @submit.prevent="onSubmit">
          <input
            v-model="target"
            type="text"
            placeholder="8.8.8.8 or google.com"
            autocomplete="off"
            aria-label="Target IP or domain"
          />
          <button type="submit">{{ t('scan') }}</button>
        </form>
        <div class="history-strip">
          <button
            v-for="h in visibleHistory"
            :key="h"
            class="history-chip"
            type="button"
            @click="onChipClick(h)"
          >{{ h }}</button>
        </div>
      </section>

      <!-- 状态条 -->
      <div class="status-bar" :class="statusClass">{{ statusText }}</div>

      <!-- 结果区 -->
      <div v-if="showResults" class="results">
        <!-- 地理位置卡片 -->
        <section class="card geo-card">
          <div class="card-head">
            <span class="card-kicker">{{ t('geolocation') }}</span>
          </div>
          <div class="geo-grid">
            <p v-if="!geo" class="geo-empty">{{ t('noData') }}</p>
            <template v-else>
              <div class="geo-item">
                <div class="g-label">{{ t('ip') }}</div>
                <div class="g-value">{{ geo.ip }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('country') }}</div>
                <div class="g-value">{{ geo.country || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('region') }}</div>
                <div class="g-value">{{ geo.region || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('city') }}</div>
                <div class="g-value">{{ geo.city || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('isp') }}</div>
                <div class="g-value">{{ geo.isp || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('org') }}</div>
                <div class="g-value">{{ geo.org || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('timezone') }}</div>
                <div class="g-value">{{ geo.tz || '—' }}</div>
              </div>
              <div class="geo-item">
                <div class="g-label">{{ t('coords') }}</div>
                <div class="g-value">
                  <template v-if="geo.lat != null">
                    {{ geo.lat }}, {{ geo.lon }}
                    <a :href="mapUrl" target="_blank" rel="noreferrer">{{ t('mapLink') }}</a>
                  </template>
                  <template v-else>—</template>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- DNS 记录 -->
        <section class="card">
          <div class="card-head">
            <span class="card-kicker">{{ t('dnsRecords') }}</span>
          </div>
          <div class="dns-grid">
            <p v-if="!dnsRecords.length" class="dns-empty">{{ t('noData') }}</p>
            <div
              v-for="r in dnsRecords"
              :key="r.type"
              class="dns-row"
            >
              <span class="dns-type">{{ r.type }}</span>
              <div class="dns-values">
                <span
                  v-for="(v, i) in r.values"
                  :key="i"
                  class="dns-val"
                >{{ v }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 延迟 -->
        <section class="card">
          <div class="card-head">
            <span class="card-kicker">{{ t('latency') }}</span>
          </div>
          <div class="latency-body">
            <div
              v-for="item in latencyItems"
              :key="item.label"
              class="latency-item"
            >
              <div class="l-label">{{ item.label }}</div>
              <div class="l-value" :class="item.cls">{{ item.value }}</div>
              <div class="l-unit">ms</div>
            </div>
          </div>
        </section>

        <!-- HTTP 响应（仅有数据时渲染） -->
        <section v-if="httpInfo && !httpInfo.error" class="card">
          <div class="card-head">
            <span class="card-kicker">{{ t('httpHeaders') }}</span>
          </div>
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">status</span>
              <span class="kv-val">{{ httpInfo.status }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">type</span>
              <span class="kv-val">{{ httpInfo.type }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">response time</span>
              <span class="kv-val">{{ httpInfo.ms }} ms</span>
            </div>
          </div>
        </section>

        <!-- SSL 证书（仅有数据时渲染） -->
        <section v-if="sslCerts.length" class="card">
          <div class="card-head">
            <span class="card-kicker">{{ t('sslCerts') }}</span>
          </div>
          <div class="ssl-body">
            <div
              v-for="c in sslCerts"
              :key="c.id"
              class="ssl-item"
            >
              <div class="ssl-name">{{ c.name }}</div>
              <div class="ssl-meta">
                {{ t('issuer') }}: {{ sslIssuer(c) }}<br />
                {{ t('issued') }}: {{ sslDateShort(c.issued) }} ·
                {{ t('expires') }}: {{ sslDateShort(c.expires) }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Node Atlas — 深色网络情报主题
   原 :root 变量迁移到组件根类 .node-atlas-app，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.node-atlas-app {
  /* 主题色 */
  --bg: #08111f;
  --bg-2: #0b1830;
  --line: rgba(125, 197, 255, 0.18);
  --text: #e9f4ff;
  --muted: #87a3c4;
  --accent: #56d3ff;
  --accent-2: #8d7bff;
  --panel: rgba(8, 20, 37, 0.72);
  --green: #34d399;
  --yellow: #fbbf24;
  --red: #f87171;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  color-scheme: dark;

  min-height: 100vh;
  margin: 0;
  color: var(--text);
  font-family: "Space Grotesk", system-ui, sans-serif;
  background:
    linear-gradient(rgba(98,163,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(98,163,255,0.06) 1px, transparent 1px),
    radial-gradient(circle at top, #102348 0%, #091325 45%, #050b14 100%);
  background-size: 28px 28px, 28px 28px, auto;
}

.node-atlas-app a { color: var(--accent); text-decoration: none; }
.node-atlas-app a:hover { text-decoration: underline; }
.node-atlas-app h1,
.node-atlas-app h2,
.node-atlas-app h3,
.node-atlas-app p,
.node-atlas-app span,
.node-atlas-app strong,
.node-atlas-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1000px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0.3rem 0 1rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.88rem;
}

/* ---------- 搜索 ---------- */
.search-bar {
  margin-top: 0.8rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.search-bar form {
  display: flex;
  gap: 0.5rem;
}

.search-bar input {
  flex: 1;
  font: inherit;
  font-family: "JetBrains Mono", monospace;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(8, 20, 37, 0.6);
  color: var(--text);
  font-size: 0.92rem;
}

.search-bar button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.2rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--bg);
  cursor: pointer;
  font-weight: 700;
}

.history-strip {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.history-chip {
  font: inherit;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
}

.history-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ---------- 状态条 ---------- */
.status-bar {
  padding: 0.4rem 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.74rem;
  color: var(--muted);
  min-height: 1.4rem;
}

.status-bar.scanning { color: var(--accent); }
.status-bar.done { color: var(--green); }
.status-bar.error { color: var(--red); }

/* ---------- 结果区 ---------- */
.results {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.8rem;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1rem;
}

.card-head {
  margin-bottom: 0.6rem;
}

.card-kicker {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.68rem;
  color: var(--accent);
}

/* ---------- 地理位置 ---------- */
.geo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.geo-empty {
  color: var(--muted);
}

.geo-item {
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.geo-item .g-label {
  font-size: 0.66rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.geo-item .g-value {
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.1rem;
}

.geo-item .g-value a {
  font-size: 0.78rem;
}

/* ---------- DNS ---------- */
.dns-grid {
  display: grid;
  gap: 0.5rem;
}

.dns-empty {
  color: var(--muted);
}

.dns-row {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 0.5rem;
  align-items: start;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.dns-type {
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--accent-2);
}

.dns-values {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dns-val {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.78rem;
  word-break: break-all;
}

/* ---------- 延迟 ---------- */
.latency-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.latency-item {
  text-align: center;
  padding: 0.6rem;
  border: 1px solid rgba(255,255,255,0.06);
}

.latency-item .l-label {
  font-size: 0.66rem;
  color: var(--muted);
  text-transform: uppercase;
}

.latency-item .l-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 0.15rem;
}

.latency-item .l-value.fast { color: var(--green); }
.latency-item .l-value.mid { color: var(--yellow); }
.latency-item .l-value.slow { color: var(--red); }

.latency-item .l-unit {
  font-size: 0.68rem;
  color: var(--muted);
}

/* ---------- KV 列表 ---------- */
.kv-list {
  display: grid;
  gap: 0;
}

.kv-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 0.8rem;
}

.kv-key {
  font-family: "JetBrains Mono", monospace;
  color: var(--accent-2);
  font-size: 0.76rem;
}

.kv-val {
  word-break: break-all;
  color: var(--muted);
}

/* ---------- SSL ---------- */
.ssl-body {
  display: grid;
  gap: 0.5rem;
}

.ssl-item {
  padding: 0.5rem;
  border: 1px solid rgba(255,255,255,0.06);
  font-size: 0.8rem;
}

.ssl-item .ssl-name {
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.ssl-item .ssl-meta {
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

/* ---------- 加载（保留以备扩展） ---------- */
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 0.5rem 0;
  font-size: 0.85rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead { flex-direction: column; gap: 0.5rem; }
  .geo-grid { grid-template-columns: repeat(2, 1fr); }
  .latency-body { grid-template-columns: repeat(2, 1fr); }
  .kv-row { grid-template-columns: 120px 1fr; }
}
</style>
