/* ============================================================
   Global Earthquake Monitor — 全球地震实时监控
   数据来源：USGS FDSN Event API
   ============================================================ */
const copy={
en:{params:'Search Parameters',day:'Past 24 Hours',week:'Past 7 Days',month:'Past 30 Days',all:'All',plates:'🗺️ Plate Boundaries',total:'Total',maxMag:'Max Mag',avgDepth:'Avg Depth',m5:'M5+',events:'events',updating:'Updating...',location:'Location',depth:'Depth',radius:'Radius',time:'Time',popImpact:'Pop. Impact',felt:'Felt',people:'people',tsunami:'🌊 Tsunami',mago:'m ago',hago:'h ago',dago:'d ago',error:'Error',unknown:'Unknown'},
zh:{params:'搜索参数',day:'过去 24 小时',week:'过去 7 天',month:'过去 30 天',all:'全部',plates:'🗺️ 板块边界',total:'总数',maxMag:'最大震级',avgDepth:'平均深度',m5:'M5+',events:'事件',updating:'更新中...',location:'位置',depth:'深度',radius:'半径',time:'时间',popImpact:'人口影响',felt:'有感',people:'人',tsunami:'🌊 海啸',mago:'分钟前',hago:'小时前',dago:'天前',error:'错误',unknown:'未知'}
};
let lang=OK.lang;
function t(k){return copy[lang][k]||k}
function applyLang(){lang=OK.lang;OK.applyI18n(copy);us();rm();rl()}
OK.initLangToggle(document.getElementById('langToggle'),copy,applyLang);
const API_URL="https://earthquake.usgs.gov/fdsnws/event/1/query";
const state={period:'day',minMag:0,impact:'all',data:[]};
const darkBL=L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:""});
const lightBL=L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:""});
const map=L.map("map",{zoomControl:false,worldCopyJump:true,preferCanvas:true,minZoom:2,maxZoom:15}).setView([20,0],2);
L.control.zoom({position:"topleft"}).addTo(map);
darkBL.addTo(map);
const lg=L.layerGroup().addTo(map);
let platesL=null;
document.querySelector('[data-overlay="plates"]').addEventListener('click',async function(e){
  const b=e.currentTarget;b.classList.toggle('on');
  if(b.classList.contains('on')){
    if(!platesL){try{const d=await OK.fetchJSON('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json');platesL=L.layerGroup();L.geoJSON(d,{style:{color:'#ef4444',weight:1.5,opacity:0.7}}).eachLayer(function(l){platesL.addLayer(l)})}catch(e){console.warn('Plate boundaries load failed:',e)}}
    if(platesL&&!map.hasLayer(platesL))platesL.addTo(map);
  }else{if(platesL&&map.hasLayer(platesL))map.removeLayer(platesL)}
});
function mc(m){return m==null?"g":m<3?"g":m<5?"y":m<6?"o":"r"}
function mcol(m){return m==null?"#4ade80":m<3?"#4ade80":m<5?"#facc15":m<6?"#fb923c":"#ef4444"}
function ta(t){const d=Math.max(0,Math.round((Date.now()-t)/60000));if(d<60)return d+t2('mago');if(d<1440)return Math.round(d/60)+t2('hago');return Math.round(d/1440)+t2('dago')}
function t2(k){return t(k)}
function eqR(m){const z=map.getZoom();const base=Math.sqrt(Math.pow(10,1.02*m-4)/Math.PI)*1000;const scale=Math.pow(2,10-z)*0.15;return Math.max(3000,base*scale)}
function gfd(){return state.data.filter(function(e){if(state.impact==='alert')return!!e.properties.alert;if(state.impact==='tsunami')return e.properties.tsunami===1;return true})}
document.querySelectorAll('#time-filters .fb').forEach(function(b){b.addEventListener('click',function(e){document.querySelectorAll('#time-filters .fb').forEach(function(x){x.classList.remove('on')});e.currentTarget.classList.add('on');state.period=e.currentTarget.dataset.period;ld()})});
document.querySelectorAll('#mag-filters .fb').forEach(function(b){b.addEventListener('click',function(e){document.querySelectorAll('#mag-filters .fb').forEach(function(x){x.classList.remove('on')});e.currentTarget.classList.add('on');state.minMag=parseFloat(e.currentTarget.dataset.mag);ld()})});
function ld(){document.getElementById("loader").classList.add("active");const e=new Date(),s=new Date();if(state.period==="day")s.setDate(s.getDate()-1);else if(state.period==="week")s.setDate(s.getDate()-7);else s.setMonth(s.getMonth()-1);
// 使用 OK.fetchJSON 替代原生 fetch（带超时和状态检查）
OK.fetchJSON(API_URL+"?format=geojson&starttime="+s.toISOString()+"&endtime="+e.toISOString()+"&minmagnitude="+state.minMag+"&limit=20000&orderby=time").then(function(d){document.getElementById("loader").classList.remove("active");state.data=d.features||[];us();rm();rl();document.getElementById("update-time").textContent=new Date().toLocaleTimeString("en",{hour12:false,hour:"2-digit",minute:"2-digit"})}).catch(function(e){document.getElementById("loader").classList.remove("active");document.getElementById("earthquake-list").innerHTML="<div style='padding:2rem;text-align:center;color:var(--rd)'>"+OK.escape(t('error'))+"</div>"})}
function us(){const cd=gfd();let mx=-Infinity,dp=0,sg=0,vd=0;cd.forEach(function(e){const m=e.properties.mag,d=e.geometry.coordinates[2];if(m!=null&&m>mx)mx=m;if(m>=5)sg++;if(d!=null){dp+=d;vd++}});const av=vd?Math.round(dp/vd):0;document.getElementById("stats-container").innerHTML='<div class="st"><div class="v">'+cd.length+'</div><div class="l">'+t('total')+'</div></div><div class="st"><div class="v">'+(mx>-Infinity?mx.toFixed(1):'-')+'</div><div class="l">'+t('maxMag')+'</div></div><div class="st"><div class="v">'+av+' km</div><div class="l">'+t('avgDepth')+'</div></div><div class="st"><div class="v">'+sg+'</div><div class="l">'+t('m5')+'</div></div>';document.getElementById("event-count").textContent=cd.length+" "+t('events')}
function rm(){map.removeLayer(lg);lg.clearLayers();const cd=gfd();cd.forEach(function(eq){const p=eq.properties,c=eq.geometry.coordinates,m=p.mag||0,d=c[2]!=null?Math.round(c[2]):'?';const col=mcol(m),r=eqR(m),pl=OK.escape(p.place||t('unknown'));const ac={green:'#4ade80',yellow:'#facc15',orange:'#fb923c',red:'#ef4444'};
// 所有外部数据（p.alert, p.felt, p.place 等）拼入 innerHTML 前都用 OK.escape 转义
const ah=p.alert?'<br><strong>'+t('popImpact')+':</strong> <span style="text-transform:uppercase;font-weight:bold;color:'+ac[p.alert]+'">'+OK.escape(p.alert)+'</span>':'';
const fh=p.felt?'<br><strong>'+t('felt')+':</strong> '+OK.escape(p.felt)+' '+t('people'):'';
const th=p.tsunami?'<br><strong style="color:#3b82f6">'+t('tsunami')+'</strong>':'';
const pop='<div class="popup-title" style="color:'+col+'">M '+OK.escape(m.toFixed(1))+'</div><div class="popup-sub"><strong>'+t('location')+':</strong> '+pl+'<br><strong>'+t('depth')+':</strong> '+OK.escape(String(d))+' km<br><strong>'+t('radius')+':</strong> '+(r/1000).toFixed(0)+' km<br><strong>'+t('time')+':</strong> '+OK.escape(new Date(p.time).toLocaleString())+ah+fh+th+'</div>';
[-360,0,360].forEach(function(off){const k=L.circle([c[1],c[0]+off],{radius:r,fillColor:col,color:col,weight:1,opacity:0.5,fillOpacity:0.2}).addTo(lg);k.bindPopup(pop)})});map.addLayer(lg)}
function rl(){const cd=gfd().slice(0,100);let h="";cd.forEach(function(eq){const p=eq.properties,c=eq.geometry.coordinates,m=p.mag||0;const ac={green:'#4ade80',yellow:'#facc15',orange:'#fb923c',red:'#ef4444'};
// 通过 data-* 属性传递坐标，使用 addEventListener 替代内联 onclick
const ab=p.alert?'<span style="font-size:0.65rem;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);border:1px solid '+ac[p.alert]+';color:'+ac[p.alert]+'">'+OK.escape(p.alert.toUpperCase())+'</span>':'';
const tb=p.tsunami?'<span style="font-size:0.85rem">🌊</span>':'';
h+='<div class="it" data-lat="'+c[1]+'" data-lng="'+c[0]+'" data-mag="'+m+'"><div class="mg '+mc(m)+'">'+(m?m.toFixed(1):'?')+'</div><div class="inf"><div class="pl">'+OK.escape(p.place||t('unknown'))+'</div><div class="mt"><span>'+t('depth')+': '+Math.round(c[2])+' km</span>'+ab+tb+'</div></div><div class="ag">'+OK.escape(ta(p.time))+'</div></div>'});
document.getElementById("earthquake-list").innerHTML=h;
// 绑定列表项点击事件：飞往地震位置
document.getElementById("earthquake-list").querySelectorAll('.it').forEach(function(el){
  el.addEventListener('click',function(){
    const lat=parseFloat(el.dataset.lat),lng=parseFloat(el.dataset.lng),mag=parseFloat(el.dataset.mag);
    map.flyTo([lat,lng],mag>=6?5:mag>=4?6:8,{duration:1.5});
  });
});
}
applyLang();
ld();
