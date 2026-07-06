/* ============================================================
   Star Wars Archive — 星战档案
   数据来源：SWAPI（免费公开 API，支持 CORS）
   功能：三标签（角色/星球/星舰）+ 搜索 + 分页 + 详情弹窗 + 中英 i18n
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'SWAPI · Galactic Archive',
      title: 'Star Wars Archive',
      lead: 'Search the galaxy for legendary characters, distant planets, and iconic starships. Data from the Star Wars API.',
      tabPeople: 'Characters',
      tabPlanets: 'Planets',
      tabStarships: 'Starships',
      search: 'Search',
      clear: 'Clear',
      loading: 'Loading…',
      empty: 'No results found in this galaxy.',
      prev: '← Prev',
      next: 'Next →',
      searchPlaceholderPeople: 'Search characters…',
      searchPlaceholderPlanets: 'Search planets…',
      searchPlaceholderStarships: 'Search starships…',
      dataSource: 'Data: SWAPI (swapi.dev)',
      allProjects: 'All projects ↗',
      fetchError: 'Failed to reach the SWAPI. Check your connection and try again.',
      pageOf: 'Page {page} · {count} records',
      // 卡片副字段标签
      cardGender: 'Gender',
      cardBirth: 'Birth year',
      cardPopulation: 'Population',
      cardClimate: 'Climate',
      cardModel: 'Model',
      cardCrew: 'Crew',
      // 详情分类标签
      detailPeople: 'Character',
      detailPlanets: 'Planet',
      detailStarships: 'Starship',
      attributes: 'Attributes',
      homeworld: 'Homeworld',
      homeworldLoading: 'Locating homeworld…',
      homeworldFailed: 'Unknown homeworld',
      // 字段标签
      f_height: 'Height',
      f_mass: 'Mass',
      f_hair_color: 'Hair color',
      f_skin_color: 'Skin color',
      f_eye_color: 'Eye color',
      f_birth_year: 'Birth year',
      f_gender: 'Gender',
      f_name: 'Name',
      f_rotation_period: 'Rotation period',
      f_orbital_period: 'Orbital period',
      f_diameter: 'Diameter',
      f_climate: 'Climate',
      f_gravity: 'Gravity',
      f_terrain: 'Terrain',
      f_surface_water: 'Surface water',
      f_population: 'Population',
      f_model: 'Model',
      f_manufacturer: 'Manufacturer',
      f_cost_in_credits: 'Cost (credits)',
      f_length: 'Length',
      f_crew: 'Crew',
      f_passengers: 'Passengers',
      f_starship_class: 'Starship class',
      f_hyperdrive_rating: 'Hyperdrive rating',
      unknown: 'unknown',
      na: 'n/a'
    },
    zh: {
      eyebrow: 'SWAPI · 银河档案',
      title: '星战档案',
      lead: '在星河中搜寻传奇角色、遥远星球与经典星舰。数据来自 Star Wars API。',
      tabPeople: '角色',
      tabPlanets: '星球',
      tabStarships: '星舰',
      search: '搜索',
      clear: '清除',
      loading: '加载中…',
      empty: '在这片星河中没有找到结果。',
      prev: '← 上一页',
      next: '下一页 →',
      searchPlaceholderPeople: '搜索角色…',
      searchPlaceholderPlanets: '搜索星球…',
      searchPlaceholderStarships: '搜索星舰…',
      dataSource: '数据：SWAPI (swapi.dev)',
      allProjects: '全部项目 ↗',
      fetchError: '无法连接 SWAPI，请检查网络后重试。',
      pageOf: '第 {page} 页 · 共 {count} 条',
      cardGender: '性别',
      cardBirth: '出生年份',
      cardPopulation: '人口',
      cardClimate: '气候',
      cardModel: '型号',
      cardCrew: '乘员',
      detailPeople: '角色',
      detailPlanets: '星球',
      detailStarships: '星舰',
      attributes: '属性',
      homeworld: '母星',
      homeworldLoading: '正在定位母星…',
      homeworldFailed: '未知母星',
      f_height: '身高',
      f_mass: '体重',
      f_hair_color: '发色',
      f_skin_color: '肤色',
      f_eye_color: '眼色',
      f_birth_year: '出生年份',
      f_gender: '性别',
      f_name: '名称',
      f_rotation_period: '自转周期',
      f_orbital_period: '公转周期',
      f_diameter: '直径',
      f_climate: '气候',
      f_gravity: '重力',
      f_terrain: '地形',
      f_surface_water: '地表水',
      f_population: '人口',
      f_model: '型号',
      f_manufacturer: '制造商',
      f_cost_in_credits: '造价（信用点）',
      f_length: '长度',
      f_crew: '乘员',
      f_passengers: '乘客',
      f_starship_class: '舰级',
      f_hyperdrive_rating: '超空间引擎等级',
      unknown: '未知',
      na: '无'
    }
  };

  // ---------- API ----------
  var API_BASE = 'https://swapi.dev/api/';

  // 每个标签页的字段顺序（详情展示用）
  var TAB_FIELDS = {
    people: ['height', 'mass', 'hair_color', 'skin_color', 'eye_color', 'birth_year', 'gender'],
    planets: ['rotation_period', 'orbital_period', 'diameter', 'climate', 'gravity', 'terrain', 'surface_water', 'population'],
    starships: ['model', 'manufacturer', 'cost_in_credits', 'length', 'crew', 'passengers', 'starship_class', 'hyperdrive_rating']
  };

  // 卡片副字段：[字段名, 文案 key]
  var CARD_META = {
    people: [['gender', 'cardGender'], ['birth_year', 'cardBirth']],
    planets: [['population', 'cardPopulation'], ['climate', 'cardClimate']],
    starships: [['model', 'cardModel'], ['crew', 'cardCrew']]
  };

  // ---------- DOM 引用 ----------
  var langBtn, tabsEl, tabBtns, tabIndicator, searchForm, searchInput, clearBtn,
      prevBtn, nextBtn, pageInfo, loadingRow, grid, emptyState, errorBox,
      detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var currentTab = 'people';
  var nextUrl = null;
  var prevUrl = null;
  var totalCount = 0;
  var pageNum = 1;
  var lastQuery = '';
  var currentResults = [];
  var hasLoaded = false;

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function applyLanguage() {
    OK.applyI18n(copy);
    searchInput.placeholder = t('searchPlaceholder' + cap(currentTab));
    renderGrid();
    updatePageInfo();
    if (tabIndicator) moveIndicator();
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = '';
  }
  function clearError() { errorBox.style.display = 'none'; }

  // 规整展示值：空值显示为 n/a 文案
  function fmt(value) {
    if (value == null || value === '') return t('na');
    return String(value);
  }

  // 判断是否为「未知/无」类弱化值
  function isMuted(value) {
    var s = String(value == null ? '' : value).toLowerCase();
    return s === 'n/a' || s === 'unknown' || s === '';
  }

  // 移动标签指示器到当前激活标签下方
  function moveIndicator() {
    var active = tabsEl.querySelector('.tab.active');
    if (!active) return;
    tabIndicator.style.width = active.offsetWidth + 'px';
    tabIndicator.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }

  // 从 SWAPI 的 next/previous URL 中解析页码
  function pageFromUrl(url) {
    if (!url) return 1;
    var m = url.match(/[?&]page=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  // ---------- 数据加载 ----------
  function buildUrl(query) {
    var url = API_BASE + currentTab + '/?page=1';
    if (query) url += '&search=' + encodeURIComponent(query);
    return url;
  }

  function reload() {
    pageNum = 1;
    loadUrl(buildUrl(lastQuery));
  }

  function loadUrl(url) {
    setLoading(true);
    clearError();
    emptyState.style.display = 'none';
    OK.fetchJSON(url, { timeout: 15000 }).then(function (data) {
      nextUrl = data.next || null;
      prevUrl = data.previous || null;
      totalCount = data.count || 0;
      currentResults = data.results || [];
      hasLoaded = true;
      setLoading(false);
      updatePager();
      renderGrid();
    }).catch(function (err) {
      setLoading(false);
      currentResults = [];
      hasLoaded = true;
      updatePager();
      renderGrid();
      showError(t('fetchError'));
      console.warn('SWAPI load failed:', err);
    });
  }

  function updatePager() {
    prevBtn.disabled = !prevUrl;
    nextBtn.disabled = !nextUrl;
    updatePageInfo();
  }

  function updatePageInfo() {
    if (totalCount === 0) {
      pageInfo.textContent = '';
      return;
    }
    pageInfo.textContent = t('pageOf')
      .replace('{page}', pageNum)
      .replace('{count}', totalCount);
  }

  // ---------- 渲染：卡片网格 ----------
  function renderGrid() {
    if (!currentResults.length) {
      grid.innerHTML = '';
      // 仅在已加载过数据后展示空状态，避免初次加载闪烁
      emptyState.style.display = hasLoaded ? '' : 'none';
      return;
    }
    emptyState.style.display = 'none';

    grid.innerHTML = currentResults.map(function (item, i) {
      var metaHtml = (CARD_META[currentTab] || []).map(function (pair) {
        var key = pair[0], labelKey = pair[1];
        return '<div class="sw-card-meta-row">' +
          '<span class="sw-card-meta-label">' + OK.escape(t(labelKey)) + '</span>' +
          '<b>' + OK.escape(fmt(item[key])) + '</b>' +
          '</div>';
      }).join('');

      return '<article class="sw-card" data-kind="' + currentTab + '" ' +
        'style="animation-delay:' + (i * 40) + 'ms" ' +
        'data-url="' + OK.escape(item.url || '') + '" tabindex="0" role="button">' +
        '<div class="sw-card-kicker">' + OK.escape(t('detail' + cap(currentTab))) + '</div>' +
        '<div class="sw-card-name">' + OK.escape(item.name || '') + '</div>' +
        '<div class="sw-card-meta">' + metaHtml + '</div>' +
        '</article>';
    }).join('');

    Array.prototype.forEach.call(grid.querySelectorAll('.sw-card'), function (card) {
      var url = card.getAttribute('data-url');
      card.addEventListener('click', function () { openDetail(url); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(url);
        }
      });
    });
  }

  // ---------- 详情弹窗 ----------
  function openDetail(url) {
    if (!url) return;
    // 先以 loading 状态打开弹窗
    modalBody.innerHTML =
      '<div class="modal-head"><div class="modal-kicker">' +
      OK.escape(t('loading')) + '</div></div>';
    detailModal.hidden = false;
    document.body.style.overflow = 'hidden';

    OK.fetchJSON(url, { timeout: 15000 }).then(function (data) {
      renderDetail(data);
    }).catch(function (err) {
      modalBody.innerHTML =
        '<div class="modal-head"><div class="modal-kicker">' +
        OK.escape(t('fetchError')) + '</div></div>';
      console.warn('Detail load failed:', err);
    });
  }

  function renderDetail(data) {
    var kicker = t('detail' + cap(currentTab));
    var fields = TAB_FIELDS[currentTab] || [];

    var attrsHtml = fields.map(function (key) {
      var val = data[key];
      var mutedClass = isMuted(val) ? ' muted' : '';
      return '<div class="attr">' +
        '<span class="attr-label">' + OK.escape(t('f_' + key)) + '</span>' +
        '<span class="attr-value' + mutedClass + '">' + OK.escape(fmt(val)) + '</span>' +
        '</div>';
    }).join('');

    // 角色需额外展示母星名称（先占位，再异步请求）
    var homeworldHtml = '';
    if (currentTab === 'people' && data.homeworld) {
      homeworldHtml = '<div class="homeworld-link">' +
        OK.escape(t('homeworld')) + ': <span id="homeworldName">' +
        OK.escape(t('homeworldLoading')) + '</span></div>';
    }

    modalBody.innerHTML =
      '<div class="modal-head">' +
        '<div class="modal-kicker">' + OK.escape(kicker) + '</div>' +
        '<h2 class="modal-title">' + OK.escape(data.name || '') + '</h2>' +
        homeworldHtml +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>' + OK.escape(t('attributes')) + '</h3>' +
        '<div class="attr-list">' + attrsHtml + '</div>' +
      '</div>';

    // 异步请求母星名称
    if (currentTab === 'people' && data.homeworld) {
      var box = document.getElementById('homeworldName');
      OK.fetchJSON(data.homeworld, { timeout: 15000 }).then(function (planet) {
        if (box) box.innerHTML = '<b>' + OK.escape(planet.name || '') + '</b>';
      }).catch(function () {
        if (box) box.textContent = t('homeworldFailed');
      });
    }
  }

  function closeModal() {
    detailModal.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- 标签切换 ----------
  function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;
    lastQuery = '';
    searchInput.value = '';
    pageNum = 1;
    Array.prototype.forEach.call(tabBtns, function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    moveIndicator();
    searchInput.placeholder = t('searchPlaceholder' + cap(tab));
    reload();
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    tabsEl = document.querySelector('.tabs');
    tabBtns = document.querySelectorAll('.tab');
    tabIndicator = document.querySelector('.tab-indicator');
    searchForm = document.getElementById('searchForm');
    searchInput = document.getElementById('searchInput');
    clearBtn = document.getElementById('clearBtn');
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    pageInfo = document.getElementById('pageInfo');
    loadingRow = document.getElementById('loadingRow');
    grid = document.getElementById('grid');
    emptyState = document.getElementById('emptyState');
    errorBox = document.getElementById('errorBox');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();

    // 字体/布局稳定后校准指示器
    requestAnimationFrame(function () {
      moveIndicator();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(moveIndicator);
      }
    });
    window.addEventListener('resize', moveIndicator);

    Array.prototype.forEach.call(tabBtns, function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      lastQuery = searchInput.value.trim();
      pageNum = 1;
      loadUrl(buildUrl(lastQuery));
    });

    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      lastQuery = '';
      pageNum = 1;
      loadUrl(buildUrl(''));
    });

    prevBtn.addEventListener('click', function () {
      if (!prevUrl) return;
      pageNum = pageFromUrl(prevUrl);
      loadUrl(prevUrl);
    });
    nextBtn.addEventListener('click', function () {
      if (!nextUrl) return;
      pageNum = pageFromUrl(nextUrl);
      loadUrl(nextUrl);
    });

    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });

    // 首次加载默认标签首页
    reload();
  });
})();
