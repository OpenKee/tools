const countrySelect = document.getElementById('countrySelect');
const yearSelect = document.getElementById('yearSelect');
const controlForm = document.getElementById('controlForm');
const langToggle = document.getElementById('langToggle');
const summary = document.getElementById('summary');
const countdownCard = document.getElementById('countdownCard');
const yearGrid = document.getElementById('yearGrid');
const optimizerList = document.getElementById('optimizerList');
const holidayList = document.getElementById('holidayList');

const COUNTRIES = [
  ['CN', { en: 'China', zh: '中国' }],
  ['US', { en: 'United States', zh: '美国' }],
  ['GB', { en: 'United Kingdom', zh: '英国' }],
  ['JP', { en: 'Japan', zh: '日本' }],
  ['DE', { en: 'Germany', zh: '德国' }],
  ['FR', { en: 'France', zh: '法国' }],
  ['KR', { en: 'South Korea', zh: '韩国' }],
  ['SG', { en: 'Singapore', zh: '新加坡' }],
  ['AU', { en: 'Australia', zh: '澳大利亚' }],
  ['CA', { en: 'Canada', zh: '加拿大' }],
  ['IN', { en: 'India', zh: '印度' }],
  ['BR', { en: 'Brazil', zh: '巴西' }],
];

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const copy = {
  en: {
    eyebrow: 'Holiday & leave optimizer',
    title: 'Offday Planner',
    lead: 'See holidays at a glance, find long weekends, and get the smartest days to take off.',
    totalHolidays: 'Holidays',
    longWeekends: 'Long weekends',
    nextHoliday: 'Next holiday',
    daysUntil: 'days until',
    daysFromNow: 'days from now',
    today: 'today!',
    holidaysThisYear: 'public holidays this year',
    weekendsFound: '3-day+ breaks found',
    optimizer: 'Leave optimizer',
    optimizerDesc: 'Take these days off to get the longest consecutive breaks.',
    allHolidays: 'All holidays',
    loading: 'Loading holidays\u2026',
    error: 'Failed to load. Check your country/year selection.',
    takeDays: 'Take {n} day(s) off',
    getDays: 'Get {n} day(s) break',
    noData: 'No data available.',
    public: 'Public',
  },
  zh: {
    eyebrow: '假期 & 请假优化器',
    title: 'Offday Planner',
    lead: '一目了然看假期，找长周末，算出最聪明的请假方案。',
    totalHolidays: '假期数',
    longWeekends: '长周末',
    nextHoliday: '下一个假期',
    daysUntil: '天后',
    daysFromNow: '天后',
    today: '就是今天！',
    holidaysThisYear: '个公共假期',
    weekendsFound: '个 3 天以上的连休',
    optimizer: '请假优化',
    optimizerDesc: '请这些天假，获得最长连续休息。',
    allHolidays: '全部假期',
    loading: '正在加载假期\u2026',
    error: '加载失败，请检查国家/年份选择。',
    takeDays: '请 {n} 天假',
    getDays: '获得 {n} 天连休',
    noData: '暂无数据。',
    public: '公共',
  },
};


// Holiday duration mapping (days). Only applies to countries where multi-day holidays are common.
const HOLIDAY_SPANS = {
  CN: {
    '元旦': 1, "New Year's Day": 1,
    '春节': 7, 'Chinese New Year (Spring Festival)': 7,
    '清明节': 1, 'Qingming Festival': 1,
    '劳动节': 5, 'Labour Day': 5,
    '端午节': 3, 'Dragon Boat Festival': 3,
    '中秋节': 1, 'Mid-Autumn Festival': 1,
    '国庆节': 7, 'National Day': 7,
  },
  JP: {
    '正月': 3, "New Year's Day": 3,
    'ゴールデンウィーク': 5, 'Showa Day': 1,
    '振替休日': 1,
  },
};

function expandHolidays(holidays, country) {
  const spans = HOLIDAY_SPANS[country] || {};
  const expanded = new Map();
  holidays.forEach(h => {
    const span = Math.max(1, spans[h.localName] || spans[h.name] || 1);
    const base = new Date(h.date);
    for (let i = 0; i < span; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const ds = d.toISOString().slice(0, 10);
      if (!expanded.has(ds)) {
        expanded.set(ds, { ...h, date: ds, isMainDay: i === 0, spanDay: i + 1, spanTotal: span });
      }
    }
  });
  return [...expanded.values()].sort((a, b) => a.date.localeCompare(b.date));
}

let lang = localStorage.getItem('openkee-lang') || 'en';
let holidaysCache = [];

function t(key) { return copy[lang][key] || key; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang === 'en' ? '中文' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  if (holidaysCache.length) renderAll(holidaysCache);
}

function populateControls() {
  countrySelect.innerHTML = COUNTRIES.map(([c, n]) => `<option value="${c}">${n[lang]}</option>`).join('');
  countrySelect.value = 'CN';
  const y = new Date().getFullYear();
  yearSelect.innerHTML = [y - 1, y, y + 1].map(v => `<option value="${v}">${v}</option>`).join('');
  yearSelect.value = String(y);
}

function dayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(year, month, day) {
  const d = dayOfWeek(year, month, day);
  return d === 0 || d === 6;
}

function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function findLongWeekends(holidays) {
  const holiSet = new Set(holidays.map(h => h.date));
  const results = [];
  const year = Number(yearSelect.value);

  for (let m = 1; m <= 12; m++) {
    const days = daysInMonth(year, m);
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(year, m, d);
      if (!holiSet.has(ds)) continue;
      const dow = dayOfWeek(year, m, d);
      // Friday holiday = Sat+Sun+Fri off
      if (dow === 5) {
        const hol = holidays.find(h => h.date === ds);
        results.push({ date: ds, type: 'friday', name: hol?.localName || '', days: 3, leaveNeeded: 0 });
      }
      // Monday holiday = Sat+Sun+Mon off
      if (dow === 1) {
        const hol = holidays.find(h => h.date === ds);
        results.push({ date: ds, type: 'monday', name: hol?.localName || '', days: 3, leaveNeeded: 0 });
      }
      // Tue holiday = take Mon off → 4 days
      if (dow === 2) {
        const hol = holidays.find(h => h.date === ds);
        results.push({ date: ds, type: 'tuesday', name: hol?.localName || '', days: 4, leaveNeeded: 1, leaveDate: dateStr(year, m, d - 1) });
      }
      // Thu holiday = take Fri off → 4 days
      if (dow === 4) {
        const hol = holidays.find(h => h.date === ds);
        results.push({ date: ds, type: 'thursday', name: hol?.localName || '', days: 4, leaveNeeded: 1, leaveDate: dateStr(year, m, d + 1) });
      }
      // Wed holiday = take Thu+Fri off → 5 days (Sat-Wed-Thu-Fri-Sun no... take Thu Fri)
      if (dow === 3) {
        const hol = holidays.find(h => h.date === ds);
        results.push({ date: ds, type: 'wednesday', name: hol?.localName || '', days: 5, leaveNeeded: 2, leaveDates: [dateStr(year, m, d + 1), dateStr(year, m, d + 2)] });
      }
    }
  }
  return results.sort((a, b) => b.days - a.days || a.date.localeCompare(b.date));
}

function findLeaveOptimizers(longWeekends) {
  return longWeekends
    .filter(w => w.leaveNeeded > 0)
    .sort((a, b) => (b.days / b.leaveNeeded) - (a.days / a.leaveNeeded))
    .slice(0, 6);
}

function nextHolidayInfo(holidays) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.filter(h => h.date >= today);
  if (!upcoming.length) return null;
  const next = upcoming[0];
  const diff = Math.ceil((new Date(next.date) - new Date(today)) / 86400000);
  return { ...next, daysUntil: diff };
}

function renderSummary(holidays, longWeekends) {
  const nh = nextHolidayInfo(holidays);
  summary.innerHTML = `
    <div class="summary-card">
      <div class="label">${t('totalHolidays')}</div>
      <div class="value">${holidays.length}</div>
      <div class="sub">${t('holidaysThisYear')}</div>
    </div>
    <div class="summary-card">
      <div class="label">${t('longWeekends')}</div>
      <div class="value">${longWeekends.filter(w => w.leaveNeeded === 0).length}</div>
      <div class="sub">${t('weekendsFound')}</div>
    </div>
    <div class="summary-card">
      <div class="label">${t('nextHoliday')}</div>
      <div class="value">${nh ? nh.localName : '—'}</div>
      <div class="sub">${nh ? (nh.daysUntil === 0 ? t('today') : `${nh.daysUntil} ${t('daysUntil')}`) : ''}</div>
    </div>
  `;
}

function renderCountdown(holidays) {
  const nh = nextHolidayInfo(holidays);
  if (!nh) { countdownCard.innerHTML = ''; return; }
  countdownCard.innerHTML = `
    <span class="countdown-days">${nh.daysUntil}</span>
    <div class="countdown-info">
      <strong>${nh.localName}</strong> · ${nh.date} · ${nh.daysUntil === 0 ? t('today') : `${nh.daysUntil} ${t('daysFromNow')}`}
    </div>
  `;
}

