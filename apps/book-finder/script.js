/* ============================================================
   Book Finder — 图书搜索器
   数据源：Open Library Search API
   ============================================================ */

/* ---------- DOM 引用 ---------- */
var langToggle = document.getElementById('langToggle');
var searchInput = document.getElementById('searchInput');
var searchBtn = document.getElementById('searchBtn');
var resultCount = document.getElementById('resultCount');
var suggestions = document.getElementById('suggestions');
var suggestionChips = document.getElementById('suggestionChips');
var loading = document.getElementById('loading');
var errorBox = document.getElementById('errorBox');
var errorMsg = document.getElementById('errorMsg');
var retryBtn = document.getElementById('retryBtn');
var results = document.getElementById('results');
var empty = document.getElementById('empty');
var loadMoreWrap = document.getElementById('loadMoreWrap');
var loadMoreBtn = document.getElementById('loadMoreBtn');
var endText = document.getElementById('endText');
var drawer = document.getElementById('drawer');
var detailBody = document.getElementById('detailBody');

/* ---------- 配置 ---------- */
var API = 'https://openlibrary.org/search.json';
var COVER = 'https://covers.openlibrary.org/b/id/';
var WORKS = 'https://openlibrary.org';
var PAGE = 12;

/* 热门搜索建议词 */
var SUGGESTIONS = [
  'fantasy', 'science fiction', 'history', 'philosophy', 'mystery',
  'biography', 'poetry', 'cooking', 'art', 'travel'
];

/* 建议词的展示文案（中英） */
var SUGGESTION_LABELS = {
  'fantasy': { en: 'Fantasy', zh: '奇幻' },
  'science fiction': { en: 'Science Fiction', zh: '科幻' },
  'history': { en: 'History', zh: '历史' },
  'philosophy': { en: 'Philosophy', zh: '哲学' },
  'mystery': { en: 'Mystery', zh: '悬疑' },
  'biography': { en: 'Biography', zh: '传记' },
  'poetry': { en: 'Poetry', zh: '诗歌' },
  'cooking': { en: 'Cooking', zh: '烹饪' },
  'art': { en: 'Art', zh: '艺术' },
  'travel': { en: 'Travel', zh: '旅行' }
};

/* ---------- i18n 文案字典 ---------- */
var copy = {
  en: {
    eyebrow: 'Book discovery',
    title: 'Book Finder',
    lead: 'Search millions of titles from the Open Library catalog by title, author, or ISBN.',
    search: 'Search',
    searchPlaceholder: 'Search by title, author, ISBN…',
    suggestionsTitle: 'Popular searches',
    loading: 'Searching the shelves…',
    noResults: 'No books found. Try another keyword.',
    error: 'Could not reach Open Library. Please try again.',
    tryAgain: 'Try again',
    loadMore: 'Load more',
    loadingMore: 'Loading…',
    endOfResults: 'End of results',
    results: 'results',
    by: 'by',
    unknownAuthor: 'Unknown author',
    unknownYear: '—',
    firstPublished: 'First published',
    publisher: 'Publisher',
    pages: 'Pages',
    isbn: 'ISBN',
    subjects: 'Subjects',
    language: 'Language',
    description: 'Description',
    noDescription: 'No description available for this title.',
    viewOnOpenLibrary: 'View on Open Library',
    loadingDetails: 'Loading details…'
  },
  zh: {
    eyebrow: '图书发现',
    title: 'Book Finder',
    lead: '在 Open Library 海量目录中按书名、作者或 ISBN 搜索图书。',
    search: '搜索',
    searchPlaceholder: '按书名、作者、ISBN 搜索…',
    suggestionsTitle: '热门搜索',
    loading: '正在检索书架…',
    noResults: '没有找到相关图书，换个关键词试试。',
    error: '无法连接 Open Library，请稍后重试。',
    tryAgain: '重试',
    loadMore: '加载更多',
    loadingMore: '加载中…',
    endOfResults: '已显示全部结果',
    results: '条结果',
    by: '—',
    unknownAuthor: '佚名',
    unknownYear: '—',
    firstPublished: '首次出版',
    publisher: '出版社',
    pages: '页数',
    isbn: 'ISBN',
    subjects: '主题',
    language: '语言',
    description: '简介',
    noDescription: '暂无该书简介。',
    viewOnOpenLibrary: '在 Open Library 中查看',
    loadingDetails: '正在加载详情…'
  }
};

/* ---------- 状态 ---------- */
var lang = OK.lang;
var currentQuery = '';
var currentPage = 1;
var totalFound = 0;
var lastResults = null;   // 保存最近一次结果，便于语言切换后重渲染
var isLoading = false;

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

