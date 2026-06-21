/* ============================================================
   Mars Weather — 火星天气
   数据来源：MAAS2 API（NASA Curiosity / InSight 公开数据聚合）
   API 不可用时降级到内置模拟数据，保证页面功能完整。
   ============================================================ */

// ---------- 国际化文案 ----------
const copy = {
  en: {
    eyebrow: 'Mars · Curiosity / InSight data',
    title: 'Mars Weather',
    lead: 'Surface weather records from Mars: temperature, pressure, wind and season. Latest Sol fetched live via MAAS2, with a 7-Sol trend built from the most recent observation.',
    celsius: '°C',
    fahrenheit: '°F',
    dataSource: 'Data source',
    season: 'Season',
    latestSol: 'Latest Sol',
    updated: 'Updated',
    martianSeason: 'Martian season',
    trendTitle: '7-Sol temperature trend',
    maxTemp: 'High',
    minTemp: 'Low',
    solDaysTitle: 'Recent Sol weather',
    solHint: 'Sol = a Mars day (~24h 37m)',
    loading: 'Loading Mars weather data…',
    sourceTitle: 'Data source',
    sourceText: 'The latest Sol data comes from the MAAS2 API, which aggregates NASA Curiosity and InSight rover weather observations. Because MAAS2 only exposes the most recent Sol, the surrounding 6 Sols are generated from the latest reading to show the 7-Sol trend. When the API is unavailable, the page falls back to built-in simulated data so all features keep working.',
    // Sol 卡片
    sol: 'Sol',
    high: 'High',
    low: 'Low',
    pressure: 'Pressure',
    wind: 'Wind',
    windDir: 'Wind dir',
    seasonLabel: 'Season',
    // 季节描述
    seasonWinter: 'Winter on Mars brings cold, dusty skies and reduced sunlight at the landing site.',
    seasonSpring: 'Spring sees rising temperatures and occasional dust storms begin to form.',
    seasonSummer: 'Summer is the warmest season, though still well below freezing by Earth standards.',
    seasonAutumn: 'Autumn brings falling temperatures as the hemisphere tilts away from the Sun.',
    seasonNorth: 'Northern hemisphere',
    seasonSouth: 'Southern hemisphere',
    // 对比
    compareTitle: 'Mars vs Earth',
    distanceSun: 'Distance from Sun',
    dayLength: 'Day length',
    yearLength: 'Year length',
    atmosphere: 'Atmosphere',
    avgTemp: 'Avg surface temp',
    gravity: 'Gravity',
    moons: 'Moons',
    mars: 'Mars',
    earth: 'Earth',
    // 状态
    simulated: 'Simulated data',
    liveData: 'MAAS2 live',
    fetchError: 'Failed to fetch live data, showing simulated data.',
    noData: 'No weather data available.',
  },
  zh: {
    eyebrow: '火星 · 好奇号 / 洞察号数据',
    title: '火星天气',
    lead: '火星地表天气记录：温度、气压、风与季节。最新 Sol 通过 MAAS2 实时获取，7 Sol 趋势基于最近一次观测生成。',
    celsius: '°C',
    fahrenheit: '°F',
    dataSource: '数据来源',
    season: '当前季节',
    latestSol: '最新 Sol',
    updated: '更新时间',
    martianSeason: '火星季节',
    trendTitle: '7 Sol 温度趋势',
    maxTemp: '最高温',
    minTemp: '最低温',
    solDaysTitle: '近期 Sol 天气',
    solHint: 'Sol = 火星日（约 24 小时 37 分）',
    loading: '正在加载火星天气数据…',
    sourceTitle: '数据来源说明',
    sourceText: '最新的 Sol 数据来自 MAAS2 API，它聚合了 NASA 好奇号与洞察号的火星气象观测数据。由于 MAAS2 只提供最新的一个 Sol，周围的 6 个 Sol 会基于最近一次的读数生成，以展示 7 Sol 趋势；当 API 不可用时，页面将展示内置模拟数据以保证功能完整。',
    // Sol 卡片
    sol: 'Sol',
    high: '最高',
    low: '最低',
    pressure: '气压',
    wind: '风速',
    windDir: '风向',
    seasonLabel: '季节',
    // 季节描述
    seasonWinter: '火星冬季：着陆点天空寒冷多尘，日照减弱。',
    seasonSpring: '火星春季：气温回升，偶有沙尘暴开始形成。',
    seasonSummer: '火星夏季：一年中最温暖的季节，但按地球标准仍远低于冰点。',
    seasonAutumn: '火星秋季：随半球转向背离太阳，气温逐渐下降。',
    seasonNorth: '北半球',
    seasonSouth: '南半球',
    // 对比
    compareTitle: '火星 vs 地球',
    distanceSun: '距太阳距离',
    dayLength: '一天长度',
    yearLength: '一年长度',
    atmosphere: '大气成分',
    avgTemp: '平均地表温度',
    gravity: '重力',
    moons: '卫星',
    mars: '火星',
    earth: '地球',
    // 状态
    simulated: '模拟数据',
    liveData: 'MAAS2 实时',
    fetchError: '实时数据获取失败，已切换为模拟数据。',
    noData: '暂无天气数据。',
  }
};

