/* ============================================================
   Launch Board — 火箭发射日程
   数据源：Launch Library 2 API（失败时降级到内嵌 mock 数据）
   功能：下一次发射倒计时、即将发射列表、筛选/搜索、详情弹窗、中英 i18n
   ============================================================ */
(function () {
  'use strict';

  /* ---------- i18n 文案 ---------- */
  var copy = {
    en: {
      title: 'Launch Board',
      eyebrow: 'Rocket launch schedule',
      heroTitle: 'Launch Board',
      lead: 'Live countdowns and mission details for upcoming orbital launches worldwide.',
      refresh: 'Refresh',
      loading: 'Loading…',
      loadingNext: 'Loading next launch…',
      error: 'Failed to load launch data. Showing sample schedule.',
      noResults: 'No launches match your filters.',
      noUpcoming: 'No upcoming launches scheduled.',
      fallbackNotice: 'Showing sample data (API unavailable).',
      dataSource: 'Data: Launch Library 2',
      allProjects: 'All projects',
      nextLaunch: '🚀 Next Launch',
      countdownLabel: 'Countdown',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      launched: 'Launch window open',
      upcoming: 'Upcoming Launches',
      agency: 'Agency',
      status: 'Status',
      search: 'Search',
      searchPlaceholder: 'Search mission or rocket…',
      allAgencies: 'All agencies',
      allStatuses: 'All statuses',
      resultCount: '{n} launches',
      mission: 'Mission',
      rocket: 'Rocket',
      launchProvider: 'Launch provider',
      launchSite: 'Launch site',
      launchWindow: 'Launch window',
      description: 'Mission description',
      rocketDetails: 'Rocket details',
      payload: 'Payload',
      missionType: 'Mission type',
      orbit: 'Orbit',
      coordinates: 'Coordinates',
      webcast: 'Webcast',
      watchLive: '▶ Watch live',
      noWebcast: 'No webcast link available.',
      close: 'Close',
      notAvailable: 'Not available',
      utcLabel: 'UTC',
      localLabel: 'Local',
      /* 状态分类 */
      statusGo: 'Go',
      statusTbd: 'TBD',
      statusHold: 'Hold',
      statusSuccess: 'Success',
      statusFailed: 'Failed',
      statusInflight: 'In flight'
    },
    zh: {
      title: '发射日程',
      eyebrow: '火箭发射日程',
      heroTitle: '发射日程',
      lead: '全球即将到来的轨道发射实时倒计时与任务详情。',
      refresh: '刷新',
      loading: '加载中…',
      loadingNext: '正在加载下一次发射…',
      error: '加载发射数据失败，已显示示例日程。',
      noResults: '没有符合筛选条件的发射。',
      noUpcoming: '暂无即将到来的发射。',
      fallbackNotice: '当前显示示例数据（API 不可用）。',
      dataSource: '数据来源：Launch Library 2',
      allProjects: '全部项目',
      nextLaunch: '🚀 下一次发射',
      countdownLabel: '倒计时',
      days: '天',
      hours: '时',
      minutes: '分',
      seconds: '秒',
      launched: '发射窗口已开启',
      upcoming: '即将发射',
      agency: '发射机构',
      status: '状态',
      search: '搜索',
      searchPlaceholder: '搜索任务或火箭…',
      allAgencies: '全部机构',
      allStatuses: '全部状态',
      resultCount: '{n} 次发射',
      mission: '任务',
      rocket: '火箭',
      launchProvider: '发射机构',
      launchSite: '发射场',
      launchWindow: '发射窗口',
      description: '任务描述',
      rocketDetails: '火箭详情',
      payload: '载荷',
      missionType: '任务类型',
      orbit: '轨道',
      coordinates: '坐标',
      webcast: '直播',
      watchLive: '▶ 观看直播',
      noWebcast: '暂无直播链接。',
      close: '关闭',
      notAvailable: '暂无',
      utcLabel: 'UTC',
      localLabel: '本地',
      statusGo: '就绪',
      statusTbd: '待定',
      statusHold: '暂停',
      statusSuccess: '成功',
      statusFailed: '失败',
      statusInflight: '飞行中'
    }
  };

  /* ---------- 常量 ---------- */
  var API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&ordering=net';
  var ROCKET_EMOJIS = ['🚀', '🛰️', '🛸', '☄️', '🌠'];

  /* ---------- 状态 ---------- */
  var lang = OK.lang;
  var allLaunches = [];        // 全量数据
  var nextLaunch = null;       // 下一次发射（用于 hero）
  var countdownTimer = null;   // 倒计时定时器
  var usingFallback = false;   // 是否使用降级数据

  /* ---------- DOM 引用 ---------- */
  var elHeroCard = document.getElementById('heroCard');
  var elGrid = document.getElementById('launchGrid');
  var elResultCount = document.getElementById('resultCount');
  var elAgencyFilter = document.getElementById('agencyFilter');
  var elStatusFilter = document.getElementById('statusFilter');
  var elSearchInput = document.getElementById('searchInput');
  var elRefreshBtn = document.getElementById('refreshBtn');
  var elModal = document.getElementById('modal');
  var elModalBody = document.getElementById('modalBody');
  var elModalClose = document.getElementById('modalClose');
  var elModalBackdrop = document.getElementById('modalBackdrop');

  /* ---------- 辅助函数 ---------- */

  // 取翻译
  function t(key) { return OK.t(key, copy); }

  // 转义 HTML
  function esc(s) { return OK.escape(s); }

  // 状态分类：根据 Launch Library 2 的 status.id 映射到颜色类别
  // API 实测：1=Go for Launch, 2=To Be Determined, 3=TBC, 4=Hold,
  //          5=In Flight, 6=Partial Failure, 7=Failure, 8=To Be Confirmed
  function statusCategory(launch) {
    var id = launch && launch.status && launch.status.id;
    if (id === 1) return 'go';
    if (id === 2 || id === 3 || id === 8) return 'tbd';
    if (id === 4) return 'hold';
    if (id === 5) return 'inflight';
    if (id === 6 || id === 7) return 'failed';
    return 'tbd';
  }

  // 状态分类对应的 i18n 文案
  function statusLabel(cat) {
    return t('status' + cat.charAt(0).toUpperCase() + cat.slice(1));
  }

  // 火箭图标：根据任务名 hash 取一个 emoji 占位
  function rocketIcon(launch) {
    var name = (launch.name || '') + (launch.id || '');
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return ROCKET_EMOJIS[sum % ROCKET_EMOJIS.length];
  }

  // 取发射机构名
  function agencyName(launch) {
    return (launch.launch_service_provider && launch.launch_service_provider.name) || t('notAvailable');
  }

  // 取发射场名
  function padName(launch) {
    var pad = launch.pad;
    if (!pad) return t('notAvailable');
    var loc = pad.location && pad.location.name ? pad.location.name : '';
    return pad.name ? (loc ? pad.name + ' · ' + loc : pad.name) : (loc || t('notAvailable'));
  }

  // 取火箭配置名
  function rocketName(launch) {
    var cfg = launch.rocket && launch.rocket.configuration;
    return (cfg && cfg.full_name) || (cfg && cfg.name) || t('notAvailable');
  }

  // 取任务名
  function missionName(launch) {
    return (launch.mission && launch.mission.name) || launch.name || t('notAvailable');
  }

  // 判断是否为 TBD 发射（时间未确定，API 常返回月初 UTC 午夜占位）
  function isTbdLaunch(launch) {
    var cat = statusCategory(launch);
    if (cat !== 'tbd') return false;
    var d = launch && launch.net ? new Date(launch.net) : null;
    if (!d || isNaN(d.getTime())) return true;
    // 占位时间特征：UTC 00:00:00
    return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  }

  // 时间格式化：本地时区 + UTC 标注，使用 Intl.DateTimeFormat
  function formatTime(iso, launch) {
    if (!iso) return { local: t('notAvailable'), utc: '' };
    // TBD 占位时间不显示具体时刻
    if (launch && isTbdLaunch(launch)) {
      return { local: t('statusTbd'), utc: '' };
    }
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { local: t('notAvailable'), utc: '' };
    var locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    var local = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    }).format(d);
    var utc = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'UTC', timeZoneName: 'short'
    }).format(d);
    return { local: local, utc: utc };
  }

  // 列表卡片用的紧凑时间
  function formatShort(iso, launch) {
    if (!iso) return t('notAvailable');
    if (launch && isTbdLaunch(launch)) return t('statusTbd');
    var d = new Date(iso);
    if (isNaN(d.getTime())) return t('notAvailable');
    var locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
  }

  /* ---------- 内嵌 mock 数据（API 失败时降级） ---------- */
  function mockLaunches() {
    var now = Date.now();
    var hr = 3600 * 1000;
    var day = 24 * hr;
    // 用相对时间生成，保证倒计时始终有效
    return [
      {
        id: 'mock-1',
        name: 'Falcon 9 Block 5 | Starlink Group 8-12',
        status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
        net: new Date(now + 1 * day + 5 * hr).toISOString(),
        window_start: new Date(now + 1 * day + 5 * hr).toISOString(),
        window_end: new Date(now + 1 * day + 6 * hr).toISOString(),
        launch_service_provider: { id: 121, name: 'SpaceX', type: 'Commercial' },
        rocket: { configuration: { name: 'Falcon 9', family: 'Falcon', full_name: 'Falcon 9 Block 5', variant: 'Block 5' } },
        mission: { name: 'Starlink Group 8-12', description: 'A batch of Starlink v2 mini satellites for SpaceX\'s low-Earth-orbit internet constellation.', type: 'Communications', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
        pad: { name: 'Space Launch Complex 40', latitude: 28.562, longitude: -80.577, location: { name: 'Cape Canaveral, FL, USA' } },
        image: null, webcast_live: false, vidURLs: []
      },
      {
        id: 'mock-2',
        name: 'Long March 5 | Chang\'e 7',
        status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
        net: new Date(now + 4 * day + 11 * hr).toISOString(),
        window_start: new Date(now + 4 * day + 11 * hr).toISOString(),
        window_end: new Date(now + 4 * day + 12 * hr).toISOString(),
        launch_service_provider: { id: 88, name: 'CASC', type: 'Government' },
        rocket: { configuration: { name: 'Long March 5', family: 'Long March', full_name: 'Long March 5', variant: '' } },
        mission: { name: 'Chang\'e 7', description: 'Chinese lunar exploration mission to the Moon\'s south pole, including an orbiter, lander, rover and hopper.', type: 'Planetary Science', orbit: { name: 'Lunar', abbrev: 'LUN' } },
        pad: { name: 'LC-101', latitude: 19.614, longitude: 110.952, location: { name: 'Wenchang, China' } },
        image: null, webcast_live: false, vidURLs: []
      },
      {
        id: 'mock-3',
        name: 'Soyuz 2.1b | Glonass-K2',
        status: { id: 1, name: 'Go', abbrev: 'GO' },
        net: new Date(now + 6 * day + 8 * hr).toISOString(),
        window_start: new Date(now + 6 * day + 8 * hr).toISOString(),
        window_end: new Date(now + 6 * day + 9 * hr).toISOString(),
        launch_service_provider: { id: 98, name: 'Roscosmos', type: 'Government' },
        rocket: { configuration: { name: 'Soyuz 2.1b', family: 'Soyuz', full_name: 'Soyuz 2.1b', variant: 'b' } },
        mission: { name: 'Glonass-K2 No. 13', description: 'Navigation satellite for the Russian GLONASS global positioning system.', type: 'Navigation', orbit: { name: 'Medium Earth Orbit', abbrev: 'MEO' } },
        pad: { name: 'Site 43/4', latitude: 45.964, longitude: 63.305, location: { name: 'Plesetsk, Russia' } },
        image: null, webcast_live: false, vidURLs: []
      },
      {
        id: 'mock-4',
        name: 'Ariane 6 | Galactic 02',
        status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
        net: new Date(now + 9 * day + 14 * hr).toISOString(),
        window_start: new Date(now + 9 * day + 14 * hr).toISOString(),
        window_end: new Date(now + 9 * day + 15 * hr).toISOString(),
        launch_service_provider: { id: 115, name: 'Arianespace', type: 'Commercial' },
        rocket: { configuration: { name: 'Ariane 6', family: 'Ariane', full_name: 'Ariane 62', variant: '62' } },
        mission: { name: 'Galactic 02', description: 'Commercial communications payload delivered to geostationary transfer orbit.', type: 'Communications', orbit: { name: 'Geostationary Transfer Orbit', abbrev: 'GTO' } },
        pad: { name: 'ELA-4', latitude: 5.236, longitude: -52.775, location: { name: 'Kourou, French Guiana' } },
        image: null, webcast_live: false, vidURLs: []
      },
      {
        id: 'mock-5',
        name: 'Electron | The Beat Goes On',
        status: { id: 1, name: 'Go', abbrev: 'GO' },
        net: new Date(now + 12 * day + 3 * hr).toISOString(),
        window_start: new Date(now + 12 * day + 3 * hr).toISOString(),
        window_end: new Date(now + 12 * day + 4 * hr).toISOString(),
        launch_service_provider: { id: 147, name: 'Rocket Lab', type: 'Commercial' },
        rocket: { configuration: { name: 'Electron', family: 'Electron', full_name: 'Electron', variant: '' } },
        mission: { name: 'The Beat Goes On', description: 'Dedicated small-satellite rideshare mission carrying multiple commercial and academic payloads to low Earth orbit.', type: 'Dedicated Rideshare', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
        pad: { name: 'Launch Complex 1', latitude: -39.261, longitude: 177.865, location: { name: 'Mahia, New Zealand' } },
        image: null, webcast_live: true, vidURLs: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']
      },
      {
        id: 'mock-6',
        name: 'Vulcan VC6 | Dream Chaser 1',
        status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
        net: new Date(now + 18 * day + 9 * hr).toISOString(),
        window_start: new Date(now + 18 * day + 9 * hr).toISOString(),
        window_end: new Date(now + 18 * day + 10 * hr).toISOString(),
        launch_service_provider: { id: 124, name: 'ULA', type: 'Commercial' },
        rocket: { configuration: { name: 'Vulcan', family: 'Vulcan', full_name: 'Vulcan VC6', variant: 'VC6' } },
        mission: { name: 'Dream Chaser 1', description: 'First operational cargo resupply mission of the Dream Chaser spaceplane to the International Space Station.', type: 'Resupply', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
        pad: { name: 'Space Launch Complex 41', latitude: 28.583, longitude: -80.583, location: { name: 'Cape Canaveral, FL, USA' } },
        image: null, webcast_live: false, vidURLs: []
      }
    ];
  }

  /* ---------- 数据加载 ---------- */
  function loadData() {
    elHeroCard.innerHTML = '<div class="ok-loading"><span class="ok-spinner"></span><span>' + esc(t('loadingNext')) + '</span></div>';
    elGrid.innerHTML = '<div class="ok-loading"><span class="ok-spinner"></span><span>' + esc(t('loading')) + '</span></div>';

    OK.fetchJSON(API_URL, { timeout: 10000 })
      .then(function (data) {
        var results = (data && data.results) || [];
        if (!results.length) {
          // 空结果也降级
          useFallback(mockLaunches());
          return;
        }
        usingFallback = false;
        allLaunches = results;
        afterDataLoad();
      })
      .catch(function () {
        // API 失败，降级到 mock 数据
        useFallback(mockLaunches());
      });
  }

  function useFallback(data) {
    usingFallback = true;
    allLaunches = data;
    afterDataLoad();
  }

  // 数据就绪后：确定下一次发射、填充筛选、渲染
  function afterDataLoad() {
    // 下一次发射：net 在未来且最早的一条
    var now = Date.now();
    nextLaunch = null;
    for (var i = 0; i < allLaunches.length; i++) {
      var net = new Date(allLaunches[i].net).getTime();
      if (!isNaN(net) && net > now) {
        nextLaunch = allLaunches[i];
        break;
      }
    }
    // 若没有未来的，取第一条
    if (!nextLaunch && allLaunches.length) nextLaunch = allLaunches[0];

    populateFilters();
    renderHero();
    renderList();
    startCountdown();
  }

  /* ---------- 下一次发射大卡片 ---------- */
  function renderHero() {
    if (!nextLaunch) {
      elHeroCard.innerHTML = '<div class="hero-empty">' + esc(t('noUpcoming')) + '</div>';
      return;
    }
    var l = nextLaunch;
    var time = formatTime(l.net, l);
    var html = ''
      + '<div class="hero-badge">' + esc(t('nextLaunch')) + '</div>'
      + '<div class="hero-name">' + esc(l.name || missionName(l)) + '</div>'
      + '<div class="hero-mission">' + esc(t('mission') + ': ' + missionName(l)) + '</div>'
      + '<div class="hero-meta">'
      +   '<span class="hm-item"><span class="hm-key">' + esc(t('launchProvider')) + ':</span><span class="hm-val">' + esc(agencyName(l)) + '</span></span>'
      +   '<span class="hm-item"><span class="hm-key">' + esc(t('launchSite')) + ':</span><span class="hm-val">' + esc(padName(l)) + '</span></span>'
      + '</div>'
      + '<div class="hero-time">' + esc(t('localLabel') + ': ' + time.local) + ' <span class="ht-utc">· ' + esc(t('utcLabel') + ': ' + time.utc) + '</span></div>';
    // TBD 发射时间未定，不显示倒计时
    if (isTbdLaunch(l)) {
      html += '<div class="cd-launched">' + esc(t('statusTbd')) + '</div>';
    } else {
      html += '<div class="countdown" id="countdown" data-net="' + esc(l.net) + '"></div>';
    }
    if (usingFallback) {
      html += '<div class="fallback-notice">' + esc(t('fallbackNotice')) + '</div>';
    }
    elHeroCard.innerHTML = html;
  }

  // 倒计时渲染（每秒更新）
  function tickCountdown() {
    var cdEl = document.getElementById('countdown');
    if (!cdEl) return;
    var net = cdEl.getAttribute('data-net');
    var target = new Date(net).getTime();
    if (isNaN(target)) return;
    var diff = target - Date.now();

    if (diff <= 0) {
      cdEl.outerHTML = '<div class="cd-launched">' + esc(t('launched')) + '</div>';
      return;
    }
    var totalSec = Math.floor(diff / 1000);
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;

    cdEl.innerHTML = ''
      + cdUnit(days, t('days'))
      + cdUnit(hours, t('hours'))
      + cdUnit(mins, t('minutes'))
      + cdUnit(secs, t('seconds'));
  }

  function cdUnit(val, label) {
    var v = val < 10 ? '0' + val : String(val);
    return '<div class="cd-unit"><span class="cd-val">' + esc(v) + '</span><span class="cd-label">' + esc(label) + '</span></div>';
  }

  // 启动倒计时定时器
  function startCountdown() {
    stopCountdown();
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  /* ---------- 筛选器 ---------- */
  function populateFilters() {
    // 机构筛选：从数据中提取唯一机构
    var agencies = {};
    allLaunches.forEach(function (l) {
      var name = agencyName(l);
      if (name && name !== t('notAvailable')) agencies[name] = true;
    });
    var agencyKeys = Object.keys(agencies).sort();
    elAgencyFilter.innerHTML = '<option value="">' + esc(t('allAgencies')) + '</option>'
      + agencyKeys.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');

    // 状态筛选：固定分类
    var cats = ['go', 'tbd', 'hold', 'failed', 'inflight'];
    elStatusFilter.innerHTML = '<option value="">' + esc(t('allStatuses')) + '</option>'
      + cats.map(function (c) { return '<option value="' + c + '">' + esc(statusLabel(c)) + '</option>'; }).join('');
  }

  // 应用筛选并返回结果
  function getFiltered() {
    var agency = elAgencyFilter.value;
    var status = elStatusFilter.value;
    var q = elSearchInput.value.trim().toLowerCase();
    return allLaunches.filter(function (l) {
      if (agency && agencyName(l) !== agency) return false;
      if (status && statusCategory(l) !== status) return false;
      if (q) {
        var hay = ((l.name || '') + ' ' + missionName(l) + ' ' + rocketName(l) + ' ' + agencyName(l)).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- 列表渲染 ---------- */
  function renderList() {
    var filtered = getFiltered();
    elResultCount.textContent = t('resultCount').replace('{n}', String(filtered.length));

    if (!filtered.length) {
      elGrid.innerHTML = '<div class="empty-state">' + esc(t('noResults')) + '</div>';
      return;
    }

    elGrid.innerHTML = filtered.map(function (l) {
      var cat = statusCategory(l);
      var time = formatShort(l.net, l);
      return ''
        + '<div class="launch-card" data-id="' + esc(l.id) + '">'
        +   '<div class="lc-top">'
        +     '<div class="lc-icon">' + rocketIcon(l) + '</div>'
        +     '<div class="lc-name">'
        +       '<div class="lc-mission">' + esc(missionName(l)) + '</div>'
        +       '<div class="lc-rocket">' + esc(rocketName(l)) + '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="lc-body">'
        +     '<div class="lc-row"><span class="lc-key">' + esc(t('launchProvider')) + ':</span><span class="lc-val">' + esc(agencyName(l)) + '</span></div>'
        +     '<div class="lc-row"><span class="lc-key">' + esc(t('launchSite')) + ':</span><span class="lc-val">' + esc(padName(l)) + '</span></div>'
        +   '</div>'
        +   '<div class="lc-foot">'
        +     '<span class="lc-time">' + esc(time) + '</span>'
        +     '<span class="status-badge ' + cat + '">' + esc(statusLabel(cat)) + '</span>'
        +   '</div>'
        + '</div>';
    }).join('');

    // 绑定点击事件
    elGrid.querySelectorAll('.launch-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openModal(card.getAttribute('data-id'));
      });
    });
  }

  /* ---------- 详情弹窗 ---------- */
  function openModal(id) {
    var l = null;
    for (var i = 0; i < allLaunches.length; i++) {
      if (String(allLaunches[i].id) === String(id)) { l = allLaunches[i]; break; }
    }
    if (!l) return;

    var cat = statusCategory(l);
    var time = formatTime(l.net, l);
    var cfg = (l.rocket && l.rocket.configuration) || {};
    var mission = l.mission || {};
    var pad = l.pad || {};
    var orbit = (mission.orbit && mission.orbit.name) || t('notAvailable');
    var desc = mission.description || t('notAvailable');
    var coords = (pad.latitude != null && pad.longitude != null)
      ? pad.latitude.toFixed(3) + ', ' + pad.longitude.toFixed(3)
      : t('notAvailable');

    // 视频链接：取 vidURLs 数组中的第一个
    var vidUrl = (l.vidURLs && l.vidURLs.length) ? l.vidURLs[0] : '';

    var webcastHtml = vidUrl
      ? '<a class="modal-link" href="' + esc(vidUrl) + '" target="_blank" rel="noreferrer">' + esc(t('watchLive')) + '</a>'
      : '<p class="ms-muted">' + esc(t('noWebcast')) + '</p>';

    elModalBody.innerHTML = ''
      + '<div class="modal-eyebrow">' + esc(t('mission')) + '</div>'
      + '<h3 class="modal-title" id="modalTitle">' + esc(missionName(l)) + '</h3>'
      + '<p class="modal-sub">' + esc(l.name || rocketName(l)) + '</p>'
      + '<div class="modal-status-row">'
      +   '<span class="status-badge ' + cat + '">' + esc(statusLabel(cat)) + '</span>'
      +   '<span class="lc-time">' + esc(t('localLabel') + ': ' + time.local + ' · ' + t('utcLabel') + ': ' + time.utc) + '</span>'
      + '</div>'
      + '<div class="modal-section">'
      +   '<h4>' + esc(t('description')) + '</h4>'
      +   '<p>' + esc(desc) + '</p>'
      + '</div>'
      + '<div class="modal-section">'
      +   '<h4>' + esc(t('rocketDetails')) + '</h4>'
      +   '<div class="modal-grid">'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('rocket')) + '</span><span class="mg-val">' + esc(cfg.full_name || cfg.name || t('notAvailable')) + '</span></div>'
      +     '<div class="mg-row"><span class="mg-key">Family</span><span class="mg-val">' + esc(cfg.family || t('notAvailable')) + '</span></div>'
      +     '<div class="mg-row"><span class="mg-key">Variant</span><span class="mg-val">' + esc(cfg.variant || t('notAvailable')) + '</span></div>'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('launchProvider')) + '</span><span class="mg-val">' + esc(agencyName(l)) + '</span></div>'
      +   '</div>'
      + '</div>'
      + '<div class="modal-section">'
      +   '<h4>' + esc(t('payload')) + '</h4>'
      +   '<div class="modal-grid">'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('missionType')) + '</span><span class="mg-val">' + esc(mission.type || t('notAvailable')) + '</span></div>'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('orbit')) + '</span><span class="mg-val">' + esc(orbit) + '</span></div>'
      +   '</div>'
      + '</div>'
      + '<div class="modal-section">'
      +   '<h4>' + esc(t('launchSite')) + '</h4>'
      +   '<div class="modal-grid">'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('launchSite')) + '</span><span class="mg-val">' + esc(padName(l)) + '</span></div>'
      +     '<div class="mg-row"><span class="mg-key">' + esc(t('coordinates')) + '</span><span class="mg-val">' + esc(coords) + '</span></div>'
      +   '</div>'
      + '</div>'
      + '<div class="modal-section">'
      +   '<h4>' + esc(t('webcast')) + '</h4>'
      +   webcastHtml
      + '</div>';

    elModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    elModal.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------- 语言切换 ---------- */
  function applyLanguage() {
    lang = OK.lang;
    OK.applyI18n(copy);
    // 同步搜索框 placeholder
    elSearchInput.placeholder = t('searchPlaceholder');
    // 重新渲染动态内容
    if (allLaunches.length) {
      populateFilters();
      // 保留当前筛选值
      renderHero();
      renderList();
      startCountdown();
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 语言切换
    OK.initLangToggle(document.getElementById('langBtn'), copy, applyLanguage);

    // 刷新
    elRefreshBtn.addEventListener('click', function () {
      stopCountdown();
      loadData();
    });

    // 筛选变化
    elAgencyFilter.addEventListener('change', renderList);
    elStatusFilter.addEventListener('change', renderList);
    elSearchInput.addEventListener('input', renderList);

    // 弹窗关闭
    elModalClose.addEventListener('click', closeModal);
    elModalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !elModal.hidden) closeModal();
    });

    // 页面切换/隐藏时清理倒计时定时器，避免后台空跑
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopCountdown();
      } else if (nextLaunch) {
        startCountdown();
      }
    });
    window.addEventListener('pagehide', stopCountdown);
  }

  /* ---------- 启动 ---------- */
  OK.ready(function () {
    bindEvents();
    applyLanguage();
    loadData();
  });
})();
