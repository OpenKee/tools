const searchForm = document.getElementById('searchForm');
const queryInput = document.getElementById('queryInput');
const locateBtn = document.getElementById('locateBtn');
const unitToggle = document.getElementById('unitToggle');
const savedStrip = document.getElementById('savedStrip');
const heroSection = document.getElementById('heroSection');
const heroIcon = document.getElementById('heroIcon');
const heroTemp = document.getElementById('heroTemp');
const heroCondition = document.getElementById('heroCondition');
const heroPlace = document.getElementById('heroPlace');
const heroMeta = document.getElementById('heroMeta');
const heroStats = document.getElementById('heroStats');
const aqiSection = document.getElementById('aqiSection');
const aqiValue = document.getElementById('aqiValue');
const aqiText = document.getElementById('aqiText');
const aqiBar = document.getElementById('aqiBar');
const hourlySection = document.getElementById('hourlySection');
const hourlyStrip = document.getElementById('hourlyStrip');
const dailySection = document.getElementById('dailySection');
const dailyList = document.getElementById('dailyList');

const WMO_ICONS = {
  0:'☀️', 1:'🌤', 2:'⛅', 3:'☁️', 45:'🌫', 48:'🌫',
  51:'🌦', 53:'🌦', 55:'🌦', 56:'🌧', 57:'🌧',
  61:'🌧', 63:'🌧', 65:'🌧', 66:'🌧', 67:'🌧',
  71:'🌨', 73:'🌨', 75:'🌨', 77:'🌨',
  80:'🌦', 81:'🌧', 82:'⛈',
  85:'🌨', 86:'🌨',
  95:'⛈', 96:'⛈', 99:'⛈',
};

const WMO_TEXT = {
  en: {
    0:'Clear sky', 1:'Mostly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Fog', 48:'Freezing fog',
    51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
    61:'Light rain', 63:'Rain', 65:'Heavy rain',
    71:'Light snow', 73:'Snow', 75:'Heavy snow',
    80:'Rain showers', 81:'Showers', 82:'Heavy showers',
    95:'Thunderstorm', 96:'Thunderstorm + hail',
  },
  zh: {
    0:'晴', 1:'大部晴朗', 2:'多云', 3:'阴天',
    45:'雾', 48:'冻雾',
    51:'小毛毛雨', 53:'毛毛雨', 55:'大毛毛雨',
    61:'小雨', 63:'中雨', 65:'大雨',
    71:'小雪', 73:'中雪', 75:'大雪',
    80:'阵雨', 81:'中阵雨', 82:'大阵雨',
    95:'雷暴', 96:'雷暴+冰雹',
  },
};

const copy = {
  en: {
    eyebrow:'Weather & air quality', title:'Sky Brief',
    search:'Search', locate:'📍 My location', airQuality:'Air quality',
    hourly:'Next 12 hours', daily:'7-day forecast',
    feelsLike:'Feels like', wind:'Wind', humidity:'Humidity',
    sunrise:'Sunrise', sunset:'Sunset', rain:'Rain',
    uv:'UV index', pressure:'Pressure',
    aqiGood:'Good', aqiFair:'Fair', aqiModerate:'Moderate', aqiPoor:'Poor', aqiVpoor:'Very poor',
  },
  zh: {
    eyebrow:'天气 & 空气质量', title:'Sky Brief',
    search:'搜索', locate:'📍 我的位置', airQuality:'空气质量',
    hourly:'未来 12 小时', daily:'7 天预报',
    feelsLike:'体感', wind:'风速', humidity:'湿度',
    sunrise:'日出', sunset:'日落', rain:'降雨',
    uv:'紫外线', pressure:'气压',
    aqiGood:'优', aqiFair:'良', aqiModerate:'中', aqiPoor:'差', aqiVpoor:'极差',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let unit = 'C';
let lastData = null;

function t(k) { return copy[lang][k] || k; }
function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  if (lastData) render(lastData.label, lastData.forecast, lastData.air);
}

function weatherIcon(code) { return WMO_ICONS[code] || '🌡'; }
function weatherText(code) { return (WMO_TEXT[lang]||WMO_TEXT.en)[code] || `WMO ${code}`; }
function toF(c) { return c * 9/5 + 32; }
function tempV(v) { return unit==='C' ? `${Math.round(v)}°` : `${Math.round(toF(v))}°`; }
function speedV(kmh) { return unit==='C' ? `${Math.round(kmh)} km/h` : `${Math.round(kmh*0.621)} mph`; }

function aqiLabel(v) {
  if (v<=50) return t('aqiGood');
  if (v<=100) return t('aqiFair');
  if (v<=150) return t('aqiModerate');
  if (v<=200) return t('aqiPoor');
  return t('aqiVpoor');
}

function aqiColor(v) {
  if (v<=50) return 'var(--good)';
  if (v<=100) return '#8bc34a';
  if (v<=150) return 'var(--warn)';
  return 'var(--bad)';
}

function getSaved() {
  try { return JSON.parse(localStorage.getItem('sky-brief-saved')||'[]'); } catch { return []; }
}
function setSaved(items) { localStorage.setItem('sky-brief-saved', JSON.stringify(items.slice(0,6))); }

function renderSaved() {
  const items = getSaved();
  savedStrip.innerHTML = items.map(i => `<button class="saved-chip" data-q="${i.query}">${i.label}</button>`).join('');
  savedStrip.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => search(b.dataset.q)));
}

async function geocode(query) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
  if (!r.ok) throw new Error('Geocode failed');
  const d = await r.json();
  if (!d.results?.length) throw new Error('No place found');
  return d.results[0];
}

