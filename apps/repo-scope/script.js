const langToggle = document.getElementById('langToggle');
const userForm = document.getElementById('userForm');
const usernameInput = document.getElementById('usernameInput');
const tokenInput = document.getElementById('tokenInput');
const tokenSave = document.getElementById('tokenSave');
const tokenClear = document.getElementById('tokenClear');
const profileSection = document.getElementById('profileSection');
const avatar = document.getElementById('avatar');
const profileName = document.getElementById('profileName');
const profileBio = document.getElementById('profileBio');
const profileMeta = document.getElementById('profileMeta');
const profileLink = document.getElementById('profileLink');
const statStrip = document.getElementById('statStrip');
const scoreSection = document.getElementById('scoreSection');
const scoreRing = document.getElementById('scoreRing');
const scoreDesc = document.getElementById('scoreDesc');
const langSection = document.getElementById('langSection');
const langBars = document.getElementById('langBars');
const repoSection = document.getElementById('repoSection');
const sortSelect = document.getElementById('sortSelect');
const repoSearch = document.getElementById('repoSearch');
const repoGrid = document.getElementById('repoGrid');
const repoPagination = document.getElementById('repoPagination');
const repoLayout = document.getElementById('repoLayout');
const detailSection = document.getElementById('detailSection');
const detailName = document.getElementById('detailName');
const detailBody = document.getElementById('detailBody');
const detailClose = document.getElementById('detailClose');

// 复用共享设计系统中的语言颜色映射，避免重复定义
const LANG_COLORS = OK.githubLangColors;

const copy = {
  en: {
    eyebrow:'GitHub analysis utility', title:'Repo Scope',
    lead:'Analyze any GitHub user — repos, languages, activity scores, and health at a glance.',
    analyze:'Analyze', tokenToggle:'Optional: GitHub token', tokenSave:'Save', tokenClear:'Clear',
    openProfile:'Open profile →', activityScore:'Activity score',
    languages:'Languages', repositories:'Repositories', close:'Close',
    byStars:'By stars', byUpdated:'By updated', byForks:'By forks', byName:'By name',
    followers:'Followers', publicRepos:'Public repos', totalStars:'Total stars', repos:'repos',
    loading:'Loading\u2026',
    errorRateLimit:'GitHub API rate limit exceeded. Add a personal access token to raise limit to 5000/hr.',
    errorRateLimitReset:'Resets at {time}.',
    errorForbidden:'Access forbidden. The user may be suspended or a token is required.',
    errorNotFound:'User not found.', errorGeneric:'Error: {msg}',
    tokenRecommended:'Tip: GitHub limits unauthenticated requests to 60/hr. Add a token below for reliable analysis.',
    fresh:'fresh', dormant:'dormant', hot:'hot', fork:'fork',
    created:'Created', pushed:'Last push', license:'License', topics:'Topics',
    scoreHigh:'Very active — regular commits, stars growing, healthy issue response.',
    scoreMid:'Moderately active — some recent activity, decent engagement.',
    scoreLow:'Quiet — limited recent activity or very new account.',
    noRepos:'No repositories.', noLang:'No language data.',
    stars:'stars', forks:'forks', issues:'issues',
    watchers:'Watchers', size:'Size', language:'Language', defaultBranch:'Branch',
    homepage:'Homepage',
  },
  zh: {
    eyebrow:'GitHub 分析工具', title:'Repo Scope',
    lead:'分析任意 GitHub 用户 — 仓库、语言、活跃度评分、健康度一目了然。',
    analyze:'分析', tokenToggle:'可选：GitHub token', tokenSave:'保存', tokenClear:'清除',
    openProfile:'打开主页 →', activityScore:'活跃度评分',
    languages:'语言分布', repositories:'仓库', close:'关闭',
    byStars:'按星标', byUpdated:'按更新', byForks:'按 Fork', byName:'按名称',
    followers:'关注者', publicRepos:'公开仓库', totalStars:'累计星标', repos:'个仓库',
    loading:'加载中\u2026',
    errorRateLimit:'GitHub API 请求次数已达上限。添加 Personal Access Token 可提升到 5000 次/小时。',
    errorRateLimitReset:'重置时间：{time}',
    errorForbidden:'访问被拒绝。该用户可能已被冻结，或需要提供 token。',
    errorNotFound:'用户不存在。', errorGeneric:'出错：{msg}',
    tokenRecommended:'提示：GitHub 未认证请求限制为 60 次/小时。建议在下方添加 token 以获得稳定体验。',
    fresh:'刚更新', dormant:'沉寂', hot:'热门', fork:'复刻',
    created:'创建于', pushed:'最近推送', license:'许可证', topics:'标签',
    scoreHigh:'非常活跃 — 定期提交，星标增长，issue 响应健康。',
    scoreMid:'一般活跃 — 有一些近期活动，参与度还行。',
    scoreLow:'安静 — 近期活动少，或者是新账户。',
    noRepos:'没有仓库。', noLang:'没有语言数据。',
    stars:'星标', forks:'Fork', issues:'议题',
    watchers:'关注', size:'大小', language:'语言', defaultBranch:'分支',
    homepage:'主页',
  },
};

