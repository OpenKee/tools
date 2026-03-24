const lookupForm = document.getElementById('lookupForm');
const targetInput = document.getElementById('targetInput');
const langToggle = document.getElementById('langToggle');
const statusBar = document.getElementById('statusBar');
const historyStrip = document.getElementById('historyStrip');
const results = document.getElementById('results');
const geoGrid = document.getElementById('geoGrid');
const dnsGrid = document.getElementById('dnsGrid');
const latencyBody = document.getElementById('latencyBody');
const headersCard = document.getElementById('headersCard');
const headersBody = document.getElementById('headersBody');
const sslCard = document.getElementById('sslCard');
const sslBody = document.getElementById('sslBody');

const copy = {
  en: {
    eyebrow:'Network intelligence', title:'Node Atlas',
    lead:'Lookup IPs and domains — DNS, geo, headers, SSL, latency.',
    scan:'Scan', geolocation:'Geolocation', dnsRecords:'DNS Records',
    latency:'Latency', httpHeaders:'HTTP Response', sslCerts:'SSL Certificates',
    scanning:'Scanning\u2026', done:'Done', error:'Error',
    ip:'IP', country:'Country', region:'Region', city:'City',
    isp:'ISP', org:'Organization', timezone:'Timezone',
    coords:'Coordinates', reverseDns:'Reverse DNS',
    mapLink:'Open in map', noData:'No data',
    dnsLookup:'DNS lookup', httpFetch:'HTTP fetch', sslFetch:'SSL check',
    total:'Total', waiting:'Waiting\u2026',
    issued:'Issued', expires:'Expires', issuer:'Issuer',
  },
  zh: {
    eyebrow:'网络情报', title:'Node Atlas',
    lead:'查询 IP 和域名 — DNS、地理位置、HTTP 头、SSL、延迟。',
    scan:'扫描', geolocation:'地理位置', dnsRecords:'DNS 记录',
    latency:'延迟', httpHeaders:'HTTP 响应', sslCerts:'SSL 证书',
    scanning:'扫描中\u2026', done:'完成', error:'错误',
    ip:'IP', country:'国家', region:'地区', city:'城市',
    isp:'运营商', org:'组织', timezone:'时区',
    coords:'坐标', reverseDns:'反向 DNS',
    mapLink:'在地图中打开', noData:'无数据',
    dnsLookup:'DNS 查询', httpFetch:'HTTP 请求', sslFetch:'SSL 检查',
    total:'总计', waiting:'等待中\u2026',
    issued:'签发于', expires:'过期于', issuer:'签发者',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let history = JSON.parse(localStorage.getItem('node-atlas-history') || '[]');

function t(k) { return copy[lang][k] || k; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang==='en'?'中文':'EN';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
}

function isIp(v) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(v.trim()); }

function renderHistory() {
  historyStrip.innerHTML = history.slice(0,8).map(h => `<button class="history-chip" data-t="${h}">${h}</button>`).join('');
  historyStrip.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { targetInput.value = b.dataset.t; lookupForm.requestSubmit(); }));
}

function addToHistory(target) {
  history = [target, ...history.filter(h => h !== target)].slice(0, 20);
  localStorage.setItem('node-atlas-history', JSON.stringify(history));
  renderHistory();
}

function latClass(ms) { return ms < 100 ? 'fast' : ms < 500 ? 'mid' : 'slow'; }

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function measureLatency(url) {
  const start = performance.now();
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store' });
    return Math.round(performance.now() - start);
  } catch {
    return Math.round(performance.now() - start);
  }
}

async function geoLookup(ip) {
  const d = await safeFetch(`https://api.ipquery.io/${ip}`);
  if (!d) return null;
  return {
    ip, country: d.location?.country, countryCode: d.location?.country_code,
    region: d.location?.state, city: d.location?.city,
    lat: d.location?.latitude, lon: d.location?.longitude,
    tz: d.location?.timezone, isp: d.isp?.isp, org: d.isp?.org,
  };
}