async function loadForecast(lat, lon, label) {
  const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=7`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;
  const [fr, ar] = await Promise.all([fetch(fUrl), fetch(aUrl)]);
  if (!fr.ok || !ar.ok) throw new Error('Fetch failed');
  render(label, await fr.json(), await ar.json());
}

function render(label, f, air) {
  lastData = { label, forecast: f, air };
  const c = f.current;
  const aqi = air.current.us_aqi ?? 0;

  // Hero
  heroSection.style.display = '';
  heroIcon.textContent = weatherIcon(c.weather_code);
  heroTemp.textContent = tempV(c.temperature_2m);
  heroCondition.textContent = weatherText(c.weather_code);
  heroPlace.textContent = label;
  heroMeta.textContent = f.timezone;

  heroStats.innerHTML = `
    <div class="stat-item"><div class="s-label">${t('feelsLike')}</div><div class="s-value">${tempV(c.apparent_temperature)}</div></div>
    <div class="stat-item"><div class="s-label">${t('wind')}</div><div class="s-value">${speedV(c.wind_speed_10m)}</div></div>
    <div class="stat-item"><div class="s-label">${t('humidity')}</div><div class="s-value">${Math.round(c.relative_humidity_2m)}%</div></div>
    <div class="stat-item"><div class="s-label">${t('rain')}</div><div class="s-value">${Math.round(f.daily.precipitation_probability_max?.[0]??0)}%</div></div>
    <div class="stat-item"><div class="s-label">${t('sunrise')}</div><div class="s-value">${new Date(f.daily.sunrise[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
    <div class="stat-item"><div class="s-label">${t('sunset')}</div><div class="s-value">${new Date(f.daily.sunset[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
    <div class="stat-item"><div class="s-label">${t('uv')}</div><div class="s-value">${f.daily.uv_index_max?.[0]?.toFixed(1)??'—'}</div></div>
    <div class="stat-item"><div class="s-label">${t('pressure')}</div><div class="s-value">${Math.round(c.surface_pressure)} hPa</div></div>
  `;

  // AQI
  aqiSection.style.display = '';
  aqiValue.textContent = aqi;
  aqiValue.style.color = aqiColor(aqi);
  aqiText.textContent = aqiLabel(aqi);
  aqiBar.style.left = `${Math.min(100, (aqi / 200) * 100)}%`;
  aqiBar.style.borderColor = aqiColor(aqi);

  // Hourly
  hourlySection.style.display = '';
  const now = new Date();
  const startIdx = f.hourly.time.findIndex(t => new Date(t) >= new Date(now.getTime() - 3600000));
  hourlyStrip.innerHTML = f.hourly.time.slice(startIdx, startIdx + 12).map((time, i) => {
    const idx = startIdx + i;
    return `<div class="hour-card">
      <div class="h-time">${new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
      <div class="h-icon">${weatherIcon(f.hourly.weather_code[idx])}</div>
      <div class="h-temp">${tempV(f.hourly.temperature_2m[idx])}</div>
      ${f.hourly.precipitation_probability[idx] > 20 ? `<div class="h-rain">${Math.round(f.hourly.precipitation_probability[idx])}%</div>` : ''}
    </div>`;
  }).join('');

  // Daily
  dailySection.style.display = '';
  const allMin = Math.min(...f.daily.temperature_2m_min);
  const allMax = Math.max(...f.daily.temperature_2m_max);
  const range = allMax - allMin || 1;

  dailyList.innerHTML = f.daily.time.map((day, i) => {
    const lo = f.daily.temperature_2m_min[i];
    const hi = f.daily.temperature_2m_max[i];
    const left = ((lo - allMin) / range * 100).toFixed(1);
    const width = ((hi - lo) / range * 100).toFixed(1);
    const d = new Date(day);
    const isToday = d.toDateString() === new Date().toDateString();
    const label = isToday ? (lang==='zh'?'今天':'Today') : d.toLocaleDateString(lang==='en'?'en-US':'zh-CN', {weekday:'short', month:'short', day:'numeric'});

    return `<div class="day-row">
      <span class="day-date">${label}</span>
      <span class="day-icon">${weatherIcon(f.daily.weather_code[i])}</span>
      <div class="day-bar"><div class="day-bar-fill" style="left:${left}%;width:${width}%"></div></div>
      <span class="day-temps"><span class="t-low">${tempV(lo)}</span> / ${tempV(hi)}</span>
    </div>`;
  }).join('');
}

async function search(query) {
  heroSection.style.display = 'none';
  aqiSection.style.display = 'none';
  hourlySection.style.display = 'none';
  dailySection.style.display = 'none';
  try {
    const place = await geocode(query);
    const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
    await loadForecast(place.latitude, place.longitude, label);
    // Auto-save
    const saved = getSaved().filter(i => i.query.toLowerCase() !== query.toLowerCase());
    saved.unshift({ label, query });
    setSaved(saved);
    renderSaved();
  } catch(e) {
    heroSection.style.display = '';
    heroIcon.textContent = '❌';
    heroTemp.textContent = '—';
    heroCondition.textContent = e.message;
    heroPlace.textContent = query;
  }
}

// Events
searchForm.addEventListener('submit', e => { e.preventDefault(); search(queryInput.value.trim()); });

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => loadForecast(pos.coords.latitude, pos.coords.longitude, lang==='zh'?'当前位置':'Your location'),
    () => {}
  );
});

unitToggle.addEventListener('click', () => {
  unit = unit==='C'?'F':'C';
  unitToggle.textContent = unit==='C'?'°C':'°F';
  if (lastData) render(lastData.label, lastData.forecast, lastData.air);
});

// Init
applyLanguage();
renderSaved();
search('Shanghai');
