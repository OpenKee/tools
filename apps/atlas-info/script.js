/* ============================================================
   Atlas Info — 国家百科
   数据来源：world-countries（jsDelivr CDN）+ World Bank API
   ============================================================ */
const searchInput=document.getElementById('searchInput'),searchBtn=document.getElementById('searchBtn'),regionBar=document.getElementById('regionBar'),countryGrid=document.getElementById('countryGrid'),detailCard=document.getElementById('detailCard'),resultCount=document.getElementById('resultCount'),langToggle=document.getElementById('langToggle');

const REGIONS=[{k:'',l:{en:'All',zh:'全部'}},{k:'africa',l:{en:'Africa',zh:'非洲'}},{k:'americas',l:{en:'Americas',zh:'美洲'}},{k:'asia',l:{en:'Asia',zh:'亚洲'}},{k:'europe',l:{en:'Europe',zh:'欧洲'}},{k:'oceania',l:{en:'Oceania',zh:'大洋洲'}}];

const i18n={
en:{eyebrow:'Country encyclopedia',title:'Atlas Info',lead:'Search any country. Flag, population, languages, currencies, borders — via World Bank + jsDelivr.',search:'Search',allProjects:'All projects ↗',capital:'Capital',population:'Population',region:'Region',subregion:'Subregion',languages:'Languages',currencies:'Currencies',borders:'Borders',openMaps:'Google Maps',openOSM:'OpenStreetMap',none:'None',countries:'countries'},
zh:{eyebrow:'国家百科',title:'Atlas Info',lead:'搜索任意国家。国旗、人口、语言、货币、边境 — 通过 World Bank + jsDelivr。',search:'搜索',allProjects:'全部项目 ↗',capital:'首都',population:'人口',region:'地区',subregion:'子地区',languages:'语言',currencies:'货币',borders:'边境',openMaps:'Google 地图',openOSM:'OpenStreetMap',none:'无',countries:'个国家'}
};

let allCountries=[],activeRegion='',lang=OK.lang;
function t(k){return i18n[lang][k]||k}
function num(n){return new Intl.NumberFormat().format(n)}

function applyLang(){
  lang=OK.lang;
  OK.applyI18n(i18n);
  searchInput.placeholder=lang==='en'?'Search country…':'搜索国家…';
  renderBar();
}

OK.initLangToggle(langToggle,i18n,applyLang);

async function loadAll(){
try{
// 使用 OK.fetchJSON 替代原生 fetch（带超时和状态检查）
const [countries, popData] = await Promise.all([
  OK.fetchJSON('https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json'),
  OK.fetchJSON('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=300&date=2023')
]);
if(!Array.isArray(countries))throw new Error('countries not array');
const popMap={};
if(Array.isArray(popData)&&popData.length>1){
  popData[1].forEach(item=>{if(item.countryiso3code&&item.value)popMap[item.countryiso3code]=item.value});
}
const data=countries.map(c=>({...c,population:popMap[c.cca3]||0}));
allCountries=data.sort((a,b)=>(a.name?.common||'').localeCompare(b.name?.common||''));
renderBar();renderGrid(allCountries);
}catch(e){countryGrid.innerHTML='<div style="padding:2rem;text-align:center;color:var(--muted)">'+OK.escape(e.message)+'</div>'}
}

function renderBar(){
  regionBar.innerHTML=REGIONS.map(r=>'<button class="region-btn'+(activeRegion===r.k?' active':'')+'" data-r="'+OK.escape(r.k)+'">'+OK.escape(r.l[lang])+'</button>').join('');
  regionBar.querySelectorAll('[data-r]').forEach(b=>b.addEventListener('click',()=>{activeRegion=b.dataset.r;renderBar();filter()}))
}

