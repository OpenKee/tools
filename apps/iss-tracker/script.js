/* ============================================================
   ISS Tracker — 国际空间站实时位置追踪
   数据来源：wheretheiss.at / howmanypeopleareinspacerightnow.com
   ============================================================ */

// ---------- 国际化文案 ----------
const copy = {
  en: {
    eyebrow: 'Space tracking',
    title: 'ISS Tracker',
    lead: 'Follow the International Space Station as it orbits Earth at 27,600 km/h.',
    live: 'LIVE',
    coords: 'Coordinates',
    latitude: 'Latitude',
    longitude: 'Longitude',
    region: 'Region',
    orbit: 'Orbit',
    speed: 'Speed',
    altitude: 'Altitude',
    orbitPeriod: 'Orbital period',
    inSpace: 'in space',
    loadingAstros: 'Loading astronauts…',
    nextPass: 'Next pass over',
    check: 'Check',
    latPh: 'lat',
    lonPh: 'lon',
    useLocAria: 'Use my location',
    enterCoords: 'Enter a valid latitude and longitude.',
    noPass: 'No upcoming passes found.',
    fetchError: 'Failed to fetch data. Retrying…',
    locError: 'Unable to get your location.',
    updating: 'Updating…',
  },
  zh: {
    eyebrow: '太空追踪',
    title: 'ISS 追踪器',
    lead: '实时追踪国际空间站，以每小时 27,600 公里的速度环绕地球。',
    live: '实时',
    coords: '坐标',
    latitude: '纬度',
    longitude: '经度',
    region: '所在区域',
    orbit: '轨道参数',
    speed: '速度',
    altitude: '高度',
    orbitPeriod: '轨道周期',
    inSpace: '人在太空',
    loadingAstros: '正在加载宇航员信息…',
    nextPass: '下次经过',
    check: '查询',
    latPh: '纬度',
    lonPh: '经度',
    useLocAria: '使用我的位置',
    enterCoords: '请输入有效的纬度和经度。',
    noPass: '暂无即将经过的记录。',
    fetchError: '数据获取失败，正在重试…',
    locError: '无法获取您的位置。',
    updating: '更新中…',
  }
};

// ---------- 简化区域判断（粗略经纬度框，中英名称）----------
// [latMin, latMax, lonMin, lonMax, en, zh]
const CONTINENTS = [
  [25, 72, -168, -52, 'North America', '北美洲'],
  [-56, 13, -82, -34, 'South America', '南美洲'],
  [36, 71, -10, 40, 'Europe', '欧洲'],
  [-35, 37, -18, 52, 'Africa', '非洲'],
  [5, 77, 40, 145, 'Asia', '亚洲'],
  [-10, 25, 95, 141, 'Southeast Asia', '东南亚'],
  [-44, -10, 112, 154, 'Australia', '澳大利亚'],
  [60, 83, -55, -20, 'Greenland', '格陵兰'],
];
const OCEANS = [
  [-60, 60, -180, -130, 'Pacific Ocean', '太平洋'],
  [-60, 60, 120, 180, 'Pacific Ocean', '太平洋'],
  [-60, 60, -70, -15, 'Atlantic Ocean', '大西洋'],
  [-30, 25, 45, 100, 'Indian Ocean', '印度洋'],
];

// ---------- DOM 引用 ----------
const langToggle = document.getElementById('langToggle');
const lastUpdate = document.getElementById('lastUpdate');
const badgeCoords = document.getElementById('badgeCoords');
const latVal = document.getElementById('latVal');
const lonVal = document.getElementById('lonVal');
const regionVal = document.getElementById('regionVal');
const speedVal = document.getElementById('speedVal');
const altVal = document.getElementById('altVal');
const astrosCount = document.getElementById('astrosCount');
const astrosList = document.getElementById('astrosList');
const passLat = document.getElementById('passLat');
const passLon = document.getElementById('passLon');
const passBtn = document.getElementById('passBtn');
const useLocBtn = document.getElementById('useLocBtn');
const passResult = document.getElementById('passResult');

// ---------- API 地址 ----------
// 使用支持 HTTPS 的 API，避免混合内容拦截
const ISS_NOW_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
// howmanypeopleareinspacerightnow.com 未设置 CORS，通过 corsproxy.io 访问
const ASTROS_URL = 'https://corsproxy.io/?url=' + encodeURIComponent('https://www.howmanypeopleareinspacerightnow.com/peopleinspace.json');

// ---------- 运行时状态 ----------
let lang = OK.lang;
let map, issMarker, footprint, trailLayer;
let trail = [];        // 已采集的轨迹点 [{lat, lon, t}]
let lastPos = null;    // 上一次位置 {lat, lon, t}
let astrosData = null; // 宇航员数据缓存
const TRAIL_MAX = 360; // 轨迹点上限（约 30 分钟）

