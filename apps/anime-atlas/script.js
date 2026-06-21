/* ============================================================
   Anime Atlas — 动画图鉴
   数据来源：Jikan API（MyAnimeList 非官方 API，免费公开，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'Jikan · Anime Explorer',
      title: 'Anime Atlas',
      lead: 'Search anime by title or browse top-ranked titles from MyAnimeList.',
      search: 'Search',
      topRated: 'Top Rated',
      airing: 'Airing Now',
      loading: 'Loading…',
      empty: 'No anime found.',
      fetchError: 'Failed to load anime.',
      dataSource: 'Data: Jikan / MyAnimeList',
      allProjects: 'All projects ↗',
      searchPlaceholder: 'Search anime…',
      score: 'Score',
      episodes: 'Episodes',
      status: 'Status',
      aired: 'Aired',
      synopsis: 'Synopsis',
      viewOnMal: 'View on MAL ↗',
      unknown: 'Unknown',
    },
    zh: {
      eyebrow: 'Jikan · 动画图鉴',
      title: 'Anime Atlas',
      lead: '按标题搜索动画，或浏览 MyAnimeList 高分榜单。',
      search: '搜索',
      topRated: '高分榜单',
      airing: '正在连载',
      loading: '加载中…',
      empty: '没有找到动画。',
      fetchError: '动画加载失败。',
      dataSource: '数据：Jikan / MyAnimeList',
      allProjects: '全部项目 ↗',
      searchPlaceholder: '搜索动画…',
      score: '评分',
      episodes: '集数',
      status: '状态',
      aired: '播出时间',
      synopsis: '简介',
      viewOnMal: '在 MAL 查看 ↗',
      unknown: '未知',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://api.jikan.moe/v4';

  // ---------- DOM 引用 ----------
  var langBtn, searchForm, searchInput, topBtn, airingBtn, statusInfo,
      loadingRow, animeGrid, emptyState, errorState,
      detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var currentList = [];

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    searchInput.placeholder = t('searchPlaceholder') || 'Search anime…';
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function setStatusInfo(text) {
    statusInfo.textContent = text || '';
  }

  // ---------- API 调用 ----------
  function fetchJSON(path) {
    return OK.fetchJSON(API_BASE + path, { timeout: 15000 });
  }

  function searchAnime(q) {
    if (!q.trim()) return loadTopAnime();
    setLoading(true);
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    setStatusInfo(t('search') + ': ' + q);
    fetchJSON('/anime?q=' + encodeURIComponent(q) + '&limit=12&sfw=true')
      .then(function (data) {
        setLoading(false);
        currentList = (data.data || []).map(normalizeAnime);
        renderGrid();
      })
      .catch(function (err) {
        setLoading(false);
        errorState.style.display = '';
        console.warn('Search failed:', err);
      });
  }

  function loadTopAnime() {
    setLoading(true);
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    setStatusInfo(t('topRated'));
    fetchJSON('/top/anime?limit=12')
      .then(function (data) {
        setLoading(false);
        currentList = (data.data || []).map(normalizeAnime);
        renderGrid();
      })
      .catch(function (err) {
        setLoading(false);
        errorState.style.display = '';
        console.warn('Top anime failed:', err);
      });
  }

  function loadAiring() {
    setLoading(true);
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    setStatusInfo(t('airing'));
    fetchJSON('/seasons/now?limit=12')
      .then(function (data) {
        setLoading(false);
        currentList = (data.data || []).map(normalizeAnime);
        renderGrid();
      })
      .catch(function (err) {
        setLoading(false);
        errorState.style.display = '';
        console.warn('Airing anime failed:', err);
      });
  }

  function loadDetail(id) {
    setLoading(true);
    fetchJSON('/anime/' + id + '/full')
      .then(function (data) {
        setLoading(false);
        openModal(normalizeAnime(data.data));
      })
      .catch(function (err) {
        setLoading(false);
        console.warn('Detail failed:', err);
      });
  }

  function normalizeAnime(d) {
    if (!d) return null;
    return {
      id: d.mal_id,
      title: d.title_english || d.title || d.title_japanese || t('unknown'),
      originalTitle: d.title_japanese || d.title || '',
      image: d.images && d.images.jpg && d.images.jpg.image_url,
      largeImage: d.images && d.images.jpg && d.images.jpg.large_image_url,
      score: d.score,
      episodes: d.episodes,
      status: d.status,
      aired: d.aired && d.aired.string,
      synopsis: d.synopsis || '',
      url: d.url,
      genres: (d.genres || []).map(function (g) { return g.name; }),
    };
  }

  // ---------- 渲染 ----------
  function renderGrid() {
    if (!currentList.length) {
      animeGrid.innerHTML = '';
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';
    animeGrid.innerHTML = currentList.map(function (a) {
      return '<article class="anime-card" data-id="' + a.id + '">' +
        '<img src="' + OK.escape(a.image || '') + '" alt="" loading="lazy" />' +
        '<div class="anime-card-body">' +
          '<div class="anime-card-title">' + OK.escape(a.title) + '</div>' +
          '<div class="anime-card-meta">' +
            '<span class="anime-score">★ ' + (a.score ? a.score.toFixed(2) : '—') + '</span>' +
            '<span>' + (a.episodes ? a.episodes + ' ep' : '') + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    animeGrid.querySelectorAll('.anime-card').forEach(function (card) {
      card.addEventListener('click', function () {
        loadDetail(parseInt(card.dataset.id, 10));
      });
    });
  }

  function openModal(anime) {
    var genresHtml = anime.genres.map(function (g) {
      return '<span class="genre-tag">' + OK.escape(g) + '</span>';
    }).join('');

    modalBody.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-poster"><img src="' + OK.escape(anime.largeImage || anime.image || '') + '" alt="" /></div>' +
        '<div class="modal-title-wrap">' +
          '<h2 class="modal-title">' + OK.escape(anime.title) + '</h2>' +
          (anime.originalTitle && anime.originalTitle !== anime.title ? '<div class="modal-meta">' + OK.escape(anime.originalTitle) + '</div>' : '') +
          '<div class="modal-score">★ ' + t('score') + ' ' + (anime.score ? anime.score.toFixed(2) : '—') + ' · ' + (anime.episodes ? anime.episodes + ' ' + t('episodes') : '—') + '</div>' +
          '<div class="modal-genres">' + (genresHtml || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>' + t('synopsis') + '</h3>' +
        '<p class="modal-synopsis">' + OK.escape(anime.synopsis || t('unknown')) + '</p>' +
        '<a class="modal-link" href="' + OK.escape(anime.url || '') + '" target="_blank" rel="noopener">' + t('viewOnMal') + '</a>' +
      '</div>';

    detailModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    detailModal.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    searchForm = document.getElementById('searchForm');
    searchInput = document.getElementById('searchInput');
    topBtn = document.getElementById('topBtn');
    airingBtn = document.getElementById('airingBtn');
    statusInfo = document.getElementById('statusInfo');
    loadingRow = document.getElementById('loadingRow');
    animeGrid = document.getElementById('animeGrid');
    emptyState = document.getElementById('emptyState');
    errorState = document.getElementById('errorState');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    loadTopAnime();

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      searchAnime(searchInput.value);
    });

    topBtn.addEventListener('click', loadTopAnime);
    airingBtn.addEventListener('click', loadAiring);

    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });
  });
})();