// ---------- DOM 引用 ----------
const langToggle = document.getElementById('langToggle');
const unitC = document.getElementById('unitC');
const unitF = document.getElementById('unitF');
const sourceVal = document.getElementById('sourceVal');
const seasonVal = document.getElementById('seasonVal');
const solVal = document.getElementById('solVal');
const updatedVal = document.getElementById('updatedVal');
const seasonName = document.getElementById('seasonName');
const seasonDesc = document.getElementById('seasonDesc');
const solGrid = document.getElementById('solGrid');
const chartSvg = document.getElementById('trendChart');
const compareGrid = document.getElementById('compareGrid');

// ---------- API 地址 ----------
const MAAS2_URL = 'https://api.maas2.apollorion.com/';

// ---------- 运行时状态 ----------
let lang = OK.lang;
let unit = 'C';            // 温度单位：'C' | 'F'
let weatherData = null;    // 解析后的天气数据数组（按时间正序）
let isSimulated = false;   // 是否使用模拟数据

// ---------- 翻译辅助 ----------
function t(key) {
  return (copy[lang] && copy[lang][key]) || key;
}

// ---------- 季节中英映射 ----------
const SEASON_MAP = {
  winter:  { en: 'Winter',  zh: '冬季' },
  spring:  { en: 'Spring',  zh: '春季' },
  summer:  { en: 'Summer',  zh: '夏季' },
  autumn:  { en: 'Autumn',  zh: '秋季' },
  fall:    { en: 'Autumn',  zh: '秋季' },
};

// 季节描述 key（按英文季节名归一）
function seasonDescKey(season) {
  const s = String(season || '').toLowerCase();
  if (s.indexOf('winter') > -1) return 'seasonWinter';
  if (s.indexOf('spring') > -1) return 'seasonSpring';
  if (s.indexOf('summer') > -1) return 'seasonSummer';
  return 'seasonAutumn';
}

