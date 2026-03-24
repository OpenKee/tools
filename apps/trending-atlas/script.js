const langToggle = document.getElementById('langToggle');
const langSelect = document.getElementById('langSelect');
const statusBar = document.getElementById('statusBar');
const repoGrid = document.getElementById('repoGrid');
const paginationEl = document.getElementById('pagination');
const rangeButtons = document.querySelectorAll('.range-btn');

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051',
  HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883', Lua: '#000080',
  Zig: '#ec915c', Elixir: '#6e4a7e', Scala: '#c22d40', R: '#198CE7',
  'Jupyter Notebook': '#DA5B0B',
};

const copy = {
  en: {
    eyebrow: 'GitHub trending explorer',
    title: 'Trending Atlas',
    lead: 'Discover what the open-source world is building right now.',
    daily: 'Today',
    weekly: 'This week',
    monthly: 'This month',
    allLanguages: 'All languages',
    loading: 'Loading trending repos\u2026',
    error: 'Failed to load. GitHub search API may be rate-limited. Try again later.',
    empty: 'No repos found for this filter.',
    stars: 'stars',
    forks: 'forks',
    created: 'created',
    hot: 'hot',
    page: 'Page',
    of: 'of',
    results: 'repos found',
    openRepo: 'Open repo',
  },
  zh: {
    eyebrow: 'GitHub 热门探索',
    title: 'Trending Atlas',
    lead: '发现开源世界正在构建什么。',
    daily: '今天',
    weekly: '本周',
    monthly: '本月',
    allLanguages: '全部语言',
    loading: '正在加载热门仓库\u2026',
    error: '加载失败，GitHub 搜索 API 可能限流了，稍后再试。',
    empty: '这个筛选条件下没找到仓库。',
    stars: '星标',
    forks: 'Fork',
    created: '创建于',
    hot: '热门',
    page: '第',
    of: '/',
    results: '个仓库',
    openRepo: '打开仓库',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let currentRange = 'daily';
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;

function t(key) { return copy[lang][key] || key; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang === 'en' ? '中文' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
}

function getDateRange(range) {
  const now = new Date();
  let days;
  if (range === 'daily') days = 1;
  else if (range === 'weekly') days = 7;
  else days = 30;
  const d = new Date(now.getTime() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function number(v) {
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'zh-CN').format(v || 0);
}

function langColor(name) {
  return LANG_COLORS[name] || '#8b8b8b';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function relativeTime(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 2592000)}mo`;
}

function isHot(repo, range) {
  const since = getDateRange(range);
  const stars = repo.stargazers_count || 0;
  if (range === 'daily' && stars >= 200) return true;
  if (range === 'weekly' && stars >= 1000) return true;
  if (range === 'monthly' && stars >= 3000) return true;
  return false;
}

function renderCard(repo, rank, range) {
  const hot = isHot(repo, range);
  return `
    <article class="repo-card">
      <div class="card-head">
        <a class="card-name" href="${repo.html_url}" target="_blank" rel="noreferrer">${repo.full_name}</a>
        <span class="card-rank">#${rank}</span>
      </div>
      <p class="card-desc">${repo.description || ''}</p>
      <div class="card-meta">
        <span class="meta-item">\u2605 ${number(repo.stargazers_count)}</span>
        <span class="meta-item">\u0192 ${number(repo.forks_count)}</span>
        ${repo.language ? `<span class="meta-item"><span class="lang-dot" style="background:${langColor(repo.language)}"></span>${repo.language}</span>` : ''}
      </div>
      <div class="card-tags">
        ${hot ? `<span class="tag hot">${t('hot')}</span>` : ''}
        ${repo.open_issues_count > 0 ? `<span class="tag">${number(repo.open_issues_count)} issues</span>` : ''}
      </div>
      <div class="card-footer">
        <a class="card-link" href="${repo.html_url}" target="_blank" rel="noreferrer">${t('openRepo')} \u2192</a>
        <span class="card-created">${t('created')} ${formatDate(repo.created_at)}</span>
      </div>
    </article>
  `;
}

function renderPagination() {
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  const pages = [];
  const maxShow = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxShow - 1);
  if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);

  pages.push(`<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">\u2190</button>`);
  for (let i = start; i <= end; i++) {
    pages.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
  }
  pages.push(`<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">\u2192</button>`);

  paginationEl.innerHTML = pages.join('');
  paginationEl.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (p >= 1 && p <= totalPages) {
        currentPage = p;
        loadRepos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

async function loadLanguages() {
  try {
    const res = await fetch('https://api.github.com/languages');
    if (!res.ok) return;
    const langs = await res.json();
    const top = langs.slice(0, 30).map(l => l.name).sort();
    const current = langSelect.value;
    langSelect.innerHTML = `<option value="" data-i18n="allLanguages">${t('allLanguages')}</option>`;
    top.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      langSelect.appendChild(opt);
    });
    langSelect.value = current;
  } catch {}
}

async function loadRepos() {
  const since = getDateRange(currentRange);
  const langFilter = langSelect.value;
  let query = `created:>${since} stars:>10`;
  if (langFilter) query += ` language:${langFilter}`;

  const perPage = 24;
  statusBar.innerHTML = `<div class="loading"><span class="spinner"></span><span>${t('loading')}</span></div>`;
  repoGrid.innerHTML = '';

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}&page=${currentPage}`;
    const headers = {};
    const token = localStorage.getItem('repo-scope-token');
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (res.status === 403 || res.status === 429) {
      statusBar.innerHTML = `<p class="error-msg">${t('error')}</p>`;
      return;
    }
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    totalCount = data.total_count;
    totalPages = Math.ceil(totalCount / perPage);
    if (totalPages > 1000) totalPages = Math.ceil(1000 / perPage);

    statusBar.textContent = `${number(totalCount)} ${t('results')} \u00b7 ${t('page')} ${currentPage} ${t('of')} ${totalPages}`;

    if (!data.items?.length) {
      repoGrid.innerHTML = `<p class="empty-state">${t('empty')}</p>`;
      paginationEl.innerHTML = '';
      return;
    }

    const rankStart = (currentPage - 1) * perPage;
    repoGrid.innerHTML = data.items.map((repo, i) => renderCard(repo, rankStart + i + 1, currentRange)).join('');
    renderPagination();
  } catch (e) {
    statusBar.innerHTML = `<p class="error-msg">${t('error')}</p>`;
  }
}

rangeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    rangeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    currentPage = 1;
    loadRepos();
  });
});

langSelect.addEventListener('change', () => {
  currentPage = 1;
  loadRepos();
});

langToggle.addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('openkee-lang', lang);
  applyLanguage();
  loadLanguages();
  loadRepos();
});

applyLanguage();
loadLanguages();
loadRepos();
