/* RunnerBear v9.5 · Live Data Integration
   Secure bridge cache is authoritative for recovery + actual activity UI.
   Never requires the Tredict Personal API token in browser storage.
*/
(function(){
  'use strict';
  const $=id=>document.getElementById(id),qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const CACHE='runnerbear_tredict_cache_v1',LAST='runnerbear_tredict_last_sync',MATCH='runnerbear_tredict_match_';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso=d=>{const x=d instanceof Date?d:new Date(d),z=n=>String(n).padStart(2,'0');return`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const today=()=>iso(new Date());
  const fmtTime=s=>{s=Math.max(0,Math.round(Number(s)||0));if(!s)return'–';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};
  const fmtPace=s=>{s=Number(s);if(!s)return'–';return`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`};
  const km=m=>Number(m)>0?Number(m)/1000:0;
  const cache=()=>read(CACHE,{activities:[],hrv:{},sleep:{},body:[],capacity:{},zones:{}});
  const lastSync=()=>localStorage.getItem(LAST)||cache().syncedAt||'';
  const matchFor=ds=>read(MATCH+ds,null);

  function activityFlat(a){
    const s=a?.summary||{};
    return {id:a?.id||'',date:a?.date||'',sportType:a?.sportType||'',subSportType:a?.subSportType||'',title:a?.title||'',duration:Number(a?.duration||s.duration||0),distance:Number(a?.distance||s.distance||0),pace:Number(a?.pace||s.pace||0),heartrate:Number(a?.heartrate||s.heartrate||0),heartrateMax:Number(a?.heartrateMax||s.heartrateMax||0),power:Number(a?.power||s.power||0),cadence:Number(a?.cadence||s.cadence||0)};
  }
  function allActivities(){return(cache().activities||[]).map(activityFlat).filter(a=>a.id&&a.date)}
  function latestSyncLabel(){const t=Date.parse(lastSync()||0);return t?new Date(t).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'}):''}

  function recovery(){
    try{return window.RunnerBearTredict?.recoverySignal?.()||null}catch{return null}
  }
  function formatSleep(sec){sec=Number(sec)||0;if(!sec)return'–';return`${Math.floor(sec/3600)}:${String(Math.round((sec%3600)/60)).padStart(2,'0')}`}
  function patchHealth(){
    if(!$('rb9HealthSource'))return;
    const r=recovery(),has=!!(r?.hrv?.value||r?.sleep?.value||r?.rhr?.value),t=latestSyncLabel();
    $('rb9HealthSource').textContent=has?`TREDICT · ${t||'LIVE'}`:'TREDICT · SYNC';
    $('rb9Hrv').textContent=r?.hrv?.value?`${Math.round(r.hrv.value)} ms`:'–';
    $('rb9HrvSub').textContent=r?.hrv?.baseline?`baseline ${Math.round(r.hrv.baseline)} ms`:'ingen baseline';
    $('rb9Sleep').textContent=r?.sleep?.value?formatSleep(r.sleep.value):'–';
    $('rb9SleepSub').textContent=r?.sleep?.baseline?`baseline ${formatSleep(r.sleep.baseline)}`:'ingen baseline';
    $('rb9Rhr').textContent=r?.rhr?.value?`${Math.round(r.rhr.value)} bpm`:'–';
    $('rb9RhrSub').textContent=r?.rhr?.baseline?`normal ${Math.round(r.rhr.baseline)} bpm`:'ingen baseline';
    $('rb9Load').textContent=!has?'–':r.level==='red'?'Høy':r.level==='yellow'?'Obs':'Normal';
    $('rb9LoadSub').textContent=has?'recovery-signal':'venter på verdi';
  }

  function patchTrend(){
    if(!$('rb9TrendState'))return;
    const acts=allActivities(),now=new Date();
    const stats=days=>{const cut=new Date(now);cut.setDate(cut.getDate()-days);const xs=acts.filter(a=>new Date(a.date)>=cut),runs=xs.filter(a=>a.sportType==='running');return{all:xs.length,runs:runs.length,km:runs.reduce((n,a)=>n+km(a.distance),0)}};
    const s7=stats(7),s28=stats(28);if(!s28.all)return;
    $('rb9TrendState').textContent='LIVE';
    $('rb9TrendTitle').textContent=s7.runs?`${s7.km.toFixed(1)} km siste 7 dager`:`${s7.all} økter siste 7 dager`;
    $('rb9TrendText').textContent=`Garmin/Tredict: ${s28.runs} løpeøkter · ${s28.km.toFixed(1)} km siste 28 dager${s28.all>s28.runs?` · ${s28.all-s28.runs} andre økter`:''}. Faktisk trening brukes som evidens, ikke som ordre om å øke.`;
  }

  function actualMetrics(a){
    a=activityFlat(a);const items=[];
    if(km(a.distance)>0)items.push(['Distanse',`${km(a.distance).toFixed(2)} km`]);
    if(a.duration)items.push(['Tid',fmtTime(a.duration)]);
    if(a.sportType==='running'&&a.pace)items.push(['Fart',`${fmtPace(a.pace)}/km`]);
    if(a.heartrate)items.push(['Puls',`${Math.round(a.heartrate)} bpm`,a.heartrateMax?`maks ${Math.round(a.heartrateMax)}`:'']);
    if(a.power)items.push(['Effekt',`${Math.round(a.power)} W`]);
    if(a.cadence)items.push([a.sportType==='cycling'?'Kadens':'Stegfrekvens',`${Math.round(a.cadence)} ${a.sportType==='cycling'?'rpm':'spm'}`]);
    return items.slice(0,5);
  }
  function actualHtml(m,compact=false){
    const a=activityFlat(m?.activity||{});if(!a.id)return'';const metrics=actualMetrics(a);
    return `<div class="rb95-actual ${compact?'compact':''}"><div class="rb95-actual-head"><div><span>GARMIN · MATCHET AUTOMATISK</span><b>${esc(a.title||m?.planned?.title||'Utført økt')}</b></div><strong>✓</strong></div><div class="rb95-actual-grid">${metrics.map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b>${x[2]?`<small>${x[2]}</small>`:''}</div>`).join('')}</div>${compact?'':`<p>Faktisk økt fra Tredict er koblet til planen. Avvik i distanse eller intensitet skal ikke «tas igjen» senere.</p>`}</div>`;
  }

  function todayPlanned(){
    try{return window.RunnerBearTredict?.plannedToday?.()||null}catch{return null}
  }
  function renderTodayActual(){
    const card=$('todayCard');if(!card)return;let host=$('rbActualWorkout');
    if(!host){host=document.createElement('div');host.id='rbActualWorkout';host.className='rb-actual-wrap';card.appendChild(host)}
    const m=matchFor(today());
    if(m?.activity){host.innerHTML=actualHtml(m,false);return}
    const candidates=allActivities().filter(a=>iso(new Date(a.date))===today());
    if(candidates.length){const a=candidates[0];host.innerHTML=`<div class="rb95-actual-pending"><span>GARMIN · AKTIVITET FUNNET</span><b>${esc(a.title||a.sportType)}</b><small>RunnerBear har ikke gjort en sikker planmatch ennå. Økten blir ikke markert gjennomført før matchen er tydelig.</small></div>`;return}
    host.innerHTML='';
  }

  function selectedPlanDate(){
    const id=sessionStorage.getItem('runnerbear_v92_plan_day')||'';
    try{if(typeof flat!=='undefined'){const f=flat.find(x=>x.label===id);if(f)return iso(f.date)}}catch{}
    if(/^\d{4}-\d{2}-\d{2}$/.test(id))return id;
    const card=qs('#weeks .day.rb31-selected');if(!card)return'';
    const label=qs('.daydate',card)?.textContent?.trim()||'';
    try{if(typeof flat!=='undefined'){const f=flat.find(x=>x.label===label);if(f)return iso(f.date)}}catch{}
    return'';
  }
  function renderPlanActual(){
    qsa('.rb95-plan-actual').forEach(x=>x.remove());const card=qs('#weeks .day.rb31-selected');if(!card)return;
    const ds=selectedPlanDate(),m=ds?matchFor(ds):null;if(!m?.activity)return;
    const body=qs('.day-body',card)||card;const el=document.createElement('div');el.className='rb95-plan-actual';el.innerHTML=actualHtml(m,true);body.prepend(el);
  }

  function patchBridgeCard(){
    const c=$('rbTredictCard');if(!c||!window.RunnerBearBridge?.configured?.())return;
    const h=qs('.rb94-bridge-main h3',c),p=qs('.rb94-bridge-main p',c),pill=$('rb94BridgePill');
    if(h)h.textContent='Garmin-data er live i RunnerBear';
    if(p)p.textContent='Aktiviteter, HRV, søvn, hvilepuls, kapasitet og soner hentes sikkert via Tredict Bridge. Personal API-tokenet ligger kun hos Cloudflare.';
    if(pill&&!/SYNK|FEIL|TEST/i.test(pill.textContent||'')){pill.textContent='LIVE';pill.className='status-pill green'}
  }

  function hideLegacyRecovery(){const x=$('rbRecoveryCard');if(x)x.classList.add('rb95-legacy-hidden')}
  function renderLive(){
    document.documentElement.classList.add('rb95');hideLegacyRecovery();patchHealth();patchTrend();renderTodayActual();renderPlanActual();patchBridgeCard();
  }

  const oldRender=window.renderAll;if(typeof oldRender==='function')window.renderAll=function(){const r=oldRender.apply(this,arguments);requestAnimationFrame(renderLive);setTimeout(renderLive,80);return r};
  const oldSwitch=window.switchTab;if(typeof oldSwitch==='function')window.switchTab=function(id,scroll){const r=oldSwitch.apply(this,arguments);requestAnimationFrame(renderLive);setTimeout(renderLive,80);return r};
  document.addEventListener('click',e=>{if(e.target.closest('[data-rb31-day],[data-rb31-week],[data-rb31-current],#rb94Sync,#rb94Test,.navbtn')){requestAnimationFrame(renderLive);setTimeout(renderLive,120)}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(renderLive,120)});
  window.addEventListener('storage',e=>{if(e.key===CACHE||e.key===LAST||String(e.key||'').startsWith(MATCH))renderLive()});
  window.RunnerBearLive=Object.assign(window.RunnerBearLive||{},{render:renderLive,activities:allActivities,recovery,matchFor});
  renderLive();requestAnimationFrame(renderLive);setTimeout(renderLive,250);
})();
