const countryInput = document.getElementById('countryInput');
const countryList = document.getElementById('countryList');
const tagInput = document.getElementById('tagInput');
const tagList = document.getElementById('tagList');
const nameInput = document.getElementById('nameInput');
const searchBtn = document.getElementById('searchBtn');
const randomBtn = document.getElementById('randomBtn');
const favBtn = document.getElementById('favBtn');
const resultCount = document.getElementById('resultCount');
const stationGrid = document.getElementById('stationGrid');
const loadMore = document.getElementById('loadMore');
const playerBar = document.getElementById('playerBar');
const playerFavicon = document.getElementById('playerFavicon');
const playerName = document.getElementById('playerName');
const playerMeta = document.getElementById('playerMeta');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const stopBtn = document.getElementById('stopBtn');
const volumeInput = document.getElementById('volumeInput');
const audio = document.getElementById('audio');
const langToggle = document.getElementById('langToggle');

const API = 'https://de1.api.radio-browser.info/json';
const PAGE = 40;

const copy = {
  en: {
    eyebrow:'Global radio explorer', title:'Radio Atlas',
    lead:'Tune into live stations from every corner of the world.',
    search:'Search', random:'🎲 Random', favorites:'⭐ Favorites',
    votes:'votes', clicks:'clicks', bitrate:'kbps',
    play:'Play', stop:'Stop', noResults:'No stations found.',
    loadMore:'Scroll for more', end:'End of results',
    nowPlaying:'Now playing', favsTitle:'Your favorites',
    removeFav:'Remove', addFav:'Save',
  },
  zh: {
    eyebrow:'全球电台探索器', title:'Radio Atlas',
    lead:'收听世界各地的在线直播电台。',
    search:'搜索', random:'🎲 随机', favorites:'⭐ 收藏',
    votes:'票', clicks:'点击', bitrate:'kbps',
    play:'播放', stop:'停止', noResults:'没有找到电台。',
    loadMore:'向下滚动加载更多', end:'已全部加载',
    nowPlaying:'正在播放', favsTitle:'你的收藏',
    removeFav:'取消', addFav:'收藏',
  },
};

let lang = localStorage.getItem('openkee-lang') || 'en';
let stations = [];
let countries = [];
let tags = [];
let playing = null;
let offset = 0;
let loading = false;
let ended = false;
let showingFavs = false;

function t(k) { return copy[lang][k] || k; }

function applyLanguage() {
  document.documentElement.lang = lang;
  langToggle.textContent = lang==='en'?'中文':'EN';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
}

function getFavs() {
  try { return JSON.parse(localStorage.getItem('radio-favs')||'[]'); } catch { return []; }
}
function setFavs(f) { localStorage.setItem('radio-favs', JSON.stringify(f)); }
function isFav(id) { return getFavs().some(s => s.stationuuid === id); }
function toggleFav(station) {
  const f = getFavs();
  const idx = f.findIndex(s => s.stationuuid === station.stationuuid);
  if (idx >= 0) f.splice(idx, 1); else f.push(station);
  setFavs(f);
  return idx < 0;
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function loadMeta() {
  [countries, tags] = await Promise.all([
    getJson(`${API}/countries`),
    getJson(`${API}/tags`),
  ]);
  countryList.innerHTML = countries.slice(0, 200).map(c => `<option value="${c.name}">`).join('');
  tagList.innerHTML = tags.slice(0, 200).map(t => `<option value="${t.name}">`).join('');
}

function renderCard(s) {
  const playingCls = playing?.stationuuid === s.stationuuid ? ' playing' : '';
  const favCls = isFav(s.stationuuid) ? ' active' : '';
  const tags = (s.tags||'').split(',').filter(Boolean).slice(0, 3).map(tag => `<span class="card-tag">${tag.trim()}</span>`).join('');
  return `<div class="station-card${playingCls}" data-id="${s.stationuuid}">
    <div class="card-top">
      <img class="card-favicon" src="${s.favicon || ''}" alt="" onerror="this.style.display='none'" loading="lazy" />
      <div class="card-info">
        <div class="card-name">${s.name}</div>
        <div class="card-sub">${s.country||''}${s.language ? ' · '+s.language : ''}</div>
      </div>
    </div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
    <div class="card-stats">
      <span>\u2605 ${s.votes||0} ${t('votes')}</span>
      <span>\u25b8 ${s.clickcount||0} ${t('clicks')}</span>
      ${s.bitrate ? `<span>${s.bitrate} ${t('bitrate')}</span>` : ''}
    </div>
    <div class="card-actions">
      <button class="play-action" data-play="${s.stationuuid}">\u25b6 ${t('play')}</button>
      <button class="fav-action${favCls}" data-fav="${s.stationuuid}">\u2605</button>
    </div>
  </div>`;
}

function bindCards() {
  stationGrid.querySelectorAll('[data-play]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = stations.find(st => st.stationuuid === btn.dataset.play);
      if (s) playStation(s);
    });
  });
  stationGrid.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = stations.find(st => st.stationuuid === btn.dataset.fav);
      if (s) {
        toggleFav(s);
        btn.classList.toggle('active');
      }
    });
  });
}

