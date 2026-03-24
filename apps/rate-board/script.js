const fromCurrency = document.getElementById('fromCurrency');
const toCurrency = document.getElementById('toCurrency');
const fromAmount = document.getElementById('fromAmount');
const toAmount = document.getElementById('toAmount');
const swapBtn = document.getElementById('swapBtn');
const converterRate = document.getElementById('converterRate');
const regionSections = document.getElementById('regionSections');
const matrixTable = document.getElementById('matrixTable');
const tableBase = document.getElementById('tableBase');
const tableAmount = document.getElementById('tableAmount');
const rateTable = document.getElementById('rateTable');
const updatedAt = document.getElementById('updatedAt');
const langToggle = document.getElementById('langToggle');

const CURRENCIES = {
  USD: { en: 'US Dollar', zh: '美元', flag: '🇺🇸' },
  EUR: { en: 'Euro', zh: '欧元', flag: '🇪🇺' },
  GBP: { en: 'British Pound', zh: '英镑', flag: '🇬🇧' },
  JPY: { en: 'Japanese Yen', zh: '日元', flag: '🇯🇵' },
  CNY: { en: 'Chinese Yuan', zh: '人民币', flag: '🇨🇳' },
  KRW: { en: 'Korean Won', zh: '韩元', flag: '🇰🇷' },
  HKD: { en: 'Hong Kong Dollar', zh: '港币', flag: '🇭🇰' },
  SGD: { en: 'Singapore Dollar', zh: '新加坡元', flag: '🇸🇬' },
  TWD: { en: 'Taiwan Dollar', zh: '新台币', flag: '🇹🇼' },
  AUD: { en: 'Australian Dollar', zh: '澳元', flag: '🇦🇺' },
  CAD: { en: 'Canadian Dollar', zh: '加元', flag: '🇨🇦' },
  CHF: { en: 'Swiss Franc', zh: '瑞士法郎', flag: '🇨🇭' },
  NZD: { en: 'New Zealand Dollar', zh: '新西兰元', flag: '🇳🇿' },
  SEK: { en: 'Swedish Krona', zh: '瑞典克朗', flag: '🇸🇪' },
  NOK: { en: 'Norwegian Krone', zh: '挪威克朗', flag: '🇳🇴' },
  DKK: { en: 'Danish Krone', zh: '丹麦克朗', flag: '🇩🇰' },
  INR: { en: 'Indian Rupee', zh: '印度卢比', flag: '🇮🇳' },
  THB: { en: 'Thai Baht', zh: '泰铢', flag: '🇹🇭' },
  MYR: { en: 'Malaysian Ringgit', zh: '马来西亚林吉特', flag: '🇲🇾' },
  PHP: { en: 'Philippine Peso', zh: '菲律宾比索', flag: '🇵🇭' },
  IDR: { en: 'Indonesian Rupiah', zh: '印尼盾', flag: '🇮🇩' },
  VND: { en: 'Vietnamese Dong', zh: '越南盾', flag: '🇻🇳' },
  RUB: { en: 'Russian Ruble', zh: '俄罗斯卢布', flag: '🇷🇺' },
  BRL: { en: 'Brazilian Real', zh: '巴西雷亚尔', flag: '🇧🇷' },
  MXN: { en: 'Mexican Peso', zh: '墨西哥比索', flag: '🇲🇽' },
  AED: { en: 'UAE Dirham', zh: '阿联酋迪拉姆', flag: '🇦🇪' },
  SAR: { en: 'Saudi Riyal', zh: '沙特里亚尔', flag: '🇸🇦' },
  ZAR: { en: 'South African Rand', zh: '南非兰特', flag: '🇿🇦' },
  TRY: { en: 'Turkish Lira', zh: '土耳其里拉', flag: '🇹🇷' },
  PLN: { en: 'Polish Zloty', zh: '波兰兹罗提', flag: '🇵🇱' },
};

const REGIONS = [
  { key: 'asia', label: { en: 'Asia Pacific', zh: '亚太地区' }, codes: ['CNY', 'JPY', 'KRW', 'HKD', 'SGD', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'INR'] },
  { key: 'west', label: { en: 'Americas & Europe', zh: '欧美地区' }, codes: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY'] },
  { key: 'other', label: { en: 'Middle East & Others', zh: '中东及其他' }, codes: ['AED', 'SAR', 'RUB', 'BRL', 'MXN', 'ZAR'] },
];

const MATRIX_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'KRW', 'SGD', 'AUD', 'CAD'];

