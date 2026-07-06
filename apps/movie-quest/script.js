/* ============================================================
   Movie Quest — 电影搜索器
   数据源：OMDB (Open Movie Database) API，使用公开测试 key
   ============================================================ */

/* ---------- DOM 引用 ---------- */
var langToggle = document.getElementById('langToggle');
var searchInput = document.getElementById('searchInput');
var searchBtn = document.getElementById('searchBtn');
var typeToggle = document.querySelector('.type-toggle');
var resultCount = document.getElementById('resultCount');
var genreFilter = document.getElementById('genreFilter');
var genreChips = document.getElementById('genreChips');
var trendingSection = document.getElementById('trendingSection');
var trendingRow = document.getElementById('trendingRow');
var trendingLoading = document.getElementById('trendingLoading');
var loading = document.getElementById('loading');
var errorBox = document.getElementById('errorBox');
var errorMsg = document.getElementById('errorMsg');
var retryBtn = document.getElementById('retryBtn');
var resultsSection = document.getElementById('resultsSection');
var results = document.getElementById('results');
var empty = document.getElementById('empty');
var loadMoreWrap = document.getElementById('loadMoreWrap');
var loadMoreBtn = document.getElementById('loadMoreBtn');
var endText = document.getElementById('endText');
var modal = document.getElementById('modal');
var detailBody = document.getElementById('detailBody');

/* ---------- 配置 ---------- */
var API = 'https://www.omdbapi.com/';
var API_KEY = 'trilogy';   // 公开测试用 key

/* 热门电影 imdbID 列表（用于初始轮播，逐个拉取详情以获得评分/类型） */
var TRENDING_IDS = [
  'tt0111161', // The Shawshank Redemption
  'tt0468569', // The Dark Knight
  'tt1375666', // Inception
  'tt0133093', // The Matrix
  'tt0109830', // Forrest Gump
  'tt0120737', // The Lord of the Rings: The Fellowship of the Ring
  'tt0816692', // Interstellar
  'tt0114369', // Se7en
  'tt0137523', // Fight Club
  'tt0167260', // The Lord of the Rings: The Return of the King
  'tt0903747', // Breaking Bad (剧集)
  'tt0944947'  // Game of Thrones (剧集)
];

/* 类型筛选定义（match 用于匹配 OMDB 的 Genre 字段） */
var GENRES = [
  { key: 'all',       en: 'All',       zh: '全部', match: null },
  { key: 'action',    en: 'Action',    zh: '动作', match: /action/i },
  { key: 'comedy',    en: 'Comedy',    zh: '喜剧', match: /comedy/i },
  { key: 'scifi',     en: 'Sci-Fi',    zh: '科幻', match: /sci-?fi|science fiction/i },
  { key: 'horror',    en: 'Horror',    zh: '恐怖', match: /horror|thriller/i },
  { key: 'romance',   en: 'Romance',   zh: '爱情', match: /romance/i },
  { key: 'animation', en: 'Animation', zh: '动画', match: /animation/i },
  { key: 'drama',     en: 'Drama',     zh: '剧情', match: /drama/i },
  { key: 'crime',     en: 'Crime',     zh: '犯罪', match: /crime/i }
];

