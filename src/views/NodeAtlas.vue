<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet } from '../ok.js'
import { countryName } from '../lib/country-meta.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiChip,
  UiErrorState,
  UiLoading,
  UiPage,
  UiSearch,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/node-atlas.js'

const t = useT(copy)

const HISTORY_KEY = 'node-atlas-history'
const HISTORY_LIMIT = 20
const HISTORY_VISIBLE = 8

const target = ref('')
const history = ref(loadHistory())
const statusText = ref('')
const statusClass = ref('')
const showResults = ref(false)
const geo = ref(null)
const geoError = ref('')
const geoMs = ref(0)
const dnsRecords = ref([])
const dnsError = ref('')
const dnsMs = ref(0)
const httpInfo = ref(null)
const httpError = ref('')
const httpMs = ref(0)
const sslCerts = ref([])
const sslError = ref('')
const sslMs = ref(0)
const ptr = ref([])
const rdap = ref(null)
const rdapError = ref('')
const httpHeaders = ref(null)
const httpHeadersError = ref('')
const totalMs = ref(0)
const isDomain = ref(false)
const copied = ref(false)
let lookupSeq = 0
let copyTimer = null

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
  history.value = [value, ...history.value.filter((h) => h !== value)].slice(0, HISTORY_LIMIT)
  saveHistory()
}

function clearHistory() {
  history.value = []
  saveHistory()
}

async function copyResults() {
  if (!showResults.value) return
  const payload = {
    target: target.value,
    type: isDomain.value ? 'domain' : 'ip',
    geo: geo.value,
    reverseDns: ptr.value,
    dns: dnsRecords.value,
    rdap: rdap.value,
    http: { reachability: httpInfo.value, headers: httpHeaders.value },
    ssl: sslCerts.value,
    latency: {
      geo: geoMs.value,
      dns: dnsMs.value,
      http: httpMs.value,
      ssl: sslMs.value,
      total: totalMs.value,
    },
    errors: {
      geo: geoError.value,
      dns: dnsError.value,
      http: httpError.value,
      ssl: sslError.value,
      rdap: rdapError.value,
      headers: httpHeadersError.value,
    },
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {}
}

const visibleHistory = computed(() => history.value.slice(0, HISTORY_VISIBLE))

const mapUrl = computed(() => {
  const g = geo.value
  if (!g || g.lat == null) return ''
  return `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=10/${g.lat}/${g.lon}`
})

const geoCountryLabel = computed(() => {
  const g = geo.value
  if (!g) return '—'
  if (g.countryCode) return countryName(g.countryCode, i18nState.lang)
  return g.country || '—'
})

const riskFlags = computed(() => {
  const r = geo.value?.risk
  if (!r) return []
  return [r.vpn && 'VPN', r.tor && 'Tor', r.proxy && 'Proxy', r.datacenter && 'Datacenter'].filter(Boolean)
})

const sslLabsUrl = computed(() => {
  const host = target.value
  return host ? `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(host)}&hideResults=on` : ''
})

const hasRdapData = computed(() => {
  const r = rdap.value
  return !!r && !!(r.registrar || r.created || r.expires || r.updated || r.status?.length || r.nameservers?.length)
})

const latencyItems = computed(() => {
  const items = [{ label: t.value('geoLookup'), value: geoMs.value, cls: latClass(geoMs.value) }]
  if (isDomain.value) {
    items.push(
      { label: t.value('dnsLookup'), value: dnsMs.value, cls: latClass(dnsMs.value) },
      { label: t.value('httpFetch'), value: httpMs.value, cls: latClass(httpMs.value) },
      { label: t.value('sslFetch'), value: sslMs.value, cls: latClass(sslMs.value) },
      { label: t.value('total'), value: totalMs.value, cls: latClass(totalMs.value) },
    )
  }
  return items
})

function isIPv4(v) {
  const parts = String(v).split('.')
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isIPv6(v) {
  if (!String(v).includes(':')) return false
  try {
    new URL(`http://[${v}]`)
    return true
  } catch (e) {
    return false
  }
}

function parseTarget(raw) {
  let value = String(raw || '').trim()
  if (!value) return { error: t.value('invalidTarget') }
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      value = new URL(value).hostname
    } else {
      value = value.split(/[/?#]/)[0]
      value = value.replace(/^\[|\]$/g, '')
      if (/^[^:]+:\d+$/.test(value)) value = value.replace(/:\d+$/, '')
    }
  } catch (e) {
    return { error: t.value('invalidTarget') }
  }
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  value = value.replace(/\.$/, '').toLowerCase()
  if (isIPv4(value) || isIPv6(value)) return { target: value, isDomain: false }
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)) {
    return { error: t.value('invalidTarget') }
  }
  return { target: value, isDomain: true }
}

