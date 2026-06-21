/* ============================================================
   Aurora Forecast — 极光预报
   数据源：NOAA SWPC
     · KP 指数历史与预报：products/noaa-planetary-k-index.json
     · 极光可见性网格：json/ovation_aurora_latest.json
   接口失败时降级到内嵌示例数据，保证页面始终可用。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 文案字典（中英双语） ---------- */
  var copy = {
    en: {
      title: 'Aurora Forecast',
      eyebrow: 'NOAA SWPC · Space Weather',
      lead: 'Real-time planetary Kp index, 3-day forecast and aurora oval visibility from NOAA SWPC.',
      refresh: 'Refresh',
      latitude: 'Latitude',
      currentKp: 'Current Kp Index',
      visibleLat: 'Visible latitude',
      lastUpdated: 'Last updated',
      forecast3day: '3-Day Kp Forecast',
      auroraMap: 'Aurora Visibility',
      northHemi: 'Northern Hemisphere',
      southHemi: 'Southern Hemisphere',
      observation: 'Observation Advice',
      legend: 'Kp Index Legend',
      levelLow: 'Low',
      levelMed: 'Medium',
      levelHigh: 'High',
      levelStorm: 'Storm',
      loading: 'Loading…',
      fallbackNote: 'Live API unavailable — showing sample data',
      dataSource: 'Data: NOAA SWPC',
      builtBy: 'Built by',
      auroraNote: 'Brighter colors = higher aurora probability. Dashed ring marks your latitude.',
      adviceStrong: 'Strong aurora activity — you have a high chance of seeing the lights tonight. Find a dark sky with a clear view toward the pole.',
      advicePossible: 'Aurora may be visible from your latitude tonight. Seek a dark location away from city lights.',
      adviceEdge: 'You are near the edge of visibility. A low horizon toward the pole could reveal a faint glow.',
      adviceUnlikely: 'Aurora is unlikely at your latitude tonight. Activity would need to strengthen to reach you.',
      legendRange: 'Kp {a}–{b}',
      legendVis: 'Visible from ~{lat}°',
      yourLat: 'Your latitude',
      hemiN: 'N',
      hemiS: 'S'
    },
    zh: {
      title: '极光预报',
      eyebrow: 'NOAA SWPC · 空间天气',
      lead: '来自 NOAA 空间天气预报中心的实时行星 Kp 指数、未来 3 天预报与极光椭圆可见范围。',
      refresh: '刷新',
      latitude: '纬度',
      currentKp: '当前 Kp 指数',
      visibleLat: '可见纬度',
      lastUpdated: '更新时间',
      forecast3day: '未来 3 天 Kp 预报',
      auroraMap: '极光可见范围',
      northHemi: '北半球',
      southHemi: '南半球',
      observation: '观测建议',
      legend: 'Kp 指数等级图例',
      levelLow: '低',
      levelMed: '中',
      levelHigh: '高',
      levelStorm: '风暴',
      loading: '加载中…',
      fallbackNote: '实时接口不可用——正在显示示例数据',
      dataSource: '数据：NOAA SWPC',
      builtBy: '由',
      auroraNote: '颜色越亮代表极光概率越高。虚线圆环为您所选纬度。',
      adviceStrong: '极光活动强烈——今晚您很有机会看到极光。请寻找黑暗、视野朝向极点方向的开阔地。',
      advicePossible: '今晚您所在纬度有可能看到极光。请远离城市灯光，寻找黑暗地点。',
      adviceEdge: '您处于可见边缘附近。朝向极点方向的低矮地平线可能看到微弱光晕。',
      adviceUnlikely: '今晚您所在纬度不太可能看到极光，需要活动进一步增强才能抵达。',
      legendRange: 'Kp {a}–{b}',
      legendVis: '约 {lat}° 起可见',
      yourLat: '您的纬度',
      hemiN: '北',
      hemiS: '南'
    }
  };

  /* ---------- 常量 ---------- */
  var KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
  var KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
  var AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  var LEVEL_COLORS = { low: '#4ade80', med: '#22d3ee', high: '#a855f7', storm: '#f43f5e' };
  var LEGEND = [
    { key: 'low', a: 0, b: 3 },
    { key: 'med', a: 4, b: 5 },
    { key: 'high', a: 6, b: 7 },
    { key: 'storm', a: 8, b: 9 }
  ];

  /* ---------- 状态 ---------- */
  var state = { kpParsed: null, aurora: null, usedFallback: false, userLat: 55 };

  /* ---------- DOM 引用 ---------- */
  var langBtn, latSelect, refreshBtn, statusNote, loadingRow, layout;
  var kpValue, kpLevelEl, kpVisibleLat, kpUpdated;
  var adviceIcon, adviceText, adviceSub;
  var forecastChart, northCanvas, southCanvas, legendGrid;

  /* ---------- 工具函数 ---------- */
  // 取翻译
  function t(k) { return OK.t(k, copy); }

  // KP 值 -> 等级
  function kpLevel(kp) {
    if (kp < 4) return 'low';
    if (kp < 6) return 'med';
    if (kp < 8) return 'high';
    return 'storm';
  }

  // 等级 -> i18n key
  function levelKey(l) {
    return { low: 'levelLow', med: 'levelMed', high: 'levelHigh', storm: 'levelStorm' }[l];
  }

  // 极光赤道侧可见纬度（地理纬度近似：66 - 2*Kp）
  function visibleLatitude(kp) { return Math.round(66 - 2 * kp); }

  // 解析 NOAA 时间字符串（视为 UTC）
  function parseTime(s) {
    var str = String(s).replace(' ', 'T');
    if (!/[zZ]|[+-]\d\d:?\d\d$/.test(str)) str += 'Z';
    return new Date(str);
  }

  // 本地化时间格式化
  function fmtTime(d) {
    if (!d || isNaN(d.getTime())) return '—';
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // 格式化为 UTC 字符串（用于 mock 数据，匹配 NOAA 格式）
  function fmtUTC(d) {
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
      ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
  }

  // 极光强度 -> 颜色
  function auroraColor(intensity) {
    if (intensity > 75) return '#f472b6';
    if (intensity > 50) return '#a855f7';
    if (intensity > 25) return '#22d3ee';
    return '#4ade80';
  }

  /* ---------- 示例数据（API 失败时降级用） ---------- */
  // 生成 mock KP 数据（结构与 NOAA 新格式一致：对象数组）
  function mockKp() {
    var rows = [];
    var now = new Date();
    var h;
    // 过去 30 小时（实测）
    for (h = -30; h <= 0; h += 3) {
      var tm = new Date(now.getTime() + h * 3600000);
      var kp = 2 + 2 * Math.sin(h / 8) + (h > -6 ? 1.5 : 0);
      rows.push({ time_tag: fmtUTC(tm), Kp: Math.max(0, kp).toFixed(2), a_running: 10, station_count: 8 });
    }
    // 未来 72 小时（预报），含一次风暴峰值
    for (h = 3; h <= 72; h += 3) {
      var tf = new Date(now.getTime() + h * 3600000);
      var kp2 = 3 + 3 * Math.sin(h / 10) + (h > 24 && h < 42 ? 2.5 : 0);
      rows.push({ time_tag: fmtUTC(tf), Kp: Math.min(9, Math.max(0, kp2)).toFixed(2), a_running: 10, station_count: 0 });
    }
    return rows;
  }

  // 生成 mock 极光可见性数据（合成极光椭圆）
  function mockAurora() {
    var coords = [];
    var now = Date.now();
    // 北半球椭圆（中心纬度 ~68°）
    for (var lat = 55; lat <= 80; lat++) {
      for (var lon = -180; lon < 180; lon += 3) {
        var dlat = lat - 68;
        var nightMod = 0.5 + 0.5 * Math.cos(lon * Math.PI / 180);
        var intensity = Math.exp(-(dlat * dlat) / 18) * 80 * (0.4 + 0.6 * nightMod);
        if (intensity > 3) coords.push([lon, lat, Math.round(intensity)]);
      }
    }
    // 南半球椭圆（中心纬度 ~-68°）
    for (var slat = -80; slat <= -55; slat++) {
      for (var slon = -180; slon < 180; slon += 3) {
        var sdlat = slat - (-68);
        var snight = 0.5 + 0.5 * Math.cos(slon * Math.PI / 180);
        var sint = Math.exp(-(sdlat * sdlat) / 18) * 80 * (0.4 + 0.6 * snight);
        if (sint > 3) coords.push([slon, slat, Math.round(sint)]);
      }
    }
    return {
      'Observation Time': new Date(now - 3600000).toISOString(),
      'Forecast Time': new Date(now).toISOString(),
      'Data Format': '[Longitude, Latitude, Aurora]',
      coordinates: coords
    };
  }

  /* ---------- 解析 KP 数据 ---------- */
  // NOAA 当前提供两种格式：对象数组 [{time_tag,Kp,a_running,station_count}]（新）
  // 或嵌套数组 [['time_tag', 'Kp', ...], [...]]（旧）。此处兼容两者。
  function normalizeKpRow(r) {
    if (!r) return null;
    if (Array.isArray(r)) {
      return {
        time: parseTime(r[0]),
        kp: parseFloat(r[1]),
        station: parseInt(r[3], 10) || 0
      };
    }
    var time = r.time_tag || r.TimeTag || r.time;
    var kp = r.Kp || r.kp || r.KP;
    var station = r.station_count || r.StationCount || r.station || 0;
    return {
      time: parseTime(time),
      kp: parseFloat(kp),
      station: parseInt(station, 10) || 0
    };
  }

  function parseKp(rows, forecastRows) {
    if (!rows || !rows.length) return { current: null, forecast: [] };

    var now = Date.now();
    var data = rows.map(normalizeKpRow).filter(function (d) {
      return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime());
    });

    var measured = data.filter(function (d) { return d.station > 0; });
    var current = measured.length ? measured[measured.length - 1] : null;
    if (!current) {
      current = data.filter(function (d) { return d.time.getTime() <= now; }).pop() || data[0] || null;
    }

    // 预报优先使用专用 forecast 接口；若不可用，用历史数据兜底
    var forecast = [];
    if (forecastRows && forecastRows.length) {
      forecast = forecastRows.map(normalizeKpRow).filter(function (d) {
        return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime());
      }).filter(function (d) { return d.time.getTime() > now; }).slice(0, 24);
    }
    if (!forecast.length) {
      forecast = data.filter(function (d) { return d.time.getTime() > now; }).slice(0, 24);
    }
    if (!forecast.length) forecast = data.slice(-24);
    return { current: current, forecast: forecast };
  }

  /* ---------- 渲染：当前 KP 卡片 ---------- */
  function renderKpCard(current) {
    if (!current) {
      kpValue.textContent = '—';
      kpLevelEl.textContent = '—';
      kpVisibleLat.textContent = '—';
      kpUpdated.textContent = '—';
      return;
    }
    var kp = current.kp;
    var lvl = kpLevel(kp);
    kpValue.textContent = kp.toFixed(1);
    kpValue.style.color = LEVEL_COLORS[lvl];
    kpLevelEl.textContent = t(levelKey(lvl));
    kpLevelEl.style.color = LEVEL_COLORS[lvl];
    kpLevelEl.style.borderColor = LEVEL_COLORS[lvl];
    kpVisibleLat.textContent = visibleLatitude(kp) + '°';
    kpUpdated.textContent = fmtTime(current.time);
  }

  /* ---------- 渲染：未来 3 天 KP 预报条形图（SVG） ---------- */
  function renderForecast(entries) {
    var W = 720, H = 240;
    var padL = 30, padR = 12, padT = 14, padB = 30;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var n = entries.length;
    var parts = ['<svg class="forecast-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + OK.escape(t('forecast3day')) + '">'];

    if (!n) {
      parts.push('<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" class="axis-label">—</text></svg>');
      forecastChart.innerHTML = parts.join('');
      return;
    }

    var slot = plotW / n;
    var barW = slot * 0.62;
    // y 坐标：Kp 0 在底部，Kp 9 在顶部
    function y(kp) { return padT + plotH - (kp / 9) * plotH; }

    // 网格线 + y 轴标签
    [0, 3, 5, 7, 9].forEach(function (kp) {
      var yy = y(kp);
      parts.push('<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" class="' + (kp === 0 ? 'grid-base' : 'grid-line') + '"' + (kp === 0 ? '' : ' stroke-dasharray="2 4"') + '/>');
      parts.push('<text x="' + (padL - 6) + '" y="' + (yy + 3) + '" text-anchor="end" class="axis-label">' + kp + '</text>');
    });

    // 柱子
    entries.forEach(function (e, i) {
      var kp = e.kp;
      var color = LEVEL_COLORS[kpLevel(kp)];
      var x = padL + i * slot + (slot - barW) / 2;
      var top = y(kp);
      var h = (padT + plotH) - top;
      parts.push('<rect class="bar" x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" rx="2" fill="' + color + '" opacity="0.88"><title>Kp ' + kp.toFixed(1) + ' · ' + OK.escape(fmtTime(e.time)) + '</title></rect>');
    });

    // x 轴日期标签（按日期分组，每组首柱标注）
    var lastDay = null;
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    entries.forEach(function (e, i) {
      var dayKey = e.time.toDateString();
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        var x = padL + i * slot + slot / 2;
        var label = e.time.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
        parts.push('<text x="' + x.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" class="x-label">' + OK.escape(label) + '</text>');
      }
    });

    parts.push('</svg>');
    forecastChart.innerHTML = parts.join('');
  }

  /* ---------- 渲染：极光可见范围（Canvas 极投影） ---------- */
  function drawHemisphere(canvas, coords, hemisphere, userLat) {
    var dpr = window.devicePixelRatio || 1;
    var size = 300;
    // 内部分辨率按 dpr 放大，保证清晰
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    var cx = size / 2, cy = size / 2;
    var R = size / 2 - 10;

    // 背景圆（极区底色）
    ctx.fillStyle = '#0a0e27';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();

    // 纬度环 60° / 70° / 80°
    ctx.strokeStyle = 'rgba(139,149,201,0.28)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(139,149,201,0.6)';
    ctx.font = '9px "JetBrains Mono", monospace';
    [80, 70, 60].forEach(function (lat) {
      var r = (90 - lat) / 90 * R;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText(lat + '°', cx + r + 2, cy - 2);
    });

    // 经线 每 45°
    for (var m = 0; m < 360; m += 45) {
      var a = m * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a));
      ctx.stroke();
    }

    // 极光强度色块
    var step = Math.max(1, Math.floor(coords.length / 15000));
    for (var i = 0; i < coords.length; i += step) {
      var c = coords[i];
      var lon = c[0], lat = c[1], intensity = c[2] || 0;
      if (intensity <= 2) continue;
      var inNorth = lat >= 0;
      if (hemisphere === 'north' && !inNorth) continue;
      if (hemisphere === 'south' && inNorth) continue;
      var absLat = Math.abs(lat);
      if (absLat < 50) continue;
      var r = (90 - absLat) / 90 * R;
      var ang = lon * Math.PI / 180;
      var x = cx + r * Math.sin(ang);
      var y = cy - r * Math.cos(ang);
      ctx.fillStyle = auroraColor(intensity);
      ctx.globalAlpha = Math.min(1, intensity / 100 * 0.85 + 0.15);
      ctx.fillRect(x - 1.3, y - 1.3, 2.8, 2.8);
    }
    ctx.globalAlpha = 1;

    // 用户所选纬度环（虚线），颜色随当前 KP 等级
    var curKp = (state.kpParsed && state.kpParsed.current) ? state.kpParsed.current.kp : 0;
    var ringColor = LEVEL_COLORS[kpLevel(curKp)];
    if ((hemisphere === 'north' && userLat > 0) || (hemisphere === 'south' && userLat < 0)) {
      var ur = (90 - Math.abs(userLat)) / 90 * R;
      ctx.strokeStyle = ringColor;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, ur, 0, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 极点中心标记
    ctx.fillStyle = 'rgba(232,236,255,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 2 * Math.PI); ctx.fill();
  }

  function renderAurora(data, userLat) {
    var coords = [];
    if (data) {
      coords = data.coordinates || data['Coordinates'] || [];
    }
    drawHemisphere(northCanvas, coords, 'north', userLat);
    drawHemisphere(southCanvas, coords, 'south', userLat);
  }

  /* ---------- 渲染：观测建议 ---------- */
  function renderAdvice(kp, userLat) {
    var visLat = visibleLatitude(kp);
    var diff = Math.abs(userLat) - visLat;
    var icon, key;
    if (diff >= 0 && kp >= 6) { icon = '✅'; key = 'adviceStrong'; }
    else if (diff >= 0) { icon = '✅'; key = 'advicePossible'; }
    else if (diff >= -5) { icon = '⚠️'; key = 'adviceEdge'; }
    else { icon = '❌'; key = 'adviceUnlikely'; }

    adviceIcon.textContent = icon;
    adviceText.textContent = t(key);
    var hemi = userLat >= 0 ? t('hemiN') : t('hemiS');
    adviceSub.textContent = t('yourLat') + ': ' + Math.abs(userLat) + '°' + hemi + '  ·  ' + t('visibleLat') + ': ' + visLat + '°';
  }

  /* ---------- 渲染：KP 等级图例 ---------- */
  function renderLegend() {
    var html = LEGEND.map(function (it) {
      var color = LEVEL_COLORS[it.key];
      var visFrom = visibleLatitude(it.b);
      var visTo = visibleLatitude(it.a);
      var range = t('legendRange').replace('{a}', it.a).replace('{b}', it.b);
      var vis = t('legendVis').replace('{lat}', visFrom + '–' + visTo);
      return '<div class="legend-item">' +
        '<span class="legend-swatch" style="background:' + color + ';color:' + color + '"></span>' +
        '<div class="legend-info">' +
        '<div class="legend-name">' + OK.escape(t(levelKey(it.key))) + '</div>' +
        '<div class="legend-range">' + OK.escape(range) + '</div>' +
        '<div class="legend-vis">' + OK.escape(vis) + '</div>' +
        '</div></div>';
    }).join('');
    legendGrid.innerHTML = html;
  }

  /* ---------- 渲染：状态提示 ---------- */
  function renderStatus() {
    if (state.usedFallback) {
      statusNote.textContent = t('fallbackNote');
      statusNote.className = 'status-note warn';
    } else {
      var cur = state.kpParsed && state.kpParsed.current;
      statusNote.textContent = cur ? (t('lastUpdated') + ': ' + fmtTime(cur.time)) : '';
      statusNote.className = 'status-note';
    }
  }

  /* ---------- 统一重渲染 ---------- */
  function rerender() {
    if (!state.kpParsed) return;
    layout.style.display = '';
    var curKp = state.kpParsed.current ? state.kpParsed.current.kp : 0;
    renderKpCard(state.kpParsed.current);
    renderForecast(state.kpParsed.forecast);
    renderAurora(state.aurora, state.userLat);
    renderAdvice(curKp, state.userLat);
    renderLegend();
    renderStatus();
  }

  function showLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
    if (on) layout.style.display = 'none';
  }

  /* ---------- 数据加载（带降级） ---------- */
  function load() {
    showLoading(true);
    var kpFallback = false;
    var forecastFallback = false;
    var auroraFallback = false;

    var kpP = OK.fetchJSON(KP_URL).catch(function () {
      kpFallback = true;
      return mockKp();
    });
    var fcP = OK.fetchJSON(KP_FORECAST_URL).catch(function () {
      forecastFallback = true;
      return null;
    });
    var auP = OK.fetchJSON(AURORA_URL).catch(function () {
      auroraFallback = true;
      return mockAurora();
    });

    Promise.all([kpP, fcP, auP]).then(function (res) {
      state.kpParsed = parseKp(res[0], res[1]);
      state.aurora = res[2];
      // 只有核心数据（当前 KP / 极光图）降级才提示；预报接口失败会静默使用历史/模拟数据
      state.usedFallback = kpFallback || auroraFallback;
      showLoading(false);
      rerender();
    }).catch(function () {
      // 最终兜底
      state.kpParsed = parseKp(mockKp());
      state.aurora = mockAurora();
      state.usedFallback = true;
      showLoading(false);
      rerender();
    });
  }

  /* ---------- 启动 ---------- */
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    latSelect = document.getElementById('latSelect');
    refreshBtn = document.getElementById('refreshBtn');
    statusNote = document.getElementById('statusNote');
    loadingRow = document.getElementById('loadingRow');
    layout = document.getElementById('layout');
    kpValue = document.getElementById('kpValue');
    kpLevelEl = document.getElementById('kpLevel');
    kpVisibleLat = document.getElementById('kpVisibleLat');
    kpUpdated = document.getElementById('kpUpdated');
    adviceIcon = document.getElementById('adviceIcon');
    adviceText = document.getElementById('adviceText');
    adviceSub = document.getElementById('adviceSub');
    forecastChart = document.getElementById('forecastChart');
    northCanvas = document.getElementById('northCanvas');
    southCanvas = document.getElementById('southCanvas');
    legendGrid = document.getElementById('legendGrid');

    // 初始化 i18n 与语言切换
    OK.applyI18n(copy);
    OK.initLangToggle(langBtn, copy, function () { rerender(); });

    // 纬度选择
    state.userLat = parseInt(latSelect.value, 10) || 55;
    latSelect.addEventListener('change', function () {
      state.userLat = parseInt(latSelect.value, 10) || 55;
      rerender();
    });

    // 刷新按钮
    refreshBtn.addEventListener('click', load);

    // 首次加载
    load();
  });
})();