/* ---------- i18n 文案字典 ---------- */
var copy = {
  en: {
    eyebrow: 'Cinema discovery',
    title: 'Movie Quest',
    lead: 'Search movies and TV shows, browse what\u2019s trending, and open any title for ratings, plot, and cast.',
    search: 'Search',
    searchPlaceholder: 'Search a movie or TV show\u2026',
    typeAll: 'All',
    typeMovie: 'Movies',
    typeSeries: 'TV',
    genreTitle: 'Filter trending',
    trendingTitle: 'Trending now',
    loadingTrending: 'Loading trending\u2026',
    loading: 'Searching\u2026',
    noResults: 'No results. Try another keyword.',
    error: 'Could not reach the movie database. Please try again.',
    tryAgain: 'Try again',
    loadMore: 'Load more',
    loadingMore: 'Loading\u2026',
    endOfResults: 'End of results',
    results: 'results',
    resultsTitle: 'Search results',
    movie: 'Movie',
    series: 'TV',
    episode: 'Episode',
    released: 'Released',
    runtime: 'Runtime',
    rated: 'Rated',
    director: 'Director',
    actors: 'Cast',
    country: 'Country',
    language: 'Language',
    production: 'Studio',
    awards: 'Awards',
    plot: 'Plot',
    noPlot: 'No plot available for this title.',
    votes: 'votes',
    loadingDetails: 'Loading details\u2026',
    noTrendingMatch: 'No trending titles match this genre.',
    seasons: 'Seasons'
  },
  zh: {
    eyebrow: '电影发现',
    title: 'Movie Quest',
    lead: '搜索电影和电视剧，浏览热门影片，点开任意条目查看评分、剧情与演职人员。',
    search: '搜索',
    searchPlaceholder: '搜索电影或电视剧…',
    typeAll: '全部',
    typeMovie: '电影',
    typeSeries: '剧集',
    genreTitle: '筛选热门',
    trendingTitle: '正在热映',
    loadingTrending: '正在加载热门…',
    loading: '正在搜索…',
    noResults: '没有找到相关结果，换个关键词试试。',
    error: '无法连接电影数据库，请稍后重试。',
    tryAgain: '重试',
    loadMore: '加载更多',
    loadingMore: '加载中…',
    endOfResults: '已显示全部结果',
    results: '条结果',
    resultsTitle: '搜索结果',
    movie: '电影',
    series: '剧集',
    episode: '单集',
    released: '上映日期',
    runtime: '时长',
    rated: '分级',
    director: '导演',
    actors: '主演',
    country: '国家/地区',
    language: '语言',
    production: '制作公司',
    awards: '获奖',
    plot: '剧情简介',
    noPlot: '暂无该条目的剧情简介。',
    votes: '人评价',
    loadingDetails: '正在加载详情…',
    noTrendingMatch: '当前类型下没有热门影片。',
    seasons: '季数'
  }
};

/* ---------- 状态 ---------- */
var lang = OK.lang;
var currentQuery = '';
var currentPage = 1;
var currentType = 'all';   // 搜索媒体类型：all / movie / series
var totalFound = 0;
var lastResults = null;    // 最近一次搜索结果，便于语言切换后重渲染
var isLoading = false;
var trendingMovies = [];   // 热门完整详情列表
var activeGenre = 'all';
var detailCache = {};      // imdbID -> 详情，避免重复请求

/* ---------- 工具函数 ---------- */

/* 取翻译文案 */
function t(key) {
  return (copy[lang] && copy[lang][key]) || copy.en[key] || key;
}

/* 转义 HTML，防止 XSS */
function esc(str) { return OK.escape(str); }

/* 防抖 */
function debounce(fn, wait) {
  var timer;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

/* 显示 / 隐藏元素 */
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

/* 判断字段是否有效（OMDB 大量返回 "N/A"） */
function valid(v) {
  return v != null && v !== '' && v !== 'N/A';
}

/* 媒体类型本地化标签 */
function typeLabel(type) {
  if (type === 'series') return t('series');
  if (type === 'episode') return t('episode');
  return t('movie');
}

/* 判断电影是否匹配当前选中的类型 */
function matchesGenre(movie, genreKey) {
  if (genreKey === 'all') return true;
  var g = null;
  for (var i = 0; i < GENRES.length; i++) {
    if (GENRES[i].key === genreKey) { g = GENRES[i]; break; }
  }
  if (!g || !g.match) return true;
  return g.match.test(movie.Genre || '');
}

/* ---------- 语言切换 ---------- */
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  searchInput.placeholder = lang === 'en' ? copy.en.searchPlaceholder : copy.zh.searchPlaceholder;
  renderGenreChips();
  if (trendingMovies.length) renderTrending();
  if (lastResults) renderResults(lastResults);
  updateResultCount();
}

/* ---------- 类型筛选渲染 ---------- */
function renderGenreChips() {
  var html = GENRES.map(function (g) {
    var label = g[lang] || g.en;
    var active = g.key === activeGenre;
    return '<button class="chip' + (active ? ' active' : '') + '" type="button" data-genre="' +
      esc(g.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '" aria-label="' + esc(label) +
      '">' + esc(label) + '</button>';
  }).join('');
  genreChips.innerHTML = html;
  genreChips.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      activeGenre = c.dataset.genre;
      /* 切换激活态 */
      genreChips.querySelectorAll('.chip').forEach(function (x) {
        var on = x.dataset.genre === activeGenre;
        x.classList.toggle('active', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderTrending();
    });
  });
}

/* ---------- 热门轮播 ---------- */
function loadTrending() {
  show(trendingLoading);
  trendingRow.innerHTML = '';
  /* 逐个拉取详情，单个失败不影响整体 */
  var promises = TRENDING_IDS.map(function (id) {
    return OK.fetchJSON(API + '?i=' + id + '&apikey=' + API_KEY + '&plot=short')
      .then(function (d) { return (d && d.Response !== 'False') ? d : null; })
      .catch(function () { return null; });
  });
  Promise.all(promises).then(function (list) {
    trendingMovies = list.filter(function (m) { return m; });
    hide(trendingLoading);
    renderTrending();
  });
}