let lang = OK.lang;
let ghToken = localStorage.getItem('repo-scope-token') || '';
let allRepos = [];
let filteredRepos = [];
let currentPage = 1;
const PER_PAGE = 20;
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟缓存

if (ghToken) tokenInput.value = ghToken;

function t(k) { return copy[lang][k] || k; }
function num(v) { return new Intl.NumberFormat(lang==='en'?'en-US':'zh-CN').format(v||0); }
function langColor(n) { return LANG_COLORS[n]||'#8b8b8b'; }

function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
}

function rateLimitInfo(r) {
  return {
    limit: parseInt(r.headers.get('x-ratelimit-limit')||'0',10),
    remaining: parseInt(r.headers.get('x-ratelimit-remaining')||'0',10),
    reset: parseInt(r.headers.get('x-ratelimit-reset')||'0',10),
  };
}

async function getJson(url) {
  const h = {Accept:'application/vnd.github+json'};
  if (ghToken) h.Authorization = `Bearer ${ghToken}`;
  const r = await fetch(url,{headers:h});
  const rl = rateLimitInfo(r);
  if (r.status===403) {
    // 403 可能是限流，也可能是其他禁止访问场景；结合 remaining 判断
    if (rl.remaining === 0 || rl.limit === 60) {
      const err = new Error('rate_limit');
      err.resetAt = rl.reset ? new Date(rl.reset * 1000) : null;
      throw err;
    }
    throw new Error('forbidden');
  }
  if (r.status===404) throw new Error('not_found');
  if (!r.ok) { const b=await r.json().catch(()=>({})); throw new Error(b.message||`${r.status}`); }
  return r.json();
}

function cacheKey(username) { return 'repo-scope-cache-' + username.toLowerCase(); }

function getCache(username) {
  try {
    const raw = localStorage.getItem(cacheKey(username));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > CACHE_TTL) return null;
    return data;
  } catch (e) { return null; }
}

function setCache(username, profile, repos) {
  try {
    localStorage.setItem(cacheKey(username), JSON.stringify({ ts: Date.now(), profile, repos }));
  } catch (e) {}
}

function daysSince(d) { return (Date.now()-new Date(d).getTime())/86400000; }

function repoTags(repo) {
  const tags = [];
  if (daysSince(repo.updated_at)<21) tags.push({text:t('fresh'),cls:'fresh'});
  if (daysSince(repo.updated_at)>180) tags.push({text:t('dormant'),cls:'dormant'});
  if ((repo.stargazers_count||0)>=50) tags.push({text:t('hot'),cls:'hot'});
  if (repo.fork) tags.push({text:t('fork'),cls:''});
  return tags;
}