// ---------- 翻译辅助 ----------
function t(key) { return (copy[lang] && copy[lang][key]) || key; }

function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 占位符与无障碍标签随语言刷新
  passLat.placeholder = t('latPh');
  passLon.placeholder = t('lonPh');
  useLocBtn.setAttribute('aria-label', t('useLocAria'));
  // 重新渲染动态内容
  renderAstros();
  if (lastPos) updatePositionUI(lastPos);
}

// ---------- 区域检测 ----------
function detectRegion(lat, lon) {
  // 极地
  if (lat > 66.5) return { en: 'Arctic region', zh: '北极地区' };
  if (lat < -66.5) return { en: 'Antarctic region', zh: '南极地区' };
  // 大陆优先匹配
  for (let i = 0; i < CONTINENTS.length; i++) {
    const c = CONTINENTS[i];
    if (lat >= c[0] && lat <= c[1] && lon >= c[2] && lon <= c[3]) {
      return { en: c[4], zh: c[5] };
    }
  }
  // 海洋
  for (let i = 0; i < OCEANS.length; i++) {
    const o = OCEANS[i];
    if (lat >= o[0] && lat <= o[1] && lon >= o[2] && lon <= o[3]) {
      return { en: o[4], zh: o[5] };
    }
  }
  return { en: 'Open ocean', zh: '开阔海域' };
}

