/* ============================================================
   Sun & Moon — 日出日落时间
   数据源：
     · Sunrise-Sunset API（日出日落及各阶段曙暮光，formatted=0 返回 UTC ISO 时间）
     · Open-Meteo Geocoding API（城市搜索，返回 name/latitude/longitude/country/timezone）
   所有时间按所选城市时区显示（通过 Intl.DateTimeFormat 转换）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 文案字典（中英双语） ---------- */
  var copy = {
    en: {
      title: 'Sun & Moon',
      eyebrow: 'Sunrise · Sunset · Twilight',
      lead: "Sunrise, sunset, solar noon and twilight phases for any city on any date, shown in the city's local time.",
      searchPlaceholder: 'Search a city…',
      date: 'Date',
      favorites: 'Favorites',
      addFav: '★ Save',
      removeFav: '★ Saved',
      noFavs: 'No favorites yet — save a city for quick access.',
      timeline: 'Day Timeline',
      sunTimes: 'Sun',
      civilTwilight: 'Civil Twilight',
      nauticalTwilight: 'Nautical Twilight',
      astroTwilight: 'Astronomical Twilight',
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      solarNoon: 'Solar Noon',
      dayLength: 'Day Length',
      civilBegin: 'Civil Dawn',
      civilEnd: 'Civil Dusk',
      nautBegin: 'Nautical Dawn',
      nautEnd: 'Nautical Dusk',
      astroBegin: 'Astronomical Dawn',
      astroEnd: 'Astronomical Dusk',
      now: 'Now',
      loading: 'Loading…',
      error: 'Failed to load data. Please try again.',
      noResults: 'No matching cities.',
      dataSource: 'Data: Sunrise-Sunset.org · Open-Meteo',
      builtBy: 'Built by',
      phaseNight: 'Night',
      phaseAstro: 'Astronomical',
      phaseNautical: 'Nautical',
      phaseCivil: 'Civil',
      phaseDay: 'Day'
    },
    zh: {
      title: '日月',
      eyebrow: '日出 · 日落 · 曙暮光',
      lead: '查询任意城市、任意日期的日出、日落、太阳正午及各阶段曙暮光，时间按所选城市时区显示。',
      searchPlaceholder: '搜索城市…',
      date: '日期',
      favorites: '收藏',
      addFav: '★ 收藏',
      removeFav: '★ 已收藏',
      noFavs: '暂无收藏——收藏常用城市可快速切换。',
      timeline: '当日时间轴',
      sunTimes: '太阳',
      civilTwilight: '民用曙暮光',
      nauticalTwilight: '航海曙暮光',
      astroTwilight: '天文曙暮光',
      sunrise: '日出',
      sunset: '日落',
      solarNoon: '太阳正午',
      dayLength: '白昼时长',
      civilBegin: '民用晨光始',
      civilEnd: '民用昏光终',
      nautBegin: '航海晨光始',
      nautEnd: '航海昏光终',
      astroBegin: '天文晨光始',
      astroEnd: '天文昏光终',
      now: '当前',
      loading: '加载中…',
      error: '数据加载失败，请重试。',
      noResults: '未找到匹配的城市。',
      dataSource: '数据：Sunrise-Sunset.org · Open-Meteo',
      builtBy: '由',
      phaseNight: '夜晚',
      phaseAstro: '天文',
      phaseNautical: '航海',
      phaseCivil: '民用',
      phaseDay: '白昼'
    }
  };

  /* ---------- 常量 ---------- */
  var SUN_URL = 'https://api.sunrise-sunset.org/json';
  var GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var FAV_KEY = 'sun-moon-favorites';
  // 默认北京
  var BEIJING = { name: 'Beijing', lat: 39.9, lng: 116.4, country: 'China', timezone: 'Asia/Shanghai' };

  // 各阶段配色（与时间轴渐变一致）
  var PHASE_COLORS = {
    night: '#0a0f24',
    astro: '#1e1b4b',
    nautical: '#4338ca',
    civil: '#fb923c',
    day: '#fcd34d',
    dayPeak: '#fef3c7'
  };

  /* ---------- 状态 ---------- */
  var state = { city: null, data: null, error: null, searchResults: [] };

  /* ---------- DOM 引用 ---------- */
  var langBtn, cityInput, searchResultsEl, dateInput, currentCityEl;
  var favoritesStrip, addFavBtn, timeline, loadingEl, errorEl;
  var infoEls = {};

  /* ---------- 工具函数 ---------- */
  function t(k) { return OK.t(k, copy); }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // 在指定时区下格式化时间为 HH:MM
  function fmtTime(date, timeZone) {
    if (!date || isNaN(date.getTime())) return '—';
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    try {
      return new Intl.DateTimeFormat(loc, {
        timeZone: timeZone, hour: '2-digit', minute: '2-digit', hour12: false
      }).format(date);
    } catch (e) {
      return date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }

  // 取某时刻在指定时区下的小时（小数，0~24）
  function localHours(date, timeZone) {
    if (!date || isNaN(date.getTime())) return null;
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(date);
      var h = 0, m = 0, s = 0;
      parts.forEach(function (p) {
        if (p.type === 'hour') h = parseInt(p.value, 10);
        else if (p.type === 'minute') m = parseInt(p.value, 10);
        else if (p.type === 'second') s = parseInt(p.value, 10);
      });
      if (h === 24) h = 0;
      return h + m / 60 + s / 3600;
    } catch (e) {
      return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    }
  }

  // 取指定时区下今天的日期字符串 YYYY-MM-DD
  function todayInTZ(timeZone) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      var y, mo, d;
      parts.forEach(function (p) {
        if (p.type === 'year') y = p.value;
        else if (p.type === 'month') mo = p.value;
        else if (p.type === 'day') d = p.value;
      });
      return y + '-' + mo + '-' + d;
    } catch (e) {
      var n = new Date();
      return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate());
    }
  }

  // 将 YYYY-MM-DD 格式化为带星期的本地日期文字（按当前语言）
  function fmtDateLabel(ymd) {
    if (!ymd) return '';
    var parts = ymd.split('-');
    if (parts.length !== 3) return ymd;
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    if (isNaN(d.getTime())) return ymd;
    var loc = OK.lang === 'zh' ? 'zh-CN' : 'en-US';
    try {
      return d.toLocaleDateString(loc, {
        timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      });
    } catch (e) {
      return ymd;
    }
  }

  // 白昼时长（秒）转 "Xh Ym" / "X 小时 Y 分"
  function fmtDayLength(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (OK.lang === 'zh') return h + ' 小时 ' + m + ' 分';
    return h + 'h ' + m + 'm';
  }

  function safeDate(iso) { return iso ? new Date(iso) : null; }

  // 判断所选日期是否为该城市时区的今天
  function isToday() {
    if (!state.city || !dateInput || !dateInput.value) return false;
    return dateInput.value === todayInTZ(state.city.timezone);
  }

  /* ---------- 收藏管理 ---------- */
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }
  function setFavs(arr) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function isFav(city) {
    if (!city) return false;
    return getFavs().some(function (f) { return f.lat === city.lat && f.lng === city.lng; });
  }
  function toggleFav(city) {
    if (!city) return;
    var favs = getFavs();
    var idx = favs.findIndex(function (f) { return f.lat === city.lat && f.lng === city.lng; });
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push({ name: city.name, lat: city.lat, lng: city.lng, country: city.country, timezone: city.timezone });
    setFavs(favs);
    renderFavorites();
    renderFavBtn();
  }

  /* ---------- 城市搜索 ---------- */
  var searchTimer = null;

  function onSearchInput() {
    clearTimeout(searchTimer);
    var q = cityInput.value.trim();
    if (!q) { hideSearchResults(); return; }
    searchTimer = setTimeout(function () { searchCities(q); }, 300);
  }

  function searchCities(query) {
    var url = GEO_URL + '?name=' + encodeURIComponent(query) + '&count=5&language=en&format=json';
    OK.fetchJSON(url).then(function (data) {
      state.searchResults = (data && data.results) || [];
      renderSearchResults();
    }).catch(function () {
      state.searchResults = [];
      renderSearchResults();
    });
  }

  function renderSearchResults() {
    var list = state.searchResults;
    if (!list.length) {
      searchResultsEl.innerHTML = '<div class="sr-empty">' + OK.escape(t('noResults')) + '</div>';
      searchResultsEl.style.display = '';
      return;
    }
    var html = list.map(function (r, i) {
      var label = r.name;
      if (r.admin1) label += ', ' + r.admin1;
      if (r.country) label += ', ' + r.country;
      var sub = (r.latitude != null ? r.latitude.toFixed(2) : '—') + ', ' +
        (r.longitude != null ? r.longitude.toFixed(2) : '—') +
        (r.timezone ? ' · ' + r.timezone : '');
      return '<button type="button" class="sr-item" data-idx="' + i + '">' +
        '<span class="sr-name">' + OK.escape(label) + '</span>' +
        '<span class="sr-sub">' + OK.escape(sub) + '</span>' +
        '</button>';
    }).join('');
    searchResultsEl.innerHTML = html;
    searchResultsEl.style.display = '';
    searchResultsEl.querySelectorAll('.sr-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx, 10);
        var r = list[idx];
        if (!r) return;
        selectCity({ name: r.name, lat: r.latitude, lng: r.longitude, country: r.country, timezone: r.timezone });
      });
    });
  }

  function hideSearchResults() {
    searchResultsEl.innerHTML = '';
    searchResultsEl.style.display = 'none';
  }

  /* ---------- 选择城市并加载 ---------- */
  function selectCity(city) {
    state.city = city;
    state.searchResults = [];
    cityInput.value = '';
    hideSearchResults();
    if (!dateInput.value) dateInput.value = todayInTZ(city.timezone);
    load();
  }

  /* ---------- 加载日出日落数据 ---------- */
  function load() {
    if (!state.city) return;
    showLoading(true);
    var date = dateInput.value || todayInTZ(state.city.timezone);
    var url = SUN_URL + '?lat=' + state.city.lat + '&lng=' + state.city.lng +
      '&date=' + encodeURIComponent(date) + '&formatted=0';
    OK.fetchJSON(url).then(function (data) {
      if (!data || data.status !== 'OK') throw new Error(data && data.status ? data.status : 'error');
      state.data = data.results;
      state.error = null;
    }).catch(function (e) {
      state.data = null;
      state.error = (e && e.message) ? e.message : 'error';
    }).then(function () {
      showLoading(false);
      rerender();
    });
  }

  /* ---------- 渲染：当前城市信息 ---------- */
  function renderCurrentCity() {
    if (!state.city) { currentCityEl.textContent = ''; return; }
    var c = state.city;
    var coords = (c.lat != null ? c.lat.toFixed(2) : '—') + '°, ' + (c.lng != null ? c.lng.toFixed(2) : '—') + '°';
    currentCityEl.innerHTML =
      '<span class="cc-name">' + OK.escape(c.name) + (c.country ? ', ' + OK.escape(c.country) : '') + '</span>' +
      '<span class="cc-coords">' + OK.escape(coords) + ' · ' + OK.escape(c.timezone || 'UTC') + '</span>' +
      '<span class="cc-date">' + OK.escape(fmtDateLabel(dateInput.value)) + '</span>';
  }

  /* ---------- 渲染：收藏栏 ---------- */
  function renderFavorites() {
    var favs = getFavs();
    if (!favs.length) {
      favoritesStrip.innerHTML = '<span class="fav-empty">' + OK.escape(t('noFavs')) + '</span>';
      return;
    }
    favoritesStrip.innerHTML = favs.map(function (f, i) {
      var label = f.name + (f.country ? ', ' + f.country : '');
      return '<button type="button" class="fav-chip" data-idx="' + i + '" title="' + OK.escape(label) + '">' +
        '<span class="fav-chip-name">' + OK.escape(f.name) + '</span>' +
        '<span class="fav-chip-remove" data-rm="' + i + '" role="button" aria-label="×">×</span>' +
        '</button>';
    }).join('');
    favoritesStrip.querySelectorAll('.fav-chip').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        // 点击删除按钮：移除该收藏
        if (e.target && e.target.classList.contains('fav-chip-remove')) {
          e.stopPropagation();
          var rmIdx = parseInt(e.target.dataset.rm, 10);
          var arr = getFavs();
          if (rmIdx >= 0 && rmIdx < arr.length) {
            arr.splice(rmIdx, 1);
            setFavs(arr);
            renderFavorites();
            renderFavBtn();
          }
          return;
        }
        // 点击 chip 主体：切换到该城市
        var idx = parseInt(btn.dataset.idx, 10);
        var f = getFavs()[idx];
        if (f) selectCity(f);
      });
    });
  }

  function renderFavBtn() {
    if (!state.city) { addFavBtn.style.display = 'none'; return; }
    addFavBtn.style.display = '';
    if (isFav(state.city)) {
      addFavBtn.textContent = t('removeFav');
      addFavBtn.classList.add('is-saved');
    } else {
      addFavBtn.textContent = t('addFav');
      addFavBtn.classList.remove('is-saved');
    }
  }

  /* ---------- 渲染：信息卡片 ---------- */
  function renderInfo() {
    var d = state.data;
    var tz = state.city.timezone;
    function set(id, val) { if (infoEls[id]) infoEls[id].textContent = val; }
    set('sunrise', fmtTime(safeDate(d.sunrise), tz));
    set('solarNoon', fmtTime(safeDate(d.solar_noon), tz));
    set('sunset', fmtTime(safeDate(d.sunset), tz));
    set('dayLength', fmtDayLength(d.day_length));
    set('civilBegin', fmtTime(safeDate(d.civil_twilight_begin), tz));
    set('civilEnd', fmtTime(safeDate(d.civil_twilight_end), tz));
    set('nautBegin', fmtTime(safeDate(d.nautical_twilight_begin), tz));
    set('nautEnd', fmtTime(safeDate(d.nautical_twilight_end), tz));
    set('astroBegin', fmtTime(safeDate(d.astronomical_twilight_begin), tz));
    set('astroEnd', fmtTime(safeDate(d.astronomical_twilight_end), tz));
  }

  /* ---------- 渲染：时间轴渐变 ---------- */
  function buildGradient(events) {
    function find(key) {
      for (var i = 0; i < events.length; i++) if (events[i].key === key) return events[i];
      return null;
    }
    function pct(h) { return (h / 24 * 100).toFixed(2); }
    function stop(color, h) { return PHASE_COLORS[color] + ' ' + pct(h) + '%'; }

    var sunrise = find('sunrise');
    var sunset = find('sunset');
    var solarNoon = find('solarNoon');
    var civilBegin = find('civilBegin');
    var civilEnd = find('civilEnd');
    var nautBegin = find('nautBegin');
    var nautEnd = find('nautEnd');
    var astroBegin = find('astroBegin');
    var astroEnd = find('astroEnd');

    // 极昼 / 极夜兜底（无日出日落）
    if (!sunrise && !sunset) {
      var dl = state.data && state.data.day_length;
      if (dl != null && dl >= 86400) {
        return 'linear-gradient(90deg, ' + PHASE_COLORS.day + ' 0%, ' + PHASE_COLORS.dayPeak + ' 50%, ' + PHASE_COLORS.day + ' 100%)';
      }
      return 'linear-gradient(90deg, ' + PHASE_COLORS.night + ' 0%, ' + PHASE_COLORS.night + ' 100%)';
    }

    // 平滑渐变：深夜 → 天文 → 航海 → 民用 → 白昼（正午最亮）→ 民用 → 航海 → 天文 → 深夜
    var stops = [PHASE_COLORS.night + ' 0%'];
    if (astroBegin) stops.push(stop('astro', astroBegin.hours));
    if (nautBegin) stops.push(stop('nautical', nautBegin.hours));
    if (civilBegin) stops.push(stop('civil', civilBegin.hours));
    if (sunrise) stops.push(stop('day', sunrise.hours));
    if (solarNoon) stops.push(stop('dayPeak', solarNoon.hours));
    if (sunset) stops.push(stop('day', sunset.hours));
    if (civilEnd) stops.push(stop('civil', civilEnd.hours));
    if (nautEnd) stops.push(stop('nautical', nautEnd.hours));
    if (astroEnd) stops.push(stop('astro', astroEnd.hours));
    stops.push(PHASE_COLORS.night + ' 100%');

    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  /* ---------- 渲染：时间轴 ---------- */
  function renderTimeline() {
    if (!state.data) { timeline.innerHTML = ''; return; }
    var d = state.data;
    var tz = state.city.timezone;

    // 收集存在的事件
    var defs = [
      { key: 'astroBegin', iso: d.astronomical_twilight_begin, phase: 'astro', label: t('astroBegin') },
      { key: 'nautBegin', iso: d.nautical_twilight_begin, phase: 'nautical', label: t('nautBegin') },
      { key: 'civilBegin', iso: d.civil_twilight_begin, phase: 'civil', label: t('civilBegin') },
      { key: 'sunrise', iso: d.sunrise, phase: 'sunrise', label: t('sunrise') },
      { key: 'solarNoon', iso: d.solar_noon, phase: 'day', label: t('solarNoon') },
      { key: 'sunset', iso: d.sunset, phase: 'sunset', label: t('sunset') },
      { key: 'civilEnd', iso: d.civil_twilight_end, phase: 'civil', label: t('civilEnd') },
      { key: 'nautEnd', iso: d.nautical_twilight_end, phase: 'nautical', label: t('nautEnd') },
      { key: 'astroEnd', iso: d.astronomical_twilight_end, phase: 'astro', label: t('astroEnd') }
    ];
    var events = [];
    defs.forEach(function (e) {
      if (!e.iso) return;
      var date = new Date(e.iso);
      var h = localHours(date, tz);
      if (h == null) return;
      events.push({ key: e.key, hours: h, date: date, phase: e.phase, label: e.label });
    });

    var gradient = buildGradient(events);

    // 轨道上的小时刻度线（0,6,12,18,24）
    var ticksHtml = '';
    [0, 6, 12, 18, 24].forEach(function (h) {
      var left = (h / 24 * 100).toFixed(2);
      ticksHtml += '<div class="tl-tick" style="left:' + left + '%"></div>';
    });

    // 事件标记（上下交错避免重叠）
    var markersHtml = '';
    events.forEach(function (e, i) {
      var left = (e.hours / 24 * 100).toFixed(2);
      var pos = i % 2 === 0 ? 'above' : 'below';
      var time = fmtTime(e.date, tz);
      markersHtml += '<div class="tl-marker ' + pos + '" style="left:' + left + '%" title="' + OK.escape(e.label + ' ' + time) + '">' +
        '<div class="tl-marker-line"></div>' +
        '<div class="tl-marker-dot phase-' + e.phase + '"></div>' +
        '<div class="tl-marker-label">' +
        '<span class="tl-name">' + OK.escape(e.label) + '</span>' +
        '<span class="tl-time">' + OK.escape(time) + '</span>' +
        '</div>' +
        '</div>';
    });

    // 当前时刻线（仅当查看的是该城市今天时显示）
    var nowHtml = '';
    if (isToday()) {
      var nowH = localHours(new Date(), tz);
      if (nowH != null) {
        var left = (nowH / 24 * 100).toFixed(2);
        nowHtml = '<div class="tl-now" style="left:' + left + '%">' +
          '<div class="tl-now-line"></div>' +
          '<span class="tl-now-label">' + OK.escape(t('now')) + '</span>' +
          '</div>';
      }
    }

    // 小时刻度文字行
    var hoursHtml = '';
    [0, 6, 12, 18, 24].forEach(function (h) {
      var left = (h / 24 * 100).toFixed(2);
      hoursHtml += '<span class="tl-hour" style="left:' + left + '%">' + pad2(h) + ':00</span>';
    });

    // 阶段图例
    var legendHtml =
      '<span class="tl-legend-item"><span class="tl-legend-swatch" style="background:' + PHASE_COLORS.night + '"></span>' + OK.escape(t('phaseNight')) + '</span>' +
      '<span class="tl-legend-item"><span class="tl-legend-swatch" style="background:' + PHASE_COLORS.astro + '"></span>' + OK.escape(t('phaseAstro')) + '</span>' +
      '<span class="tl-legend-item"><span class="tl-legend-swatch" style="background:' + PHASE_COLORS.nautical + '"></span>' + OK.escape(t('phaseNautical')) + '</span>' +
      '<span class="tl-legend-item"><span class="tl-legend-swatch" style="background:' + PHASE_COLORS.civil + '"></span>' + OK.escape(t('phaseCivil')) + '</span>' +
      '<span class="tl-legend-item"><span class="tl-legend-swatch" style="background:' + PHASE_COLORS.day + '"></span>' + OK.escape(t('phaseDay')) + '</span>';

    timeline.innerHTML =
      '<div class="tl-stage">' +
        '<div class="tl-track" style="background:' + gradient + '">' + ticksHtml + '</div>' +
        markersHtml + nowHtml +
      '</div>' +
      '<div class="tl-hours">' + hoursHtml + '</div>' +
      '<div class="tl-legend">' + legendHtml + '</div>';
  }

  /* ---------- 渲染：状态 ---------- */
  function showLoading(on) {
    if (loadingEl) loadingEl.style.display = on ? '' : 'none';
    if (on && errorEl) errorEl.style.display = 'none';
  }

  function showError() {
    if (errorEl) {
      errorEl.textContent = t('error');
      errorEl.style.display = '';
    }
  }

  /* ---------- 统一重渲染（语言切换 / 数据更新后调用） ---------- */
  function rerender() {
    cityInput.placeholder = t('searchPlaceholder');
    renderCurrentCity();
    renderFavorites();
    renderFavBtn();
    if (state.error) {
      showError();
      timeline.innerHTML = '';
      return;
    }
    if (errorEl) errorEl.style.display = 'none';
    if (!state.data) return;
    renderInfo();
    renderTimeline();
  }

  /* ---------- 启动 ---------- */
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    cityInput = document.getElementById('cityInput');
    searchResultsEl = document.getElementById('searchResults');
    dateInput = document.getElementById('dateInput');
    currentCityEl = document.getElementById('currentCity');
    favoritesStrip = document.getElementById('favoritesStrip');
    addFavBtn = document.getElementById('addFavBtn');
    timeline = document.getElementById('timeline');
    loadingEl = document.getElementById('loadingRow');
    errorEl = document.getElementById('errorRow');

    ['sunrise', 'solarNoon', 'sunset', 'dayLength',
      'civilBegin', 'civilEnd', 'nautBegin', 'nautEnd', 'astroBegin', 'astroEnd'
    ].forEach(function (id) {
      infoEls[id] = document.getElementById(id);
    });

    // 初始化 i18n 与语言切换
    OK.applyI18n(copy);
    OK.initLangToggle(langBtn, copy, function () { rerender(); });

    // 搜索输入：防抖
    cityInput.addEventListener('input', onSearchInput);
    cityInput.addEventListener('focus', function () {
      if (cityInput.value.trim() && state.searchResults.length) renderSearchResults();
    });
    cityInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimer);
        if (cityInput.value.trim()) searchCities(cityInput.value.trim());
      } else if (e.key === 'Escape') {
        hideSearchResults();
      }
    });
    // 点击外部关闭搜索结果下拉
    document.addEventListener('click', function (e) {
      if (!cityInput.contains(e.target) && !searchResultsEl.contains(e.target)) hideSearchResults();
    });

    // 日期变化
    dateInput.addEventListener('change', function () {
      if (state.city) load();
    });

    // 收藏按钮
    addFavBtn.addEventListener('click', function () { toggleFav(state.city); });

    // 默认加载北京
    selectCity(BEIJING);
  });
})();