function latClass(ms) {
  return ms < 100 ? 'fast' : ms < 500 ? 'mid' : 'slow'
}

function latTone(cls) {
  if (cls === 'fast') return 'up'
  if (cls === 'mid') return 'warn'
  return 'down'
}

function fmtCoord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(4) : '—'
}

function rdapStatusLabel(status) {
  return String(status || '')
    .split('/')
    .pop()
    .replace(/#/g, ' ')
    .trim()
}

function sslIssuer(c) {
  return c.issuer?.split('CN=')[1] || c.issuer || '—'
}

function sslDateShort(s) {
  return s?.slice(0, 10) || '—'
}

async function geoLookup(ip) {
  const start = performance.now()
  try {
    const d = await fetchJSON(`https://api.ipquery.io/${encodeURIComponent(ip)}`, { timeout: 8000 })
    return {
      ms: Math.round(performance.now() - start),
      error: '',
      data: {
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
        asn: d.isp?.asn || '',
        risk: d.risk
          ? {
              vpn: !!d.risk.is_vpn,
              tor: !!d.risk.is_tor,
              proxy: !!d.risk.is_proxy,
              datacenter: !!d.risk.is_datacenter,
              score: d.risk.risk_score ?? null,
            }
          : null,
      },
    }
  } catch (e) {
    try {
      const d = await fetchJSON(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, { timeout: 8000 })
      const [lat, lon] = String(d.loc || '')
        .split(',')
        .map(Number)
      const org = d.org || ''
      return {
        ms: Math.round(performance.now() - start),
        error: '',
        data: {
          ip,
          country: '',
          countryCode: d.country || '',
          region: d.region || '',
          city: d.city || '',
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          tz: d.timezone || '',
          isp: org,
          org,
          asn: (org.match(/^AS\d+/) || [''])[0],
          risk: null,
        },
      }
    } catch (e2) {
      return { ms: Math.round(performance.now() - start), error: e2.message, data: null }
    }
  }
}

async function ptrLookup(ip) {
  const name = reverseName(ip)
  if (!name) return { values: [], ms: 0, error: '' }
  const start = performance.now()
  try {
    const d = await fetchJSON(`https://dns.alidns.com/resolve?name=${encodeURIComponent(name)}&type=PTR`, {
      timeout: 5000,
    })
    return {
      values: (d?.Answer || []).map((a) => a.data),
      ms: Math.round(performance.now() - start),
      error: '',
    }
  } catch (e) {
    return { values: [], ms: Math.round(performance.now() - start), error: e.message }
  }
}

function reverseName(ip) {
  if (isIPv4(ip)) return ip.split('.').reverse().join('.') + '.in-addr.arpa'
  if (!isIPv6(ip)) return ''
  const value = ip.toLowerCase()
  const halves = value.split('::')
  if (halves.length > 2) return ''
  let groups
  if (halves.length === 1) {
    groups = value.split(':')
  } else {
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves[1] ? halves[1].split(':') : []
    const fill = 8 - left.length - right.length
    if (fill < 1) return ''
    groups = [...left, ...Array(fill).fill('0'), ...right]
  }
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return ''
  const full = groups.map((g) => g.padStart(4, '0')).join('')
  return full.split('').reverse().join('.') + '.ip6.arpa'
}

function rdapEvent(events, action) {
  const event = (events || []).find((e) => e.eventAction === action)
  return event?.eventDate ? event.eventDate.slice(0, 10) : ''
}

function rdapRegistrar(data) {
  const entity = (data.entities || []).find((e) => (e.roles || []).includes('registrar'))
  if (!entity) return ''
  const vcard = entity.vcardArray?.[1]
  if (Array.isArray(vcard)) {
    const fn = vcard.find((row) => row[0] === 'fn')
    if (fn && fn[3]) return fn[3]
  }
  return entity.handle || ''
}

async function rdapLookup(domain) {
  const start = performance.now()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const d = await fetchJSON(`https://rdap.net/domain/${encodeURIComponent(domain)}`, {
        timeout: attempt === 0 ? 6000 : 4000,
      })
      return {
        ms: Math.round(performance.now() - start),
        error: '',
        data: {
          registrar: rdapRegistrar(d),
          created: rdapEvent(d.events, 'registration'),
          expires: rdapEvent(d.events, 'expiration'),
          updated: rdapEvent(d.events, 'last changed'),
          status: (d.status || []).slice(0, 8),
          nameservers: (d.nameservers || [])
            .map((n) => n.ldhName)
            .filter(Boolean)
            .slice(0, 8),
        },
      }
    } catch (e) {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
  return { ms: Math.round(performance.now() - start), error: t.value('rdapUnavailable'), data: null }
}

async function fetchHttpHeaders(domain) {
  const start = performance.now()
  try {
    const r = await fetch(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent('https://' + domain)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const text = await r.text()
    if (!r.ok || /^error\b/i.test(text.trim())) throw new Error('headers unavailable')
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const statusLine = lines.shift() || ''
    const headers = lines
      .map((line) => {
        const idx = line.indexOf(':')
        if (idx <= 0) return null
        return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
      })
      .filter(Boolean)
    return {
      statusLine,
      headers,
      ms: Math.round(performance.now() - start),
      error: '',
    }
  } catch (e) {
    return {
      statusLine: '',
      headers: [],
      ms: Math.round(performance.now() - start),
      error: t.value('httpHeadersUnavailable'),
    }
  }
}

async function dnsLookup(domain) {
  const start = performance.now()
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA']
  const results = await Promise.all(
    types.map(async (type) => {
      try {
        const d = await fetchJSON(`https://dns.alidns.com/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {
          timeout: 7000,
        })
        return {
          type,
          values: (d?.Answer || []).map((a) => ({ value: a.data, ttl: a.TTL })),
          failed: false,
        }
      } catch (e) {
        return { type, values: [], failed: true }
      }
    }),
  )
  const records = results.filter((r) => r.values.length)
  return {
    records,
    ms: Math.round(performance.now() - start),
    error: results.every((r) => r.failed) ? t.value('dnsUnavailable') : '',
  }
}

async function checkReachability(domain) {
  const start = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(`https://${domain}`, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return {
      ok: true,
      status: r.status || 'opaque',
      type: r.type,
      ms: Math.round(performance.now() - start),
      error: '',
    }
  } catch (e) {
    return {
      ok: false,
      status: '',
      type: '',
      ms: Math.round(performance.now() - start),
      error: t.value('httpUnavailable'),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSSL(domain) {
  const start = performance.now()
  try {
    const certs = await fetchJSON(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, { timeout: 10000 })
    if (!Array.isArray(certs)) throw new Error('bad response')
    return {
      ms: Math.round(performance.now() - start),
      error: '',
      certs: certs.slice(0, 5).map((c) => ({
        name: c.common_name,
        issuer: c.issuer_name,
        issued: c.not_before,
        expires: c.not_after,
        id: c.id,
      })),
    }
  } catch (e) {
    return {
      ms: Math.round(performance.now() - start),
      error: t.value('sslUnavailable'),
      certs: [],
    }
  }
}

async function lookup(value) {
  const seq = ++lookupSeq
  const parsed = parseTarget(value)
  if (parsed.error) {
    statusClass.value = 'error'
    statusText.value = parsed.error
    showResults.value = false
    return
  }

  const targetValue = parsed.target
  const domain = parsed.isDomain

  target.value = targetValue
  addToHistory(targetValue)

  showResults.value = false
  isDomain.value = domain
  geo.value = null
  geoError.value = ''
  geoMs.value = 0
  dnsRecords.value = []
  dnsError.value = ''
  dnsMs.value = 0
  httpInfo.value = null
  httpError.value = ''
  httpMs.value = 0
  sslCerts.value = []
  sslError.value = ''
  sslMs.value = 0
  ptr.value = []
  rdap.value = null
  rdapError.value = ''
  httpHeaders.value = null
  httpHeadersError.value = ''
  totalMs.value = 0
  statusClass.value = 'scanning'
  statusText.value = t.value('scanning')

  const started = performance.now()

  try {
    let dnsResult = { records: [], ms: 0, error: '' }
    let ip = targetValue

    if (domain) {
      dnsResult = await dnsLookup(targetValue)
      if (seq !== lookupSeq) return
      const address = dnsResult.records.find((r) => r.type === 'A') || dnsResult.records.find((r) => r.type === 'AAAA')
      if (address) ip = address.values[0]?.value || targetValue
    }

    const [geoResult, ptrResult, httpResult, sslResult, rdapResult, headersResult] = await Promise.all([
      geoLookup(ip),
      ptrLookup(ip),
      domain ? checkReachability(targetValue) : Promise.resolve(null),
      domain ? fetchSSL(targetValue) : Promise.resolve(null),
      domain ? rdapLookup(targetValue) : Promise.resolve(null),
      domain ? fetchHttpHeaders(targetValue) : Promise.resolve(null),
    ])
    if (seq !== lookupSeq) return

    geo.value = geoResult.data
    geoError.value = geoResult.error
    geoMs.value = geoResult.ms
    dnsRecords.value = dnsResult.records
    dnsError.value = dnsResult.error
    dnsMs.value = dnsResult.ms
    ptr.value = ptrResult.values || []
    httpInfo.value = httpResult
    httpError.value = httpResult?.error || ''
    httpMs.value = httpResult?.ms || 0
    sslCerts.value = sslResult?.certs || []
    sslError.value = sslResult?.error || ''
    sslMs.value = sslResult?.ms || 0
    rdap.value = rdapResult?.data || null
    rdapError.value = rdapResult?.error || ''
    httpHeaders.value = headersResult?.headers?.length ? headersResult : null
    httpHeadersError.value = headersResult?.error || ''
    totalMs.value = Math.round(performance.now() - started)
    showResults.value = true

    const errors = [geoError.value, dnsError.value, httpError.value, sslError.value].filter(Boolean)
    const hasData = !!geo.value || dnsRecords.value.length > 0 || !!httpInfo.value?.ok || sslCerts.value.length > 0
    if (!hasData) {
      statusClass.value = 'error'
      statusText.value = t.value('lookupFailed')
    } else if (errors.length) {
      statusClass.value = 'partial'
      statusText.value = `${t.value('partial')} — ${totalMs.value}ms`
    } else {
      statusClass.value = 'done'
      statusText.value = `${t.value('done')} — ${totalMs.value}ms`
    }
  } catch (e) {
    if (seq !== lookupSeq) return
    statusClass.value = 'error'
    statusText.value = `${t.value('error')}: ${e.message}`
  }
}

function onSubmit() {
  lookup(target.value)
}

function onChipClick(value) {
  target.value = value
  lookup(value)
}

onMounted(() => {
  target.value = '8.8.8.8'
  lookup('8.8.8.8')
})

onBeforeUnmount(() => {
  clearTimeout(copyTimer)
})
</script>

<template>
  <UiPage
    class="node-atlas-app"
    :title="{ en: 'Node Atlas', zh: '节点情报' }"
    width="1100px"
    spacing="compact"
    :sources="[
      { name: 'ipquery.io', url: 'https://ipquery.io/' },
      { name: 'ipinfo.io', url: 'https://ipinfo.io/' },
      { name: 'AliDNS DoH', url: 'https://www.alidns.com/' },
      { name: 'crt.sh', url: 'https://crt.sh/' },
      { name: 'RDAP', url: 'https://rdap.net/' },
      { name: 'HackerTarget', url: 'https://hackertarget.com/' },
    ]"
  >
    <section class="search-bar">
      <UiSearch
        v-model="target"
        placeholder="8.8.8.8 or google.com"
        aria-label="Target IP or domain"
        :submit-label="t('scan')"
        @submit="onSubmit"
      >
        <template #extra>
          <UiChip
            v-for="h in visibleHistory"
            :key="h"
            class="history-chip"
            size="sm"
            type="button"
            @click="onChipClick(h)"
          >
            {{ h }}
          </UiChip>
          <UiButton v-if="history.length" class="history-clear" variant="link" size="sm" @click="clearHistory">
            {{ t('clearHistory') }}
          </UiButton>
        </template>
      </UiSearch>
    </section>

    <div class="status-bar" :class="statusClass" aria-live="polite">
      <UiLoading v-if="statusClass === 'scanning'" inline :label="statusText" />
      <template v-else>
        <UiErrorState
          v-if="statusClass === 'error' || statusClass === 'partial'"
          class="status-error"
          variant="inline"
          :message="statusText"
          retry-label=""
        />
        <span v-else-if="statusText" class="status-text">{{ statusText }}</span>
        <UiButton
          v-if="statusClass === 'error' || statusClass === 'partial'"
          variant="secondary"
          size="sm"
          @click="onSubmit"
        >
          {{ t('retry') }}
        </UiButton>
      </template>
      <UiButton v-if="showResults" class="status-copy" variant="secondary" size="sm" @click="copyResults">
        {{ copied ? t('copied') : t('copyJson') }}
      </UiButton>
    </div>

    <div v-if="showResults" class="results">
      <UiCard class="geo-card" :label="t('geolocation')">
        <template #actions>
          <span v-if="!isDomain && geoMs" class="card-time">{{ geoMs }} ms</span>
        </template>
        <UiErrorState v-if="geoError" :message="t('geoUnavailable')" retry-label="" />
        <p v-else-if="!geo" class="geo-empty">{{ t('noData') }}</p>
        <div v-else class="geo-grid">
          <div class="geo-item">
            <div class="g-label">{{ t('ip') }}</div>
            <div class="g-value">{{ geo.ip }}</div>
          </div>
          <div class="geo-item">
            <div class="g-label">{{ t('country') }}</div>
            <div class="g-value">
              {{ geoCountryLabel }}
              <small v-if="geo.countryCode" class="g-code">{{ geo.countryCode }}</small>
            </div>
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
          <div v-if="geo.asn" class="geo-item">
            <div class="g-label">{{ t('asn') }}</div>
            <div class="g-value">{{ geo.asn }}</div>
          </div>
          <div v-if="geo.risk" class="geo-item">
            <div class="g-label">{{ t('risk') }}</div>
            <div class="g-value">
              <span v-if="riskFlags.length" class="risk-tags">
                <UiBadge v-for="flag in riskFlags" :key="flag" size="sm" mono>{{ flag }}</UiBadge>
              </span>
              <span v-else>{{ t('noRiskFlags') }}</span>
              <small v-if="geo.risk.score != null" class="g-code">{{ t('riskScore') }} {{ geo.risk.score }}</small>
            </div>
          </div>
          <div v-if="ptr.length" class="geo-item">
            <div class="g-label">{{ t('reverseDns') }}</div>
            <div class="g-value">{{ ptr.join(', ') }}</div>
          </div>
          <div class="geo-item">
            <div class="g-label">{{ t('timezone') }}</div>
            <div class="g-value">{{ geo.tz || '—' }}</div>
          </div>
          <div class="geo-item">
            <div class="g-label">{{ t('coords') }}</div>
            <div class="g-value">
              <template v-if="geo.lat != null">
                {{ fmtCoord(geo.lat) }}, {{ fmtCoord(geo.lon) }}
                <a :href="mapUrl" target="_blank" rel="noreferrer">{{ t('mapLink') }}</a>
              </template>
              <template v-else>—</template>
            </div>
          </div>
        </div>
      </UiCard>

      <UiCard v-if="isDomain" :label="t('dnsRecords')">
        <UiErrorState v-if="dnsError" :message="dnsError" retry-label="" />
        <p v-else-if="!dnsRecords.length" class="dns-empty">{{ t('noData') }}</p>
        <div v-else class="dns-grid">
          <div v-for="r in dnsRecords" :key="r.type" class="dns-row">
            <span class="dns-type">
              {{ r.type }}
              <small v-if="r.values[0]?.ttl" class="dns-ttl">TTL {{ r.values[0].ttl }}s</small>
            </span>
            <div class="dns-values">
              <span v-for="(v, i) in r.values" :key="i" class="dns-val">{{ v.value }}</span>
            </div>
          </div>
        </div>
      </UiCard>

      <UiCard v-if="isDomain" :label="t('rdapTitle')">
        <UiErrorState v-if="rdapError" :message="rdapError" retry-label="" />
        <p v-else-if="!hasRdapData" class="dns-empty">{{ t('noData') }}</p>
        <div v-else class="kv-list">
          <div v-if="rdap.registrar" class="kv-row">
            <span class="kv-key">{{ t('registrar') }}</span>
            <span class="kv-val">{{ rdap.registrar }}</span>
          </div>
          <div v-if="rdap.created" class="kv-row">
            <span class="kv-key">{{ t('rdapCreated') }}</span>
            <span class="kv-val">{{ rdap.created }}</span>
          </div>
          <div v-if="rdap.expires" class="kv-row">
            <span class="kv-key">{{ t('rdapExpires') }}</span>
            <span class="kv-val">{{ rdap.expires }}</span>
          </div>
          <div v-if="rdap.updated" class="kv-row">
            <span class="kv-key">{{ t('rdapUpdated') }}</span>
            <span class="kv-val">{{ rdap.updated }}</span>
          </div>
          <div v-if="rdap.status.length" class="kv-row">
            <span class="kv-key">{{ t('rdapStatus') }}</span>
            <span class="kv-val status-tags">
              <UiBadge v-for="s in rdap.status" :key="s" size="sm" mono>{{ rdapStatusLabel(s) }}</UiBadge>
            </span>
          </div>
          <div v-if="rdap.nameservers.length" class="kv-row">
            <span class="kv-key">{{ t('rdapNameservers') }}</span>
            <span class="kv-val">{{ rdap.nameservers.join(', ') }}</span>
          </div>
        </div>
      </UiCard>

      <UiCard v-if="isDomain" :label="t('latency')">
        <div class="latency-body">
          <UiStat
            v-for="item in latencyItems"
            :key="item.label"
            :label="item.label"
            :value="item.value"
            sub="ms"
            :tone="latTone(item.cls)"
            card
            compact
          />
        </div>
      </UiCard>

      <UiCard v-if="isDomain" :label="t('httpCheck')">
        <UiErrorState v-if="httpError" :message="httpError" retry-label="" />
        <template v-else-if="httpInfo">
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">{{ t('result') }}</span>
              <span class="kv-val">{{ httpInfo.ok ? t('reachable') : t('unreachable') }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">{{ t('mode') }}</span>
              <span class="kv-val">{{ httpInfo.type || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">{{ t('responseTime') }}</span>
              <span class="kv-val">{{ httpInfo.ms }} ms</span>
            </div>
          </div>
          <p class="card-note">{{ t('httpOpaque') }}</p>
        </template>
        <details v-if="httpHeaders?.headers.length" class="headers-details">
          <summary>{{ t('headers') }} ({{ httpHeaders.headers.length }})</summary>
          <div class="headers-status">{{ httpHeaders.statusLine }}</div>
          <div class="headers-list">
            <div v-for="(h, i) in httpHeaders.headers" :key="i" class="header-row">
              <span class="header-name">{{ h.name }}</span>
              <span class="header-value">{{ h.value }}</span>
            </div>
          </div>
          <p class="card-note">{{ t('headersSource') }}</p>
        </details>
        <p v-else-if="httpHeadersError" class="card-note">{{ httpHeadersError }}</p>
      </UiCard>

      <UiCard v-if="isDomain" :label="t('sslCerts')">
        <UiErrorState v-if="sslError" :message="sslError" retry-label="" />
        <p v-else-if="!sslCerts.length" class="dns-empty">{{ t('noData') }}</p>
        <div v-else class="ssl-body">
          <div v-for="c in sslCerts" :key="c.id" class="ssl-item">
            <div class="ssl-name">{{ c.name }}</div>
            <div class="ssl-meta">
              {{ t('issuer') }}: {{ sslIssuer(c) }}<br />
              {{ t('issued') }}: {{ sslDateShort(c.issued) }} · {{ t('expires') }}: {{ sslDateShort(c.expires) }}
            </div>
          </div>
        </div>
        <a v-if="sslLabsUrl" class="card-link" :href="sslLabsUrl" target="_blank" rel="noreferrer"
          >{{ t('sslReport') }} ↗</a
        >
      </UiCard>
    </div>
  </UiPage>
</template>

<style scoped>
.search-bar {
  padding: 0.15rem 0 0.75rem;
  border-bottom: 1px solid var(--ok-line);
}

.history-chip {
  font-family: var(--ok-mono);
}

.status-bar {
  display: flex;
  min-height: 1.8rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0;
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--ok-muted);
}

.status-bar.scanning :deep(.ui-loading) {
  padding: 0;
  color: var(--ok-accent);
  font-family: var(--ok-mono);
}

.status-bar.done .status-text {
  color: var(--ok-up);
}

.status-error {
  flex: 1 1 18rem;
}

.status-copy {
  margin-left: auto;
}

.results {
  display: grid;
  grid-template-columns: 1fr;
  align-items: start;
  gap: 0.8rem;
  margin-top: 0.9rem;
}

.results :deep(.ui-card-label) {
  color: var(--ok-accent);
  font-family: var(--ok-mono);
}

.card-time {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.72rem;
}

.card-note {
  color: var(--ok-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.card-link {
  display: inline-block;
  font-size: 0.76rem;
}

.headers-details {
  padding-top: 0.5rem;
  border-top: 1px solid var(--ok-line);
}

.headers-details summary {
  color: var(--ok-accent);
  font-size: 0.76rem;
  cursor: pointer;
}

.headers-status {
  margin-top: 0.4rem;
  font-family: var(--ok-mono);
  font-size: 0.76rem;
}

.headers-list {
  display: grid;
  gap: 0.2rem;
  margin-top: 0.3rem;
}

.header-row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr;
  gap: 0.5rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--ok-line);
  font-size: 0.72rem;
}

.header-name {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  word-break: break-all;
}

.header-value {
  font-family: var(--ok-mono);
  word-break: break-all;
}

.geo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.geo-empty {
  color: var(--ok-muted);
}

.geo-item {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--ok-line);
}

.geo-item .g-label {
  color: var(--ok-muted);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.geo-item .g-value {
  margin-top: 0.1rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.geo-item .g-code {
  margin-left: 0.35rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.7rem;
}

.risk-tags,
.status-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.geo-item .g-value a {
  font-size: 0.78rem;
}

.dns-grid {
  display: grid;
  gap: 0.5rem;
}

.dns-empty {
  color: var(--ok-muted);
}

.dns-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 0.5rem;
  align-items: start;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--ok-line);
}

.dns-type {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  color: var(--ok-accent);
  font-family: var(--ok-mono);
  font-size: 0.82rem;
  font-weight: 700;
}

.dns-values {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dns-val {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  word-break: break-all;
}

.dns-ttl {
  color: var(--ok-muted);
  font-size: 0.62rem;
  font-weight: 400;
}

.latency-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.kv-list {
  display: grid;
  gap: 0;
}

.kv-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--ok-line);
  font-size: 0.8rem;
}

.kv-key {
  color: var(--ok-accent);
  font-family: var(--ok-mono);
  font-size: 0.76rem;
}

.kv-val {
  color: var(--ok-muted);
  word-break: break-all;
}

.ssl-body {
  display: grid;
  gap: 0.5rem;
}

.ssl-item {
  padding: 0.5rem;
  border: 1px solid var(--ok-line);
  font-size: 0.8rem;
}

.ssl-item .ssl-name {
  margin-bottom: 0.2rem;
  font-weight: 600;
}

.ssl-item .ssl-meta {
  color: var(--ok-muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .geo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .latency-body {
    grid-template-columns: repeat(2, 1fr);
  }
  .kv-row {
    grid-template-columns: 120px 1fr;
  }
  .dns-row {
    grid-template-columns: 70px 1fr;
  }
}
</style>
