const liveTime = document.getElementById('liveTime');
const liveDate = document.getElementById('liveDate');
const langToggle = document.getElementById('langToggle');
const cityChips = document.getElementById('cityChips');
const cityInput = document.getElementById('cityInput');
const cityList = document.getElementById('cityList');
const addBtn = document.getElementById('addBtn');
const presetSelect = document.getElementById('presetSelect');
const timeline = document.getElementById('timeline');
const hourAxis = document.getElementById('hourAxis');
const durBtns = document.querySelectorAll('.dur-btn');
const durHint = document.getElementById('durHint');
const resultCard = document.getElementById('resultCard');
const resultBody = document.getElementById('resultBody');
const clearBtn = document.getElementById('clearBtn');
const bestSlots = document.getElementById('bestSlots');

const KNOWN_CITIES = [
  'Shanghai','Beijing','Shenzhen','Guangzhou','Hong Kong','Taipei',
  'Tokyo','Seoul','Singapore','Bangkok','Jakarta','Manila','Hanoi','Kuala Lumpur','Mumbai','Delhi','Dubai',
  'London','Paris','Berlin','Amsterdam','Madrid','Rome','Stockholm','Warsaw','Istanbul','Moscow',
  'New York','Los Angeles','Chicago','Toronto','Vancouver','Mexico City','São Paulo','Buenos Aires',
  'Sydney','Melbourne','Auckland','Cairo','Nairobi','Johannesburg','Lagos',
];

const PRESETS = {
  apac: ['Shanghai', 'Tokyo', 'Singapore', 'Sydney'],
  'us-eu': ['New York', 'London', 'Berlin'],
  global: ['Shanghai', 'London', 'New York'],
};

const copy = {
  en: {
    eyebrow: 'Cross-timezone meeting planner',
    title: 'Hour Bridge',
    lead: 'Pick cities, see who\u2019s awake, find the fairest meeting slot.',
    custom: 'Custom',
    add: 'Add',
    duration: 'Meeting duration',
    timeline: 'Timeline',
    timelineDesc: 'Click a slot to select meeting time. Green = business hours, yellow = edge, red = night.',
    selectedSlot: 'Selected slot',
    clear: 'Clear',
    bestSlots: 'Best meeting slots',
    good: 'Business hours',
    fair: 'Early / Late',
    night: 'Night',
    score: 'Score',
    remove: '\u00d7',
    enterCity: 'Type a city name\u2026',
    slotDetails: '{city}: {time} ({status})',
    loading: 'Resolving cities\u2026',
  },
  zh: {
    eyebrow: '跨时区会议规划',
    title: 'Hour Bridge',
    lead: '选城市，看谁醒着，找最公平的开会时间。',
    custom: '自定义',
    add: '添加',
    duration: '会议时长',
    timeline: '时间线',
    timelineDesc: '点击格子选会议时间。绿=上班时间，黄=边缘，红=深夜。',
    selectedSlot: '已选时段',
    clear: '清除',
    bestSlots: '最佳会议时段',
    good: '上班时间',
    fair: '偏早/偏晚',
    night: '深夜',
    score: '得分',
    remove: '\u00d7',
    enterCity: '输入城市名\u2026',
    slotDetails: '{city}: {time} ({status})',
    loading: '正在解析城市\u2026',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let cities = [];
let duration = 60;
let selectedSlot = null;

function t(key) { return copy[lang][key] || key; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang === 'en' ? '中文' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  cityInput.placeholder = t('enterCity');
  if (cities.length) renderTimeline();
}

function updateClock() {
  const now = new Date();
  liveTime.textContent = now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  liveDate.textContent = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
}

function localHour(tz, utcHour) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(today.getTime() + utcHour * 3600000);
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(target));
}

function localTime(tz, utcHour) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(today.getTime() + utcHour * 3600000);
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(target);
}

function hourStatus(h) {
  if (h >= 9 && h <= 18) return 'good';
  if ((h >= 7 && h < 9) || (h > 18 && h <= 21)) return 'fair';
  return 'night';
}

function statusLabel(s) {
  return s === 'good' ? t('good') : s === 'fair' ? t('fair') : t('night');
}

function renderChips() {
  cityChips.innerHTML = cities.map((c, i) => `
    <span class="chip">${c.name} <span class="chip-remove" data-rm="${i}">${t('remove')}</span></span>
  `).join('');
  cityChips.querySelectorAll('[data-rm]').forEach(el => {
    el.addEventListener('click', () => {
      cities.splice(Number(el.dataset.rm), 1);
      renderChips();
      if (cities.length >= 2) renderTimeline();
    });
  });
}

async function resolveCity(name) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const place = data.results?.[0];
  if (!place) throw new Error(`Not found: ${name}`);
  return { name: place.name, tz: place.timezone, lat: place.latitude, lon: place.longitude };
}

