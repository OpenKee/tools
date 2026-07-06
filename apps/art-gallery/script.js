/* ============================================================
   Art Gallery — 大都会艺术博物馆藏品探索
   数据来源：The Metropolitan Museum of Art Collection API
   ============================================================ */
const copy={
en:{sub:'Explore 400,000+ artworks from The Met',search:'Search',random:'✦ Random artwork',loading:'Loading…',loadMore:'Load more',loadingMore:'Loading...',untitled:'Untitled',unknown:'Unknown',unknownArtist:'Unknown artist',noResults:'No results',date:'Date',medium:'Medium',dimensions:'Dimensions',department:'Department',period:'Period',culture:'Culture',type:'Type',credit:'Credit',close:'Close'},
zh:{sub:'探索大都会艺术博物馆 40 万+ 件藏品',search:'搜索',random:'✦ 随机作品',loading:'加载中…',loadMore:'加载更多',loadingMore:'加载中...',untitled:'无题',unknown:'佚名',unknownArtist:'未知艺术家',noResults:'无结果',date:'年代',medium:'材质',dimensions:'尺寸',department:'部门',period:'时期',culture:'文化',type:'类型',credit:'来源',close:'关闭'}
};
let lang=OK.lang;
function t(k){return copy[lang][k]||k}
function applyLang(){lang=OK.lang;OK.applyI18n(copy);document.getElementById('inp').placeholder=lang==='en'?'Search… Monet, Van Gogh, Samurai…':'搜索… 莫奈、梵高、武士…';const mb=document.getElementById('moreBtn');if(mb&&!mb.disabled)mb.textContent=t('loadMore')}
OK.initLangToggle(document.getElementById('langToggle'),copy,applyLang);

const API='https://collectionapi.metmuseum.org/public/collection/v1';
let allIds=[];
let shown=0;
const batch=24;

function search(){
  const q=document.getElementById('inp').value.trim();if(!q)return;
  let btn=document.getElementById('btn');btn.disabled=true;
  document.getElementById('out').innerHTML='';
  document.getElementById('moreBtn').style.display='none';
  document.getElementById('ld').classList.add('on');
  shown=0;
  // 使用 OK.fetchJSON 替代原生 fetch（带超时）
  OK.fetchJSON(API+'/search?q='+encodeURIComponent(q)+'&hasImages=true')
    .then(function(d){
      allIds=d.objectIDs||[];
      if(!allIds.length)throw Error(t('noResults'));
      return loadBatch();
    })
    .catch(function(e){
      document.getElementById('ld').classList.remove('on');
      document.getElementById('out').innerHTML='<div style="text-align:center;padding:2rem;color:var(--mt)">'+OK.escape(e.message)+'</div>';
    })
    .finally(function(){btn.disabled=false});
}

function randomArt(){
  document.getElementById('out').innerHTML='';
  document.getElementById('moreBtn').style.display='none';
  document.getElementById('ld').classList.add('on');
  shown=0;
  // 随机搜索词
  const terms=['painting','sculpture','portrait','landscape','vase','jewelry','armor','photograph','drawing','ceramic','tapestry','furniture','mosaic','statue','bust'];
  const term=terms[Math.floor(Math.random()*terms.length)];
  OK.fetchJSON(API+'/search?q='+term+'&hasImages=true')
    .then(function(d){
      allIds=d.objectIDs||[];
      // 洗牌
      for(let i=allIds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=allIds[i];allIds[i]=allIds[j];allIds[j]=t;}
      return loadBatch();
    })
    .catch(function(){document.getElementById('ld').classList.remove('on')});
}

function loadBatch(){
  const ids=allIds.slice(shown,shown+batch);
  shown+=ids.length;
  return Promise.all(ids.map(function(id){
    return OK.fetchJSON(API+'/objects/'+id).catch(function(){return null});
  })).then(function(arts){
    document.getElementById('ld').classList.remove('on');
    appendGrid(arts.filter(function(a){return a&&a.primaryImageSmall}));
    document.getElementById('moreBtn').style.display=shown<allIds.length?'inline-block':'none';
  });
}

function loadMore(){
  let btn=document.getElementById('moreBtn');
  btn.textContent=t('loadingMore');btn.disabled=true;
  loadBatch().then(function(){
    btn.textContent=t('loadMore');btn.disabled=false;
  });
}

function appendGrid(arts){
  let grid=document.getElementById('out').querySelector('.grid');
  if(!grid){document.getElementById('out').innerHTML='<div class="grid"></div>';grid=document.getElementById('out').querySelector('.grid')}
  arts.forEach(function(a){
    const img=a.primaryImageSmall||'';
    // 所有外部数据拼入 innerHTML 前都用 OK.escape 转义
    const imgH=img?'<img src="'+OK.escape(img)+'" alt="'+OK.escape(a.title||'')+'" loading="lazy">':'<div class="no-img">🖼</div>';
    const div=document.createElement('div');
    div.className='art';
    div.innerHTML='<div class="frame">'+imgH+'</div><div class="label"><div class="title">'+OK.escape(a.title||t('untitled'))+'</div><div class="meta">'+OK.escape(a.artistDisplayName||t('unknown'))+'</div><div class="date">'+OK.escape(a.objectDate||'')+'</div></div>';
    div.addEventListener('click',function(){showDetail(a.objectID)});
    grid.appendChild(div);
  });
}

function showDetail(id){
  OK.fetchJSON(API+'/objects/'+id)
    .then(function(a){
      const img=a.primaryImage||a.primaryImageSmall||'';
      const t1=a.title||t('untitled');
      const imgH=img?'<img src="'+OK.escape(img)+'" alt="'+OK.escape(t1)+'">':'<div class="no-img">🖼</div>';
      const rows=[];
      if(a.objectDate)rows.push([t('date'),a.objectDate]);
      if(a.medium)rows.push([t('medium'),a.medium]);
      if(a.dimensions)rows.push([t('dimensions'),a.dimensions]);
      if(a.department)rows.push([t('department'),a.department]);
      if(a.period)rows.push([t('period'),a.period]);
      if(a.culture)rows.push([t('culture'),a.culture]);
      if(a.classification)rows.push([t('type'),a.classification]);
      if(a.creditLine)rows.push([t('credit'),a.creditLine]);
      const table=rows.map(function(r){return'<tr><td>'+OK.escape(r[0])+'</td><td>'+OK.escape(r[1])+'</td></tr>'}).join('');
      const modal=document.getElementById('modal');
      modal.innerHTML='<button class="close" aria-label="'+OK.escape(t('close'))+'">✕</button><div class="top"><div class="img-wrap">'+imgH+'</div><div class="info"><h2>'+OK.escape(a.title||t('untitled'))+'</h2><div class="artist">'+OK.escape(a.artistDisplayName||t('unknownArtist'))+'</div><table>'+table+'</table></div></div>';
      // 关闭按钮：使用 addEventListener 替代内联 onclick
      modal.querySelector('.close').addEventListener('click',closeDetail);
      document.getElementById('overlay').classList.add('on');
    });
}

function closeDetail(){document.getElementById('overlay').classList.remove('on')}

// 绑定静态按钮事件（替代内联 onclick / onsubmit）
document.getElementById('inp').form.addEventListener('submit',function(e){e.preventDefault();search()});
document.querySelector('.random').addEventListener('click',randomArt);
document.getElementById('moreBtn').addEventListener('click',loadMore);
// 点击遮罩空白处关闭弹窗（替代内联 onclick）
document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeDetail()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDetail()});

applyLang();
randomArt();
