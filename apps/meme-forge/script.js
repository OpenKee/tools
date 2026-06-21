/* ============================================================
   Meme Forge — 梗图生成器
   数据来源：Meme API（聚合 Reddit 公开梗图，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'Meme API · Random Memes',
      title: 'Meme Forge',
      lead: 'Get a random meme, pick a subreddit, or browse through the latest posts.',
      load: 'Load',
      random: 'Random',
      prev: '← Prev',
      next: 'Next →',
      copyLink: 'Copy Link',
      copied: 'Copied!',
      loading: 'Loading…',
      fetchError: 'Failed to load meme.',
      dataSource: 'Data: Meme API / Reddit',
      allProjects: 'All projects ↗',
      subPlaceholder: 'memes',
      viewPost: 'View post ↗',
      upvotes: 'upvotes',
      by: 'by',
    },
    zh: {
      eyebrow: 'Meme API · 随机梗图',
      title: 'Meme Forge',
      lead: '随机获取一张梗图，或指定 subreddit 浏览最新帖子。',
      load: '加载',
      random: '随机',
      prev: '← 上一张',
      next: '下一张 →',
      copyLink: '复制链接',
      copied: '已复制！',
      loading: '加载中…',
      fetchError: '梗图加载失败。',
      dataSource: '数据：Meme API / Reddit',
      allProjects: '全部项目 ↗',
      subPlaceholder: 'memes',
      viewPost: '查看原帖 ↗',
      upvotes: '赞',
      by: '作者',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://meme-api.com/gimme';

  // ---------- DOM 引用 ----------
  var langBtn, subForm, subInput, randomBtn, prevBtn, nextBtn, copyBtn,
      loadingRow, memeCard, memeImage, memeTitle, memeSubreddit,
      memeVotes, memeAuthor, memeLink, errorState;

  // ---------- 状态 ----------
  var currentMeme = null;
  var history = [];
  var historyIndex = -1;

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    subInput.placeholder = t('subPlaceholder') || 'memes';
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function apiUrl(subreddit, after) {
    var url = API_BASE;
    if (subreddit) url += '/' + encodeURIComponent(subreddit);
    if (after) url += (subreddit ? '?' : '?') + 'after=' + encodeURIComponent(after);
    return url;
  }

  // ---------- API 调用 ----------
  function fetchMeme(subreddit) {
    setLoading(true);
    memeCard.style.display = 'none';
    errorState.style.display = 'none';

    OK.fetchJSON(apiUrl(subreddit), { timeout: 15000 })
      .then(function (data) {
        setLoading(false);
        if (!data || !data.url) {
          errorState.style.display = '';
          return;
        }
        currentMeme = data;
        // 丢弃当前位置之后的历史
        history = history.slice(0, historyIndex + 1);
        history.push(data);
        historyIndex = history.length - 1;
        renderMeme(data);
        updateButtons();
      })
      .catch(function (err) {
        setLoading(false);
        errorState.style.display = '';
        console.warn('Meme load failed:', err);
      });
  }

  function renderMeme(meme) {
    memeImage.src = meme.url;
    memeImage.alt = meme.title || '';
    memeTitle.textContent = meme.title || '';
    memeSubreddit.textContent = 'r/' + (meme.subreddit || '');
    memeVotes.textContent = (meme.ups || 0) + ' ' + t('upvotes');
    memeAuthor.textContent = t('by') + ' u/' + (meme.author || '');
    memeLink.href = meme.postLink || '#';
    memeCard.style.display = '';
  }

  function updateButtons() {
    prevBtn.disabled = historyIndex <= 0;
    nextBtn.disabled = historyIndex >= history.length - 1;
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      currentMeme = history[historyIndex];
      renderMeme(currentMeme);
      updateButtons();
    }
  }

  function goForward() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      currentMeme = history[historyIndex];
      renderMeme(currentMeme);
      updateButtons();
    } else {
      fetchMeme(getSubreddit());
    }
  }

  function getSubreddit() {
    return subInput.value.trim().replace(/^r\//, '');
  }

  function copyLink() {
    if (!currentMeme || !currentMeme.url) return;
    var url = currentMeme.url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        var original = copyBtn.textContent;
        copyBtn.textContent = t('copied');
        setTimeout(function () { copyBtn.textContent = original; }, 1500);
      }).catch(function () {});
    }
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    subForm = document.getElementById('subForm');
    subInput = document.getElementById('subInput');
    randomBtn = document.getElementById('randomBtn');
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    copyBtn = document.getElementById('copyBtn');
    loadingRow = document.getElementById('loadingRow');
    memeCard = document.getElementById('memeCard');
    memeImage = document.getElementById('memeImage');
    memeTitle = document.getElementById('memeTitle');
    memeSubreddit = document.getElementById('memeSubreddit');
    memeVotes = document.getElementById('memeVotes');
    memeAuthor = document.getElementById('memeAuthor');
    memeLink = document.getElementById('memeLink');
    errorState = document.getElementById('errorState');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    fetchMeme('');

    subForm.addEventListener('submit', function (e) {
      e.preventDefault();
      history = [];
      historyIndex = -1;
      fetchMeme(getSubreddit());
    });

    randomBtn.addEventListener('click', function () {
      subInput.value = '';
      history = [];
      historyIndex = -1;
      fetchMeme('');
    });

    prevBtn.addEventListener('click', goBack);
    nextBtn.addEventListener('click', goForward);
    copyBtn.addEventListener('click', copyLink);
  });
})();
