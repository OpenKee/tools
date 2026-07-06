/* ============================================================
   Air Quality Monitor — 空气质量监测
   数据源：Open-Meteo
     · Air Quality API：当前污染物 + US AQI + 24h 逐小时预报
     · Geocoding API：城市名搜索
   accent 颜色随当前 AQI 等级动态变化。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 文案字典（中英双语） ---------- */
  var copy = {
    en: {
      title: 'Air Quality',
      eyebrow: 'Open-Meteo · Atmospheric Monitoring',
      lead: 'Real-time US AQI, pollutant concentrations and 24-hour trends for any city. Data by Open-Meteo.',
      searchPlaceholder: 'Search a city…',
      favorite: 'Favorite',
      loading: 'Loading…',
      refresh: 'Refresh',
      usAqi: 'US Air Quality Index',
      healthAdvice: 'Health Advice',
      pollutants: 'Pollutants',
      trend24h: '24-Hour AQI Trend',
      location: 'Location',
      dominant: 'Dominant pollutant',
      updated: 'Last updated',
      dataSource: 'Data: Open-Meteo Air Quality API',
      builtBy: 'Built by',
      noResults: 'No matching cities',
      searchError: 'City search failed. Please try again.',
      loadError: 'Failed to load air quality data. Please try again.',
      now: 'Now',
      aqiUnit: 'AQI',
      levelGood: 'Good',
      levelModerate: 'Moderate',
      levelUsg: 'Unhealthy for Sensitive Groups',
      levelUnhealthy: 'Unhealthy',
      levelVeryUnhealthy: 'Very Unhealthy',
      levelHazardous: 'Hazardous',
      pm25: 'PM2.5 Fine Particulate',
      pm10: 'PM10 Coarse Particulate',
      o3: 'Ozone',
      no2: 'Nitrogen Dioxide',
      so2: 'Sulphur Dioxide',
      co: 'Carbon Monoxide',
      adviceGood: 'Air quality is ideal. Enjoy outdoor activities and exercise freely.',
      adviceModerate: 'Air quality is acceptable. Unusually sensitive people should consider reducing prolonged heavy outdoor exertion.',
      adviceUsg: 'Sensitive groups (children, elderly, those with heart or lung disease) should reduce prolonged outdoor exertion. Watch for symptoms like coughing.',
      adviceUnhealthy: 'Everyone may begin to be affected. Limit prolonged outdoor exertion and consider wearing a mask in traffic.',
      adviceVeryUnhealthy: 'Health alert: avoid prolonged outdoor exertion. Wear a mask outdoors and keep windows closed.',
      adviceHazardous: 'Health warning: everyone should avoid all outdoor activity. Stay indoors and use an air purifier if available.'
    },
    zh: {
      title: '空气质量',
      eyebrow: 'Open-Meteo · 大气监测',
      lead: '任意城市的实时美国 AQI、污染物浓度与 24 小时趋势。数据由 Open-Meteo 提供。',
      searchPlaceholder: '搜索城市…',
      favorite: '收藏',
      loading: '加载中…',
      refresh: '刷新',
      usAqi: '美国空气质量指数',
      healthAdvice: '健康建议',
      pollutants: '污染物',
      trend24h: '24 小时 AQI 趋势',
      location: '位置',
      dominant: '主要污染物',
      updated: '更新时间',
      dataSource: '数据：Open-Meteo 空气质量 API',
      builtBy: '由',
      noResults: '未找到匹配的城市',
      searchError: '城市搜索失败，请重试。',
      loadError: '空气质量数据加载失败，请重试。',
      now: '现在',
      aqiUnit: 'AQI',
      levelGood: '良好',
      levelModerate: '中等',
      levelUsg: '敏感人群不健康',
      levelUnhealthy: '不健康',
      levelVeryUnhealthy: '非常不健康',
      levelHazardous: '危险',
      pm25: 'PM2.5 细颗粒物',
      pm10: 'PM10 可吸入颗粒物',
      o3: '臭氧',
      no2: '二氧化氮',
      so2: '二氧化硫',
      co: '一氧化碳',
      adviceGood: '空气质量理想，适合户外活动与运动。',
      adviceModerate: '空气质量尚可。异常敏感人群应考虑减少长时间高强度户外运动。',
      adviceUsg: '敏感人群（儿童、老人、心肺疾病患者）应减少长时间户外运动，注意咳嗽等症状。',
      adviceUnhealthy: '所有人都可能受到影响。应限制长时间户外运动，交通中建议佩戴口罩。',
      adviceVeryUnhealthy: '健康警报：避免长时间户外运动。外出佩戴口罩并关闭门窗。',
      adviceHazardous: '健康警告：所有人应避免一切户外活动，请留在室内，有条件请使用空气净化器。'
    }
  };

  /* ---------- 常量 ---------- */
  var AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  var GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var CURRENT_FIELDS = 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide';
  var HOURLY_FIELDS = 'pm10,pm2_5,us_aqi';
  var FAV_KEY = 'openkee-airquality-favs';
  var DEFAULT_CITY = { name: 'Beijing', lat: 39.9, lng: 116.4, country: 'China', admin1: 'Beijing' };

  // AQI 等级颜色（US AQI 标准）
  var LEVEL_COLORS = {
    good: '#22c55e',
    moderate: '#eab308',
    usg: '#f97316',
    unhealthy: '#ef4444',
    veryUnhealthy: '#a855f7',
    hazardous: '#991b1b'
  };

  // 等级软背景色（用于 --aqi-soft）
  var LEVEL_SOFT = {
    good: 'rgba(34,197,94,0.14)',
    moderate: 'rgba(234,179,8,0.16)',
    usg: 'rgba(249,115,22,0.16)',
    unhealthy: 'rgba(239,68,68,0.16)',
    veryUnhealthy: 'rgba(168,85,247,0.18)',
    hazardous: 'rgba(153,27,27,0.22)'
  };

  // 等级建议图标
  var ADVICE_ICONS = {
    good: '😊', moderate: '🙂', usg: '⚠️',
    unhealthy: '😷', veryUnhealthy: '🚨', hazardous: '☣️'
  };

  // 污染物配置：API 字段 → 展示信息
  var POLLUTANTS = [
    { key: 'pm2_5', sub: 'us_aqi_pm2_5', chem: 'PM2.5', labelKey: 'pm25' },
    { key: 'pm10', sub: 'us_aqi_pm10', chem: 'PM10', labelKey: 'pm10' },
    { key: 'ozone', sub: 'us_aqi_ozone', chem: 'O₃', labelKey: 'o3' },
    { key: 'nitrogen_dioxide', sub: 'us_aqi_nitrogen_dioxide', chem: 'NO₂', labelKey: 'no2' },
    { key: 'sulphur_dioxide', sub: 'us_aqi_sulphur_dioxide', chem: 'SO₂', labelKey: 'so2' },
    { key: 'carbon_monoxide', sub: 'us_aqi_carbon_monoxide', chem: 'CO', labelKey: 'co' }
  ];

  // 等级刻度条分段（按 AQI 范围宽度加权）
  var SCALE_SEGMENTS = [
    { key: 'good', lo: 0, lo2: 50, weight: 50 },
    { key: 'moderate', lo: 51, lo2: 100, weight: 50 },
    { key: 'usg', lo: 101, lo2: 150, weight: 50 },
    { key: 'unhealthy', lo: 151, lo2: 200, weight: 50 },
    { key: 'veryUnhealthy', lo: 201, lo2: 300, weight: 100 },
    { key: 'hazardous', lo: 301, lo2: 500, weight: 200 }
  ];

  /* ---------- 状态 ---------- */
  var state = {
    city: null,      // 当前城市 {name, lat, lng, country, admin1}
    data: null,      // 当前空气质量数据
    favs: [],        // 收藏城市列表
    searchTimer: null,
    searchActive: -1 // 键盘导航当前高亮项
  };

  /* ---------- DOM 引用 ---------- */
  var langBtn, cityInput, searchResults, favBtn, favRow;
  var loadingRow, errorBox, layout, refreshBtn;
  var aqiValue, aqiTag, aqiLocation, aqiDominant, aqiUpdated, aqiScale;
  var adviceIcon, adviceText, adviceSub;
  var pollutantGrid, trendChart;

  /* ---------- 工具函数 ---------- */
  function t(k) { return OK.t(k, copy); }

  // US AQI 值 -> 等级 key
  function aqiLevel(aqi) {
    if (aqi == null || isNaN(aqi)) return 'good';
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'usg';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'veryUnhealthy';
    return 'hazardous';
  }

  // 等级 key -> i18n 文案 key
  function levelLabelKey(l) {
    return {
      good: 'levelGood', moderate: 'levelModerate', usg: 'levelUsg',
      unhealthy: 'levelUnhealthy', veryUnhealthy: 'levelVeryUnhealthy',
      hazardous: 'levelHazardous'
    }[l];
  }

  // 等级 key -> 健康建议 i18n key
  function adviceKey(l) {
    return {
      good: 'adviceGood', moderate: 'adviceModerate', usg: 'adviceUsg',
      unhealthy: 'adviceUnhealthy', veryUnhealthy: 'adviceVeryUnhealthy',
      hazardous: 'adviceHazardous'
    }[l];
  }

  // 数值格式化（μg/m³）
  function fmtVal(v) {
    if (v == null || isNaN(v)) return '—';
    if (v < 10) return v.toFixed(2);
    if (v < 100) return v.toFixed(1);
    return Math.round(v).toString();
  }

  // 时间格式化（API 因 timezone=auto 返回本地时间字符串）
  function fmtTime(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // 小时格式化（用于趋势图 x 轴）
  function fmtHour(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }

  // 安全访问 localStorage
  function safeStorage(action, k, v) {
    try { return action === 'get' ? localStorage.getItem(k) : localStorage.setItem(k, v); }
    catch (e) { return action === 'get' ? null : undefined; }
  }

  // 读取收藏
  function loadFavs() {
    var raw = safeStorage('get', FAV_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  // 保存收藏
  function saveFavs() {
    safeStorage('set', FAV_KEY, JSON.stringify(state.favs));
  }

  // 判断城市是否已收藏（按经纬度匹配，保留 2 位小数）
  function isFav(city) {
    if (!city) return false;
    return state.favs.some(function (f) {
      return Math.abs(f.lat - city.lat) < 0.01 && Math.abs(f.lng - city.lng) < 0.01;
    });
  }

  // 切换收藏
  function toggleFav() {
    if (!state.city) return;
    var c = state.city;
    if (isFav(c)) {
      state.favs = state.favs.filter(function (f) {
        return !(Math.abs(f.lat - c.lat) < 0.01 && Math.abs(f.lng - c.lng) < 0.01);
      });
    } else {
      state.favs.push({ name: c.name, lat: c.lat, lng: c.lng, country: c.country || '', admin1: c.admin1 || '' });
    }
    saveFavs();
    renderFavs();
    renderFavBtn();
  }

  /* ---------- 城市搜索 ---------- */
  // 渲染搜索结果到下拉列表（errored=true 表示请求失败）
  function renderResults(results, errored) {
    state.searchActive = -1;
    if (errored) {
      searchResults.innerHTML = '<li class="res-empty">' + OK.escape(t('searchError')) + '</li>';
      searchResults.hidden = false;
      return;
    }
    if (!results.length) {
      searchResults.innerHTML = '<li class="res-empty">' + OK.escape(t('noResults')) + '</li>';
      searchResults.hidden = false;
      return;
    }
    var html = results.map(function (r, i) {
      var meta = [r.admin1, r.country].filter(Boolean).join(', ');
      var lat = Number(r.latitude).toFixed(2);
      var lng = Number(r.longitude).toFixed(2);
      return '<li data-i="' + i + '" role="option">' +
        '<span class="res-name">' + OK.escape(r.name) + '</span>' +
        '<span class="res-meta">' + OK.escape(meta || (lat + ', ' + lng)) + '</span>' +
        '</li>';
    }).join('');
    searchResults.innerHTML = html;
    searchResults.hidden = false;
  }

  function hideResults() {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
    state.searchActive = -1;
  }

  // 缓存最近一次搜索结果，供选择时使用
  var lastResults = [];
  function renderResultsCached(results, errored) {
    lastResults = errored ? [] : results;
    renderResults(results, errored);
  }

  function pickFromCache(idx) {
    var r = lastResults[idx];
    if (!r) return;
    var city = {
      name: r.name,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      country: r.country || '',
      admin1: r.admin1 || ''
    };
    cityInput.value = '';
    hideResults();
    selectCity(city);
  }

  /* ---------- 选择城市并加载数据 ---------- */
  function selectCity(city) {
    state.city = city;
    loadAirQuality(city);
  }

  function loadAirQuality(city) {
    showLoading(true);
    hideError();
    var url = AQ_URL + '?latitude=' + city.lat + '&longitude=' + city.lng +
      '&current=' + CURRENT_FIELDS +
      '&hourly=' + HOURLY_FIELDS +
      '&timezone=auto&forecast_days=1';
    OK.fetchJSON(url).then(function (data) {
      state.data = data;
      showLoading(false);
      rerender();
    }).catch(function (e) {
      showLoading(false);
      showError(t('loadError'));
    });
  }

  /* ---------- 渲染：动态主题色 ---------- */
  function applyTheme(level) {
    var color = LEVEL_COLORS[level];
    var soft = LEVEL_SOFT[level];
    var root = document.documentElement.style;
    root.setProperty('--aqi', color);
    root.setProperty('--aqi-soft', soft);
    root.setProperty('--ok-accent', color);
    root.setProperty('--ok-accent-soft', soft);
    root.setProperty('--ok-footer-link', color);
  }

  /* ---------- 渲染：主 AQI 卡片 ---------- */
  function renderAQI() {
    var cur = state.data && state.data.current ? state.data.current : null;
    if (!cur) {
      aqiValue.textContent = '—';
      aqiTag.textContent = '—';
      aqiLocation.textContent = state.city ? state.city.name : '—';
      aqiDominant.textContent = '—';
      aqiUpdated.textContent = '—';
      renderScale(null);
      return;
    }
    var aqi = cur.us_aqi;
    var level = aqiLevel(aqi);
    applyTheme(level);

    aqiValue.textContent = (aqi == null || isNaN(aqi)) ? '—' : Math.round(aqi).toString();
    aqiTag.textContent = t(levelLabelKey(level));

    // 位置：城市名 + 行政区/国家
    var locParts = [state.city.name];
    if (state.city.admin1 && state.city.admin1 !== state.city.name) locParts.push(state.city.admin1);
    if (state.city.country) locParts.push(state.city.country);
    aqiLocation.textContent = locParts.join(', ');

    // 主要污染物：取分指数最大者
    var dom = dominantPollutant(cur);
    aqiDominant.textContent = dom ? dom.chem : '—';

    aqiUpdated.textContent = fmtTime(cur.time);
    renderScale(aqi);
  }

  // 找出分指数最高的污染物
  function dominantPollutant(cur) {
    var best = null;
    POLLUTANTS.forEach(function (p) {
      var sub = cur[p.sub];
      if (sub != null && !isNaN(sub) && (!best || sub > best.sub)) {
        best = { chem: p.chem, sub: sub, labelKey: p.labelKey };
      }
    });
    return best;
  }

  /* ---------- 渲染：AQI 等级刻度条 + 当前位置标记 ---------- */
  function renderScale(aqi) {
    var segs = SCALE_SEGMENTS.map(function (s) {
      return '<span class="seg-' + s.key + '" style="flex:' + s.weight + '" title="' +
        OK.escape(t(levelLabelKey(s.key))) + ' (' + s.lo + '–' + s.lo2 + ')"></span>';
    }).join('');
    var marker = '';
    if (aqi != null && !isNaN(aqi)) {
      var pct = Math.max(0, Math.min(100, (aqi / 500) * 100));
      marker = '<div class="aqi-marker" style="left:' + pct.toFixed(2) + '%"></div>';
    }
    aqiScale.innerHTML = '<div class="scale-bar">' + segs + '</div>' + marker;
  }

  /* ---------- 渲染：污染物网格 ---------- */
  function renderPollutants() {
    var cur = state.data && state.data.current ? state.data.current : null;
    var html = POLLUTANTS.map(function (p) {
      var val = cur ? cur[p.key] : null;
      var sub = cur ? cur[p.sub] : null;
      var level = aqiLevel(sub);
      var color = LEVEL_COLORS[level];
      var subTxt = (sub == null || isNaN(sub)) ? '—' : Math.round(sub).toString();
      return '<div class="pollutant-cell" style="--cell-color:' + color + '" title="' + OK.escape(t(p.labelKey)) + '">' +
        '<div class="p-name">' + OK.escape(p.chem) + '</div>' +
        '<div class="p-value">' + OK.escape(fmtVal(val)) + '<span class="p-unit">μg/m³</span></div>' +
        '<div class="p-sub">' +
          '<span class="dot"></span>' +
          '<span class="lvl">' + OK.escape(t(levelLabelKey(level))) + '</span>' +
          '<span class="aqi-num">' + OK.escape(subTxt) + '</span>' +
        '</div>' +
        '</div>';
    }).join('');
    pollutantGrid.innerHTML = html;
  }

  /* ---------- 渲染：健康建议 ---------- */
  function renderAdvice() {
    var cur = state.data && state.data.current ? state.data.current : null;
    var aqi = cur ? cur.us_aqi : null;
    var level = aqiLevel(aqi);
    adviceIcon.textContent = ADVICE_ICONS[level];
    adviceText.textContent = t(adviceKey(level));
    var subParts = [];
    if (aqi != null && !isNaN(aqi)) subParts.push('US AQI ' + Math.round(aqi));
    var dom = cur ? dominantPollutant(cur) : null;
    if (dom) subParts.push(dom.chem + ' ' + Math.round(dom.sub));
    adviceSub.textContent = subParts.join('  ·  ');
  }

  /* ---------- 渲染：24h 趋势图（SVG path） ---------- */
  function renderTrend() {
    var hourly = state.data && state.data.hourly ? state.data.hourly : null;
    var times = hourly ? hourly.time : null;
    var aqis = hourly ? hourly.us_aqi : null;

    if (!times || !aqis || !times.length) {
      trendChart.innerHTML = '<svg class="trend-svg" viewBox="0 0 720 240" role="img" aria-label="' +
        OK.escape(t('trend24h')) + '"><text x="360" y="120" text-anchor="middle" class="axis-label">—</text></svg>';
      return;
    }

    var n = times.length;
    // 过滤有效点，保留索引
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = aqis[i];
      if (a != null && !isNaN(a)) pts.push({ i: i, a: a, t: times[i] });
    }

    var W = 720, H = 240;
    var padL = 38, padR = 16, padT = 16, padB = 30;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    // y 轴最大值：向上取整到 50 的倍数，至少 50
    var maxAqi = 50;
    pts.forEach(function (p) { if (p.a > maxAqi) maxAqi = p.a; });
    var maxScale = Math.ceil(maxAqi / 50) * 50;
    if (maxScale > 500) maxScale = 500;

    function x(i) { return padL + (plotW * i / (n - 1)); }
    function y(a) { return padT + plotH - (Math.min(a, maxScale) / maxScale) * plotH; }

    var parts = ['<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + OK.escape(t('trend24h')) + '">'];

    // 定义渐变（面积填充用）
    parts.push('<defs><linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + LEVEL_COLORS[aqiLevel(state.data && state.data.current ? state.data.current.us_aqi : null)] + '" stop-opacity="0.35"/>' +
      '<stop offset="100%" stop-color="' + LEVEL_COLORS[aqiLevel(state.data && state.data.current ? state.data.current.us_aqi : null)] + '" stop-opacity="0"/>' +
      '</linearGradient></defs>');

    // 横向网格线（AQI 等级边界）
    [50, 100, 150, 200, 300].forEach(function (lvl) {
      if (lvl > maxScale) return;
      var yy = y(lvl);
      parts.push('<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" class="' + (lvl === 0 ? 'grid-base' : 'grid-line') + '"/>');
      parts.push('<text x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" class="axis-label">' + lvl + '</text>');
    });
    // 基线
    var baseY = padT + plotH;
    parts.push('<line x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '" class="grid-base"/>');

    // 趋势折线 + 面积
    if (pts.length >= 2) {
      // 折线 path
      var linePath = pts.map(function (p, idx) {
        return (idx === 0 ? 'M' : 'L') + x(p.i).toFixed(1) + ' ' + y(p.a).toFixed(1);
      }).join(' ');
      // 面积 path：沿折线 → 到基线 → 闭合
      var areaPath = linePath +
        ' L' + x(pts[pts.length - 1].i).toFixed(1) + ' ' + baseY.toFixed(1) +
        ' L' + x(pts[0].i).toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
      parts.push('<path d="' + areaPath + '" fill="url(#aqiFill)"/>');
      parts.push('<path d="' + linePath + '" fill="none" stroke="' + LEVEL_COLORS[aqiLevel(state.data && state.data.current ? state.data.current.us_aqi : null)] + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');

      // 数据点（每 3 小时一个，便于查看）
      pts.forEach(function (p) {
        if (p.i % 3 !== 0 && p.i !== n - 1) return;
        var cx = x(p.i), cy = y(p.a);
        parts.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.2" fill="' + LEVEL_COLORS[aqiLevel(p.a)] + '"><title>AQI ' + Math.round(p.a) + ' · ' + OK.escape(fmtHour(p.t)) + '</title></circle>');
      });
    } else if (pts.length === 1) {
      var p0 = pts[0];
      parts.push('<circle cx="' + x(p0.i).toFixed(1) + '" cy="' + y(p0.a).toFixed(1) + '" r="3" fill="' + LEVEL_COLORS[aqiLevel(p0.a)] + '"/>');
    }

    // “现在”标记：找最接近当前时间的小时点
    var nowIdx = -1;
    if (state.data && state.data.current && state.data.current.time) {
      var nowT = new Date(state.data.current.time).getTime();
      var bestDiff = Infinity;
      times.forEach(function (tm, i) {
        var diff = Math.abs(new Date(tm).getTime() - nowT);
        if (diff < bestDiff) { bestDiff = diff; nowIdx = i; }
      });
    }
    if (nowIdx >= 0) {
      var nx = x(nowIdx);
      parts.push('<line x1="' + nx.toFixed(1) + '" y1="' + padT + '" x2="' + nx.toFixed(1) + '" y2="' + baseY + '" class="now-line"/>');
      var curAqi = aqis[nowIdx];
      if (curAqi != null && !isNaN(curAqi)) {
        parts.push('<circle cx="' + nx.toFixed(1) + '" cy="' + y(curAqi).toFixed(1) + '" r="4" class="now-dot"/>');
      }
      parts.push('<text x="' + nx.toFixed(1) + '" y="' + (padT - 4) + '" text-anchor="middle" class="now-label">' + OK.escape(t('now')) + '</text>');
    }

    // x 轴时间标签（每 4 小时一个）
    for (var xi = 0; xi < n; xi += 4) {
      var lx = x(xi);
      parts.push('<text x="' + lx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" class="axis-x">' + OK.escape(fmtHour(times[xi])) + '</text>');
    }

    parts.push('</svg>');
    trendChart.innerHTML = parts.join('');
  }

  /* ---------- 渲染：收藏城市芯片 ---------- */
  function renderFavs() {
    if (!state.favs.length) {
      favRow.hidden = true;
      favRow.innerHTML = '';
      return;
    }
    favRow.hidden = false;
    var html = state.favs.map(function (f, i) {
      var label = f.name;
      if (f.country && f.country !== f.name) label += ', ' + f.country;
      return '<span class="fav-chip">' +
        '<span class="chip-name" data-i="' + i + '">' + OK.escape(label) + '</span>' +
        '<button class="chip-del" data-del="' + i + '" type="button" aria-label="' + OK.escape(t('favorite')) + '">×</button>' +
        '</span>';
    }).join('');
    favRow.innerHTML = html;
  }

  /* ---------- 渲染：收藏按钮状态 ---------- */
  function renderFavBtn() {
    var on = isFav(state.city);
    favBtn.classList.toggle('on', on);
    favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    favBtn.querySelector('.fav-star').textContent = on ? '★' : '☆';
  }

  /* ---------- 统一重渲染 ---------- */
  function rerender() {
    if (!state.data) return;
    layout.style.display = '';
    renderAQI();
    renderPollutants();
    renderAdvice();
    renderTrend();
    renderFavBtn();
  }

  function showLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
    if (on) layout.style.display = 'none';
  }

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.style.display = msg ? '' : 'none';
  }
  function hideError() { showError(''); }

  /* ---------- i18n 应用（含 placeholder 等额外属性） ---------- */
  function applyI18n() {
    OK.applyI18n(copy);
    cityInput.placeholder = t('searchPlaceholder');
    favBtn.title = t('favorite');
  }

  /* ---------- 启动 ---------- */
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    cityInput = document.getElementById('cityInput');
    searchResults = document.getElementById('searchResults');
    favBtn = document.getElementById('favBtn');
    favRow = document.getElementById('favRow');
    loadingRow = document.getElementById('loadingRow');
    errorBox = document.getElementById('errorBox');
    layout = document.getElementById('layout');
    refreshBtn = document.getElementById('refreshBtn');
    aqiValue = document.getElementById('aqiValue');
    aqiTag = document.getElementById('aqiTag');
    aqiLocation = document.getElementById('aqiLocation');
    aqiDominant = document.getElementById('aqiDominant');
    aqiUpdated = document.getElementById('aqiUpdated');
    aqiScale = document.getElementById('aqiScale');
    adviceIcon = document.getElementById('adviceIcon');
    adviceText = document.getElementById('adviceText');
    adviceSub = document.getElementById('adviceSub');
    pollutantGrid = document.getElementById('pollutantGrid');
    trendChart = document.getElementById('trendChart');

    // 初始化收藏
    state.favs = loadFavs();
    renderFavs();

    // 初始化 i18n 与语言切换
    applyI18n();
    OK.initLangToggle(langBtn, copy, function () {
      applyI18n();
      rerender();
      renderFavs();
    });

    // 搜索输入（防抖 350ms）
    cityInput.addEventListener('input', function () {
      var q = cityInput.value;
      if (state.searchTimer) clearTimeout(state.searchTimer);
      if (q.trim().length < 2) { hideResults(); return; }
      state.searchTimer = setTimeout(function () { runSearchDebounced(q); }, 350);
    });

    // 搜索结果点击
    searchResults.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]');
      if (!li) return;
      pickFromCache(parseInt(li.getAttribute('data-i'), 10));
    });

    // 键盘导航：上下选择、回车确认、Esc 关闭
    cityInput.addEventListener('keydown', function (e) {
      var lis = searchResults.querySelectorAll('li[data-i]');
      if (searchResults.hidden || !lis.length) {
        if (e.key === 'Escape') hideResults();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.searchActive = (state.searchActive + 1) % lis.length;
        updateActive(lis);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.searchActive = (state.searchActive - 1 + lis.length) % lis.length;
        updateActive(lis);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.searchActive >= 0) pickFromCache(parseInt(lis[state.searchActive].getAttribute('data-i'), 10));
      } else if (e.key === 'Escape') {
        hideResults();
      }
    });

    function updateActive(lis) {
      lis.forEach(function (li, i) { li.classList.toggle('active', i === state.searchActive); });
    }

    // 点击外部关闭搜索结果
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) hideResults();
    });

    // 收藏按钮
    favBtn.addEventListener('click', toggleFav);

    // 收藏芯片点击：加载 / 删除
    favRow.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        var i = parseInt(del.getAttribute('data-del'), 10);
        state.favs.splice(i, 1);
        saveFavs();
        renderFavs();
        renderFavBtn();
        return;
      }
      var name = e.target.closest('[data-i]');
      if (name) {
        var idx = parseInt(name.getAttribute('data-i'), 10);
        var f = state.favs[idx];
        if (f) selectCity({ name: f.name, lat: f.lat, lng: f.lng, country: f.country, admin1: f.admin1 });
      }
    });

    // 刷新按钮
    refreshBtn.addEventListener('click', function () {
      if (state.city) loadAirQuality(state.city);
    });

    // 首次加载：默认北京
    selectCity(DEFAULT_CITY);
  });

  // 防抖搜索（包装以缓存结果）
  function runSearchDebounced(query) {
    var url = GEO_URL + '?name=' + encodeURIComponent(query) + '&count=5&language=' + (OK.lang === 'zh' ? 'zh' : 'en') + '&format=json';
    OK.fetchJSON(url).then(function (res) {
      renderResultsCached(res && res.results ? res.results : [], false);
    }).catch(function () {
      renderResultsCached([], true);
    });
  }
})();