function filter(){
  const q=searchInput.value.toLowerCase();
  let list=allCountries;
  if(activeRegion)list=list.filter(c=>c.region?.toLowerCase()===activeRegion);
  if(q)list=list.filter(c=>(c.name?.common||'').toLowerCase().includes(q)||(c.name?.official||'').toLowerCase().includes(q));
  renderGrid(list)
}

function renderGrid(countries){
  resultCount.textContent=countries.length+' '+t('countries');
  // 所有国家字段拼入 innerHTML 前用 OK.escape 转义，防止 XSS
  countryGrid.innerHTML=countries.map(c=>'<div class="country-mini" data-code="'+OK.escape(c.cca3)+'"><span class="c-flag">'+OK.escape(c.flag||'')+'</span><div><div class="c-name">'+OK.escape(c.name?.common||'')+'</div><div class="c-sub">'+OK.escape(c.region||'')+' · '+OK.escape(num(c.population||0))+'</div></div></div>').join('');
  countryGrid.querySelectorAll('[data-code]').forEach(el=>el.addEventListener('click',()=>showDetail(el.dataset.code)))
}

function showDetail(code){
  const c=allCountries.find(x=>x.cca3===code);if(!c)return;
  // 语言列表与货币列表先转义每个值
  const langs=c.languages?Object.values(c.languages).map(v=>OK.escape(v)).join(', '):'—';
  const currs=c.currencies?Object.values(c.currencies).map(x=>OK.escape(x.name)+' ('+OK.escape(x.symbol||'')+')').join(', '):'—';
  // 邻国按钮：每个字段都转义
  const borders=c.borders?.map(b=>{const bc=allCountries.find(x=>x.cca3===b);return bc?'<button class="border-chip" data-code="'+OK.escape(b)+'">'+OK.escape(bc.flag||'')+' '+OK.escape(bc.name?.common||b)+'</button>':'<button class="border-chip" data-code="'+OK.escape(b)+'">'+OK.escape(b)+'</button>'}).join('')||t('none');
  const lat=c.latlng?.[0],lng=c.latlng?.[1];
  const gMap=lat!=null&&lng!=null?'https://www.google.com/maps/search/?api=1&query='+lat+','+lng:'#';
  const osm=lat!=null&&lng!=null?'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lng+'#map=5/'+lat+'/'+lng:'#';
  detailCard.style.display='';
  detailCard.innerHTML='<div class="card"><div class="flag">'+OK.escape(c.flag||'')+'</div><div class="info"><h2>'+OK.escape(c.name?.common||'')+'</h2><div class="native">'+OK.escape(c.name?.official||'')+'</div><div class="grid"><div class="item"><div class="i-label">'+t('capital')+'</div><div class="i-val">'+OK.escape(c.capital?.[0]||'—')+'</div></div><div class="item"><div class="i-label">'+t('population')+'</div><div class="i-val">'+OK.escape(num(c.population||0))+'</div></div><div class="item"><div class="i-label">'+t('region')+'</div><div class="i-val">'+OK.escape(c.region||'—')+'</div></div><div class="item"><div class="i-label">'+t('subregion')+'</div><div class="i-val">'+OK.escape(c.subregion||'—')+'</div></div><div class="item"><div class="i-label">'+t('languages')+'</div><div class="i-val">'+langs+'</div></div><div class="item"><div class="i-label">'+t('currencies')+'</div><div class="i-val">'+currs+'</div></div></div><div class="borders"><h3>'+t('borders')+'</h3><div class="border-chips">'+borders+'</div></div><div class="map-link"><a href="'+OK.escape(gMap)+'" target="_blank">'+t('openMaps')+' ↗</a> · <a href="'+OK.escape(osm)+'" target="_blank">'+t('openOSM')+' ↗</a></div></div></div>';
  detailCard.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.code)));
  detailCard.scrollIntoView({behavior:'smooth'})
}

searchInput.addEventListener('input',filter);searchBtn.addEventListener('click',filter);searchInput.addEventListener('keydown',e=>{if(e.key==='Enter')filter()});
applyLang();loadAll();
