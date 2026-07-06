/* ============================================================
   Cosmic Lens — NASA 每日天文图片（APOD）
   数据来源：NASA APOD API（DEMO_KEY，每小时 30 次限速）。
   按日期获取的结果缓存到 localStorage，避免重复请求。
   ============================================================ */

// ---------- 国际化文案 ----------
var copy = {
  en: {
    eyebrow: 'NASA · Astronomy Picture of the Day',
    title: 'Cosmic Lens',
    lead: 'A daily window onto the universe from NASA. Each day brings a different image of the cosmos, with a brief explanation written by a professional astronomer.',
    date: 'Date',
    today: 'Today',
    random: 'Surprise me',
    viewHD: 'View HD',
    explanationTitle: 'Explanation',
    copyright: 'Image credit',
    loading: 'Receiving signal from deep space…',
    error: 'Lost contact with the API. The DEMO_KEY hourly limit may have been reached — please try again later.',
    noVideo: 'This video could not be embedded.',
    mediaTypeImage: 'Photograph',
    mediaTypeVideo: 'Video'
  },
  zh: {
    eyebrow: 'NASA · 每日天文一图',
    title: '宇宙之眼',
    lead: '一扇望向宇宙的每日之窗。NASA 每天精选一张宇宙影像，并由专业天文学家撰写简短说明。',
    date: '日期',
    today: '今天',
    random: '随机探索',
    viewHD: '查看高清',
    explanationTitle: '图片说明',
    copyright: '图片来源',
    loading: '正在接收来自深空的信号…',
    error: '与 API 失去联系。DEMO_KEY 每小时限速可能已用尽，请稍后再试。',
    noVideo: '无法嵌入该视频。',
    mediaTypeImage: '照片',
    mediaTypeVideo: '视频'
  }
};

// ---------- DOM 引用 ----------
var langToggle = document.getElementById('langToggle');
var dateInput = document.getElementById('dateInput');
var todayBtn = document.getElementById('todayBtn');
var randomBtn = document.getElementById('randomBtn');
var stage = document.getElementById('stage');

// ---------- API ----------
var API_BASE = 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY';
var CACHE_PREFIX = 'cosmic-lens:apod:';

// ---------- 运行时状态 ----------
var lang = OK.lang;
var currentTodayDate = null; // NASA 认定的「今天」日期（首次加载时确定）
var currentApod = null;      // 当前展示的 APOD 数据
var viewState = 'loading';   // 'loading' | 'error' | 'ready'
var lastError = null;        // 最近一次错误信息

// ---------- 翻译辅助 ----------
function t(key) {
  return (copy[lang] && copy[lang][key]) || key;
}

