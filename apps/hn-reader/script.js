// ============================================================
// HN Reader — Hacker News 阅读器
// 数据源：Hacker News Firebase API（公开、免费、支持 CORS）
// ============================================================

(function () {
  'use strict';

  var API = 'https://hacker-news.firebaseio.com/v0';

  // 各标签页对应的 stories 端点
  var ENDPOINTS = {
    top: '/topstories.json',
    best: '/beststories.json',
    new: '/newstories.json',
    ask: '/askstories.json',
    show: '/showstories.json',
    job: '/jobstories.json'
  };

  var PAGE_SIZE = 20;

  // i18n 文案字典
  var copy = {
    en: {
      eyebrow: 'Hacker News reader',
      title: 'HN Reader',
      lead: 'A compact feed of what Hacker News is reading right now.',
      top: 'Top',
      best: 'Best',
      new: 'New',
      ask: 'Ask HN',
      show: 'Show HN',
      jobs: 'Jobs',
      loading: 'Loading stories…',
      loadingMore: 'Loading more…',
      error: 'Failed to load stories. Check your connection and try again.',
      empty: 'No stories in this feed.',
      end: '— end of feed —',
      points: 'pts',
      by: 'by',
      comments: 'comments',
      comment: 'comment',
      noComments: 'discuss',
      justNow: 'just now',
      minuteAgo: 'm ago',
      hourAgo: 'h ago',
      dayAgo: 'd ago',
      monthAgo: 'mo ago'
    },
    zh: {
      eyebrow: 'Hacker News 阅读器',
      title: 'HN Reader',
      lead: '紧凑呈现 Hacker News 此刻正在阅读的内容。',
      top: '热门',
      best: '最佳',
      new: '最新',
      ask: 'Ask HN',
      show: 'Show HN',
      jobs: '招聘',
      loading: '正在加载文章…',
      loadingMore: '加载更多…',
      error: '加载失败，请检查网络后重试。',
      empty: '该分类下暂无文章。',
      end: '— 已到底部 —',
      points: '分',
      by: '作者',
      comments: '评论',
      comment: '评论',
      noComments: '讨论',
      justNow: '刚刚',
      minuteAgo: '分钟前',
      hourAgo: '小时前',
      dayAgo: '天前',
      monthAgo: '个月前'
    }
  };

  // DOM 引用
  var tabsEl = document.getElementById('tabs');
  var statusEl = document.getElementById('status');
  var listEl = document.getElementById('list');
  var sentinelEl = document.getElementById('sentinel');
  var langToggle = document.getElementById('langToggle');

  // 应用状态
  var currentTab = 'top';
  var idsCache = {};        // 每个标签页的 id 列表缓存
  var loadedItems = [];     // 当前已加载的 item（含 null 占位）
  var loading = false;
  var finished = false;

  function t(key) { return OK.t(key, copy); }

  // ---------- 工具函数 ----------

  // 相对时间：time 为 Unix 秒
  function relativeTime(time) {
    var diff = Math.max(0, (Date.now() / 1000) - (time || 0));
    if (diff < 60) return t('justNow');
    if (diff < 3600) return Math.floor(diff / 60) + t('minuteAgo');
    if (diff < 86400) return Math.floor(diff / 3600) + t('hourAgo');
    if (diff < 2592000) return Math.floor(diff / 86400) + t('dayAgo');
    return Math.floor(diff / 2592000) + t('monthAgo');
  }

  // 从 url 提取域名（去掉 www. 前缀）
  function domainFrom(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  // 评论数文案
  function commentsLabel(c) {
    if (!c) return t('noComments');
    return c + ' ' + (c === 1 ? t('comment') : t('comments'));
  }

  // 安全渲染 text 字段（HTML）：
  // 先用 OK.escape 全量转义杜绝 XSS，再恢复受控的基本标签（p / a / 基本格式）。
  // 链接仅允许 http/https 协议，阻止 javascript:/data: 等危险协议。
  function sanitizeText(html) {
    if (!html) return '';
    var s = OK.escape(html);
    // 恢复段落
    s = s.replace(/&lt;p&gt;/g, '<p>').replace(/&lt;\/p&gt;/g, '</p>');
    // 恢复基本格式标签
    s = s.replace(/&lt;(\/?)(i|b|em|strong|code|pre)&gt;/g, '<$1$2>');
    // 恢复链接：href 中的 &amp;/&#39; 还原后校验协议
    s = s.replace(/&lt;a\s+href=&quot;(.*?)&quot;&gt;/g, function (m, raw) {
      var url = raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
      if (!/^https?:\/\//i.test(url)) return '';
      return '<a href="' + url + '" target="_blank" rel="noreferrer noopener">';
    });
    s = s.replace(/&lt;\/a&gt;/g, '</a>');
    return s;
  }

  // 渲染单条文章
  function renderRow(item, rank) {
    var hasUrl = !!item.url;
    var hasText = !!item.text;
    var hnUrl = 'https://news.ycombinator.com/item?id=' + item.id;
    var domain = hasUrl ? domainFrom(item.url) : '';
    var score = item.score || 0;
    var by = item.by || '';
    var descendants = item.descendants || 0;
    var time = item.time || 0;

    // 标题区：有 url → 外链；否则若为文字帖 → 可展开按钮；否则链接到原帖
    var titleHtml;
    if (hasUrl) {
      titleHtml = '<a class="title" href="' + OK.escape(item.url) + '" target="_blank" rel="noreferrer noopener">' + OK.escape(item.title) + '</a>';
    } else if (hasText) {
      titleHtml = '<button class="title-toggle" type="button" aria-expanded="false" data-id="' + OK.escape(item.id) + '">' +
        '<span class="caret">\u25B8</span>' + OK.escape(item.title) + '</button>';
    } else {
      titleHtml = '<a class="title" href="' + OK.escape(hnUrl) + '" target="_blank" rel="noreferrer">' + OK.escape(item.title) + '</a>';
    }

    var domainHtml = domain ? '<span class="domain">(' + OK.escape(domain) + ')</span>' : '';
    var commentsHtml = '<a class="comments" href="' + OK.escape(hnUrl) + '" target="_blank" rel="noreferrer">' + OK.escape(commentsLabel(descendants)) + '</a>';
    // 文字帖内容容器：text 经 sanitizeText 安全渲染后预置，默认隐藏
    var contentHtml = hasText
      ? '<div class="content" id="content-' + OK.escape(item.id) + '" hidden>' + sanitizeText(item.text) + '</div>'
      : '';

    return '' +
      '<article class="row" data-id="' + OK.escape(item.id) + '">' +
        '<span class="rank">' + rank + '</span>' +
        '<div class="main">' +
          '<div class="title-line">' + titleHtml + domainHtml + '</div>' +
          '<div class="meta">' +
            '<span class="score">' + score + ' ' + t('points') + '</span>' +
            '<span class="dot">·</span>' +
            '<span class="by">' + t('by') + ' ' + OK.escape(by) + '</span>' +
            '<span class="dot">·</span>' +
            '<span class="time" data-time="' + time + '">' + relativeTime(time) + '</span>' +
            '<span class="dot">·</span>' +
            commentsHtml +
          '</div>' +
          contentHtml +
        '</div>' +
      '</article>';
  }

  // ---------- 数据加载 ----------

  // 获取某个标签页的全部 id（带缓存）
  function getIds(tab) {
    if (idsCache[tab]) return Promise.resolve(idsCache[tab]);
    return OK.fetchJSON(API + ENDPOINTS[tab]).then(function (ids) {
      idsCache[tab] = ids || [];
      return idsCache[tab];
    });
  }

  // 并发拉取一批 item 详情（限制并发数避免瞬时大量请求）
  function fetchItems(ids) {
    var concurrency = 8;
    var results = new Array(ids.length);
    var i = 0;
    function next() {
      if (i >= ids.length) return Promise.resolve();
      var idx = i++;
      return OK.fetchJSON(API + '/item/' + ids[idx] + '.json')
        .then(function (item) { results[idx] = item; })
        .catch(function () { results[idx] = null; })
        .then(next);
    }
    var workers = [];
    for (var w = 0; w < concurrency; w++) workers.push(next());
    return Promise.all(workers).then(function () { return results; });
  }

  // 加载下一页（每次 PAGE_SIZE 条）
  function loadNext() {
    if (loading || finished) return Promise.resolve();
    loading = true;

    if (loadedItems.length === 0) {
      statusEl.innerHTML = '<span class="spinner"></span><span>' + t('loading') + '</span>';
      listEl.innerHTML = '';
    } else {
      statusEl.innerHTML = '<span class="spinner"></span><span>' + t('loadingMore') + '</span>';
    }

    return getIds(currentTab).then(function (ids) {
      if (!ids.length) {
        listEl.innerHTML = '<p class="empty">' + t('empty') + '</p>';
        statusEl.innerHTML = '';
        finished = true;
        loading = false;
        return;
      }
      var start = loadedItems.length;
      var slice = ids.slice(start, start + PAGE_SIZE);
      if (!slice.length) {
        finished = true;
        loading = false;
        renderEnd();
        return;
      }
      return fetchItems(slice).then(function (items) {
        for (var k = 0; k < items.length; k++) loadedItems.push(items[k]);
        loading = false;
        if (loadedItems.length >= ids.length) finished = true;

        // 追加新行，保留已有展开状态
        removeEnd();
        var html = '';
        for (var j = 0; j < items.length; j++) {
          if (items[j]) html += renderRow(items[j], start + j + 1);
        }
        listEl.insertAdjacentHTML('beforeend', html);
        bindRowEvents();
        renderEnd();
        renderStatusCount();
      });
    }).catch(function () {
      loading = false;
      statusEl.innerHTML = '<p class="error-msg">' + t('error') + '</p>';
    });
  }

  // ---------- 渲染辅助 ----------

  function renderEnd() {
    removeEnd();
    if (!loadedItems.length) return;
    var el = document.createElement('div');
    el.className = 'end-msg';
    el.id = 'endMsg';
    el.textContent = t('end');
    listEl.appendChild(el);
  }

  function removeEnd() {
    var e = document.getElementById('endMsg');
    if (e) e.remove();
  }

  // 显示已加载 / 总数计数
  function renderStatusCount() {
    var ids = idsCache[currentTab] || [];
    if (loadedItems.length && ids.length) {
      statusEl.innerHTML = '<span>' + loadedItems.length + ' / ' + ids.length + '</span>';
    }
  }

  // 绑定文字帖展开/折叠
  function bindRowEvents() {
    var toggles = listEl.querySelectorAll('.title-toggle:not([data-bound])');
    toggles.forEach(function (btn) {
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var content = document.getElementById('content-' + id);
        if (!content) return;
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        content.hidden = expanded;
        btn.setAttribute('aria-expanded', String(!expanded));
      });
    });
  }

  // 语言切换后用新语言重渲染已加载内容
  function rerenderLoaded() {
    if (!loadedItems.length) return;
    removeEnd();
    var html = '';
    for (var i = 0; i < loadedItems.length; i++) {
      if (loadedItems[i]) html += renderRow(loadedItems[i], i + 1);
    }
    listEl.innerHTML = html;
    renderEnd();
    renderStatusCount();
    bindRowEvents();
  }

  function applyLanguage() {
    OK.applyI18n(copy);
    rerenderLoaded();
  }

  // 切换标签页
  function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;
    loadedItems = [];
    finished = false;
    loading = false;
    listEl.innerHTML = '';
    statusEl.innerHTML = '';
    loadNext();
  }

  // 无限滚动：观察哨兵元素
  function setupObserver() {
    if (!('IntersectionObserver' in window)) {
      // 降级：滚动监听
      window.addEventListener('scroll', function () {
        var rect = sentinelEl.getBoundingClientRect();
        if (rect.top < window.innerHeight + 400) loadNext();
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) loadNext();
    }, { rootMargin: '400px' });
    io.observe(sentinelEl);
  }

  // 每分钟刷新相对时间，避免时间显示陈旧
  function setupClock() {
    setInterval(function () {
      var spans = listEl.querySelectorAll('.time[data-time]');
      spans.forEach(function (s) {
        var time = parseInt(s.getAttribute('data-time'), 10);
        if (time) s.textContent = relativeTime(time);
      });
    }, 60000);
  }

  // ---------- 事件绑定 ----------

  tabsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    tabsEl.querySelectorAll('.tab').forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    switchTab(btn.getAttribute('data-tab'));
  });

  // ---------- 初始化 ----------

  OK.ready(function () {
    OK.applyI18n(copy);                       // 按存储的语言同步静态文案
    OK.initLangToggle(langToggle, copy, applyLanguage);
    setupObserver();
    setupClock();
    loadNext();
  });
})();