// ---------- 内置模拟数据（API 不可用时降级） ----------
// 数值参考 InSight 着陆点（埃律西昂平原）的真实量级
function buildMockData() {
  const season = 'winter';
  const base = Date.now();
  const days = [];
  // 7 个 Sol，温度围绕真实火星范围波动
  const seeds = [
    { mx: -24.2, mn: -88.1, pre: 712, hws: 6.4, dir: 'NE', deg: 45 },
    { mx: -21.8, mn: -85.7, pre: 708, hws: 7.8, dir: 'E',  deg: 90 },
    { mx: -26.5, mn: -90.3, pre: 715, hws: 5.2, dir: 'NE', deg: 50 },
    { mx: -23.1, mn: -87.4, pre: 720, hws: 8.9, dir: 'SE', deg: 135 },
    { mx: -19.7, mn: -83.9, pre: 725, hws: 6.1, dir: 'E',  deg: 95 },
    { mx: -22.4, mn: -86.2, pre: 711, hws: 7.0, dir: 'NE', deg: 40 },
    { mx: -25.0, mn: -89.0, pre: 718, hws: 9.3, dir: 'SE', deg: 140 },
  ];
  for (let i = 0; i < 7; i++) {
    const s = seeds[i];
    days.push({
      sol: 1340 + i,
      date: new Date(base - (6 - i) * 86400000),
      at: { av: +((s.mx + s.mn) / 2).toFixed(1), mx: s.mx, mn: s.mn },
      pre: { av: s.pre },
      hws: { av: s.hws },
      wd: { compass_point: s.dir, compass_degrees: s.deg },
      season: season,
      simulated: true,
    });
  }
  return days;
}

// ---------- 解析 MAAS2 API 返回 ----------
// MAAS2 返回单个最新 Sol 对象。我们把它作为最新一天，再基于它生成前 6 天。
function parseApiResponse(data) {
  if (!data || data.sol == null) return null;
  const latest = maas2ToDay(data, false);
  if (!latest) return null;
  const days = [latest];
  // 生成前 6 天：温度、气压、风速在真实值附近小幅波动
  for (let i = 1; i < 7; i++) {
    const factor = i / 6; // 0..1，越往前偏离越大
    const jitter = (max, min) => (Math.random() * (max - min) + min) * factor;
    const mx = latest.at.mx + jitter(4, -4);
    const mn = latest.at.mn + jitter(4, -4);
    const pre = latest.pre && latest.pre.av != null
      ? latest.pre.av + jitter(12, -12)
      : null;
    const hws = latest.hws && latest.hws.av != null
      ? latest.hws.av + jitter(2, -2)
      : null;
    days.unshift({
      sol: latest.sol - i,
      date: new Date(latest.date.getTime() - i * 88700000), // 约一个火星日
      at: { av: +((mx + mn) / 2).toFixed(1), mx: +mx.toFixed(1), mn: +mn.toFixed(1) },
      pre: pre != null ? { av: +pre.toFixed(1) } : null,
      hws: hws != null ? { av: Math.max(0, +hws.toFixed(1)) } : null,
      wd: latest.wd,
      season: latest.season,
      simulated: true, // 历史 Sol 为基于真实数据生成的填充数据
    });
  }
  return days;
}

// 将 MAAS2 单个 Sol 对象转成统一 day 结构
function maas2ToDay(d, simulated) {
  const sol = parseInt(d.sol, 10);
  if (isNaN(sol)) return null;
  const mx = num(d.max_temp);
  const mn = num(d.min_temp);
  const pre = num(d.pressure);
  const hws = d.wind_speed !== '--' && d.wind_speed != null ? num(d.wind_speed) : null;
  const date = d.terrestrial_date ? new Date(d.terrestrial_date) : new Date();
  return {
    sol: sol,
    date: date,
    at: {
      av: mx != null && mn != null ? +((mx + mn) / 2).toFixed(1) : (mx != null ? mx : (mn != null ? mn : null)),
      mx: mx,
      mn: mn,
    },
    pre: pre != null ? { av: pre } : null,
    hws: hws != null ? { av: hws } : null,
    wd: parseWindDirection(d.wind_direction),
    season: d.season || 'unknown',
    simulated: simulated,
  };
}

function parseWindDirection(raw) {
  if (!raw) return null;
  const str = String(raw).trim().toUpperCase();
  const DIRS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
                 S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
  const deg = DIRS[str];
  if (deg == null) return null;
  return { compass_point: str, compass_degrees: deg };
}

// 安全取数
function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ---------- 温度单位换算 ----------
function toF(c) { return c * 9 / 5 + 32; }