function renderTrending() {
  var filtered = trendingMovies.filter(function (m) {
    return matchesGenre(m, activeGenre);
  });
  if (!filtered.length) {
    trendingRow.innerHTML = '<p class="trending-empty">' + esc(t('noTrendingMatch')) + '</p>';
    return;
  }
  trendingRow.innerHTML = filtered.map(function (m) {
    /* 热门已有完整详情，直接传入评分 */
    return renderCard(m, m.imdbRating);
  }).join('');
  bindCards(trendingRow);
}

/* ---------- 搜索 ---------- */
function doSearch(reset) {
  var q = searchInput.value.trim();
  /* 输入为空时恢复热门视图 */
  if (!q) {
    restoreTrendingView();
    return;
  }
  if (isLoading) return;

  if (reset) {
    currentPage = 1;
    results.innerHTML = '';
  }

  currentQuery = q;
  lastResults = null;
  isLoading = true;
  hide(empty);
  hide(errorBox);
  show(loading);
  hide(loadMoreWrap);
  hide(endText);
  /* 搜索时隐藏热门与类型筛选 */
  hide(trendingSection);
  hide(genreFilter);
  show(resultsSection);

  var typeParam = currentType && currentType !== 'all' ? '&type=' + currentType : '';
  var url = API + '?s=' + encodeURIComponent(q) + '&apikey=' + API_KEY +
    '&page=' + currentPage + typeParam;

  OK.fetchJSON(url).then(function (data) {
    if (data.Response === 'False') {
      totalFound = 0;
      lastResults = [];
      renderResults([]);
    } else {
      totalFound = parseInt(data.totalResults || '0', 10);
      lastResults = data.Search || [];
      renderResults(lastResults);
    }
    updateResultCount();
  }).catch(function () {
    showError();
  }).then(function () {
    isLoading = false;
    hide(loading);
  });
}

/* 恢复热门视图（搜索框清空时） */
function restoreTrendingView() {
  currentQuery = '';
  lastResults = null;
  hide(resultsSection);
  hide(empty);
  hide(errorBox);
  hide(loadMoreWrap);
  hide(loading);
  resultCount.textContent = '';
  show(trendingSection);
  show(genreFilter);
}

/* 加载更多 */
function loadMore() {
  if (isLoading || !currentQuery) return;
  currentPage += 1;
  isLoading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = t('loadingMore');

  var typeParam = currentType && currentType !== 'all' ? '&type=' + currentType : '';
  var url = API + '?s=' + encodeURIComponent(currentQuery) + '&apikey=' + API_KEY +
    '&page=' + currentPage + typeParam;

  OK.fetchJSON(url).then(function (data) {
    if (data.Response === 'False') {
      hide(loadMoreWrap);
      show(endText);
    } else {
      var items = data.Search || [];
      lastResults = (lastResults || []).concat(items);
      appendResults(items);
      updateResultCount();
    }
  }).catch(function () {
    /* 加载更多失败时恢复按钮，便于重试 */
  }).then(function () {
    isLoading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = t('loadMore');
  });
}

/* ---------- 渲染 ---------- */

/* 渲染单张海报卡片。rating 为已知评分；undefined 表示需懒加载 */
function renderCard(item, rating) {
  var title = esc(item.Title || '');
  var year = esc(item.Year || '');
  var type = item.Type || 'movie';
  var poster = valid(item.Poster) ? item.Poster : '';
  var imgHtml = poster
    ? '<img src="' + esc(poster) + '" alt="' + title + '" loading="lazy" data-fallback="remove" />'
    : '';

  /* 评分徽章：已知则直接显示，未知则占位等待懒加载 */
  var ratingHtml = '';
  if (valid(rating)) {
    ratingHtml = '<span class="rating-badge">\u2605 ' + esc(rating) + '</span>';
  } else if (rating === undefined) {
    ratingHtml = '<span class="rating-badge rating-pending" data-rating-for="' + esc(item.imdbID) + '"></span>';
  }

  return '<article class="card" data-id="' + esc(item.imdbID) + '" tabindex="0" role="button" aria-label="' +
    title + (year ? ' ' + year : '') + '">' +
    '<div class="poster">' +
    '<div class="poster-placeholder" aria-hidden="true"></div>' +
    imgHtml +
    ratingHtml +
    '<span class="type-badge">' + esc(typeLabel(type)) + '</span>' +
    '</div>' +
    '<div class="card-meta">' +
    '<h3 class="card-title">' + title + '</h3>' +
    (year ? '<p class="card-year">' + year + '</p>' : '') +
    '</div></article>';
}