function calcScore(profile, repos) {
  let score = 0;
  // Account age (max 15)
  const ageDays = daysSince(profile.created_at);
  score += Math.min(15, ageDays / 100);
  // Public repos (max 20)
  score += Math.min(20, repos.length * 1.5);
  // Total stars (max 25)
  const stars = repos.reduce((s,r)=>s+(r.stargazers_count||0),0);
  score += Math.min(25, Math.log10(stars+1) * 8);
  // Recent activity (max 25)
  const recent = repos.filter(r => daysSince(r.pushed_at) < 90).length;
  score += Math.min(25, recent * 3);
  // Forks indicate community use (max 15)
  const forks = repos.reduce((s,r)=>s+(r.forks_count||0),0);
  score += Math.min(15, Math.log10(forks+1) * 6);
  return Math.min(100, Math.round(score));
}

function renderProfile(profile) {
  profileSection.style.display = '';
  avatar.src = profile.avatar_url;
  profileName.textContent = profile.name || profile.login;
  profileBio.textContent = profile.bio || '';
  profileLink.href = profile.html_url;
  profileMeta.innerHTML = [
    profile.company ? `<span class="meta-item">🏢 ${OK.escape(profile.company)}</span>` : '',
    profile.location ? `<span class="meta-item">📍 ${OK.escape(profile.location)}</span>` : '',
    profile.blog ? `<span class="meta-item">🔗 <a href="${OK.escape(profile.blog.startsWith('http')?profile.blog:'https://'+profile.blog)}" target="_blank">${OK.escape(profile.blog)}</a></span>` : '',
    `<span class="meta-item">📅 ${new Date(profile.created_at).toLocaleDateString(lang==='en'?'en-US':'zh-CN')}</span>`,
  ].filter(Boolean).join('');
}

function renderStats(profile, repos) {
  const stars = repos.reduce((s,r)=>s+(r.stargazers_count||0),0);
  const langs = new Set(repos.map(r=>r.language).filter(Boolean));
  statStrip.innerHTML = `
    <div class="stat-card"><div class="stat-label">${t('followers')}</div><div class="stat-value">${num(profile.followers)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('publicRepos')}</div><div class="stat-value">${num(repos.length)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('totalStars')}</div><div class="stat-value">${num(stars)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('languages')}</div><div class="stat-value">${langs.size}</div><div class="stat-sub">${t('repos')}</div></div>
  `;
}

function renderScore(profile, repos) {
  scoreSection.style.display = '';
  const score = calcScore(profile, repos);
  scoreRing.textContent = score;
  scoreRing.className = 'score-ring ' + (score >= 65 ? 'high' : score >= 35 ? 'mid' : 'low');
  scoreDesc.textContent = score >= 65 ? t('scoreHigh') : score >= 35 ? t('scoreMid') : t('scoreLow');
}

function renderLanguages(repos) {
  langSection.style.display = '';
  const counts = {};
  repos.forEach(r => { if (r.language) counts[r.language] = (counts[r.language]||0)+1; });
  const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const max = ranked[0]?.[1] || 1;
  langBars.innerHTML = ranked.map(([name,count]) => `
    <div class="lang-bar-row">
      <span class="lang-bar-name"><span class="lang-dot" style="background:${langColor(name)}"></span> ${OK.escape(name)}</span>
      <div class="lang-bar-track"><div class="lang-bar-fill" style="width:${(count/max*100).toFixed(1)}%;background:${langColor(name)}"></div></div>
      <span class="lang-bar-pct">${num(count)}</span>
    </div>
  `).join('');
}

function renderRepos(repos) {
  repoLayout.style.display = '';
  const search = repoSearch.value.toLowerCase();
  filteredRepos = repos.filter(r => !search || r.name.toLowerCase().includes(search) || (r.description||'').toLowerCase().includes(search));
  currentPage = 1;
  renderRepoPage();
}

