/* ============================================================
   Cat Atlas — 猫咪图鉴
   数据来源：The Cat API（免费公开，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'The Cat API · Feline Atlas',
      title: 'Cat Atlas',
      lead: 'Browse hundreds of cat photos by breed. Click any photo to see breed temperament, origin, lifespan and more.',
      breed: 'Breed',
      allBreeds: 'All breeds',
      refresh: 'Refresh',
      loading: 'Loading…',
      empty: 'No cats found.',
      loadMore: 'Load more',
      noMore: 'No more photos',
      dataSource: 'Data: The Cat API',
      allProjects: 'All projects ↗',
      fetchError: 'Failed to load cats. Please try again.',
      fetchBreedsError: 'Failed to load breed list.',
      temperament: 'Temperament',
      origin: 'Origin',
      lifeSpan: 'Life span',
      weight: 'Weight',
      description: 'Description',
      unknownBreed: 'Unknown breed',
      noBreedInfo: 'No breed information available for this photo.',
      countInfo: '{count} photos',
      metric: 'metric',
      imperial: 'imperial'
    },
    zh: {
      eyebrow: 'The Cat API · 猫咪图鉴',
      title: 'Cat Atlas 猫咪图鉴',
      lead: '按品种浏览上百张猫咪图片。点击任意图片可查看品种性情、起源、寿命等详细信息。',
      breed: '品种',
      allBreeds: '全部品种',
      refresh: '换一批',
      loading: '加载中…',
      empty: '没有找到猫咪。',
      loadMore: '加载更多',
      noMore: '没有更多了',
      dataSource: '数据：The Cat API',
      allProjects: '全部项目 ↗',
      fetchError: '猫咪图片加载失败，请重试。',
      fetchBreedsError: '品种列表加载失败。',
      temperament: '性情',
      origin: '起源',
      lifeSpan: '寿命',
      weight: '体重',
      description: '描述',
      unknownBreed: '未知品种',
      noBreedInfo: '这张图片暂无品种信息。',
      countInfo: '已加载 {count} 张',
      metric: '公制',
      imperial: '英制'
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://api.thecatapi.com/v1';
  var PAGE_SIZE = 12;

  // ---------- DOM 引用 ----------
  var langBtn, breedSelect, refreshBtn, countInfo, loadingRow,
      catGrid, emptyState, loadMoreBtn,
      detailModal, modalClose, modalBody;

  // ---------- 状态 ----------
  var breeds = [];            // 完整品种列表 [{id,name}]
  var currentBreed = '';      // 当前筛选品种 id（空表示全部）
  var currentPage = 0;        // 分页页码（The Cat API 用 page 参数分页）
  var images = [];            // 已加载的图片数组（累积）
  var loading = false;        // 是否正在请求
  var reachedEnd = false;     // 是否已加载到末页

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    renderGrid();
    updateCountInfo();
    // 切换语言时若弹窗已打开，重新渲染弹窗内容
    if (!detailModal.hidden && modalBody.dataset.idx != null) {
      openModal(images[parseInt(modalBody.dataset.idx, 10)]);
    }
  }

  function setLoading(on) {
    loading = on;
    loadingRow.style.display = on ? '' : 'none';
  }

  // 取图片关联的首个品种（API 返回 breeds 数组，通常 0 或 1 个）
  function firstBreed(img) {
    return img && img.breeds && img.breeds.length ? img.breeds[0] : null;
  }

  function updateCountInfo() {
    countInfo.textContent = t('countInfo').replace('{count}', images.length);
  }

  // ---------- API 调用 ----------
  function fetchJSON(path) {
    return OK.fetchJSON(API_BASE + path, { timeout: 15000 });
  }

  // 拉取品种列表并填充下拉框
  function loadBreeds() {
    return fetchJSON('/breeds').then(function (list) {
      breeds = (list || []).map(function (b) {
        return { id: b.id, name: b.name };
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      populateBreedSelect();
    }).catch(function (err) {
      console.warn('Breeds load failed:', err);
      emptyState.textContent = t('fetchBreedsError');
      emptyState.style.display = '';
    });
  }

  function populateBreedSelect() {
    var html = '<option value="">' + OK.escape(t('allBreeds')) + '</option>';
    breeds.forEach(function (b) {
      html += '<option value="' + OK.escape(b.id) + '">' + OK.escape(b.name) + '</option>';
    });
    breedSelect.innerHTML = html;
    breedSelect.value = currentBreed;
  }

  // 构造当前请求地址（带品种与分页）
  function buildUrl(page) {
    var url = '/images/search?limit=' + PAGE_SIZE + '&page=' + page;
    if (currentBreed) {
      url += '&breed_ids=' + encodeURIComponent(currentBreed);
    }
    return url;
  }

  // 加载图片：reset=true 时清空重新开始，否则追加下一页
  function loadImages(reset) {
    if (loading) return;
    if (reset) {
      reachedEnd = false;
      images = [];
      catGrid.innerHTML = '';
    }
    if (reachedEnd) return;

    // 先确定目标页码，请求成功后再提交，避免失败时跳页
    var page = reset ? 0 : currentPage + 1;

    setLoading(true);
    loadMoreBtn.disabled = true;

    fetchJSON(buildUrl(page)).then(function (data) {
      var batch = data || [];
      if (reset) images = batch.slice();
      else images = images.concat(batch);
      currentPage = page;

      // 返回不足一页 → 已到末尾
      if (batch.length < PAGE_SIZE) reachedEnd = true;

      setLoading(false);
      renderGrid();
      updateCountInfo();
      updateLoadMoreBtn();
    }).catch(function (err) {
      setLoading(false);
      loadMoreBtn.disabled = false;
      console.warn('Images load failed:', err);
      if (!images.length) {
        emptyState.textContent = t('fetchError');
        emptyState.style.display = '';
      }
    });
  }

  function updateLoadMoreBtn() {
    loadMoreBtn.hidden = !images.length || reachedEnd;
    loadMoreBtn.disabled = false;
    if (reachedEnd && images.length) {
      loadMoreBtn.textContent = t('noMore');
      loadMoreBtn.disabled = true;
    } else {
      loadMoreBtn.textContent = t('loadMore');
    }
  }

  // ---------- 渲染网格 ----------
  function renderGrid() {
    if (!images.length) {
      catGrid.innerHTML = '';
      emptyState.style.display = loading ? 'none' : '';
      return;
    }
    emptyState.style.display = 'none';

    // 重建整张网格（瀑布流列布局，追加时整体重排最稳妥）
    catGrid.innerHTML = images.map(function (img, idx) {
      var breed = firstBreed(img);
      var breedName = breed ? breed.name : t('unknownBreed');
      return '<article class="cat-card" data-idx="' + idx + '" tabindex="0" role="button" aria-label="' +
        OK.escape(breedName) + '">' +
        '<div class="cat-card-img-wrap">' +
          '<img src="' + OK.escape(img.url) + '" alt="' + OK.escape(breedName) +
            '" loading="lazy" />' +
        '</div>' +
        '<div class="cat-card-overlay">' +
          '<div class="cat-card-breed">' + OK.escape(breedName) + '</div>' +
          '<div class="cat-card-id">#' + OK.escape(img.id || '') + '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    // 绑定点击与键盘事件
    var cards = catGrid.querySelectorAll('.cat-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        openModal(images[parseInt(card.dataset.idx, 10)]);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(images[parseInt(card.dataset.idx, 10)]);
        }
      });
    });
  }

  // ---------- 弹窗 ----------
  function openModal(img) {
    if (!img) return;
    var breed = firstBreed(img);

    var html = '<div class="modal-image"><img src="' + OK.escape(img.url) +
      '" alt="' + OK.escape(breed ? breed.name : t('unknownBreed')) + '" /></div>' +
      '<div class="modal-info">';

    if (!breed) {
      // 无品种信息：仅展示提示
      html += '<h2 class="modal-title">' + OK.escape(t('unknownBreed')) + '</h2>' +
        '<div class="modal-subtitle">#' + OK.escape(img.id || '') + '</div>' +
        '<p class="modal-note">' + OK.escape(t('noBreedInfo')) + '</p>';
    } else {
      // 基础信息卡片
      var origin = breed.origin || '—';
      var lifeSpan = breed.life_span || '—';
      var weightMetric = (breed.weight && breed.weight.metric) ? breed.weight.metric : '—';
      var weightImperial = (breed.weight && breed.weight.imperial) ? breed.weight.imperial : '—';

      // 性情拆分为标签
      var temperament = breed.temperament || '';
      var tagsHtml = temperament.split(/[,;]/).map(function (s) {
        return s.trim();
      }).filter(Boolean).map(function (s) {
        return '<span class="tag-chip">' + OK.escape(s) + '</span>';
      }).join('');

      html += '<h2 class="modal-title">' + OK.escape(breed.name) + '</h2>' +
        '<div class="modal-subtitle">#' + OK.escape(img.id || '') + '</div>' +
        '<div class="modal-meta">' +
          metaBox(t('origin'), OK.escape(origin)) +
          metaBox(t('lifeSpan'), OK.escape(lifeSpan)) +
          metaBox(t('weight'), OK.escape(weightMetric) + ' kg') +
        '</div>';

      if (tagsHtml) {
        html += '<div class="modal-section">' +
          '<h3>' + OK.escape(t('temperament')) + '</h3>' +
          '<div class="modal-tags">' + tagsHtml + '</div>' +
        '</div>';
      }

      if (breed.description) {
        html += '<div class="modal-section">' +
          '<h3>' + OK.escape(t('description')) + '</h3>' +
          '<p>' + OK.escape(breed.description) + '</p>' +
        '</div>';
      }
    }

    html += '</div>';

    modalBody.innerHTML = html;
    modalBody.dataset.idx = images.indexOf(img);
    detailModal.hidden = false;
    document.body.style.overflow = 'hidden';
    detailModal.querySelector('.modal-panel').scrollTop = 0;
  }

  function metaBox(label, value) {
    return '<div class="meta-box"><div class="meta-label">' + label +
      '</div><div class="meta-value">' + value + '</div></div>';
  }

  function closeModal() {
    detailModal.hidden = true;
    document.body.style.overflow = '';
    delete modalBody.dataset.idx;
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    breedSelect = document.getElementById('breedSelect');
    refreshBtn = document.getElementById('refreshBtn');
    countInfo = document.getElementById('countInfo');
    loadingRow = document.getElementById('loadingRow');
    catGrid = document.getElementById('catGrid');
    emptyState = document.getElementById('emptyState');
    loadMoreBtn = document.getElementById('loadMoreBtn');
    detailModal = document.getElementById('detailModal');
    modalClose = document.getElementById('modalClose');
    modalBody = document.getElementById('modalBody');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();

    // 先拉品种列表，再加载首批图片
    loadBreeds().then(function () {
      loadImages(true);
    });

    // 品种筛选切换
    breedSelect.addEventListener('change', function () {
      currentBreed = breedSelect.value;
      loadImages(true);
    });

    // 随机刷新
    refreshBtn.addEventListener('click', function () {
      loadImages(true);
    });

    // 加载更多（页码在请求成功后递增，避免失败跳页）
    loadMoreBtn.addEventListener('click', function () {
      loadImages(false);
    });

    // 弹窗关闭交互
    modalClose.addEventListener('click', closeModal);
    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !detailModal.hidden) closeModal();
    });
  });
})();