/* Open Library 语言代码 → 本地化名称 */
var LANG_NAMES = {
  eng: { en: 'English', zh: '英语' },
  zho: { en: 'Chinese', zh: '中文' },
  chi: { en: 'Chinese', zh: '中文' },
  spa: { en: 'Spanish', zh: '西班牙语' },
  fre: { en: 'French', zh: '法语' },
  fra: { en: 'French', zh: '法语' },
  ger: { en: 'German', zh: '德语' },
  deu: { en: 'German', zh: '德语' },
  jpn: { en: 'Japanese', zh: '日语' },
  rus: { en: 'Russian', zh: '俄语' },
  por: { en: 'Portuguese', zh: '葡萄牙语' },
  ita: { en: 'Italian', zh: '意大利语' },
  ara: { en: 'Arabic', zh: '阿拉伯语' },
  kor: { en: 'Korean', zh: '韩语' },
  lat: { en: 'Latin', zh: '拉丁语' }
};
function langName(code) {
  var e = LANG_NAMES[code];
  return e ? e[lang] : code;
}

/* ---------- 语言切换 ---------- */
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  searchInput.placeholder = lang === 'en' ? copy.en.searchPlaceholder : copy.zh.searchPlaceholder;
  renderSuggestions();
  if (lastResults) renderResults(lastResults);
  updateResultCount();
}

/* ---------- 热门建议渲染 ---------- */
function renderSuggestions() {
  var html = SUGGESTIONS.map(function (s) {
    var label = (SUGGESTION_LABELS[s] && SUGGESTION_LABELS[s][lang]) || s;
    return '<button class="chip" type="button" data-q="' + esc(s) +
      '" aria-label="' + esc(label) + '">' + esc(label) + '</button>';
  }).join('');
  suggestionChips.innerHTML = html;
  suggestionChips.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      searchInput.value = c.dataset.q;
      doSearch(true);
    });
  });
}

/* ---------- 搜索 ---------- */
function doSearch(reset) {
  var q = searchInput.value.trim();
  if (!q) return;
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
  suggestions.style.display = 'none';   // 搜索后隐藏建议区

  var url = API + '?q=' + encodeURIComponent(q) + '&limit=' + PAGE + '&page=' + currentPage;

  OK.fetchJSON(url).then(function (data) {
    totalFound = data.numFound || 0;
    lastResults = data.docs || [];
    renderResults(lastResults);
    updateResultCount();
  }).catch(function () {
    showError();
  }).then(function () {
    isLoading = false;
    hide(loading);
  });
}

/* 加载更多 */
function loadMore() {
  if (isLoading || !currentQuery) return;
  currentPage += 1;
  isLoading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = t('loadingMore');

  var url = API + '?q=' + encodeURIComponent(currentQuery) + '&limit=' + PAGE + '&page=' + currentPage;

  OK.fetchJSON(url).then(function (data) {
    var docs = data.docs || [];
    lastResults = (lastResults || []).concat(docs);
    appendResults(docs);
    updateResultCount();
  }).catch(function () {
    /* 加载更多失败时恢复按钮，便于重试 */
  }).then(function () {
    isLoading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = t('loadMore');
  });
}

/* ---------- 渲染 ---------- */

/* 拼接封面 URL */
function coverUrl(coverI, size) {
  return coverI ? COVER + coverI + '-' + size + '.jpg' : '';
}

/* 渲染单张书籍卡片 */
function renderCard(book) {
  var title = esc(book.title || '');
  var author = (book.author_name && book.author_name[0]) ? esc(book.author_name[0]) : t('unknownAuthor');
  var year = book.first_publish_year ? esc(book.first_publish_year) : '';
  var cover = coverUrl(book.cover_i, 'M');
  var coverHtml = cover
    ? '<img src="' + cover + '" alt="' + title + '" loading="lazy" onerror="this.remove()" />'
    : '';

  return '<article class="card" data-key="' + esc(book.key || '') +
    '" tabindex="0" role="button" aria-label="' + title + ' ' + t('by') + ' ' + author + '">' +
    '<div class="cover">' + coverHtml +
    '<div class="cover-placeholder" aria-hidden="true"></div></div>' +
    '<div class="card-meta">' +
    '<h3 class="card-title">' + title + '</h3>' +
    '<p class="card-author">' + author + '</p>' +
    (year ? '<p class="card-year">' + year + '</p>' : '') +
    '</div></article>';
}

/* 渲染整页结果 */
function renderResults(docs) {
  if (!docs || !docs.length) {
    results.innerHTML = '';
    show(empty);
    hide(loadMoreWrap);
    return;
  }
  hide(empty);
  results.innerHTML = docs.map(renderCard).join('');
  bindCards();

  /* 是否还有更多结果 */
  if (lastResults.length < totalFound) {
    show(loadMoreWrap);
    hide(endText);
    loadMoreBtn.textContent = t('loadMore');
  } else {
    hide(loadMoreWrap);
  }
}

/* 追加加载更多的结果 */
function appendResults(docs) {
  if (!docs.length) {
    hide(loadMoreWrap);
    show(endText);
    return;
  }
  results.insertAdjacentHTML('beforeend', docs.map(renderCard).join(''));
  bindCards();
  if ((lastResults || []).length >= totalFound) {
    hide(loadMoreWrap);
    show(endText);
  }
}

