/* RunnerBear v9.7 · Plan History + More Cleanup
   Plan owns planned + completed activity detail. More owns profile, shoes and app/data only.
   Cross-device authentication remains a separate follow-up by design. */
(function(){
  'use strict';
  const BUILD='9.8';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const setText=(el,value)=>{if(el&&el.textContent!==String(value))el.textContent=String(value)};
  const iso=d=>{const x=d instanceof Date?d:new Date(d),z=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const CACHE='runnerbear_tredict_cache_v1',LAST='runnerbear_tredict_last_sync',MATCH='runnerbear_tredict_match_';
  let planSig='',moreSig='',queued=false;

  function fmtTime(sec){
    sec=Math.max(0,Math.round(Number(sec)||0));if(!sec)return'–';
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  }
  function fmtPace(sec){sec=Number(sec);if(!sec)return'–';return`${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,'0')}`}
  function km(m){return Number(m)>0?Number(m)/1000:0}
  function activityFlat(a){
    const s=a?.summary||{};
    return{id:a?.id||'',date:a?.date||'',sportType:a?.sportType||'',subSportType:a?.subSportType||'',title:a?.title||'',duration:Number(a?.duration||s.duration||0),distance:Number(a?.distance||s.distance||0),pace:Number(a?.pace||s.pace||0),heartrate:Number(a?.heartrate||s.heartrate||0),heartrateMax:Number(a?.heartrateMax||s.heartrateMax||0),power:Number(a?.power||s.power||0),cadence:Number(a?.cadence||s.cadence||0)};
  }
  function matchFor(ds){return ds?read(MATCH+ds,null):null}
  function hasHealth(){
    let r=null;try{r=window.RunnerBearTredict?.recoverySignal?.()||null}catch{}
    const dom=['rb9Hrv','rb9Sleep','rb9Rhr'].map(id=>($(id)?.textContent||'').trim()).filter(v=>v&&v!=='–');
    return !!(r?.hrv?.value||r?.sleep?.value||r?.rhr?.value||dom.length);
  }
  function lastSyncLabel(){
    const raw=localStorage.getItem(LAST)||read(CACHE,{}).syncedAt||'';
    const t=Date.parse(raw||0);if(!t)return'';
    return new Date(t).toLocaleString('nb-NO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function selectedPlanDate(){
    const stored=sessionStorage.getItem('runnerbear_v92_plan_day')||'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(stored))return stored;
    try{if(typeof flat!=='undefined'&&Array.isArray(flat)){const f=flat.find(x=>x.label===stored);if(f)return iso(f.date)}}catch{}
    const chip=qs('#rb31PlanOverview [data-rb31-day].selected');
    const cid=chip?.dataset.rb31Day||'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(cid))return cid;
    try{if(typeof flat!=='undefined'&&Array.isArray(flat)){const f=flat.find(x=>x.label===cid);if(f)return iso(f.date)}}catch{}
    const card=qs('#weeks .day.rb31-selected');const label=qs('.daydate',card)?.textContent?.trim()||'';
    try{if(typeof flat!=='undefined'&&Array.isArray(flat)){const f=flat.find(x=>x.label===label);if(f)return iso(f.date)}}catch{}
    return'';
  }
  function activityKind(a){
    a=activityFlat(a);if(a.subSportType==='indoor_rowing'||a.subSportType==='rowing')return'Roing';if(a.sportType==='cycling')return'Sykkel';if(a.sportType==='running')return'Løp';return'Økt';
  }
  function activityMetrics(a){
    a=activityFlat(a);const out=[];
    if(km(a.distance)>0)out.push(['Distanse',`${km(a.distance).toFixed(2)} km`]);
    if(a.duration)out.push(['Tid',fmtTime(a.duration)]);
    if(a.sportType==='running'&&a.pace)out.push(['Snittfart',`${fmtPace(a.pace)}/km`]);
    if(a.heartrate)out.push(['Snittpuls',`${Math.round(a.heartrate)} bpm`]);
    if(a.heartrateMax)out.push(['Makspuls',`${Math.round(a.heartrateMax)} bpm`]);
    if(a.power)out.push(['Effekt',`${Math.round(a.power)} W`]);
    if(a.cadence)out.push([a.sportType==='cycling'?'Kadens':(a.subSportType==='indoor_rowing'||a.subSportType==='rowing')?'Takfrekvens':'Stegfrekvens',`${Math.round(a.cadence)} ${a.sportType==='cycling'?'rpm':'spm'}`]);
    return out;
  }
  function planActualHtml(m){
    const a=activityFlat(m?.activity||{}),metrics=activityMetrics(a);if(!a.id)return'';
    const primary=metrics.slice(0,4),extra=metrics.slice(4);
    const coach='Aktiviteten er matchet automatisk mot planen. RunnerBear bruker faktisk gjennomføring videre uten at du trenger å registrere økten manuelt.';
    return `<section class="rb97-plan-actual" id="rb97PlanActual">
      <div class="rb97-plan-actual-head"><div><span>UTFØRT · GARMIN/TREDICT</span><h3>${esc(a.title||m?.planned?.title||activityKind(a))}</h3></div><strong>✓</strong></div>
      <div class="rb97-plan-actual-metrics">${primary.map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>
      <div class="rb97-plan-coach"><span>RB COACH</span><p>${esc(coach)}</p></div>
      <details class="rb97-activity-details"><summary>Se aktivitetsdetaljer <span>↓</span></summary>
        <div class="rb97-activity-detail-grid">
          <div><span>Aktivitetstype</span><b>${esc(activityKind(a))}</b></div>
          <div><span>Dato</span><b>${esc(String(a.date||m?.planned?.date||'').slice(0,10))}</b></div>
          ${extra.map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}
          <div><span>Match</span><b>Automatisk</b></div>
        </div>
      </details>
    </section>`;
  }
  function decoratePlan(){
    const card=qs('#weeks .day.rb31-selected');if(!card)return;
    const body=qs('.day-body',card)||card,ds=selectedPlanDate(),m=matchFor(ds);
    const sig=[ds,m?.activityId||'',qs('h3',card)?.textContent||''].join('|');
    const hasLabel=!!qs('.rb97-planned-label',card),hasActual=!!qs('#rb97PlanActual',card);
    if(sig===planSig&&hasLabel&&hasActual===!!m?.activity)return;planSig=sig;
    qsa('#weeks .rb97-planned-label,#weeks #rb97PlanActual').forEach(x=>x.remove());
    const planned=document.createElement('div');planned.className='rb97-planned-label';planned.textContent='PLANLAGT';body.prepend(planned);
    const status=qs('.daystatus',card);
    if(m?.activity){
      if(status){setText(status,'✓ MATCHET');status.classList.add('rb97-live-status')}
      const old=qs('.rb95-plan-actual',card);if(old)old.classList.add('rb97-hide-old-actual');
      const wrap=document.createElement('div');wrap.innerHTML=planActualHtml(m);const actual=wrap.firstElementChild;
      const manual=qs('.rb32-manual-menu',body);if(manual)body.insertBefore(actual,manual);else body.appendChild(actual);
    }else if(status){status.classList.remove('rb97-live-status')}
  }

  function openTodayInPlan(){
    if(typeof window.switchTab==='function')window.switchTab('plan',true);else qs('.bottom-nav [data-tab="plan"]')?.click();
    setTimeout(()=>{
      const ds=iso(new Date());let ids=[ds];
      try{if(typeof flat!=='undefined'&&Array.isArray(flat)){const f=flat.find(x=>iso(x.date)===ds);if(f)ids.push(f.label)}}catch{}
      const chip=qsa('#rb31PlanOverview [data-rb31-day]').find(x=>ids.includes(x.dataset.rb31Day));
      chip?.click();
    },100);
  }
  function patchToday(){
    const root=$('rb35Today');if(!root)return;
    const live=hasHealth(),healthCard=qs('.rb35-health',root),status=qs('.rb35-status',root);
    if(!live&&healthCard){
      const title=qs('.rb35-health-head h3',healthCard),dot=qs('.rb35-dot',healthCard),p=qs(':scope>p',healthCard);
      setText(title,'Ikke synkronisert');
      if(dot)dot.className='rb35-dot rb97-neutral-dot';
      setText(p,'Ingen ferske Garmin/Tredict-data er tilgjengelig på denne enheten.');
      healthCard.classList.add('rb97-health-offline');
      if(status){const h=qs('h2',status),msg=qs('p',status);setText(h,'Planen står · uten recovery-data');setText(msg,'Dagens økt vises som planlagt. Recovery-data er ikke tilgjengelig på denne enheten.');status.classList.remove('rb35-green','rb35-yellow','rb35-red');status.classList.add('rb97-neutral-status')}
    }else{
      healthCard?.classList.remove('rb97-health-offline');
      if(healthCard){const src=lastSyncLabel();const p=qs(':scope>p',healthCard);if(src&&p&&!p.textContent.includes('synk'))p.textContent+=` · synk ${src}`}
    }
    const actual=qs('.rb35-actual',root);if(actual&&!qs('[data-rb97-plan-actual]',actual)){
      const b=document.createElement('button');b.type='button';b.dataset.rb97PlanActual='1';b.className='rb97-plan-link';b.textContent='Se i Plan →';b.addEventListener('click',openTodayInPlan);actual.appendChild(b);
    }
  }

  function profileData(){
    const liveThreshold=($('rb9Threshold')?.textContent||'').trim();const threshold=(liveThreshold&&liveThreshold!=='–'?liveThreshold:($('thresholdCurrent')?.textContent||'–')).trim();
    const max=($('rb9MaxHr')?.textContent||'188 bpm').trim();
    const zones=qsa('#more .zones>div').map(x=>({name:qs('b',x)?.textContent?.trim()||'',value:qs('strong',x)?.textContent?.trim()||'',unit:qs('span',x)?.textContent?.trim()||''})).filter(x=>x.name);
    return{threshold,max,zones};
  }
  function shoesData(){
    return qsa('#shoeWall .shoebox').map(x=>({km:qs('strong',x)?.textContent?.trim()||'0 km',name:qs('b',x)?.textContent?.trim()||'',desc:qs('span',x)?.textContent?.trim()||''})).filter(x=>x.name);
  }
  function bridgeState(){
    let configured=false;try{configured=!!window.RunnerBearBridge?.configured?.()}catch{}
    return{configured,sync:lastSyncLabel()};
  }
  function moreHtml(){
    const p=profileData(),shoes=shoesData(),bridge=bridgeState();
    const zoneHtml=p.zones.length?p.zones.map(z=>`<div><span>${esc(z.name)}</span><b>${esc(z.value)}${z.unit?` ${esc(z.unit)}`:''}</b></div>`).join(''):'<p class="rb97-empty">Soner fylles fra treningsprofilen.</p>';
    const shoeHtml=shoes.length?shoes.map(s=>`<div class="rb97-shoe-row"><div><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></div><strong>${esc(s.km)}</strong></div>`).join(''):'<p class="rb97-empty">Ingen sko registrert ennå.</p>';
    const syncText=bridge.configured?(bridge.sync?`Sist synk ${bridge.sync}`:'Tilkoblet · venter på første synk'):'Ikke koblet på denne enheten';
    return `<div class="rb97-more-surface">
      <div class="rb97-more-grid">
        <article class="rb97-more-card"><div class="rb97-more-head"><span>TRENINGSPROFIL</span><strong>LIVE GRUNNLAG</strong></div><div class="rb97-profile-main"><div><span>Terskel</span><b>${esc(p.threshold)}</b></div><div><span>Makspuls</span><b>${esc(p.max)}</b></div></div><details><summary>Se soner <span>↓</span></summary><div class="rb97-zone-grid">${zoneHtml}</div></details></article>
        <article class="rb97-more-card"><div class="rb97-more-head"><span>SKO</span><strong>ROTASJON</strong></div><div class="rb97-shoes">${shoeHtml}</div></article>
      </div>
      <article class="rb97-more-card rb97-data-card"><div class="rb97-more-head"><span>DATA & APP</span><strong class="${bridge.configured?'ok':'off'}">${bridge.configured?'TILKOBLET':'DENNE ENHETEN'}</strong></div>
        <div class="rb97-data-row"><div><b>Garmin / Tredict</b><span>${esc(syncText)}</span></div><i class="${bridge.configured?'ok':'off'}"></i></div>
        <div class="rb97-data-actions">${bridge.configured?'<button type="button" data-rb97-sync>Synk nå</button>':''}<span>RunnerBear ${BUILD}</span></div>
        <details class="rb97-advanced"><summary>Avansert <span>↓</span></summary><div><button type="button" data-rb97-test ${bridge.configured?'':'disabled'}>Test datakilde</button><button type="button" data-rb97-reset>Nullstill lokale RunnerBear-data</button><p>Tekniske bridge-innstillinger er skjult fra normal bruk. Fler-enhetsinnlogging løses i neste steg.</p></div></details>
      </article>
    </div>`;
  }
  function bindMore(root){
    qs('[data-rb97-sync]',root)?.addEventListener('click',async()=>{try{await window.RunnerBearBridge?.sync?.(true);setTimeout(render,120)}catch{}});
    qs('[data-rb97-test]',root)?.addEventListener('click',async()=>{try{const ok=await window.RunnerBearBridge?.test?.();alert(ok?'Datakilden svarer normalt.':'Datakilden svarte ikke som forventet.')}catch(e){alert(e?.message||'Kunne ikke teste datakilden.')}});
    qs('[data-rb97-reset]',root)?.addEventListener('click',()=>{$('resetData')?.click()});
  }
  function renderMore(){
    const more=$('more');if(!more)return;
    const head=qs('.section-head',more);if(head){const eye=qs('.eyebrow',head),h=qs('h1',head),p=qs('p',head);setText(eye,'PROFIL · UTSTYR · DATA');setText(h,'Mer');setText(p,'Det du trenger sjelden – ryddig samlet på ett sted.')}
    const sig=JSON.stringify({p:profileData(),s:shoesData(),b:bridgeState()});
    let root=$('rb97More');if(!root){root=document.createElement('div');root.id='rb97More';head?.insertAdjacentElement('afterend',root)}
    if(sig===moreSig&&root.children.length)return;moreSig=sig;root.innerHTML=moreHtml();bindMore(root);
  }

  function render(){
    document.documentElement.classList.add('rb97');
    patchToday();decoratePlan();renderMore();
  }
  function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;render()},40)}
  function init(){
    render();requestAnimationFrame(render);setTimeout(render,120);setTimeout(render,350);
    document.addEventListener('click',e=>{if(e.target.closest('.navbtn,[data-rb31-day],[data-rb31-week],[data-rb31-current],#rb94Sync'))queue()},true);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});
    ['today','plan','more'].forEach(id=>{const el=$(id);if(el)new MutationObserver(queue).observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']})});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