// 按当前单位格式化温度（保留 1 位小数）
function fmtTemp(c) {
  if (c == null) return '—';
  const v = unit === 'F' ? toF(c) : c;
  return (v > 0 ? '' : '') + v.toFixed(1) + '°' + unit;
}

// ---------- 获取天气数据（实时优先，失败降级模拟） ----------
function fetchWeather() {
  showLoading(true);
  OK.fetchJSON(MAAS2_URL, { timeout: 15000 })
    .then(function (data) {
      const parsed = parseApiResponse(data);
      if (!parsed) {
        // API 返回但无有效数据，降级
        console.warn('MAAS2 API returned no usable data, falling back to mock.');
        useMockData();
        return;
      }
      weatherData = parsed;
      isSimulated = false;
      showLoading(false);
      renderAll();
    })
    .catch(function (err) {
      console.warn('MAAS2 API fetch failed:', err);
      useMockData();
    });
}

function useMockData() {
  weatherData = buildMockData();
  isSimulated = true;
  showLoading(false);
  renderAll();
}

function showLoading(on) {
  if (on) {
    solGrid.innerHTML = '<div class="loading-note"><span class="ok-spinner" aria-hidden="true"></span><span>' +
      OK.escape(t('loading')) + '</span></div>';
  }
}

// ---------- 渲染：状态条 ----------
function renderStatusBar() {
  const latest = weatherData[weatherData.length - 1];
  sourceVal.textContent = isSimulated ? t('simulated') : t('liveData');
  sourceVal.classList.toggle('sim', isSimulated);

  const seasonRaw = latest && latest.season ? latest.season : '';
  const sm = SEASON_MAP[String(seasonRaw).toLowerCase()] || { en: seasonRaw, zh: seasonRaw };
  seasonVal.textContent = lang === 'zh' ? sm.zh : sm.en;

  solVal.textContent = latest ? latest.sol : '—';
  updatedVal.textContent = new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ---------- 渲染：季节卡片 ----------
function renderSeasonCard() {
  const latest = weatherData[weatherData.length - 1];
  if (!latest) return;
  const seasonRaw = String(latest.season || '').toLowerCase();
  const sm = SEASON_MAP[seasonRaw] || { en: latest.season, zh: latest.season };
  seasonName.textContent = lang === 'zh' ? sm.zh : sm.en;
  seasonDesc.textContent = t(seasonDescKey(seasonRaw));
}

// ---------- 渲染：Sol 天气卡片网格 ----------
function renderSolGrid() {
  if (!weatherData || !weatherData.length) {
    solGrid.innerHTML = '<div class="error-msg">' + OK.escape(t('noData')) + '</div>';
    return;
  }
  const items = weatherData.map(function (d, idx) {
    const isLatest = idx === weatherData.length - 1;
    const dateStr = d.date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric',
    });
    const preStr = d.pre && d.pre.av != null ? Math.round(d.pre.av) + ' Pa' : '—';
    const windStr = d.hws && d.hws.av != null ? d.hws.av.toFixed(1) + ' m/s' : '—';
    const dirStr = d.wd && d.wd.compass_point ? d.wd.compass_point : '—';
    const dirDeg = d.wd && d.wd.compass_degrees != null ? d.wd.compass_degrees : 0;
    const seasonRaw = String(d.season || '').toLowerCase();
    const sm = SEASON_MAP[seasonRaw] || { en: d.season, zh: d.season };
    const seasonText = lang === 'zh' ? sm.zh : sm.en;

    return '' +
      '<article class="sol-card' + (isLatest ? ' latest' : '') + '" aria-label="Sol ' + d.sol + ' weather">' +
        '<div class="sol-card-head">' +
          '<span class="sol-num">' + OK.escape(t('sol')) + ' ' + d.sol + '</span>' +
          '<span class="sol-date">' + OK.escape(dateStr) + '</span>' +
        '</div>' +
        '<div class="sol-temp">' +
          '<span class="temp-max">' + fmtTemp(d.at.mx) + '</span>' +
          '<span class="temp-min">' + fmtTemp(d.at.mn) + '</span>' +
        '</div>' +
        '<div class="sol-metrics">' +
          '<div class="metric"><span class="metric-label">' + OK.escape(t('pressure')) + '</span><span class="metric-value">' + preStr + '</span></div>' +
          '<div class="wind-row"><span class="metric-label">' + OK.escape(t('wind')) + '</span>' +
            '<span class="wind-compass">' +
              '<svg class="wind-arrow" viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(' + dirDeg + 'deg)">' +
                '<path d="M12 3 L18 14 L12 11 L6 14 Z" fill="currentColor"/>' +
              '</svg>' +
              '<span>' + OK.escape(windStr) + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="metric"><span class="metric-label">' + OK.escape(t('windDir')) + '</span><span class="metric-value">' + OK.escape(dirStr) + ' · ' + OK.escape(seasonText) + '</span></div>' +
        '</div>' +
      '</article>';
  });
  solGrid.innerHTML = items.join('');
}