async function addCity(name) {
  if (!name || cities.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
  if (cities.length >= 8) return;
  try {
    const resolved = await resolveCity(name);
    cities.push(resolved);
    renderChips();
    if (cities.length >= 2) renderTimeline();
  } catch {
    // silently ignore bad city names
  }
}

function scoreSlot(utcHour) {
  let total = 0;
  cities.forEach(c => {
    const h = localHour(c.tz, utcHour);
    const s = hourStatus(h);
    total += s === 'good' ? 2 : s === 'fair' ? 1 : -3;
  });
  return total;
}

function renderTimeline() {
  const utcHours = Array.from({ length: 24 }, (_, i) => i);

  // Timeline rows
  timeline.innerHTML = cities.map(c => {
    const slots = utcHours.map(uh => {
      const lh = localHour(c.tz, uh);
      const lt = localTime(c.tz, uh);
      const s = hourStatus(lh);
      const sel = selectedSlot !== null && uh >= selectedSlot && uh < selectedSlot + Math.ceil(duration / 60);
      return `<div class="tl-slot ${s} ${sel ? (uh === selectedSlot ? 'selected' : 'in-range') : ''}" data-utc="${uh}" title="${c.name}: ${lt} (${statusLabel(s)})">${lt.slice(0, 2)}</div>`;
    }).join('');
    return `<div class="tl-row"><div class="tl-city">${c.name}<small>${c.tz.split('/').pop().replace(/_/g, ' ')}</small></div><div class="tl-bar">${slots}</div></div>`;
  }).join('');

  // Hour axis
  hourAxis.innerHTML = utcHours.map(uh => `<span>${String(uh).padStart(2, '0')}</span>`).join('');

  // Click handlers
  timeline.querySelectorAll('.tl-slot').forEach(el => {
    el.addEventListener('click', () => {
      const uh = Number(el.dataset.utc);
      selectedSlot = selectedSlot === uh ? null : uh;
      renderTimeline();
      renderResult();
      renderBestSlots();
    });
  });

  renderBestSlots();
}

function renderResult() {
  if (selectedSlot === null || cities.length < 2) {
    resultCard.style.display = 'none';
    return;
  }
  resultCard.style.display = '';
  const slotsNeeded = Math.ceil(duration / 60);
  resultBody.innerHTML = cities.map(c => {
    const lt = localTime(c.tz, selectedSlot);
    const lh = localHour(c.tz, selectedSlot);
    const s = hourStatus(lh);
    return `<div class="result-item">
      <div class="city-name">${c.name}</div>
      <div class="city-time">${lt}</div>
      <div class="city-status ${s}">${statusLabel(s)}</div>
    </div>`;
  }).join('');
}

function renderBestSlots() {
  if (cities.length < 2) { bestSlots.innerHTML = ''; return; }
  const scored = Array.from({ length: 24 }, (_, i) => i)
    .map(uh => ({ uh, score: scoreSlot(uh) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  bestSlots.innerHTML = scored.map((s, i) => {
    const maxScore = cities.length * 2;
    const pct = Math.round((s.score / maxScore) * 100);
    const cls = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
    const details = cities.map(c => {
      const lt = localTime(c.tz, s.uh);
      const st = hourStatus(localHour(c.tz, s.uh));
      return `${c.name} ${lt} (${statusLabel(st)})`;
    }).join(' · ');

    return `<div class="best-card" data-uh="${s.uh}">
      <span class="best-rank">#${i + 1}</span>
      <div class="best-time">UTC ${String(s.uh).padStart(2, '0')}:00</div>
      <div class="best-detail">${details}</div>
      <span class="best-score ${cls}">${t('score')}: ${pct}%</span>
    </div>`;
  }).join('');

  bestSlots.querySelectorAll('.best-card').forEach(el => {
    el.addEventListener('click', () => {
      selectedSlot = Number(el.dataset.uh);
      renderTimeline();
      renderResult();
    });
  });
}

// Events
addBtn.addEventListener('click', () => {
  const val = cityInput.value.trim();
  if (val) { addCity(val); cityInput.value = ''; }
});

cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
});

presetSelect.addEventListener('change', () => {
  const key = presetSelect.value;
  if (!key || !PRESETS[key]) return;
  cities = [];
  renderChips();
  PRESETS[key].forEach(c => addCity(c));
  presetSelect.value = '';
});

durBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    durBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    duration = Number(btn.dataset.dur);
    renderTimeline();
    renderResult();
  });
});

clearBtn.addEventListener('click', () => {
  selectedSlot = null;
  renderTimeline();
  renderResult();
});

langToggle.addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('openkee-lang', lang);
  applyLanguage();
});

// Populate datalist
cityList.innerHTML = KNOWN_CITIES.map(c => `<option value="${c}">`).join('');

// Init
setInterval(updateClock, 1000);
updateClock();
applyLanguage();
['Shanghai', 'London', 'New York'].forEach(c => addCity(c));