const copy = {
  en: {
    eyebrow: 'Exchange rate utility',
    title: 'Rate Board',
    lead: 'Convert currencies, compare rates, plan budgets. No sign-up, no tracking.',
    crossRates: 'Cross Rates',
    crossDesc: 'Direct rates between currencies (no base needed).',
    allRates: 'All Rates',
    updated: 'Updated',
    loading: 'Loading rates\u2026',
    error: 'Failed to load rates. The free API may be temporarily unavailable.',
    rate: 'Rate',
    conv: 'Converted',
  },
  zh: {
    eyebrow: '汇率工具',
    title: 'Rate Board',
    lead: '换算汇率、对比币种、规划预算。无需注册，不追踪。',
    crossRates: '交叉汇率',
    crossDesc: '货币之间的直接汇率（无需基准货币）。',
    allRates: '全部汇率',
    updated: '更新于',
    loading: '正在加载汇率\u2026',
    error: '加载失败，免费 API 可能暂时不可用。',
    rate: '汇率',
    conv: '换算结果',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let ratesCache = null;

function t(key) { return copy[lang][key] || key; }
function cname(code) { return CURRENCIES[code]?.[lang] || code; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang === 'en' ? '中文' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  if (ratesCache) renderAll();
}

function populateSelect(sel, codes) {
  const current = sel.value;
  sel.innerHTML = codes.map(c => `<option value="${c}">${CURRENCIES[c]?.flag || ''} ${c} — ${cname(c)}</option>`).join('');
  if (codes.includes(current)) sel.value = current;
}

function crossRate(rates, from, to) {
  if (from === to) return 1;
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!rFrom || !rTo) return null;
  return rTo / rFrom;
}

function fmtRate(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtAmount(n) {
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

async function loadRates() {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  if (data.result !== 'success') throw new Error('API error');
  return data;
}

function convert() {
  if (!ratesCache) return;
  const from = fromCurrency.value;
  const to = toCurrency.value;
  const amount = parseFloat(fromAmount.value) || 0;
  const rate = crossRate(ratesCache.rates, from, to);
  if (rate === null) { toAmount.value = ''; converterRate.textContent = '—'; return; }
  toAmount.value = (amount * rate).toFixed(2);
  converterRate.textContent = `1 ${from} = ${fmtRate(rate)} ${to}`;
}

function renderRegions() {
  if (!ratesCache) return;
  const base = 'USD';
  regionSections.innerHTML = REGIONS.map(region => {
    const rows = region.codes
      .filter(c => c !== base && ratesCache.rates[c])
      .map(c => {
        const rate = ratesCache.rates[c];
        return `<div class="currency-row">
          <div><span class="currency-code">${CURRENCIES[c]?.flag || ''} ${c}</span><span class="currency-name">${cname(c)}</span></div>
          <span class="currency-rate">${fmtRate(rate)}</span>
        </div>`;
      }).join('');
    return `<div class="region-card">
      <div class="region-title">${region.label[lang]}</div>
      ${rows}
    </div>`;
  }).join('');
}

function renderMatrix() {
  if (!ratesCache) return;
  let html = '<thead><tr><th></th>';
  MATRIX_CODES.forEach(c => { html += `<th>${c}</th>`; });
  html += '</tr></thead><tbody>';
  MATRIX_CODES.forEach(from => {
    html += `<tr><th>${from}</th>`;
    MATRIX_CODES.forEach(to => {
      if (from === to) {
        html += `<td class="diag">1</td>`;
      } else {
        const r = crossRate(ratesCache.rates, from, to);
        html += `<td>${fmtRate(r)}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody>';
  matrixTable.innerHTML = html;
}

function renderTable() {
  if (!ratesCache) return;
  const base = tableBase.value;
  const amount = parseFloat(tableAmount.value) || 0;
  const codes = Object.keys(CURRENCIES).filter(c => c !== base && ratesCache.rates[c]);
  codes.sort((a, b) => (ratesCache.rates[b] || 0) - (ratesCache.rates[a] || 0));

  rateTable.innerHTML = codes.map(c => {
    const rate = crossRate(ratesCache.rates, base, c);
    const converted = rate ? amount * rate : 0;
    return `<div class="rate-row">
      <span class="rate-code">${CURRENCIES[c]?.flag || ''} ${c}</span>
      <span class="rate-val">${fmtRate(rate)}</span>
      <span class="rate-converted">${fmtAmount(converted)}</span>
      <span class="rate-name">${cname(c)}</span>
    </div>`;
  }).join('');
}

function renderAll() {
  convert();
  renderRegions();
  renderMatrix();
  renderTable();
}

// Events
fromCurrency.addEventListener('change', convert);
toCurrency.addEventListener('change', convert);
fromAmount.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const tmp = fromCurrency.value;
  fromCurrency.value = toCurrency.value;
  toCurrency.value = tmp;
  convert();
});

tableBase.addEventListener('change', renderTable);
tableAmount.addEventListener('input', renderTable);

langToggle.addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('openkee-lang', lang);
  applyLanguage();
});

// Init
const allCodes = Object.keys(CURRENCIES);
populateSelect(fromCurrency, allCodes);
populateSelect(toCurrency, allCodes);
populateSelect(tableBase, allCodes);
fromCurrency.value = 'USD';
toCurrency.value = 'CNY';
applyLanguage();

document.querySelectorAll('.region-card, .matrix-section, .table-section').forEach(el => {
  el.insertAdjacentHTML('beforebegin', el.outerHTML.includes('matrix') ? '' : '');
});

regionSections.innerHTML = `<div class="loading"><span class="spinner"></span><span>${t('loading')}</span></div>`;

loadRates().then(data => {
  ratesCache = data;
  const d = new Date(data.time_last_update_utc);
  updatedAt.textContent = `${t('updated')}: ${d.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN')}`;
  renderAll();
}).catch(err => {
  regionSections.innerHTML = `<p class="error-msg">${t('error')}</p>`;
});
