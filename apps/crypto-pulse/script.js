/* ============================================================
   Crypto Pulse — 加密货币实时行情看板
   数据源：CoinGecko 免费 API（支持 CORS，有限速约 10-30 次/分）
   - 市场数据缓存到 localStorage，60 秒过期，避免频繁请求
   - 收藏列表持久化到 localStorage，置顶显示
   - 中英文 i18n，共享 window.OK 工具
   ============================================================ */
(function () {
  'use strict';

  // ---------- i18n 文案字典 ----------
  var copy = {
    en: {
      eyebrow: 'Live crypto markets',
      title: 'Crypto Pulse',
      lead: 'Track top cryptocurrencies by market cap — real-time prices, 24h/7d changes, favorites, and detailed stats. Powered by CoinGecko.',
      updated: 'Updated',
      refreshing: 'Refreshing…',
      loading: 'Loading markets…',
      error: 'Failed to load market data. CoinGecko free API may be rate-limited — please wait a moment and retry.',
      searchPlaceholder: 'Search by name or symbol…',
      colName: 'Name',
      colPrice: 'Price',
      col24h: '24h %',
      col7d: '7d %',
      colMcap: 'Market Cap',
      colVol: '24h Volume',
      results: 'coins',
      statCoins: 'Coins Tracked',
      statTotalMcap: 'Total Market Cap',
      statGainers: '24h Gainers',
      statLosers: '24h Losers',
      noResults: 'No coins match your search.',
      rank: 'Rank',
      detailMcap: 'Market Cap',
      detailVol24h: '24h Volume',
      detailHigh24h: '24h High',
      detailLow24h: '24h Low',
      detailChange24h: '24h Change',
      detailChange7d: '7d Change',
      detailAth: 'All-Time High',
      detailAthChange: 'ATH Distance',
      detailAtl: 'All-Time Low',
      detailCirculating: 'Circulating Supply',
      detailTotalSupply: 'Total Supply',
      detailSparkline: '7d Price Trend'
    },
    zh: {
      eyebrow: '实时加密货币行情',
      title: 'Crypto Pulse',
      lead: '追踪市值前列的加密货币：实时价格、24h/7d 涨跌、收藏与详细数据。数据由 CoinGecko 提供。',
      updated: '更新于',
      refreshing: '刷新中…',
      loading: '正在加载行情…',
      error: '加载行情数据失败。CoinGecko 免费 API 可能限流，请稍候再试。',
      searchPlaceholder: '按名称或代号搜索…',
      colName: '名称',
      colPrice: '价格',
      col24h: '24h %',
      col7d: '7d %',
      colMcap: '市值',
      colVol: '24h 成交量',
      results: '个币种',
      statCoins: '追踪币种',
      statTotalMcap: '总市值',
      statGainers: '24h 上涨',
      statLosers: '24h 下跌',
      noResults: '没有匹配的币种。',
      rank: '排名',
      detailMcap: '市值',
      detailVol24h: '24h 成交量',
      detailHigh24h: '24h 最高',
      detailLow24h: '24h 最低',
      detailChange24h: '24h 涨跌',
      detailChange7d: '7d 涨跌',
      detailAth: '历史最高',
      detailAthChange: '距历史最高',
      detailAtl: '历史最低',
      detailCirculating: '流通量',
      detailTotalSupply: '总供应量',
      detailSparkline: '7d 价格走势'
    }
  };

  function t(key) { return OK.t(key, copy); }

  // ---------- 常量 ----------
  var MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d';
  var CACHE_KEY = 'crypto-pulse-markets';
  var FAV_KEY = 'crypto-pulse-favorites';
  var CACHE_TTL = 60 * 1000; // 60 秒
  var REFRESH_INTERVAL = 60 * 1000; // 60 秒自动刷新

  // ---------- DOM 引用 ----------
  var elStats = document.getElementById('stats');
  var elCoinList = document.getElementById('coinList');
  var elSearch = document.getElementById('searchInput');
  var elCount = document.getElementById('countInfo');
  var elUpdatedAt = document.getElementById('updatedAt');
  var elRefresh = document.getElementById('refreshBtn');
  var elLangToggle = document.getElementById('langToggle');
  var elModal = document.getElementById('modal');
  var elModalBody = document.getElementById('modalBody');
  var elModalClose = document.getElementById('modalClose');
  var elThead = document.querySelector('.thead');

  // ---------- 状态 ----------
  var state = {
    coins: [],            // 原始币种数组
    favorites: loadFavorites(),
    sortKey: 'rank',      // 默认按市值排名
    sortDir: 'asc',
    query: '',
    refreshing: false
  };

  var refreshTimer = null;

  // ---------- localStorage 工具（隐私模式下安全读取） ----------
  function safeLocalStorage(getOrSet, key, value) {
    try {
      if (getOrSet === 'get') return localStorage.getItem(key);
      if (getOrSet === 'set') return localStorage.setItem(key, value);
      if (getOrSet === 'remove') return localStorage.removeItem(key);
    } catch (e) {}
    return null;
  }

  function loadFavorites() {
    var raw = safeLocalStorage('get', FAV_KEY);
    if (!raw) return {};
    try {
      var arr = JSON.parse(raw);
      var obj = {};
      for (var i = 0; i < arr.length; i++) obj[arr[i]] = true;
      return obj;
    } catch (e) { return {}; }
  }

  function saveFavorites() {
    safeLocalStorage('set', FAV_KEY, JSON.stringify(Object.keys(state.favorites)));
  }

  // ---------- 缓存读写 ----------
  function readCache() {
    var raw = safeLocalStorage('get', CACHE_KEY);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.ts && Date.now() - obj.ts < CACHE_TTL) return obj.data;
    } catch (e) {}
    return null;
  }

  function writeCache(data) {
    safeLocalStorage('set', CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
  }

  // ---------- 格式化 ----------
  function formatPrice(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 0.01) return '$' + n.toFixed(4);
    return '$' + n.toPrecision(4);
  }

  // 大数字缩写（带 $ 前缀，用于市值/成交量）
  function formatCompactUSD(n) {
    if (n == null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
  }

  // 供应量缩写（无 $ 前缀，附带 symbol）
  function formatSupply(n, symbol) {
    if (n == null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    var str;
    if (abs >= 1e12) str = (n / 1e12).toFixed(2) + 'T';
    else if (abs >= 1e9) str = (n / 1e9).toFixed(2) + 'B';
    else if (abs >= 1e6) str = (n / 1e6).toFixed(2) + 'M';
    else if (abs >= 1e3) str = (n / 1e3).toFixed(2) + 'K';
    else str = n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return str + (symbol ? ' ' + symbol.toUpperCase() : '');
  }

  function formatPct(n) {
    if (n == null || isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function pctClass(n) {
    if (n == null) return '';
    return n >= 0 ? 'up' : 'down';
  }

  function pctArrow(n) {
    if (n == null) return '';
    return n >= 0 ? '▲' : '▼';
  }

  // ---------- 数据加载 ----------
  function fetchMarkets(force) {
    if (state.refreshing) return Promise.resolve();
    state.refreshing = true;
    elRefresh.classList.add('spinning');

    // 先尝试命中缓存（非强制刷新时）
    var cached = force ? null : readCache();
    if (cached) {
      state.refreshing = false;
      elRefresh.classList.remove('spinning');
      state.coins = cached;
      renderAll();
      return Promise.resolve();
    }

    return OK.fetchJSON(MARKETS_URL, { timeout: 15000 })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Bad response');
        state.coins = data;
        writeCache(data);
        renderAll();
      })
      .catch(function (err) {
        // 失败时若已有旧数据，保留旧数据继续展示，仅提示
        if (state.coins.length === 0) {
          elCoinList.innerHTML = '<div class="error-box">' + OK.escape(t('error')) + '</div>';
          elCount.textContent = '';
        }
      })
      .then(function () {
        state.refreshing = false;
        elRefresh.classList.remove('spinning');
      });
  }

  // ---------- 排序与过滤 ----------
  function sortValue(key, c) {
    switch (key) {
      case 'rank': return c.market_cap_rank != null ? c.market_cap_rank : 9999;
      case 'price': return c.current_price || 0;
      case 'change24h': return c.price_change_percentage_24h != null ? c.price_change_percentage_24h : 0;
      case 'change7d': return c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency : 0;
      case 'mcap': return c.market_cap || 0;
      case 'volume': return c.total_volume || 0;
      default: return 0;
    }
  }

  function getVisibleCoins() {
    var q = state.query.trim().toLowerCase();
    var list = state.coins;
    if (q) {
      list = list.filter(function (c) {
        return (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
               (c.symbol && c.symbol.toLowerCase().indexOf(q) !== -1);
      });
    }
    // 排序
    var sorted = list.slice().sort(function (a, b) {
      var va = sortValue(state.sortKey, a);
      var vb = sortValue(state.sortKey, b);
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    if (state.sortDir === 'desc') sorted.reverse();
    // 收藏置顶：收藏组在前，每组内部保持当前排序
    var favs = sorted.filter(function (c) { return state.favorites[c.id]; });
    var rest = sorted.filter(function (c) { return !state.favorites[c.id]; });
    return favs.concat(rest);
  }

  // ---------- 渲染：统计 ----------
  function renderStats() {
    var coins = state.coins;
    if (!coins.length) { elStats.innerHTML = ''; return; }
    var totalMcap = 0, gainers = 0, losers = 0;
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      totalMcap += c.market_cap || 0;
      var ch = c.price_change_percentage_24h;
      if (ch != null) { if (ch >= 0) gainers++; else losers++; }
    }
    elStats.innerHTML =
      cell(t('statCoins'), String(coins.length), '') +
      cell(t('statTotalMcap'), formatCompactUSD(totalMcap), '') +
      cell(t('statGainers'), String(gainers), 'up') +
      cell(t('statLosers'), String(losers), 'down');
  }

  function cell(label, val, cls) {
    return '<div class="stat ' + cls + '">' +
      '<div class="s-label">' + OK.escape(label) + '</div>' +
      '<div class="s-val">' + OK.escape(val) + '</div>' +
      '</div>';
  }

  // ---------- 渲染：表格 ----------
  function renderList() {
    var coins = getVisibleCoins();
    elCount.textContent = coins.length + ' ' + t('results');

    if (state.coins.length === 0) {
      elCoinList.innerHTML = '<div class="state"><span class="spinner"></span><span>' + OK.escape(t('loading')) + '</span></div>';
      return;
    }
    if (coins.length === 0) {
      elCoinList.innerHTML = '<div class="state">' + OK.escape(t('noResults')) + '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      var isFav = !!state.favorites[c.id];
      var ch24 = c.price_change_percentage_24h;
      var ch7 = c.price_change_percentage_7d_in_currency;
      html +=
        '<div class="trow' + (isFav ? ' is-fav' : '') + '" data-id="' + OK.escape(c.id) + '" role="row" tabindex="0">' +
          '<span class="tcell"><button class="star-btn' + (isFav ? ' on' : '') + '" data-fav="' + OK.escape(c.id) + '" type="button" aria-label="Favorite" tabindex="-1">' + (isFav ? '★' : '☆') + '</button></span>' +
          '<span class="tcell tc-rank num">' + (c.market_cap_rank != null ? OK.escape(String(c.market_cap_rank)) : '—') + '</span>' +
          '<span class="tcell"><span class="coin-id">' +
            '<img class="coin-icon" src="' + OK.escape(c.image) + '" alt="" loading="lazy" />' +
            '<span class="coin-meta">' +
              '<span class="coin-name">' + OK.escape(c.name) + '</span>' +
              '<span class="coin-symbol">' + OK.escape(c.symbol) + '</span>' +
            '</span>' +
          '</span></span>' +
          '<span class="tcell tc-price"><span class="num">' + OK.escape(formatPrice(c.current_price)) + '</span></span>' +
          '<span class="tcell tc-24h"><span class="pct ' + pctClass(ch24) + '">' + OK.escape(formatPct(ch24)) + '</span></span>' +
          '<span class="tcell tc-7d"><span class="pct ' + pctClass(ch7) + '">' + OK.escape(formatPct(ch7)) + '</span></span>' +
          '<span class="tcell tc-mcap"><span class="num">' + OK.escape(formatCompactUSD(c.market_cap)) + '</span></span>' +
          '<span class="tcell tc-vol"><span class="num">' + OK.escape(formatCompactUSD(c.total_volume)) + '</span></span>' +
        '</div>';
    }
    elCoinList.innerHTML = html;
  }

  // ---------- 渲染：表头排序指示 ----------
  function renderThead() {
    var headers = elThead.querySelectorAll('.th.sortable');
    headers.forEach(function (th) {
      th.classList.remove('sorted', 'asc', 'desc');
      if (th.dataset.sort === state.sortKey) {
        th.classList.add('sorted', state.sortDir);
      }
    });
  }

  function renderAll() {
    renderStats();
    renderList();
    renderThead();
    var d = new Date();
    elUpdatedAt.textContent = t('updated') + ': ' + d.toLocaleTimeString(OK.lang === 'zh' ? 'zh-CN' : 'en-US');
  }

  // ---------- 详情弹窗 ----------
  function openDetail(id) {
    var c = null;
    for (var i = 0; i < state.coins.length; i++) {
      if (state.coins[i].id === id) { c = state.coins[i]; break; }
    }
    if (!c) return;

    var ch24 = c.price_change_percentage_24h;
    var ch7 = c.price_change_percentage_7d_in_currency;
    var spark = buildSpark(c.sparkline_in_currency && c.sparkline_in_currency.price, ch7);

    var dcellHTML = function (label, val, cls) {
      return '<div class="dcell"><span class="dc-label">' + OK.escape(label) + '</span>' +
        '<span class="dc-val ' + (cls || '') + '">' + OK.escape(val) + '</span></div>';
    };

    var html =
      '<div class="detail-head">' +
        '<img class="detail-icon" src="' + OK.escape(c.image) + '" alt="" />' +
        '<div class="detail-title">' +
          '<div><span class="detail-name">' + OK.escape(c.name) + '</span>' +
          '<span class="detail-symbol">' + OK.escape(c.symbol) + '</span></div>' +
          '<div class="detail-rank">' + OK.escape(t('rank') + ' #' + (c.market_cap_rank != null ? c.market_cap_rank : '—')) + '</div>' +
        '</div>' +
        '<div class="detail-price-block">' +
          '<div class="detail-price num">' + OK.escape(formatPrice(c.current_price)) + '</div>' +
          '<div class="detail-change ' + pctClass(ch24) + '">' + OK.escape(pctArrow(ch24) + ' ' + formatPct(ch24)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-grid">' +
        dcellHTML(t('detailMcap'), formatCompactUSD(c.market_cap)) +
        dcellHTML(t('detailVol24h'), formatCompactUSD(c.total_volume)) +
        dcellHTML(t('detailChange24h'), formatPct(ch24), pctClass(ch24)) +
        dcellHTML(t('detailChange7d'), formatPct(ch7), pctClass(ch7)) +
        dcellHTML(t('detailHigh24h'), formatPrice(c.high_24h)) +
        dcellHTML(t('detailLow24h'), formatPrice(c.low_24h)) +
        dcellHTML(t('detailAth'), formatPrice(c.ath)) +
        dcellHTML(t('detailAtl'), formatPrice(c.atl)) +
        dcellHTML(t('detailAthChange'), formatPct(c.ath_change_percentage), pctClass(c.ath_change_percentage)) +
        dcellHTML(t('detailCirculating'), formatSupply(c.circulating_supply, c.symbol)) +
        dcellHTML(t('detailTotalSupply'), formatSupply(c.total_supply, c.symbol)) +
      '</div>' +
      (spark ? '<div class="detail-spark-wrap"><div class="detail-spark-label">' + OK.escape(t('detailSparkline')) + '</div>' + spark + '</div>' : '');

    elModalBody.innerHTML = html;
    elModal.hidden = false;
    document.body.style.overflow = 'hidden';
    elModalClose.focus();
  }

  function closeModal() {
    elModal.hidden = true;
    document.body.style.overflow = '';
  }

  // 构建 7d 价格走势 SVG sparkline
  function buildSpark(prices, change) {
    if (!prices || prices.length < 2) return '';
    var w = 560, h = 64;
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < prices.length; i++) {
      if (prices[i] < min) min = prices[i];
      if (prices[i] > max) max = prices[i];
    }
    var range = max - min || 1;
    var step = w / (prices.length - 1);
    var pts = '';
    for (var j = 0; j < prices.length; j++) {
      var x = (j * step).toFixed(2);
      var y = (h - ((prices[j] - min) / range) * (h - 4) - 2).toFixed(2);
      pts += x + ',' + y + ' ';
    }
    var color = (change != null && change >= 0) ? '#22c55e' : '#ef4444';
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts.trim() + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />' +
      '</svg>';
  }

  // ---------- 收藏切换 ----------
  function toggleFavorite(id) {
    if (state.favorites[id]) delete state.favorites[id];
    else state.favorites[id] = true;
    saveFavorites();
    renderList();
  }

  // ---------- 事件绑定 ----------
  // 表头排序
  elThead.addEventListener('click', function (e) {
    var th = e.target.closest('.th.sortable');
    if (!th) return;
    var key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = (key === 'rank') ? 'asc' : 'desc';
    }
    renderList();
    renderThead();
  });
  elThead.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var th = e.target.closest('.th.sortable');
    if (!th) return;
    e.preventDefault();
    th.click();
  });

  // 搜索
  elSearch.addEventListener('input', function (e) {
    state.query = e.target.value;
    renderList();
  });

  // 列表点击：行打开详情，星标切换收藏
  elCoinList.addEventListener('click', function (e) {
    var starBtn = e.target.closest('.star-btn');
    if (starBtn) {
      e.stopPropagation();
      toggleFavorite(starBtn.dataset.fav);
      return;
    }
    var row = e.target.closest('.trow');
    if (row) openDetail(row.dataset.id);
  });
  elCoinList.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('.trow');
    if (!row) return;
    e.preventDefault();
    openDetail(row.dataset.id);
  });

  // 刷新
  elRefresh.addEventListener('click', function () {
    fetchMarkets(true);
  });

  // 弹窗关闭
  elModalClose.addEventListener('click', closeModal);
  elModal.addEventListener('click', function (e) {
    if (e.target === elModal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !elModal.hidden) closeModal();
  });

  // 语言切换
  function applyLanguage() {
    OK.applyI18n(copy);
    // 同步搜索框 placeholder
    elSearch.placeholder = t('searchPlaceholder');
    if (state.coins.length) renderAll();
  }
  OK.initLangToggle(elLangToggle, copy, applyLanguage);

  // ---------- 启动 ----------
  OK.ready(function () {
    applyLanguage();
    elCoinList.innerHTML = '<div class="state"><span class="spinner"></span><span>' + OK.escape(t('loading')) + '</span></div>';
    fetchMarkets(false);
    // 每 60 秒自动刷新
    refreshTimer = setInterval(function () { fetchMarkets(true); }, REFRESH_INTERVAL);
    // 页面隐藏时暂停轮询，可见时立即刷新（避免后台浪费配额）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) fetchMarkets(true);
    });
  });
})();