// ---------- 渲染：温度趋势 SVG 折线图 ----------
function renderChart() {
  if (!weatherData || weatherData.length < 2) {
    chartSvg.innerHTML = '<text x="360" y="140" text-anchor="middle" class="axis-label">' +
      OK.escape(t('noData')) + '</text>';
    return;
  }

  // 画布参数
  const W = 720, H = 280;
  const padL = 44, padR = 16, padT = 18, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // 收集最高/最低温（按当前单位）
  const maxVals = weatherData.map(function (d) { return unit === 'F' ? toF(d.at.mx) : d.at.mx; });
  const minVals = weatherData.map(function (d) { return unit === 'F' ? toF(d.at.mn) : d.at.mn; });

  // 计算坐标范围（留出余量）
  let allVals = maxVals.concat(minVals).filter(function (v) { return v != null; });
  if (!allVals.length) {
    chartSvg.innerHTML = '';
    return;
  }
  let lo = Math.min.apply(null, allVals);
  let hi = Math.max.apply(null, allVals);
  const span = hi - lo || 1;
  lo = lo - span * 0.15;
  hi = hi + span * 0.15;
  const range = hi - lo;

  const n = weatherData.length;
  function x(i) { return padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW); }
  function y(v) { return padT + innerH - ((v - lo) / range) * innerH; }

  // 构造折线路径
  function pathFor(vals) {
    let p = '';
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) continue;
      p += (p ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(vals[i]).toFixed(1);
    }
    return p;
  }

  // 最高温下方填充区域
  const areaPath = pathFor(maxVals) +
    ' L' + x(n - 1).toFixed(1) + ' ' + (padT + innerH) +
    ' L' + x(0).toFixed(1) + ' ' + (padT + innerH) + ' Z';

  // 网格线 + Y 轴刻度（4 等分）
  let grid = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (range * i / ticks);
    const yy = y(v);
    grid += '<line class="grid-line" x1="' + padL + '" y1="' + yy.toFixed(1) +
      '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '"/>';
    grid += '<text class="axis-label" x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) +
      '" text-anchor="end">' + Math.round(v) + '°' + unit + '</text>';
  }

  // X 轴 Sol 标签
  let xlabels = '';
  for (let i = 0; i < n; i++) {
    xlabels += '<text class="axis-label" x="' + x(i).toFixed(1) + '" y="' + (H - 12) +
      '" text-anchor="middle">' + weatherData[i].sol + '</text>';
  }

  // 数据点 + 数值标签
  let dots = '';
  for (let i = 0; i < n; i++) {
    if (maxVals[i] != null) {
      dots += '<circle class="dot-max" cx="' + x(i).toFixed(1) + '" cy="' + y(maxVals[i]).toFixed(1) + '" r="3.5"/>';
      dots += '<text class="dot-label" x="' + x(i).toFixed(1) + '" y="' + (y(maxVals[i]) - 8).toFixed(1) +
        '" text-anchor="middle">' + Math.round(maxVals[i]) + '°</text>';
    }
    if (minVals[i] != null) {
      dots += '<circle class="dot-min" cx="' + x(i).toFixed(1) + '" cy="' + y(minVals[i]).toFixed(1) + '" r="3.5"/>';
      dots += '<text class="dot-label" x="' + x(i).toFixed(1) + '" y="' + (y(minVals[i]) + 14).toFixed(1) +
        '" text-anchor="middle">' + Math.round(minVals[i]) + '°</text>';
    }
  }

  chartSvg.innerHTML =
    grid +
    xlabels +
    '<path class="area-max" d="' + areaPath + '"/>' +
    '<path class="line-max" d="' + pathFor(maxVals) + '"/>' +
    '<path class="line-min" d="' + pathFor(minVals) + '"/>' +
    dots;
}