function renderRepoPage() {
  const start = (currentPage-1)*PER_PAGE;
  const page = filteredRepos.slice(start, start+PER_PAGE);
  repoGrid.innerHTML = page.map(r => {
    const tags = repoTags(r).map(tag => `<span class="repo-tag ${tag.cls}">${tag.text}</span>`).join('');
    return `<div class="repo-card" data-repo="${OK.escape(r.full_name)}">
      <span class="repo-card-name">${OK.escape(r.name)}</span>
      <span class="repo-card-stats">\u2605 ${num(r.stargazers_count)} · \u0192 ${num(r.forks_count)}${r.language ? ` · <span class="lang-dot" style="background:${langColor(r.language)}"></span>` : ''}</span>
      ${r.description ? `<p class="repo-card-desc">${OK.escape(r.description)}</p>` : ''}
      ${tags ? `<div class="repo-card-tags">${tags}</div>` : ''}
    </div>`;
  }).join('') || `<div class="loading">${t('noRepos')}</div>`;

  repoGrid.querySelectorAll('.repo-card').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.repo));
  });

  // Pagination
  const totalPages = Math.ceil(filteredRepos.length / PER_PAGE);
  if (totalPages <= 1) { repoPagination.innerHTML = ''; return; }
  const btns = [];
  btns.push(`<button class="page-btn" ${currentPage<=1?'disabled':''} data-p="${currentPage-1}">\u2190</button>`);
  for (let i=1;i<=Math.min(totalPages,8);i++) btns.push(`<button class="page-btn ${i===currentPage?'active':''}" data-p="${i}">${i}</button>`);
  btns.push(`<button class="page-btn" ${currentPage>=totalPages?'disabled':''} data-p="${currentPage+1}">\u2192</button>`);
  repoPagination.innerHTML = btns.join('');
  repoPagination.querySelectorAll('.page-btn').forEach(b => {
    b.addEventListener('click', () => { currentPage=Number(b.dataset.p); renderRepoPage(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
}

async function loadDetail(fullName) {
  detailSection.style.display = '';
  detailName.textContent = fullName;
  detailBody.innerHTML = `<div class="loading"><span class="spinner"></span>${t('loading')}</div>`;
  try {
    const r = await getJson(`https://api.github.com/repos/${fullName}`);
    const tags = repoTags(r).map(tag=>`<span class="repo-tag ${tag.cls}">${tag.text}</span>`).join(' ');
    detailBody.innerHTML = `
      <div class="detail-item"><div class="d-label">${t('stars')}</div><div class="d-value">${num(r.stargazers_count)}</div></div>
      <div class="detail-item"><div class="d-label">${t('forks')}</div><div class="d-value">${num(r.forks_count)}</div></div>
      <div class="detail-item"><div class="d-label">${t('issues')}</div><div class="d-value">${num(r.open_issues_count)}</div></div>
      <div class="detail-item"><div class="d-label">${t('watchers')}</div><div class="d-value">${num(r.subscribers_count??r.watchers_count)}</div></div>
      <div class="detail-item"><div class="d-label">${t('language')}</div><div class="d-value">${OK.escape(r.language||'\u2014')}</div></div>
      <div class="detail-item"><div class="d-label">${t('license')}</div><div class="d-value">${OK.escape(r.license?.spdx_id||'\u2014')}</div></div>
      <div class="detail-item"><div class="d-label">${t('size')}</div><div class="d-value">${num(r.size)} KB</div></div>
      <div class="detail-item"><div class="d-label">${t('defaultBranch')}</div><div class="d-value">${OK.escape(r.default_branch)}</div></div>
      <div class="detail-item"><div class="d-label">${t('created')}</div><div class="d-value">${new Date(r.created_at).toLocaleDateString(lang==='en'?'en-US':'zh-CN')}</div></div>
      <div class="detail-item"><div class="d-label">${t('pushed')}</div><div class="d-value">${new Date(r.pushed_at).toLocaleDateString(lang==='en'?'en-US':'zh-CN')}</div></div>
      ${r.homepage ? `<div class="detail-item"><div class="d-label">${t('homepage')}</div><div class="d-value"><a href="${OK.escape(r.homepage)}" target="_blank">${OK.escape(r.homepage)}</a></div></div>` : ''}
      ${r.topics?.length ? `<div class="detail-item" style="grid-column:1/-1"><div class="d-label">${t('topics')}</div><div class="d-value">${r.topics.map(tp=>`<span class="repo-tag">${OK.escape(tp)}</span>`).join(' ')}</div></div>` : ''}
      <div style="grid-column:1/-1;margin-top:0.3rem">${tags}<a href="${OK.escape(r.html_url)}" target="_blank" style="margin-left:0.5rem;font-size:0.78rem">GitHub →</a></div>
    `;
  } catch(e) {
    detailBody.innerHTML = `<p class="error-msg">${OK.escape(e.message)}</p>`;
  }
}

async function analyzeUser(username) {
  if (!username) return;
  profileSection.style.display = 'none';
  scoreSection.style.display = 'none';
  langSection.style.display = 'none';
  repoLayout.style.display = 'none';
  detailSection.style.display = 'none';
  repoGrid.innerHTML = `<div class="loading"><span class="spinner"></span>${t('loading')}</div>`;

  // 优先使用缓存，避免重复触发限流
  const cached = getCache(username);
  if (cached) {
    renderFromData(cached.profile, cached.repos);
    // 后台静默刷新一次（不阻塞 UI）
    refreshInBackground(username);
    return;
  }

  try {
    const [profile, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${username}`),
      getJson(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`),
    ]);
    allRepos = repos.filter(r=>!r.fork).sort((a,b)=>b.stargazers_count-a.stargazers_count);
    setCache(username, profile, allRepos);
    renderFromData(profile, allRepos);
  } catch(e) {
    repoGrid.innerHTML = '';
    let msg;
    if (e.message==='rate_limit') {
      msg = t('errorRateLimit');
      if (e.resetAt) {
        msg += ' ' + t('errorRateLimitReset').replace('{time}', e.resetAt.toLocaleTimeString(lang==='en'?'en-US':'zh-CN'));
      }
      // 自动展开 token 输入区，提醒用户填入
      document.querySelector('.token-toggle').open = true;
      tokenInput.focus();
    } else if (e.message==='forbidden') {
      msg = t('errorForbidden');
    } else if (e.message==='not_found') {
      msg = t('errorNotFound');
    } else {
      msg = t('errorGeneric').replace('{msg}', OK.escape(e.message));
    }
    repoGrid.innerHTML = `<p class="error-msg">${msg}</p>`;
  }
}

function renderFromData(profile, repos) {
  allRepos = repos;
  renderProfile(profile);
  renderStats(profile, allRepos);
  renderScore(profile, allRepos);
  renderLanguages(allRepos);
  sortAndRender();
}

async function refreshInBackground(username) {
  try {
    const [profile, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${username}`),
      getJson(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`),
    ]);
    const nonForks = repos.filter(r=>!r.fork).sort((a,b)=>b.stargazers_count-a.stargazers_count);
    setCache(username, profile, nonForks);
    if (usernameInput.value.trim().toLowerCase() === username.toLowerCase()) {
      renderFromData(profile, nonForks);
    }
  } catch (e) { /* 静默失败，缓存数据仍可用 */ }
}

