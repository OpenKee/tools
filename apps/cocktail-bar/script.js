/* ============================================================
   Cocktail Bar — 鸡尾酒配方搜索
   数据来源：TheCocktailDB（免费公开 API，无需 key，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'TheCocktailDB · Mixology',
      title: 'Cocktail Bar',
      lead: 'Search hundreds of cocktail recipes. Browse by category, look up a name, or shake things up with a random pick.',
      searchPlaceholder: 'Search cocktails…',
      search: 'Search',
      random: 'Random',
      allCategories: 'All categories',
      loading: 'Loading…',
      empty: 'No cocktails found.',
      ingredients: 'Ingredients',
      instructions: 'Instructions',
      category: 'Category',
      glass: 'Glass',
      type: 'Type',
      dataSource: 'Data: TheCocktailDB',
      allProjects: 'All projects ↗',
      fetchError: 'Failed to load cocktails.',
      countUnit: 'drinks'
    },
    zh: {
      eyebrow: 'TheCocktailDB · 调酒配方',
      title: '鸡尾酒酒吧',
      lead: '搜索数百款鸡尾酒配方。按分类浏览、按名称查找，或者随机来一杯。',
      searchPlaceholder: '搜索鸡尾酒…',
      search: '搜索',
      random: '随机',
      allCategories: '全部分类',
      loading: '加载中…',
      empty: '没有找到鸡尾酒。',
      ingredients: '材料',
      instructions: '做法',
      category: '分类',
      glass: '酒杯',
      type: '类型',
      dataSource: '数据：TheCocktailDB',
      allProjects: '全部项目 ↗',
      fetchError: '鸡尾酒加载失败。',
      countUnit: '款'
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

  // ---------- DOM 引用 ----------
  var langBtn, searchForm, searchInput, randomBtn, categorySelect,
      statusNote, loadingRow, drinkGrid, emptyState, detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var currentDrinks = [];     // 当前网格中的鸡尾酒列表
  var categories = [];        // 全部类别（来自 list.php?c=list）
  var activeCategory = '';    // 当前选中的类别（用于补全 filter.php 结果缺失的 strCategory）
  var currentDetail = null;   // 当前弹窗展示的鸡尾酒（用于语言切换后重渲染）

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    searchInput.placeholder = t('searchPlaceholder');
    // 重填类别下拉，保持当前选中
    populateSelect(categorySelect, categories, t('allCategories'));
    if (activeCategory) categorySelect.value = activeCategory;
    renderGrid();
    // 弹窗若打开，按当前语言重渲染
    if (detailModal && !detailModal.hidden && currentDetail) openModal(currentDetail);
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function setStatus(msg) {
    statusNote.textContent = msg || '';
  }

  // ---------- API 调用 ----------
  function fetchJSON(path) {
    return OK.fetchJSON(API_BASE + path, { timeout: 15000 });
  }

  // 将原始 drink 对象规范化；fallbackCategory 用于 filter.php 结果补全分类
  function normalizeDrink(d, fallbackCategory) {
    if (!d) return null;
    var ingredients = [];
    for (var i = 1; i <= 15; i++) {
      var ing = d['strIngredient' + i];
      var meas = d['strMeasure' + i];
      if (ing && String(ing).trim()) {
        ingredients.push({ name: String(ing).trim(), measure: (meas || '').trim() });
      }
    }
    return {
      id: d.idDrink,
      name: d.strDrink,
      thumb: d.strDrinkThumb,
      category: d.strCategory || fallbackCategory || '',
      alcoholic: d.strAlcoholic || '',
      glass: d.strGlass || '',
      instructions: d.strInstructions || '',
      ingredients: ingredients
    };
  }

  function normalizeCategories(data) {
    if (!data || !data.drinks) return [];
    return data.drinks.map(function (c) { return c.strCategory; }).filter(Boolean).sort();
  }

  // ---------- 初始化分类下拉 ----------
  function initCategories() {
    fetchJSON('/list.php?c=list')
      .then(function (data) {
        categories = normalizeCategories(data);
        populateSelect(categorySelect, categories, t('allCategories'));
        if (activeCategory) categorySelect.value = activeCategory;
      })
      .catch(function (err) {
        console.warn('Failed to load categories:', err);
      });
  }

  function populateSelect(select, list, defaultLabel) {
    var html = '<option value="">' + OK.escape(defaultLabel) + '</option>';
    list.forEach(function (item) {
      html += '<option value="' + OK.escape(item) + '">' + OK.escape(item) + '</option>';
    });
    select.innerHTML = html;
  }

  // ---------- 加载鸡尾酒 ----------
  function loadDrinks(path, fallbackCategory) {
    setLoading(true);
    emptyState.style.display = 'none';
    drinkGrid.innerHTML = '';
    fetchJSON(path)
      .then(function (data) {
        var drinks = (data && data.drinks) || [];
        currentDrinks = drinks.map(function (d) {
          return normalizeDrink(d, fallbackCategory);
        }).filter(Boolean);
        setLoading(false);
        setStatus(currentDrinks.length ? currentDrinks.length + ' ' + t('countUnit') : '');
        renderGrid();
      })
      .catch(function (err) {
        setLoading(false);
        currentDrinks = [];
        drinkGrid.innerHTML = '';
        setStatus(t('fetchError'));
        emptyState.style.display = '';
        console.warn('Cocktail load failed:', err);
      });
  }

  function searchByName(q) {
    activeCategory = '';
    categorySelect.value = '';
    // 空查询时按首字母 a 展示一批，避免空白初始页
    if (!q) return loadDrinks('/search.php?f=a');
    loadDrinks('/search.php?s=' + encodeURIComponent(q));
  }

  function filterByCategory(c) {
    activeCategory = c;
    // filter.php 仅返回 id/name/thumb，用 c 作为 fallback 分类
    loadDrinks('/filter.php?c=' + encodeURIComponent(c), c);
  }

  function randomDrink() {
    setLoading(true);
    fetchJSON('/random.php')
      .then(function (data) {
        var drinks = (data && data.drinks) || [];
        var drink = drinks.map(function (d) { return normalizeDrink(d); }).filter(Boolean)[0];
        setLoading(false);
        if (drink) {
          currentDrinks = [drink];
          setStatus('1 ' + t('countUnit'));
          renderGrid();
          openModal(drink);
        }
      })
      .catch(function (err) {
        setLoading(false);
        setStatus(t('fetchError'));
        console.warn('Random drink failed:', err);
      });
  }

  // 类别筛选结果只有摘要，点击卡片时用 lookup 取完整配方
  function loadDetail(id) {
    setLoading(true);
    fetchJSON('/lookup.php?i=' + encodeURIComponent(id))
      .then(function (data) {
        var drinks = (data && data.drinks) || [];
        var drink = drinks.map(function (d) {
          return normalizeDrink(d, activeCategory);
        }).filter(Boolean)[0];
        setLoading(false);
        if (drink) openModal(drink);
      })
      .catch(function (err) {
        setLoading(false);
        console.warn('Drink detail failed:', err);
      });
  }

  // ---------- 渲染卡片网格 ----------
  function renderGrid() {
    if (!currentDrinks.length) {
      drinkGrid.innerHTML = '';
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';
    drinkGrid.innerHTML = currentDrinks.map(function (d) {
      var meta = '';
      if (d.category) {
        meta += '<span class="drink-card-tag">' + OK.escape(d.category) + '</span>';
      }
      if (d.alcoholic) {
        meta += '<span class="drink-card-alcoholic">' + OK.escape(d.alcoholic) + '</span>';
      }
      return '<article class="drink-card" data-id="' + OK.escape(d.id) + '" tabindex="0">' +
        '<img src="' + OK.escape(d.thumb) + '" alt="' + OK.escape(d.name) + '" loading="lazy" />' +
        '<div class="drink-card-body">' +
        '<div class="drink-card-title">' + OK.escape(d.name) + '</div>' +
        '<div class="drink-card-meta">' + meta + '</div>' +
        '</div></article>';
    }).join('');

    drinkGrid.querySelectorAll('.drink-card').forEach(function (card) {
      card.addEventListener('click', function () {
        loadDetail(card.dataset.id);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadDetail(card.dataset.id);
        }
      });
    });
  }

  // ---------- 弹窗 ----------
  function buildMetaLine(drink) {
    var parts = [];
    if (drink.category) {
      parts.push('<span><strong>' + t('category') + ':</strong>' + OK.escape(drink.category) + '</span>');
    }
    if (drink.glass) {
      parts.push('<span><strong>' + t('glass') + ':</strong>' + OK.escape(drink.glass) + '</span>');
    }
    if (drink.alcoholic) {
      parts.push('<span><strong>' + t('type') + ':</strong>' + OK.escape(drink.alcoholic) + '</span>');
    }
    return parts.join('');
  }

  function buildIngredientsHtml(drink) {
    if (!drink.ingredients.length) return '<p class="instructions">—</p>';
    return '<ul class="ingredient-list">' + drink.ingredients.map(function (ing) {
      return '<li><span class="ing-name">' + OK.escape(ing.name) + '</span>' +
        (ing.measure ? '<span class="measure"> — ' + OK.escape(ing.measure) + '</span>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function openModal(drink) {
    currentDetail = drink;
    modalBody.innerHTML =
      '<div class="modal-hero"><img src="' + OK.escape(drink.thumb) + '" alt="' + OK.escape(drink.name) + '" /></div>' +
      '<h2 class="modal-title">' + OK.escape(drink.name) + '</h2>' +
      '<div class="modal-meta">' + buildMetaLine(drink) + '</div>' +
      '<div class="modal-section">' +
      '<h3>' + t('ingredients') + '</h3>' +
      buildIngredientsHtml(drink) +
      '</div>' +
      '<div class="modal-section">' +
      '<h3>' + t('instructions') + '</h3>' +
      '<p class="instructions">' + OK.escape(drink.instructions || '') + '</p>' +
      '</div>';

    detailModal.hidden = false;
    modalClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    detailModal.hidden = true;
    document.body.style.overflow = '';
    currentDetail = null;
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    searchForm = document.getElementById('searchForm');
    searchInput = document.getElementById('searchInput');
    randomBtn = document.getElementById('randomBtn');
    categorySelect = document.getElementById('categorySelect');
    statusNote = document.getElementById('statusNote');
    loadingRow = document.getElementById('loadingRow');
    drinkGrid = document.getElementById('drinkGrid');
    emptyState = document.getElementById('emptyState');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    initCategories();
    loadDrinks('/search.php?f=a');

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      searchByName(searchInput.value.trim());
    });

    randomBtn.addEventListener('click', function () {
      searchInput.value = '';
      categorySelect.value = '';
      activeCategory = '';
      randomDrink();
    });

    categorySelect.addEventListener('change', function () {
      searchInput.value = '';
      if (categorySelect.value) filterByCategory(categorySelect.value);
      else searchByName('');
    });

    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });
  });
})();