function renderYearCalendar(holidays) {
  const year = Number(yearSelect.value);
  const holiMap = {};
  holidays.forEach(h => { holiMap[h.date] = h.localName; });
  const todayStr = new Date().toISOString().slice(0, 10);

  yearGrid.innerHTML = Array.from({ length: 12 }, (_, mi) => {
    const m = mi + 1;
    const days = daysInMonth(year, m);
    const firstDow = (dayOfWeek(year, m, 1) + 6) % 7; // Mon=0
    const holCount = holidays.filter(h => {
      const hm = Number(h.date.slice(5, 7));
      return hm === m;
    }).length;

    let cells = (lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN).map(d => `<div class="cal-head">${d}</div>`).join('');
    for (let i = 0; i < firstDow; i++) cells += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(year, m, d);
      const we = isWeekend(year, m, d);
      const hol = holiMap[ds];
      const today = ds === todayStr;
      let cls = 'cal-day';
      if (we) cls += ' weekend';
      if (today) cls += ' today';
      const hInfo = holidays.find(hh => hh.date === ds);
      if (hol) {
        cls += ' holiday';
        if (hInfo && hInfo.spanTotal > 1) {
          if (hInfo.spanDay === 1) cls += ' holiday-start';
          else if (hInfo.spanDay === hInfo.spanTotal) cls += ' holiday-end';
        } else {
          cls += ' holiday-single';
        }
      }
      const titleText = hInfo ? (hInfo.spanTotal > 1 ? `${hol} (${hInfo.spanDay}/${hInfo.spanTotal})` : hol) : '';
      cells += `<div class="${cls}" title="${titleText}">${d}</div>`;
    }
    return `<div class="month-card">
      <div class="month-name">${(lang === 'zh' ? MONTHS_ZH : MONTHS_EN)[mi]}<span class="month-count">${holCount} ${t('public')}</span></div>
      <div class="cal-grid">${cells}</div>
    </div>`;
  }).join('');
}

function renderOptimizer(longWeekends) {
  const opts = findLeaveOptimizers(longWeekends);
  if (!opts.length) { optimizerList.innerHTML = `<p style="color:var(--muted);padding:1rem;">${t('noData')}</p>`; return; }

  optimizerList.innerHTML = opts.map(w => {
    const leaveDates = w.leaveDates || (w.leaveDate ? [w.leaveDate] : []);
    const ratio = `${w.leaveNeeded}→${w.days}`;
    return `<div class="optimize-card">
      <div class="opt-title">${w.name}</div>
      <div class="opt-break">${t('takeDays').replace('{n}', w.leaveNeeded)} → ${t('getDays').replace('{n}', w.days)}</div>
      <div class="opt-detail">${w.date} (${w.type})</div>
      <div class="opt-days">${leaveDates.map(d => `<span class="opt-tag">${d}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function renderHolidayList(holidays) {
  const groups = [];
  let current = null;
  holidays.forEach(h => {
    if (current && current.localName === h.localName) {
      current.endDate = h.date;
      current.days++;
      current.dates.push(h.date);
    } else {
      if (current) groups.push(current);
      current = { localName: h.localName, name: h.name, startDate: h.date, endDate: h.date, days: 1, dates: [h.date] };
    }
  });
  if (current) groups.push(current);

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const dowLabels = lang === 'zh' ? ['日','一','二','三','四','五','六'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  holidayList.innerHTML = groups.map(g => {
    const start = new Date(g.startDate);
    const end = new Date(g.endDate);
    const rangeFmt = g.days > 1
      ? `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
      : start.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });

    const dayStrip = g.dates.map(ds => {
      const dd = new Date(ds);
      const dow = dd.getDay();
      const isWe = dow === 0 || dow === 6;
      const label = `${dd.getDate()}/${dd.getMonth()+1}`;
      return `<span class="day-chip${isWe ? ' day-we' : ''}">${label} ${dowLabels[dow]}</span>`;
    }).join('');

    return `<div class="holiday-row">
      <div class="holiday-left">
        <div class="holiday-range">${rangeFmt}</div>
        <div class="day-strip">${dayStrip}</div>
      </div>
      <div class="holiday-mid">
        <div class="holiday-name">${g.localName}</div>
        ${g.localName !== g.name ? `<div class="holiday-local">${g.name}</div>` : ''}
      </div>
      <span class="holiday-badge${g.days > 1 ? ' weekend-badge' : ''}">${g.days}d</span>
    </div>`;
  }).join('');
}

function renderAll(holidays) {
  const country = countrySelect.value;
  holidays = expandHolidays(holidays, country);
  holidaysCache = holidays;
  const lw = findLongWeekends(holidays);
  renderSummary(holidays, lw);
  renderCountdown(holidays);
  renderYearCalendar(holidays);
  renderOptimizer(lw);
  renderHolidayList(holidays);
}

async function loadHolidays() {
  const country = countrySelect.value;
  const year = yearSelect.value;
  yearGrid.innerHTML = `<div class="loading"><span class="spinner"></span><span>${t('loading')}</span></div>`;
  optimizerList.innerHTML = '';
  holidayList.innerHTML = '';

  try {
    const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${country}`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    renderAll(data);
  } catch {
    yearGrid.innerHTML = `<p style="color:#a33;padding:1rem;">${t('error')}</p>`;
  }
}

// Events
controlForm.addEventListener('change', loadHolidays);
langToggle.addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('openkee-lang', lang);
  applyLanguage();
  populateControls();
  loadHolidays();
});

// Init
populateControls();
applyLanguage();
loadHolidays();