function sortAndRender() {
  const sort = sortSelect.value;
  const sorted = [...allRepos];
  if (sort==='stars') sorted.sort((a,b)=>b.stargazers_count-a.stargazers_count);
  else if (sort==='updated') sorted.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  else if (sort==='forks') sorted.sort((a,b)=>b.forks_count-a.forks_count);
  else sorted.sort((a,b)=>a.name.localeCompare(b.name));
  renderRepos(sorted);
}

// Events
userForm.addEventListener('submit', e=>{ e.preventDefault(); analyzeUser(usernameInput.value.trim()); });
sortSelect.addEventListener('change', sortAndRender);
repoSearch.addEventListener('input', sortAndRender);
detailClose.addEventListener('click', ()=>{ detailSection.style.display='none'; });
OK.initLangToggle(langToggle, copy, applyLanguage);
tokenSave.addEventListener('click', ()=>{
  const v=tokenInput.value.trim(); if(!v) return;
  ghToken=v; localStorage.setItem('repo-scope-token',v);
  tokenInput.classList.add('token-ok'); setTimeout(()=>tokenInput.classList.remove('token-ok'),1500);
});
tokenClear.addEventListener('click', ()=>{ ghToken=''; localStorage.removeItem('repo-scope-token'); tokenInput.value=''; });

// Init
applyLanguage();

// Auto-load from URL hash
const hashUser = decodeURIComponent(location.hash.slice(1));
if (hashUser) { usernameInput.value = hashUser; analyzeUser(hashUser); }