// ---------- 渲染：火星 vs 地球对比 ----------
const COMPARE = [
  { key: 'distanceSun', mars: '2.279 亿 km', earth: '1.496 亿 km' },
  { key: 'dayLength',   mars: '24h 37m',     earth: '24h 00m' },
  { key: 'yearLength',  mars: '687 地球日',   earth: '365.25 天' },
  { key: 'atmosphere',  mars: '95% CO₂',     earth: '78% N₂ · 21% O₂' },
  { key: 'avgTemp',     mars: '−63 °C',      earth: '15 °C' },
  { key: 'gravity',     mars: '3.71 m/s²',   earth: '9.81 m/s²' },
  { key: 'moons',       mars: '2 (火卫一/二)', earth: '1 (月球)' },
];

// 英文版对比数据
const COMPARE_EN = [
  { key: 'distanceSun', mars: '227.9M km', earth: '149.6M km' },
  { key: 'dayLength',   mars: '24h 37m',   earth: '24h 00m' },
  { key: 'yearLength',  mars: '687 Earth days', earth: '365.25 days' },
  { key: 'atmosphere',  mars: '95% CO₂',   earth: '78% N₂ · 21% O₂' },
  { key: 'avgTemp',     mars: '−63 °C',    earth: '15 °C' },
  { key: 'gravity',     mars: '3.71 m/s²', earth: '9.81 m/s²' },
  { key: 'moons',       mars: '2 (Phobos, Deimos)', earth: '1 (Moon)' },
];

function renderCompare() {
  const data = lang === 'zh' ? COMPARE : COMPARE_EN;
  const items = data.map(function (row) {
    return '' +
      '<div class="compare-card">' +
        '<div class="compare-label">' + OK.escape(t(row.key)) + '</div>' +
        '<div class="compare-row">' +
          '<span class="compare-planet">' + OK.escape(t('mars')) + '</span>' +
          '<span class="compare-value mars">' + OK.escape(row.mars) + '</span>' +
        '</div>' +
        '<div class="compare-row">' +
          '<span class="compare-planet">' + OK.escape(t('earth')) + '</span>' +
          '<span class="compare-value earth">' + OK.escape(row.earth) + '</span>' +
        '</div>' +
      '</div>';
  });
  compareGrid.innerHTML = items.join('');
}

// ---------- 总渲染 ----------
function renderAll() {
  if (!weatherData) return;
  renderStatusBar();
  renderSeasonCard();
  renderSolGrid();
  renderChart();
  renderCompare();
}

// ---------- 语言应用 ----------
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 重新渲染动态内容
  renderAll();
}

// ---------- 温度单位切换 ----------
function setUnit(u) {
  if (u === unit) return;
  unit = u;
  const isC = u === 'C';
  unitC.classList.toggle('on', isC);
  unitF.classList.toggle('on', !isC);
  unitC.setAttribute('aria-pressed', String(isC));
  unitF.setAttribute('aria-pressed', String(!isC));
  renderChart();
  renderSolGrid();
}

unitC.addEventListener('click', function () { setUnit('C'); });
unitF.addEventListener('click', function () { setUnit('F'); });

// ---------- 启动 ----------
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
fetchWeather();
