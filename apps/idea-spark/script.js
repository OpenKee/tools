/* ============================================================
   Idea Spark — 点子板
   数据来源：Bored API（免费公开 API，支持 CORS）
   使用 AppBrewery 镜像：https://bored-api.appbrewery.com
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'Bored API · Activity Ideas',
      title: 'Idea Spark',
      lead: 'Stuck on what to do? Get a random activity based on type and how many people are around.',
      type: 'Type',
      participants: 'Participants',
      any: 'Any',
      spark: 'Spark an Idea',
      loading: 'Loading…',
      fetchError: 'Failed to load activity.',
      dataSource: 'Data: Bored API',
      allProjects: 'All projects ↗',
      person: 'person',
      people: 'people',
      free: 'Free',
      cheap: 'Cheap',
      moderate: 'Moderate',
      pricey: 'Pricey',
      minutes: 'minutes',
      hours: 'hours',
      days: 'days',
      learnMore: 'Learn more ↗',
      noIdea: 'No matching idea found. Try broader filters.',
    },
    zh: {
      eyebrow: 'Bored API · 活动灵感',
      title: 'Idea Spark',
      lead: '不知道做什么？根据类型和参与人数随机获取一个活动建议。',
      type: '类型',
      participants: '参与人数',
      any: '任意',
      spark: '来一个点子',
      loading: '加载中…',
      fetchError: '活动加载失败。',
      dataSource: '数据：Bored API',
      allProjects: '全部项目 ↗',
      person: '人',
      people: '人',
      free: '免费',
      cheap: '便宜',
      moderate: '适中',
      pricey: '较贵',
      minutes: '分钟',
      hours: '小时',
      days: '天',
      learnMore: '了解更多 ↗',
      noIdea: '没有匹配的点子，试试更宽泛的条件。',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://bored-api.appbrewery.com';

  // ---------- DOM 引用 ----------
  var langBtn, typeSelect, participantsSelect, sparkBtn,
      loadingRow, ideaCard, ideaEmoji, ideaActivity, ideaType,
      ideaParticipants, ideaPrice, ideaDuration, ideaLink, errorState;

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
  }

  function setLoading(on) {
    loadingRow.style.display = on ? '' : 'none';
  }

  function priceLabel(price) {
    if (price === 0) return t('free');
    if (price <= 0.25) return t('cheap');
    if (price <= 0.6) return t('moderate');
    return t('pricey');
  }

  function durationLabel(duration) {
    var d = String(duration || '').toLowerCase();
    if (d.indexOf('minute') !== -1) return t('minutes');
    if (d.indexOf('hour') !== -1) return t('hours');
    if (d.indexOf('day') !== -1) return t('days');
    return duration || '';
  }

  function typeEmoji(type) {
    var map = {
      education: '📚', recreational: '🎮', social: '🎉',
      diy: '🔨', charity: '❤️', cooking: '🍳',
      relaxation: '🧘', music: '🎵', busywork: '📋'
    };
    return map[type] || '💡';
  }

  // ---------- API 调用 ----------
  function fetchActivity() {
    setLoading(true);
    ideaCard.style.display = 'none';
    errorState.style.display = 'none';

    var type = typeSelect.value;
    var participants = participantsSelect.value;
    var url = API_BASE + '/random';

    // 如果有筛选条件，使用 /filter 接口并随机取一条
    if (type || participants) {
      var params = [];
      if (type) params.push('type=' + encodeURIComponent(type));
      if (participants) params.push('participants=' + encodeURIComponent(participants));
      url = API_BASE + '/filter?' + params.join('&');
    }

    OK.fetchJSON(url, { timeout: 15000 })
      .then(function (data) {
        setLoading(false);
        if (!data) {
          errorState.style.display = '';
          return;
        }
        // /filter 返回数组
        if (Array.isArray(data)) {
          if (!data.length) {
            errorState.textContent = t('noIdea');
            errorState.style.display = '';
            return;
          }
          data = data[Math.floor(Math.random() * data.length)];
        }
        renderActivity(data);
      })
      .catch(function (err) {
        setLoading(false);
        errorState.style.display = '';
        console.warn('Activity load failed:', err);
      });
  }

  function renderActivity(activity) {
    ideaEmoji.textContent = typeEmoji(activity.type);
    ideaActivity.textContent = activity.activity || '';
    ideaType.textContent = activity.type || '';
    ideaParticipants.textContent = (activity.participants || 1) + ' ' + (activity.participants === 1 ? t('person') : t('people'));
    ideaPrice.textContent = priceLabel(activity.price);
    ideaDuration.textContent = durationLabel(activity.duration);

    if (activity.link && activity.link.indexOf('http') === 0) {
      ideaLink.href = activity.link;
      ideaLink.style.display = 'inline-block';
    } else {
      ideaLink.href = '#';
      ideaLink.style.display = 'none';
    }

    ideaCard.style.display = '';
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    typeSelect = document.getElementById('typeSelect');
    participantsSelect = document.getElementById('participantsSelect');
    sparkBtn = document.getElementById('sparkBtn');
    loadingRow = document.getElementById('loadingRow');
    ideaCard = document.getElementById('ideaCard');
    ideaEmoji = document.getElementById('ideaEmoji');
    ideaActivity = document.getElementById('ideaActivity');
    ideaType = document.getElementById('ideaType');
    ideaParticipants = document.getElementById('ideaParticipants');
    ideaPrice = document.getElementById('ideaPrice');
    ideaDuration = document.getElementById('ideaDuration');
    ideaLink = document.getElementById('ideaLink');
    errorState = document.getElementById('errorState');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();

    sparkBtn.addEventListener('click', fetchActivity);
  });
})();