/* 渲染整页搜索结果 */
function renderResults(items) {
  if (!items || !items.length) {
    results.innerHTML = '';
    show(empty);
    hide(loadMoreWrap);
    return;
  }
  hide(empty);
  results.innerHTML = items.map(function (item) {
    return renderCard(item, undefined);   /* 评分懒加载 */
  }).join('');
  bindCards(results);
  /* 为每张卡片懒加载评分 */
  items.forEach(function (item) {
    if (item.imdbID) fetchRatingForCard(item.imdbID);
  });
  /* 是否还有更多结果 */
  if ((lastResults || []).length < totalFound) {
    show(loadMoreWrap);
    hide(endText);
    loadMoreBtn.textContent = t('loadMore');
  } else {
    hide(loadMoreWrap);
  }
}

/* 追加加载更多的结果 */
function appendResults(items) {
  if (!items.length) {
    hide(loadMoreWrap);
    show(endText);
    return;
  }
  results.insertAdjacentHTML('beforeend', items.map(function (item) {
    return renderCard(item, undefined);
  }).join(''));
  bindCards(results);
  items.forEach(function (item) {
    if (item.imdbID) fetchRatingForCard(item.imdbID);
  });
  if ((lastResults || []).length >= totalFound) {
    hide(loadMoreWrap);
    show(endText);
  }
}