function renderStations() {
  stationGrid.innerHTML = stations.length ? stations.map(renderCard).join('') : `<div style="padding:2rem;text-align:center;color:var(--muted)">${t('noResults')}</div>`;
  loadMore.textContent = ended ? t('end') : t('loadMore');
  resultCount.textContent = `${stations.length} stations`;
  bindCards();
}

function playStation(s) {
  playing = s;
  audio.src = s.url_resolved || s.url;
  audio.play().catch(() => {});
  playerBar.style.display = '';
  playerFavicon.src = s.favicon || '';
  playerFavicon.style.display = s.favicon ? '' : 'none';
  playerName.textContent = s.name;
  playerMeta.textContent = `${s.country||''} · ${s.language||''} · ${(s.tags||'').split(',')[0]||''}`;
  playBtn.textContent = '⏸';
  renderStations();
}

function stopPlayback() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  playing = null;
  playBtn.textContent = '▶';
  renderStations();
}

async function search(reset = true) {
  if (loading) return;
  loading = true;
  showingFavs = false;
  if (reset) { stations = []; offset = 0; ended = false; renderStations(); }

  const params = new URLSearchParams({ hidebroken: 'true', limit: PAGE, offset, order: 'clickcount', reverse: 'true' });
  const country = countryInput.value.trim();
  const tag = tagInput.value.trim();
  const name = nameInput.value.trim();
  if (country) params.set('country', country);
  if (tag) params.set('tag', tag);
  if (name) params.set('name', name);

  const chunk = await getJson(`${API}/stations/search?${params}`);
  stations = reset ? chunk : [...stations, ...chunk];
  offset += chunk.length;
  if (chunk.length < PAGE) ended = true;
  renderStations();
  loading = false;
}

function showFavs() {
  showingFavs = true;
  stations = getFavs();
  ended = true;
  renderStations();
  resultCount.textContent = `${stations.length} favorites`;
  loadMore.textContent = '';
}

// Events
searchBtn.addEventListener('click', () => search(true));
countryInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(true); });
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(true); });
tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(true); });

randomBtn.addEventListener('click', () => {
  if (!countries.length) return;
  countryInput.value = countries[Math.floor(Math.random() * countries.length)].name;
  tagInput.value = '';
  nameInput.value = '';
  search(true);
});

favBtn.addEventListener('click', () => {
  if (showingFavs) { search(true); return; }
  showFavs();
});

playBtn.addEventListener('click', () => {
  if (!audio.src && stations.length) { playStation(stations[0]); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
});

stopBtn.addEventListener('click', stopPlayback);

prevBtn.addEventListener('click', () => {
  if (!playing || !stations.length) return;
  const idx = stations.findIndex(s => s.stationuuid === playing.stationuuid);
  if (idx > 0) playStation(stations[idx - 1]);
});

nextBtn.addEventListener('click', () => {
  if (!playing || !stations.length) return;
  const idx = stations.findIndex(s => s.stationuuid === playing.stationuuid);
  if (idx < stations.length - 1) playStation(stations[idx + 1]);
});

volumeInput.addEventListener('input', () => { audio.volume = Number(volumeInput.value); });

audio.addEventListener('play', () => { playBtn.textContent = '⏸'; });
audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });

langToggle.addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('openkee-lang', lang);
  applyLanguage();
});

// Infinite scroll
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !loading && !ended && !showingFavs) search(false);
}, { rootMargin: '500px' });
observer.observe(loadMore);

// Init
applyLanguage();
audio.volume = 0.8;
loadMeta().then(() => { countryInput.value = 'China'; search(true); });
