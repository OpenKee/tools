/* ============================================================
   Taste Atlas — 美食地图 / 全球食谱探索
   数据来源：TheMealDB（免费公开 API，无需 key）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'TheMealDB · Global recipes',
      title: 'Taste Atlas',
      lead: 'Discover recipes from around the world. Search by name, filter by category or cuisine, or roll the dice for a random dish.',
      searchPlaceholder: 'Search recipes…',
      search: 'Search',
      random: 'Random',
      allCategories: 'All categories',
      allAreas: 'All cuisines',
      loading: 'Loading…',
      empty: 'No recipes found.',
      ingredients: 'Ingredients',
      instructions: 'Instructions',
      tags: 'Tags',
      source: 'Source',
      youtube: 'Watch on YouTube',
      dataSource: 'Data: TheMealDB',
      allProjects: 'All projects ↗',
      category: 'Category',
      cuisine: 'Cuisine',
      fetchError: 'Failed to load recipes.',
    },
    zh: {
      eyebrow: 'TheMealDB · 全球食谱',
      title: '美食地图',
      lead: '探索来自世界各地的食谱。按名称搜索、按分类或菜系筛选，或者随机来一道菜。',
      searchPlaceholder: '搜索食谱…',
      search: '搜索',
      random: '随机',
      allCategories: '全部分类',
      allAreas: '全部菜系',
      loading: '加载中…',
      empty: '没有找到食谱。',
      ingredients: '食材',
      instructions: '做法',
      tags: '标签',
      source: '来源',
      youtube: '在 YouTube 观看',
      dataSource: '数据：TheMealDB',
      allProjects: '全部项目 ↗',
      category: '分类',
      cuisine: '菜系',
      fetchError: '食谱加载失败。',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://www.themealdb.com/api/json/v1/1';

  // ---------- DOM 引用 ----------
  var langBtn, searchForm, searchInput, randomBtn, categorySelect, areaSelect,
      statusNote, loadingRow, recipeGrid, emptyState, detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var currentRecipes = [];
  var categories = [];
  var areas = [];

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    searchInput.placeholder = t('searchPlaceholder');
    renderGrid();
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

  function normalizeMeal(m) {
    if (!m) return null;
    var ingredients = [];
    for (var i = 1; i <= 20; i++) {
      var ing = m['strIngredient' + i];
      var meas = m['strMeasure' + i];
      if (ing && ing.trim()) {
        ingredients.push({ name: ing.trim(), measure: (meas || '').trim() });
      }
    }
    return {
      id: m.idMeal,
      name: m.strMeal,
      thumb: m.strMealThumb,
      category: m.strCategory,
      area: m.strArea,
      instructions: m.strInstructions,
      tags: (m.strTags || '').split(',').filter(Boolean),
      youtube: m.strYoutube,
      source: m.strSource,
      ingredients: ingredients,
    };
  }

  function normalizeList(data, key) {
    if (!data || !data.meals) return [];
    return data.meals.map(function (m) { return m[key]; }).filter(Boolean).sort();
  }

  // ---------- 初始化筛选器 ----------
  function initFilters() {
    Promise.all([
      fetchJSON('/list.php?c=list'),
      fetchJSON('/list.php?a=list'),
    ]).then(function (res) {
      categories = normalizeList(res[0], 'strCategory');
      areas = normalizeList(res[1], 'strArea');
      populateSelect(categorySelect, categories, t('allCategories'));
      populateSelect(areaSelect, areas, t('allAreas'));
    }).catch(function (err) {
      console.warn('Failed to load filters:', err);
    });
  }

  function populateSelect(select, list, defaultLabel) {
    var html = '<option value="">' + OK.escape(defaultLabel) + '</option>';
    list.forEach(function (item) {
      html += '<option value="' + OK.escape(item) + '">' + OK.escape(item) + '</option>';
    });
    select.innerHTML = html;
  }

  // ---------- 加载食谱 ----------
  function loadRecipes(path) {
    setLoading(true);
    emptyState.style.display = 'none';
    recipeGrid.innerHTML = '';
    fetchJSON(path)
      .then(function (data) {
        var meals = (data && data.meals) || [];
        currentRecipes = meals.map(normalizeMeal).filter(Boolean);
        setLoading(false);
        setStatus(currentRecipes.length ? currentRecipes.length + ' recipes' : '');
        renderGrid();
      })
      .catch(function (err) {
        setLoading(false);
        setStatus(t('fetchError'));
        console.warn('Recipe load failed:', err);
      });
  }

  function searchByName(q) {
    if (!q) return loadRecipes('/search.php?s=');
    loadRecipes('/search.php?s=' + encodeURIComponent(q));
  }

  function filterByCategory(c) {
    loadRecipes('/filter.php?c=' + encodeURIComponent(c));
  }

  function filterByArea(a) {
    loadRecipes('/filter.php?a=' + encodeURIComponent(a));
  }

  function randomRecipe() {
    setLoading(true);
    fetchJSON('/random.php')
      .then(function (data) {
        var meals = (data && data.meals) || [];
        currentRecipes = meals.map(normalizeMeal).filter(Boolean);
        setLoading(false);
        renderGrid();
        if (currentRecipes.length) openModal(currentRecipes[0]);
      })
      .catch(function (err) {
        setLoading(false);
        setStatus(t('fetchError'));
        console.warn('Random recipe failed:', err);
      });
  }

  function loadDetail(id) {
    setLoading(true);
    fetchJSON('/lookup.php?i=' + encodeURIComponent(id))
      .then(function (data) {
        var meals = (data && data.meals) || [];
        var meal = meals.map(normalizeMeal).filter(Boolean)[0];
        setLoading(false);
        if (meal) openModal(meal);
      })
      .catch(function (err) {
        setLoading(false);
        console.warn('Recipe detail failed:', err);
      });
  }

  // ---------- 渲染 ----------
  function renderGrid() {
    if (!currentRecipes.length) {
      recipeGrid.innerHTML = '';
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';
    recipeGrid.innerHTML = currentRecipes.map(function (m) {
      var meta = [];
      if (m.category) meta.push('<span class="recipe-card-tag">' + OK.escape(m.category) + '</span>');
      if (m.area) meta.push('<span>' + OK.escape(m.area) + '</span>');
      return '<article class="recipe-card" data-id="' + OK.escape(m.id) + '">' +
        '<img src="' + OK.escape(m.thumb) + '" alt="" loading="lazy" />' +
        '<div class="recipe-card-body">' +
        '<div class="recipe-card-title">' + OK.escape(m.name) + '</div>' +
        '<div class="recipe-card-meta">' + meta.join('') + '</div>' +
        '</div></article>';
    }).join('');

    recipeGrid.querySelectorAll('.recipe-card').forEach(function (card) {
      card.addEventListener('click', function () {
        loadDetail(card.dataset.id);
      });
    });
  }

  // ---------- 弹窗 ----------
  function openModal(meal) {
    var meta = [];
    if (meal.category) meta.push('<span>' + t('category') + ': ' + OK.escape(meal.category) + '</span>');
    if (meal.area) meta.push('<span>' + t('cuisine') + ': ' + OK.escape(meal.area) + '</span>');

    var ingHtml = meal.ingredients.map(function (ing) {
      return '<li><span>' + OK.escape(ing.name) + '</span>' + (ing.measure ? ' — ' + OK.escape(ing.measure) : '') + '</li>';
    }).join('');

    var tagsHtml = meal.tags.length ? '<div class="modal-tags">' + meal.tags.map(function (tag) {
      return '<span>' + OK.escape(tag) + '</span>';
    }).join('') + '</div>' : '';

    var linksHtml = '';
    if (meal.youtube) {
      linksHtml += '<a class="modal-link" href="' + OK.escape(meal.youtube) + '" target="_blank" rel="noreferrer">' + t('youtube') + ' ↗</a>';
    }
    if (meal.source) {
      linksHtml += (linksHtml ? ' · ' : '') + '<a class="modal-link" href="' + OK.escape(meal.source) + '" target="_blank" rel="noreferrer">' + t('source') + ' ↗</a>';
    }

    modalBody.innerHTML =
      '<div class="modal-hero"><img src="' + OK.escape(meal.thumb) + '" alt="" /></div>' +
      '<h2 class="modal-title">' + OK.escape(meal.name) + '</h2>' +
      '<div class="modal-meta">' + meta.join('') + '</div>' +
      '<div class="modal-section">' +
      '<h3>' + t('ingredients') + '</h3>' +
      '<ul class="ingredient-list">' + ingHtml + '</ul>' +
      '</div>' +
      '<div class="modal-section">' +
      '<h3>' + t('instructions') + '</h3>' +
      '<p class="instructions">' + OK.escape(meal.instructions || '') + '</p>' +
      '</div>' +
      (meal.tags.length ? '<div class="modal-section"><h3>' + t('tags') + '</h3>' + tagsHtml + '</div>' : '') +
      (linksHtml ? '<div class="modal-section">' + linksHtml + '</div>' : '');

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
    categorySelect = document.getElementById('categorySelect');
    areaSelect = document.getElementById('areaSelect');
    statusNote = document.getElementById('statusNote');
    loadingRow = document.getElementById('loadingRow');
    recipeGrid = document.getElementById('recipeGrid');
    emptyState = document.getElementById('emptyState');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    initFilters();
    loadRecipes('/search.php?s=');

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      categorySelect.value = '';
      areaSelect.value = '';
      searchByName(searchInput.value.trim());
    });

    randomBtn.addEventListener('click', function () {
      categorySelect.value = '';
      areaSelect.value = '';
      randomRecipe();
    });

    categorySelect.addEventListener('change', function () {
      searchInput.value = '';
      areaSelect.value = '';
      if (categorySelect.value) filterByCategory(categorySelect.value);
      else searchByName('');
    });

    areaSelect.addEventListener('change', function () {
      searchInput.value = '';
      categorySelect.value = '';
      if (areaSelect.value) filterByArea(areaSelect.value);
      else searchByName('');
    });

    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });
  });
})();