/* 给卡片绑定点击 / 键盘事件 */
function bindCards() {
  results.querySelectorAll('.card').forEach(function (card) {
    var key = card.dataset.key;
    var handler = function () { openDetail(key); };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

/* 更新结果计数 */
function updateResultCount() {
  if (!lastResults) { resultCount.textContent = ''; return; }
  resultCount.textContent = totalFound + ' ' + t('results');
}

/* ---------- 详情面板 ---------- */
function openDetail(key) {
  /* 从已保存结果中查找该书 */
  var book = (lastResults || []).find(function (b) { return b.key === key; }) || null;
  detailBody.innerHTML = renderDetailShell(book);
  openDrawer();

  if (!book) return;

  /* 异步拉取作品详情（简介等） */
  var descEl = detailBody.querySelector('#detailDescription');
  OK.fetchJSON(WORKS + book.key + '.json').then(function (work) {
    var desc = extractDescription(work.description);
    if (desc) {
      descEl.innerHTML = '<p>' + esc(desc) + '</p>';
    } else {
      descEl.innerHTML = '<p class="muted">' + t('noDescription') + '</p>';
    }
  }).catch(function () {
    descEl.innerHTML = '<p class="muted">' + t('noDescription') + '</p>';
  });
}

/* 提取简介文本（Open Library 的 description 可能是字符串或对象） */
function extractDescription(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (d.value) return d.value;
  return '';
}

/* 渲染详情面板骨架 */
function renderDetailShell(book) {
  if (!book) {
    return '<div class="detail-loading"><div class="spinner"></div><p>' + t('loadingDetails') + '</p></div>';
  }

  var title = esc(book.title || '');
  var author = (book.author_name && book.author_name[0]) ? esc(book.author_name[0]) : t('unknownAuthor');
  var year = book.first_publish_year ? esc(book.first_publish_year) : t('unknownYear');
  var cover = coverUrl(book.cover_i, 'L');
  var coverHtml = cover
    ? '<img src="' + cover + '" alt="' + title + '" onerror="this.remove()" />'
    : '';

  var publishers = (book.publisher && book.publisher.slice(0, 3).join(', ')) || '';
  var pages = book.number_of_pages_median ? book.number_of_pages_median : '';
  var isbn = (book.isbn && book.isbn[0]) ? esc(book.isbn[0]) : '';
  var subjects = (book.subject && book.subject.slice(0, 8)) || [];
  var languages = (book.language && book.language.slice(0, 3).map(langName).join(', ')) || '';
  var authorKey = (book.author_key && book.author_key[0]) || '';
  var authorPhoto = authorKey ? 'https://covers.openlibrary.org/a/olid/' + authorKey + '-M.jpg' : '';
  var authorPhotoHtml = authorPhoto
    ? '<img class="author-photo" src="' + authorPhoto + '" alt="" onerror="this.remove()" />'
    : '';
  var openLink = book.key ? 'https://openlibrary.org' + book.key : '';

  /* 元信息行 */
  var rows = [
    year ? row(t('firstPublished'), year) : '',
    publishers ? row(t('publisher'), esc(publishers)) : '',
    pages ? row(t('pages'), pages) : '',
    isbn ? row(t('isbn'), isbn) : '',
    languages ? row(t('language'), esc(languages)) : ''
  ].filter(Boolean).join('');

  var subjectsHtml = subjects.length
    ? '<div class="detail-subjects">' +
      subjects.map(function (s) { return '<span class="subject-tag">' + esc(s) + '</span>'; }).join('') +
      '</div>'
    : '';

  return '<div class="detail-head">' +
    '<div class="detail-cover">' + coverHtml +
    '<div class="cover-placeholder large" aria-hidden="true"></div></div>' +
    '<div class="detail-titles">' +
    '<h2 id="detailTitle" class="detail-title">' + title + '</h2>' +
    '<div class="detail-author">' + authorPhotoHtml +
    '<span>' + t('by') + ' ' + author + '</span></div>' +
    (rows ? '<div class="detail-rows">' + rows + '</div>' : '') +
    (openLink ? '<a class="detail-link" href="' + openLink + '" target="_blank" rel="noreferrer">' + t('viewOnOpenLibrary') + ' ↗</a>' : '') +
    '</div></div>' +
    '<div class="detail-section"><h3 class="detail-h">' + t('description') + '</h3>' +
    '<div id="detailDescription"><div class="detail-loading"><div class="spinner small"></div></div></div></div>' +
    (subjectsHtml ? '<div class="detail-section"><h3 class="detail-h">' + t('subjects') + '</h3>' + subjectsHtml + '</div>' : '');
}

/* 构造一行元信息 */
function row(label, value) {
  return '<div class="detail-row"><span class="detail-label">' + label + '</span><span>' + value + '</span></div>';
}

/* 打开 / 关闭抽屉 */
function openDrawer() {
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
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
retryBtn.addEventListener('click', function () { doSearch(true); });
loadMoreBtn.addEventListener('click', loadMore);

/* 抽屉关闭交互 */
drawer.querySelectorAll('[data-close]').forEach(function (el) {
  el.addEventListener('click', closeDrawer);
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
});

/* ---------- 初始化 ---------- */
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