// ---------- 地图初始化 ----------
function initMap() {
  map = L.map('map', {
    zoomControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 8,
    attributionControl: true,
  }).setView([20, 0], 2);

  // 深色瓦片（CartoDB Dark Matter）
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // 轨迹图层组
  trailLayer = L.layerGroup().addTo(map);

  // ISS 标记（自定义 div 图标 + 脉冲环）
  const icon = L.divIcon({
    className: 'iss-marker',
    html: '<div class="iss-icon"><span class="iss-ring"></span><span class="iss-core"></span></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  issMarker = L.marker([0, 0], { icon: icon, zIndexOffset: 1000 }).addTo(map);

  // 可见范围圆（约 1500 km 半径，表示地面可观测范围）
  footprint = L.circle([0, 0], {
    radius: 1500000,
    color: '#38bdf8',
    weight: 1,
    opacity: 0.4,
    fillColor: '#38bdf8',
    fillOpacity: 0.06,
  }).addTo(map);
}

// ---------- Haversine 距离（公里）----------
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径 km
  const toRad = function (d) { return d * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- 获取 ISS 位置 ----------
function fetchISSPosition() {
  OK.fetchJSON(ISS_NOW_URL, { timeout: 20000 })
    .then(function (data) {
      if (!data || typeof data.latitude === 'undefined') {
        throw new Error('Bad iss-now response');
      }
      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);
      const ts = data.timestamp ? data.timestamp * 1000 : Date.now();
      // wheretheiss.at 直接返回速度和高度
      const speed = data.velocity ? parseFloat(data.velocity) : null;
      const alt = data.altitude ? parseFloat(data.altitude) : null;
      handleNewPosition(lat, lon, ts, speed, alt);
    })
    .catch(function (err) {
      console.warn('ISS position fetch failed:', err);
      // 不打断定时器，下次继续尝试
    });
}

function handleNewPosition(lat, lon, ts, apiSpeed, apiAlt) {
  const newPos = { lat: lat, lon: lon, t: ts };

  // 优先使用 API 返回的速度；否则根据前后两点计算
  let speed = apiSpeed || null;
  if (speed == null && lastPos) {
    const dist = haversine(lastPos.lat, lastPos.lon, lat, lon); // km
    const dt = (ts - lastPos.t) / 3600000; // 小时
    if (dt > 0) speed = dist / dt;
  }
  lastPos = newPos;
  trail.push(newPos);
  if (trail.length > TRAIL_MAX) trail.shift();

  // 更新标记与可见范围
  issMarker.setLatLng([lat, lon]);
  footprint.setLatLng([lat, lon]);

  // 首次定位时飞到 ISS
  if (trail.length === 1) {
    map.setView([lat, lon], 4);
  }

  redrawTrail();
  updatePositionUI(newPos, speed, apiAlt);
  lastUpdate.textContent = formatTime(ts);
}

// ---------- 重绘轨迹（处理 ±180° 日期变更线）----------
function redrawTrail() {
  trailLayer.clearLayers();
  if (trail.length < 2) return;

  // 拆分跨越日期变更线的段
  const segments = [[]];
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const seg = segments[segments.length - 1];
    if (seg.length > 0) {
      const prev = seg[seg.length - 1];
      if (Math.abs(p.lon - prev[1]) > 180) {
        segments.push([]);
      }
    }
    segments[segments.length - 1].push([p.lat, p.lon]);
  }

  segments.forEach(function (seg) {
    if (seg.length >= 2) {
      L.polyline(seg, {
        color: '#38bdf8',
        weight: 2,
        opacity: 0.5,
        dashArray: '4 4',
      }).addTo(trailLayer);
    }
  });
}

// ---------- 更新坐标/区域/速度 UI ----------
function updatePositionUI(pos, speed, alt) {
  latVal.textContent = pos.lat.toFixed(3) + '°';
  lonVal.textContent = pos.lon.toFixed(3) + '°';
  badgeCoords.textContent = formatCoord(pos.lat, 'lat') + ', ' + formatCoord(pos.lon, 'lon');

  const region = detectRegion(pos.lat, pos.lon);
  regionVal.textContent = lang === 'zh' ? region.zh : region.en;

  if (speed != null && speed > 0) {
    speedVal.textContent = Math.round(speed).toLocaleString() + ' km/h';
  } else {
    speedVal.textContent = '~27,600 km/h';
  }
  altVal.textContent = (alt ? '~' + Math.round(alt) : '~408') + ' km';
}

function formatCoord(v, type) {
  const dir = type === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
  return Math.abs(v).toFixed(2) + '° ' + dir;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// ---------- 宇航员 ----------
function fetchAstronauts() {
  OK.fetchJSON(ASTROS_URL, { timeout: 20000 })
    .then(function (data) {
      if (!data || typeof data.number === 'undefined') throw new Error('Bad astros response');
      astrosData = data;
      renderAstros();
    })
    .catch(function (err) {
      console.warn('Astronauts fetch failed:', err);
      astrosList.innerHTML = '<div class="muted">' + OK.escape(t('fetchError')) + '</div>';
    });
}

function renderAstros() {
  if (!astrosData) {
    astrosList.innerHTML = '<div class="muted">' + OK.escape(t('loadingAstros')) + '</div>';
    astrosCount.textContent = '--';
    return;
  }
  astrosCount.textContent = astrosData.number;
  const people = astrosData.people || [];
  astrosList.innerHTML = people.map(function (p) {
    return '<div class="astro-item"><span>' + OK.escape(p.name) +
      '</span><span class="craft">' + OK.escape(p.craft) + '</span></div>';
  }).join('');
}

// ---------- 下一次经过指定位置 ----------
function fetchPass(lat, lon) {
  passResult.innerHTML = '<div class="muted">' + OK.escape(t('updating')) + '</div>';
  // 通过 CORS 代理请求 Open Notify 过境预测 API
  const targetUrl = 'http://api.open-notify.org/iss-pass.json?lat=' +
    encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&n=3';
  const url = 'https://corsproxy.io/?url=' + encodeURIComponent(targetUrl);
  OK.fetchJSON(url)
    .then(function (data) {
      if (!data || data.message !== 'success') throw new Error('Bad pass response');
      const passes = data.response || [];
      if (!passes.length) {
        passResult.innerHTML = '<div class="muted">' + OK.escape(t('noPass')) + '</div>';
        return;
      }
      passResult.innerHTML = passes.map(function (p) {
        const time = new Date(p.risetime * 1000);
        const timeStr = time.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        });
        return '<div class="pass-item"><span class="pass-time">' + OK.escape(timeStr) +
          '</span><span class="pass-dur">' + p.duration + 's</span></div>';
      }).join('');
    })
    .catch(function (err) {
      console.warn('Pass fetch failed:', err);
      passResult.innerHTML = '<div class="error-msg">' + OK.escape(t('fetchError')) + '</div>';
    });
}

// ---------- 事件绑定 ----------
passBtn.addEventListener('click', function () {
  const lat = parseFloat(passLat.value);
  const lon = parseFloat(passLon.value);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    passResult.innerHTML = '<div class="error-msg">' + OK.escape(t('enterCoords')) + '</div>';
    return;
  }
  fetchPass(lat, lon);
});

useLocBtn.addEventListener('click', function () {
  if (!navigator.geolocation) {
    passResult.innerHTML = '<div class="error-msg">' + OK.escape(t('locError')) + '</div>';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      passLat.value = pos.coords.latitude.toFixed(2);
      passLon.value = pos.coords.longitude.toFixed(2);
      fetchPass(pos.coords.latitude, pos.coords.longitude);
    },
    function () {
      passResult.innerHTML = '<div class="error-msg">' + OK.escape(t('locError')) + '</div>';
    }
  );
});

// ---------- 启动 ----------
OK.initLangToggle(langToggle, copy, applyLanguage);
initMap();
applyLanguage();
fetchISSPosition();
fetchAstronauts();
// 每 5 秒自动刷新位置
setInterval(fetchISSPosition, 5000);