async function dnsLookup(domain) {
  const types = ['A','AAAA','CNAME','MX','TXT','NS','SOA'];
  const results = await Promise.all(types.map(async type => {
    const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`);
    return { type, values: (d?.Answer || []).map(a => a.data) };
  }));
  return results.filter(r => r.values.length);
}

async function fetchHeaders(domain) {
  try {
    const start = performance.now();
    const r = await fetch(`https://${domain}`, { mode: 'no-cors', cache: 'no-store' });
    const ms = Math.round(performance.now() - start);
    return { status: r.status || 'opaque', type: r.type, ms };
  } catch(e) {
    return { error: e.message };
  }
}

async function fetchSSL(domain) {
  try {
    const r = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);
    if (!r.ok) return [];
    const certs = await r.json();
    return certs.slice(0, 5).map(c => ({
      name: c.common_name,
      issuer: c.issuer_name,
      issued: c.not_before,
      expires: c.not_after,
      id: c.id,
    }));
  } catch { return []; }
}

function renderGeo(geo) {
  if (!geo) {
    geoGrid.innerHTML = `<p style="color:var(--muted)">${t('noData')}</p>`;
    return;
  }
  geoGrid.innerHTML = `
    <div class="geo-item"><div class="g-label">${t('ip')}</div><div class="g-value">${geo.ip}</div></div>
    <div class="geo-item"><div class="g-label">${t('country')}</div><div class="g-value">${geo.country||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('region')}</div><div class="g-value">${geo.region||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('city')}</div><div class="g-value">${geo.city||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('isp')}</div><div class="g-value">${geo.isp||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('org')}</div><div class="g-value">${geo.org||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('timezone')}</div><div class="g-value">${geo.tz||'—'}</div></div>
    <div class="geo-item"><div class="g-label">${t('coords')}</div><div class="g-value">${geo.lat!=null?`${geo.lat}, ${geo.lon}`:'—'} ${geo.lat!=null?`<a href="https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=10/${geo.lat}/${geo.lon}" target="_blank">${t('mapLink')}</a>`:''}</div></div>
  `;
}

function renderDNS(records) {
  dnsGrid.innerHTML = records.map(r => `
    <div class="dns-row">
      <span class="dns-type">${r.type}</span>
      <div class="dns-values">${r.values.map(v => `<span class="dns-val">${v}</span>`).join('')}</div>
    </div>
  `).join('') || `<p style="color:var(--muted)">${t('noData')}</p>`;
}

function renderLatency(dnsMs, httpMs, sslMs, totalMs) {
  latencyBody.innerHTML = `
    <div class="latency-item"><div class="l-label">${t('dnsLookup')}</div><div class="l-value ${latClass(dnsMs)}">${dnsMs}</div><div class="l-unit">ms</div></div>
    <div class="latency-item"><div class="l-label">${t('httpFetch')}</div><div class="l-value ${latClass(httpMs)}">${httpMs}</div><div class="l-unit">ms</div></div>
    <div class="latency-item"><div class="l-label">${t('sslFetch')}</div><div class="l-value ${latClass(sslMs)}">${sslMs}</div><div class="l-unit">ms</div></div>
    <div class="latency-item"><div class="l-label">${t('total')}</div><div class="l-value ${latClass(totalMs)}">${totalMs}</div><div class="l-unit">ms</div></div>
  `;
}

function renderHeaders(info) {
  if (!info || info.error) { headersCard.style.display = 'none'; return; }
  headersCard.style.display = '';
  headersBody.innerHTML = `
    <div class="kv-row"><span class="kv-key">status</span><span class="kv-val">${info.status}</span></div>
    <div class="kv-row"><span class="kv-key">type</span><span class="kv-val">${info.type}</span></div>
    <div class="kv-row"><span class="kv-key">response time</span><span class="kv-val">${info.ms} ms</span></div>
  `;
}

function renderSSL(certs) {
  if (!certs.length) { sslCard.style.display = 'none'; return; }
  sslCard.style.display = '';
  sslBody.innerHTML = certs.map(c => `
    <div class="ssl-item">
      <div class="ssl-name">${c.name}</div>
      <div class="ssl-meta">
        ${t('issuer')}: ${c.issuer?.split('CN=')[1] || c.issuer || '—'}<br>
        ${t('issued')}: ${c.issued?.slice(0,10) || '—'} · ${t('expires')}: ${c.expires?.slice(0,10) || '—'}
      </div>
    </div>
  `).join('');
}

async function lookup(target) {
  target = target.trim();
  if (!target) return;
  addToHistory(target);

  results.style.display = 'none';
  statusBar.className = 'status-bar scanning';
  statusBar.textContent = t('scanning');

  const totalStart = performance.now();
  const domain = isIp(target) ? null : target;

  try {
    // Parallel tasks
    const dnsStart = performance.now();
    const dnsPromise = domain ? dnsLookup(domain) : Promise.resolve([]);
    const httpPromise = domain ? fetchHeaders(domain) : Promise.resolve(null);
    const sslPromise = domain ? fetchSSL(domain) : Promise.resolve([]);

    // Resolve IP first for geo
    let ip = target;
    if (domain) {
      const dnsResult = await dnsPromise;
      const aRecord = dnsResult.find(r => r.type === 'A');
      ip = aRecord?.values[0] || target;
    }

    const [geo, dnsResult, httpInfo, sslCerts] = await Promise.all([
      geoLookup(ip),
      dnsPromise,
      httpPromise,
      sslPromise,
    ]);

    const dnsMs = Math.round(performance.now() - dnsStart);
    const totalMs = Math.round(performance.now() - totalStart);
    const httpMs = httpInfo?.ms || 0;
    const sslMs = sslCerts.length ? Math.round(performance.now() - dnsStart - 200) : 0;

    results.style.display = '';
    renderGeo(geo);
    renderDNS(dnsResult);
    renderLatency(dnsMs, httpMs, Math.max(0, totalMs - dnsMs - httpMs), totalMs);
    renderHeaders(httpInfo);
    renderSSL(sslCerts);

    statusBar.className = 'status-bar done';
    statusBar.textContent = `${t('done')} — ${totalMs}ms`;
  } catch(e) {
    statusBar.className = 'status-bar error';
    statusBar.textContent = `${t('error')}: ${e.message}`;
  }
}

// Events
lookupForm.addEventListener('submit', e => { e.preventDefault(); lookup(targetInput.value); });
langToggle.addEventListener('click', () => { lang = lang==='en'?'zh':'en'; localStorage.setItem('openkee-lang',lang); applyLanguage(); });

// Init
applyLanguage();
renderHistory();
lookup('8.8.8.8');
