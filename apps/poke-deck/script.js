/* ============================================================
   Poké Deck — 宝可梦图鉴
   数据来源：PokéAPI（免费公开 API，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'PokéAPI · Pokémon Explorer',
      title: 'Poké Deck',
      lead: 'Search any Pokémon by name or ID, view stats, types, abilities, and flavor text from the PokéAPI.',
      search: 'Search',
      random: 'Random',
      allTypes: 'All types',
      loading: 'Loading…',
      empty: 'No Pokémon found.',
      prev: '← Prev',
      next: 'Next →',
      pageInfo: 'Page {page}',
      searchPlaceholder: 'Search Pokémon…',
      dataSource: 'Data: PokéAPI',
      allProjects: 'All projects ↗',
      fetchError: 'Failed to load Pokémon.',
      stats: 'Base Stats',
      abilities: 'Abilities',
      height: 'Height',
      weight: 'Weight',
      flavor: 'Flavor Text',
    },
    zh: {
      eyebrow: 'PokéAPI · 宝可梦图鉴',
      title: 'Poké Deck',
      lead: '按名称或编号搜索宝可梦，查看种族值、属性、特性和图鉴介绍。',
      search: '搜索',
      random: '随机',
      allTypes: '全部属性',
      loading: '加载中…',
      empty: '没有找到宝可梦。',
      prev: '← 上一页',
      next: '下一页 →',
      pageInfo: '第 {page} 页',
      dataSource: '数据：PokéAPI',
      allProjects: '全部项目 ↗',
      fetchError: '宝可梦加载失败。',
      stats: '种族值',
      abilities: '特性',
      height: '身高',
      weight: '体重',
      flavor: '图鉴介绍',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://pokeapi.co/api/v2';

  // ---------- 类型颜色 ----------
  var TYPE_COLORS = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
    steel: '#B7B7CE', fairy: '#D685AD'
  };

  // ---------- DOM 引用 ----------
  var langBtn, searchForm, searchInput, randomBtn, typeSelect,
      prevBtn, nextBtn, pageInfo, loadingRow, pokemonGrid, emptyState,
      detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var allPokemon = [];       // 完整列表（name + url）
  var currentList = [];      // 当前页显示的基础信息
  var currentPage = 0;
  var perPage = 20;
  var totalCount = 0;
  var typeFilter = '';

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    searchInput.placeholder = t('searchPlaceholder') || 'Search Pokémon…';
    renderGrid();
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function idFromUrl(url) {
    var m = url.match(/\/(\d+)\/?$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function padId(id) {
    return '#' + String(id).padStart(3, '0');
  }

  function typeBadge(type) {
    var color = TYPE_COLORS[type] || '#777';
    return '<span class="type-badge" style="background:' + color + '">' + OK.escape(type) + '</span>';
  }

  // ---------- API 调用 ----------
  function fetchJSON(path) {
    return OK.fetchJSON(API_BASE + path, { timeout: 15000 });
  }

  function init() {
    setLoading(true);
    Promise.all([
      fetchJSON('/pokemon?limit=10000&offset=0'),
      fetchJSON('/type'),
    ]).then(function (res) {
      allPokemon = (res[0].results || []).map(function (p) {
        return { name: p.name, url: p.url, id: idFromUrl(p.url) };
      });
      totalCount = res[0].count || allPokemon.length;

      var types = (res[1].results || []).map(function (t) { return t.name; });
      populateTypeSelect(types);

      currentPage = 0;
      loadPage();
    }).catch(function (err) {
      setLoading(false);
      emptyState.textContent = t('fetchError');
      emptyState.style.display = '';
      console.warn('PokéAPI init failed:', err);
    });
  }

  function populateTypeSelect(types) {
    var html = '<option value="">' + OK.escape(t('allTypes')) + '</option>';
    types.forEach(function (type) {
      html += '<option value="' + OK.escape(type) + '">' + OK.escape(type) + '</option>';
    });
    typeSelect.innerHTML = html;
  }

  function loadPage() {
    setLoading(true);
    emptyState.style.display = 'none';
    pokemonGrid.innerHTML = '';

    // 如果选择了属性，先通过 /type/{type} 拿到该属性的宝可梦列表
    var listPromise = typeFilter
      ? fetchJSON('/type/' + encodeURIComponent(typeFilter)).then(function (data) {
          return (data.pokemon || []).map(function (entry) {
            var p = entry.pokemon;
            return { name: p.name, url: p.url, id: idFromUrl(p.url) };
          });
        })
      : Promise.resolve(allPokemon);

    listPromise.then(function (filtered) {
      var start = currentPage * perPage;
      var pageItems = filtered.slice(start, start + perPage);

      // 并行获取当前页的详细数据
      return Promise.all(pageItems.map(function (p) {
        return fetchJSON('/pokemon/' + p.id);
      })).then(function (details) {
        currentList = details.map(normalizePokemon).filter(Boolean);
        setLoading(false);
        updatePageInfo(filtered.length);
        renderGrid();
      });
    }).catch(function (err) {
      setLoading(false);
      console.warn('Page load failed:', err);
    });
  }

  function normalizePokemon(d) {
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      sprite: d.sprites && (d.sprites.front_default || d.sprites.other['official-artwork'].front_default),
      types: (d.types || []).map(function (t) { return t.type.name; }),
      stats: (d.stats || []).map(function (s) { return { name: s.stat.name, value: s.base_stat }; }),
      abilities: (d.abilities || []).map(function (a) { return a.ability.name; }),
      height: d.height,
      weight: d.weight,
    };
  }

  function updatePageInfo(total) {
    var totalPages = Math.ceil(total / perPage) || 1;
    pageInfo.textContent = t('pageInfo').replace('{page}', (currentPage + 1) + ' / ' + totalPages);
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
  }

  // ---------- 渲染 ----------
  function renderGrid() {
    if (!currentList.length) {
      pokemonGrid.innerHTML = '';
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';
    pokemonGrid.innerHTML = currentList.map(function (p) {
      var typesHtml = p.types.map(typeBadge).join('');
      return '<article class="pokemon-card" data-id="' + p.id + '">' +
        '<img src="' + OK.escape(p.sprite || '') + '" alt="" loading="lazy" />' +
        '<div class="pokemon-card-id">' + padId(p.id) + '</div>' +
        '<div class="pokemon-card-name">' + OK.escape(p.name) + '</div>' +
        '<div class="pokemon-card-types">' + typesHtml + '</div>' +
        '</article>';
    }).join('');

    pokemonGrid.querySelectorAll('.pokemon-card').forEach(function (card) {
      card.addEventListener('click', function () {
        loadDetail(parseInt(card.dataset.id, 10));
      });
    });
  }

  // ---------- 搜索与筛选 ----------
  function searchPokemon(q) {
    var term = q.trim().toLowerCase();
    if (!term) {
      typeFilter = '';
      typeSelect.value = '';
      currentPage = 0;
      loadPage();
      return;
    }

    // 按名称或 ID 搜索
    var matched = allPokemon.filter(function (p) {
      return p.name.indexOf(term) !== -1 || String(p.id) === term;
    });

    if (!matched.length) {
      currentList = [];
      renderGrid();
      return;
    }

    setLoading(true);
    Promise.all(matched.slice(0, 12).map(function (p) {
      return fetchJSON('/pokemon/' + p.id);
    })).then(function (details) {
      currentList = details.map(normalizePokemon).filter(Boolean);
      setLoading(false);
      pageInfo.textContent = matched.length + ' results';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      renderGrid();
    }).catch(function (err) {
      setLoading(false);
      console.warn('Search failed:', err);
    });
  }

  function loadDetail(id) {
    setLoading(true);
    Promise.all([
      fetchJSON('/pokemon/' + id),
      fetchJSON('/pokemon-species/' + id),
    ]).then(function (res) {
      var detail = normalizePokemon(res[0]);
      var species = res[1];
      setLoading(false);
      if (detail) openModal(detail, species);
    }).catch(function (err) {
      setLoading(false);
      console.warn('Detail failed:', err);
    });
  }

  function randomPokemon() {
    var id = Math.floor(Math.random() * totalCount) + 1;
    loadDetail(id);
  }

  // ---------- 弹窗 ----------
  function openModal(pokemon, species) {
    var flavor = '';
    if (species && species.flavor_text_entries) {
      var entry = species.flavor_text_entries.find(function (e) {
        return e.language && (e.language.name === 'en' || e.language.name === 'zh');
      }) || species.flavor_text_entries[0];
      if (entry) flavor = entry.flavor_text.replace(/\s+/g, ' ');
    }

    var statsHtml = pokemon.stats.map(function (s) {
      return '<div class="stat-box">' +
        '<div class="stat-name">' + OK.escape(s.name.replace(/-/g, ' ')) + '</div>' +
        '<div class="stat-value">' + s.value + '</div>' +
        '</div>';
    }).join('');

    var abilitiesHtml = pokemon.abilities.map(function (a) {
      return '<span class="ability-tag">' + OK.escape(a.replace(/-/g, ' ')) + '</span>';
    }).join('');

    modalBody.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-sprite"><img src="' + OK.escape(pokemon.sprite || '') + '" alt="" /></div>' +
        '<div class="modal-title-wrap">' +
          '<div class="modal-id">' + padId(pokemon.id) + '</div>' +
          '<h2 class="modal-title">' + OK.escape(pokemon.name) + '</h2>' +
          '<div class="modal-types">' + pokemon.types.map(typeBadge).join('') + '</div>' +
          '<div class="modal-flavor">' + OK.escape(flavor) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>' + t('stats') + '</h3>' +
        '<div class="stats-grid">' + statsHtml + '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>' + t('abilities') + '</h3>' +
        '<div class="ability-list">' + abilitiesHtml + '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>' + t('height') + ' & ' + t('weight') + '</h3>' +
        '<p class="modal-flavor" style="font-style:normal;">' +
          t('height') + ': ' + (pokemon.height / 10) + ' m · ' +
          t('weight') + ': ' + (pokemon.weight / 10) + ' kg' +
        '</p>' +
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
    randomBtn = document.getElementById('randomBtn');
    typeSelect = document.getElementById('typeSelect');
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    pageInfo = document.getElementById('pageInfo');
    loadingRow = document.getElementById('loadingRow');
    pokemonGrid = document.getElementById('pokemonGrid');
    emptyState = document.getElementById('emptyState');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    init();

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      searchPokemon(searchInput.value);
    });

    randomBtn.addEventListener('click', randomPokemon);

    typeSelect.addEventListener('change', function () {
      typeFilter = typeSelect.value;
      currentPage = 0;
      loadPage();
    });

    prevBtn.addEventListener('click', function () {
      if (currentPage > 0) { currentPage--; loadPage(); }
    });

    nextBtn.addEventListener('click', function () {
      currentPage++;
      loadPage();
    });

    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });
  });
})();