/* 给指定容器内的卡片绑定点击 / 键盘事件 */
function bindCards(container) {
  container.querySelectorAll('.card').forEach(function (card) {
    var id = card.dataset.id;
    var handler = function () { openDetail(id); };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
  // 图片加载失败时移除（替代内联 onerror）
  container.querySelectorAll('img[data-fallback="remove"]').forEach(function (img) {
    img.onerror = function () { this.remove(); };
  });
}

/* 懒加载某张卡片的评分并回填徽章 */
function fetchRatingForCard(imdbID) {
  OK.fetchJSON(API + '?i=' + imdbID + '&apikey=' + API_KEY + '&plot=short')
    .then(function (d) {
      if (!d || d.Response === 'False') return;
      detailCache[imdbID] = d;
      var badge = document.querySelector('[data-rating-for="' + imdbID + '"]');
      if (badge && valid(d.imdbRating)) {
        badge.innerHTML = '\u2605 ' + esc(d.imdbRating);
        badge.classList.remove('rating-pending');
      }
    })
    .catch(function () { /* 评分加载失败时静默，徽章保持隐藏 */ });
}

/* 更新结果计数 */
function updateResultCount() {
  if (!lastResults) { resultCount.textContent = ''; return; }
  resultCount.textContent = totalFound + ' ' + t('results');
}

/* ---------- 详情模态框 ---------- */
function openDetail(imdbID) {
  /* 先展示加载骨架 */
  detailBody.innerHTML = renderDetailShell();
  openModal();

  /* 命中缓存则先渲染，再后台刷新完整剧情 */
  if (detailCache[imdbID]) {
    detailBody.innerHTML = renderDetail(detailCache[imdbID]);
    bindDetailImages();
  }

  OK.fetchJSON(API + '?i=' + imdbID + '&apikey=' + API_KEY + '&plot=full')
    .then(function (d) {
      if (d && d.Response !== 'False') {
        detailCache[imdbID] = d;
        detailBody.innerHTML = renderDetail(d);
        bindDetailImages();
      } else {
        detailBody.innerHTML = '<p class="detail-plot muted">' + esc(t('noPlot')) + '</p>';
      }
    })
    .catch(function () {
      detailBody.innerHTML = '<p class="detail-plot muted">' + esc(t('error')) + '</p>';
    });
}

/* 详情面板图片加载失败时移除 */
function bindDetailImages() {
  detailBody.querySelectorAll('img[data-fallback="remove"]').forEach(function (img) {
    img.onerror = function () { this.remove(); };
  });
}

/* 详情加载骨架 */
function renderDetailShell() {
  return '<div class="detail-loading"><div class="spinner"></div><p>' + esc(t('loadingDetails')) + '</p></div>';
}

/* 渲染详情内容 */
function renderDetail(d) {
  var title = esc(d.Title || '');
  var year = esc(d.Year || '');
  var poster = valid(d.Poster) ? d.Poster : '';
  var imgHtml = poster
    ? '<img src="' + esc(poster) + '" alt="' + title + '" data-fallback="remove" />'
    : '';

  /* 评分 */
  var ratingHtml = '';
  if (valid(d.imdbRating)) {
    ratingHtml = '<div class="detail-rating">' +
      '<span class="star">\u2605</span>' +
      '<span class="rating-num">' + esc(d.imdbRating) + '</span>' +
      '<span class="rating-max">/10</span>' +
      (valid(d.imdbVotes) ? '<span class="rating-votes">' + esc(d.imdbVotes) + ' ' + esc(t('votes')) + '</span>' : '') +
      '</div>';
  }

  /* Metascore */
  var metascoreHtml = valid(d.Metascore)
    ? '<span class="metascore"><span class="ms-label">Metascore</span><span class="ms-val">' + esc(d.Metascore) + '</span></span>'
    : '';

  /* 类型标签 */
  var genreTags = '';
  if (valid(d.Genre)) {
    genreTags = '<div class="detail-genres">' +
      d.Genre.split(',').map(function (g) {
        return '<span class="genre-tag">' + esc(g.trim()) + '</span>';
      }).join('') +
      '</div>';
  }

  /* 元信息行 */
  var rows = [
    valid(d.Released) ? row(t('released'), esc(d.Released)) : '',
    valid(d.Runtime) ? row(t('runtime'), esc(d.Runtime)) : '',
    valid(d.Rated) ? row(t('rated'), esc(d.Rated)) : '',
    valid(d.totalSeasons) ? row(t('seasons'), esc(d.totalSeasons)) : '',
    valid(d.Director) ? row(t('director'), esc(d.Director)) : '',
    valid(d.Actors) ? row(t('actors'), esc(d.Actors)) : '',
    valid(d.Country) ? row(t('country'), esc(d.Country)) : '',
    valid(d.Language) ? row(t('language'), esc(d.Language)) : '',
    valid(d.Production) ? row(t('production'), esc(d.Production)) : '',
    valid(d.Awards) ? row(t('awards'), esc(d.Awards)) : ''
  ].filter(Boolean).join('');

  /* 剧情 */
  var plotHtml = valid(d.Plot)
    ? '<p class="detail-plot">' + esc(d.Plot) + '</p>'
    : '<p class="detail-plot muted">' + esc(t('noPlot')) + '</p>';

  return '<div class="detail-head">' +
    '<div class="detail-poster">' +
    '<div class="poster-placeholder large" aria-hidden="true"></div>' +
    imgHtml +
    '</div>' +
    '<div class="detail-info">' +
    '<h2 id="detailTitle" class="detail-title">' + title + '</h2>' +
    (year ? '<p class="detail-year">' + year + '</p>' : '') +
    ratingHtml +
    metascoreHtml +
    genreTags +
    '</div></div>' +
    (rows ? '<div class="detail-rows">' + rows + '</div>' : '') +
    '<div class="detail-section"><h3 class="detail-h">' + esc(t('plot')) + '</h3>' + plotHtml + '</div>';
}

/* 构造一行元信息 */
function row(label, value) {
  return '<div class="detail-row"><span class="detail-label">' + label +
    '</span><span class="detail-value">' + value + '</span></div>';
}

/* 打开 / 关闭模态框 */
function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ---------- 错误状态 ---------- */
function showError() {
  hide(loading);
  hide(empty);
  hide(loadMoreWrap);
  errorMsg.textContent = t('error');
  show(errorBox);
}

/* ---------- 事件绑定 ---------- */
var debouncedSearch = debounce(function () { doSearch(true); }, 300);

searchInput.addEventListener('input', debouncedSearch);
searchInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    doSearch(true);
  }
});
searchBtn.addEventListener('click', function () { doSearch(true); });
retryBtn.addEventListener('click', function () {
  /* 重试：若已有查询则重新搜索，否则重载热门 */
  if (currentQuery) { doSearch(true); }
  else { hide(errorBox); loadTrending(); }
});
loadMoreBtn.addEventListener('click', loadMore);

/* 媒体类型切换 */
typeToggle.querySelectorAll('.type-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    typeToggle.querySelectorAll('.type-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentType = btn.dataset.type;
    /* 若当前已有查询，则按新类型重新搜索 */
    if (searchInput.value.trim()) doSearch(true);
  });
});

/* 模态框关闭交互 */
modal.querySelectorAll('[data-close]').forEach(function (el) {
  el.addEventListener('click', closeModal);
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

/* ---------- 初始化 ---------- */
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
loadTrending();