// ---------- localStorage 安全读写（隐私模式下可能抛错） ----------
function cacheGet(date) {
  try {
    var raw = localStorage.getItem(CACHE_PREFIX + date);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function cacheSet(date, data) {
  try { localStorage.setItem(CACHE_PREFIX + date, JSON.stringify(data)); } catch (e) {}
}

// ---------- 日期工具：YYYY-MM-DD ----------
function toISO(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function isoToday() { return toISO(new Date()); }

// 按当前语言格式化日期
function formatDate(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ---------- 状态视图：加载 / 错误 ----------
function showLoading() {
  viewState = 'loading';
  stage.innerHTML =
    '<div class="state loading">' +
      '<span class="orbit" aria-hidden="true"></span>' +
      '<span>' + OK.escape(t('loading')) + '</span>' +
    '</div>';
}

function showError(message) {
  viewState = 'error';
  lastError = message || null;
  stage.innerHTML = '<div class="state error">' +
    OK.escape(message || t('error')) + '</div>';
}

// ---------- 渲染 APOD ----------
function renderApod(data) {
  currentApod = data;
  viewState = 'ready';
  if (!data) { showError(); return; }

  var isVideo = data.media_type === 'video';
  var title = OK.escape(data.title || '');
  var dateStr = OK.escape(data.date || '');
  var explanation = OK.escape(data.explanation || '');
  var copyright = data.copyright ? OK.escape(data.copyright) : '';
  var hdurl = data.hdurl || data.url || '';

  // 视频但缺地址：给出提示
  if (isVideo && !data.url) {
    showError(t('noVideo'));
    return;
  }

  var mediaHtml;
  if (isVideo) {
    // 视频：用 iframe 嵌入（YouTube 等）
    mediaHtml =
      '<div class="media-frame video">' +
        '<div class="video-wrap">' +
          '<iframe src="' + OK.escape(data.url) + '" title="' + title + '" ' +
            'loading="lazy" allowfullscreen ' +
            'allow="encrypted-media; picture-in-picture; fullscreen"></iframe>' +
        '</div>' +
        '<span class="media-tag">' + OK.escape(t('mediaTypeVideo')) + '</span>' +
      '</div>';
  } else {
    // 图片：点击在新窗口打开高清版（hdurl 缺失则回退到 url）
    mediaHtml =
      '<a class="media-frame image" href="' + OK.escape(hdurl) + '" target="_blank" rel="noreferrer" ' +
        'aria-label="' + title + ' — ' + OK.escape(t('viewHD')) + '">' +
        '<img class="apod-img" src="' + OK.escape(data.url) + '" alt="' + title + '" loading="lazy" />' +
        '<span class="hd-badge">' + OK.escape(t('viewHD')) + ' ↗</span>' +
        '<span class="media-tag">' + OK.escape(t('mediaTypeImage')) + '</span>' +
      '</a>';
  }

  var copyrightHtml = copyright
    ? '<p class="apod-copyright"><span class="copy-label">' + OK.escape(t('copyright')) +
      '</span>' + copyright + '</p>'
    : '';

  stage.innerHTML =
    '<figure class="apod ' + (isVideo ? 'is-video' : 'is-image') + '">' +
      mediaHtml +
      '<figcaption class="apod-meta">' +
        '<div class="meta-top">' +
          '<h2 class="apod-title">' + title + '</h2>' +
          '<time class="apod-date" datetime="' + dateStr + '">' + formatDate(data.date) + '</time>' +
        '</div>' +
        copyrightHtml +
      '</figcaption>' +
    '</figure>' +
    '<section class="explanation-card">' +
      '<h3 class="explanation-title" data-ok-i18n="explanationTitle">' +
        OK.escape(t('explanationTitle')) + '</h3>' +
      '<p class="explanation-text">' + explanation + '</p>' +
    '</section>';
}

// ---------- 获取 APOD ----------
// 按日期获取：优先读缓存，否则请求 API 并缓存
function loadByDate(date) {
  if (!date) { loadToday(); return; }
  var cached = cacheGet(date);
  if (cached) {
    renderApod(cached);
    return;
  }
  showLoading();
  return OK.fetchJSON(API_BASE + '&date=' + encodeURIComponent(date), { timeout: 15000 })
    .then(function (data) {
      // APOD 错误响应形如 { code: 404, msg: "..." }
      if (data && data.code) throw new Error(data.msg || 'API error');
      cacheSet(date, data);
      renderApod(data);
    })
    .catch(function (err) {
      console.warn('APOD fetch by date failed:', err);
      showError();
    });
}

// 获取「今天」（不带 date 参数，由 NASA 决定今天）
function loadToday() {
  // 已知今天的日期且命中缓存：直接复用
  if (currentTodayDate) {
    var cached = cacheGet(currentTodayDate);
    if (cached) {
      dateInput.value = currentTodayDate;
      renderApod(cached);
      return;
    }
  }
  showLoading();
  return OK.fetchJSON(API_BASE, { timeout: 15000 })
    .then(function (data) {
      if (data && data.code) throw new Error(data.msg || 'API error');
      currentTodayDate = data.date;
      cacheSet(data.date, data);
      dateInput.value = data.date;
      dateInput.max = data.date;
      renderApod(data);
    })
    .catch(function (err) {
      console.warn('APOD fetch today failed:', err);
      showError();
    });
}

// 随机探索：count=1；结果按其日期缓存以便日后回访
function loadRandom() {
  showLoading();
  return OK.fetchJSON(API_BASE + '&count=1', { timeout: 15000 })
    .then(function (resp) {
      // count 接口返回数组
      var data = Array.isArray(resp) ? resp[0] : resp;
      if (!data) throw new Error('empty response');
      if (data.code) throw new Error(data.msg || 'API error');
      if (data.date) { cacheSet(data.date, data); }
      // 同步日期输入框（仅当该日期可选取）
      if (data.date && currentTodayDate && data.date <= currentTodayDate) {
        dateInput.value = data.date;
      }
      renderApod(data);
    })
    .catch(function (err) {
      console.warn('APOD random fetch failed:', err);
      showError();
    });
}

// ---------- 事件绑定 ----------
dateInput.addEventListener('change', function () {
  if (dateInput.value) loadByDate(dateInput.value);
});

todayBtn.addEventListener('click', function () {
  if (currentTodayDate) {
    dateInput.value = currentTodayDate;
    loadByDate(currentTodayDate);
  } else {
    loadToday();
  }
});

randomBtn.addEventListener('click', loadRandom);

// ---------- 语言应用 ----------
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 按当前视图重渲染动态内容
  if (viewState === 'ready' && currentApod) {
    renderApod(currentApod);
  } else if (viewState === 'loading') {
    showLoading();
  } else if (viewState === 'error') {
    showError(lastError);
  }
}

// ---------- 启动 ----------
// 脚本位于 body 末尾，DOM 已就绪。初始化日期输入范围后加载数据。
dateInput.max = isoToday();
dateInput.value = isoToday();
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
loadToday();
