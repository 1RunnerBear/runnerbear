/* RunnerBear v9 · Premium Full Refresh
   One visual system across Today, Plan, Goals and More.
   API-ready health/capacity shell; training logic remains owned by existing coach layers. */
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch{return f}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const ICON={
    today:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>`,
    plan:`<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
    goals:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M17 7l3-3M17 7h3V4"/></svg>`,
    more:`<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></svg>`,
    run:`<svg viewBox="0 0 24 24"><circle cx="15.4" cy="4.3" r="1.65"/><path d="M13.3 7.1 10.5 10l2.4 2.2 2 3.3M13.3 7.1l3 2.1 2.8-.5M10.5 10l-3.5 4M14.9 15.5l3.5 2.6M12.9 12.1l-1.7 4.9-4.2 2"/></svg>`,
    row:`<svg viewBox="0 0 24 24"><circle cx="8.1" cy="5.7" r="1.55"/><path d="M9.2 7.8 12 10.7l4.1-1.1M10.8 10.9 8 14.3h5.3l2.5 3.1M3.2 18.2h13.2M5 20.6h10.2M16.4 9.2l2.2 8.2M18.5 8.7h2.3M20 8.7l1 8.8M18.3 17.5h3.3"/></svg>`,
    bike:`<svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="3.1"/><circle cx="18" cy="17" r="3.1"/><path d="M6 17 9.5 10h4.1l4.4 7M9.5 10 12 17h6M8.5 7.7h3.1M13.6 10l1.2-2.5h2.3"/></svg>`,
    quality:`<svg viewBox="0 0 24 24"><circle cx="14.8" cy="4.2" r="1.55"/><path d="M12.8 7 10.3 10l2.2 2 2 3M12.8 7l3.2 2.3 2.5-.4M10.3 10 7 14M14.5 15l3.8 2.7M12.4 12l-1.5 4.7-3.7 2"/><path d="M4 5h4M3 8h4"/></svg>`,
    long:`<svg viewBox="0 0 24 24"><circle cx="14.8" cy="4.2" r="1.55"/><path d="M12.8 7 10.3 10l2.2 2 2 3M12.8 7l3.2 2.3 2.5-.4M10.3 10 7 14M14.5 15l3.8 2.7M12.4 12l-1.5 4.7-3.7 2"/><path d="M3 20h4M2 17h3"/></svg>`,
    rest:`<svg viewBox="0 0 24 24"><path d="M18.5 15.2A7 7 0 0 1 8.8 5.5a7 7 0 1 0 9.7 9.7Z"/></svg>`,
    heart:`<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M7.5 12h2l1.2-2.2 2.1 4.3 1.2-2.1h2.5"/></svg>`,
    pulse:`<svg viewBox="0 0 24 24"><path d="M3 12h4l1.8-5 3.1 10 2.2-7 1.8 2H21"/></svg>`,
    clock:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,
    moon:`<svg viewBox="0 0 24 24"><path d="M18.5 15.2A7 7 0 0 1 8.8 5.5a7 7 0 1 0 9.7 9.7Z"/></svg>`,
    bars:`<svg viewBox="0 0 24 24"><path d="M5 18v-4M10 18V9M15 18V6M20 18V3"/></svg>`,
    trend:`<svg viewBox="0 0 24 24"><path d="m4 17 5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>`,
    sync:`<svg viewBox="0 0 24 24"><path d="M19 8a7 7 0 0 0-12-2L4 9M5 16a7 7 0 0 0 12 2l3-3"/><path d="M4 5v4h4M20 19v-4h-4"/></svg>`,
    shoe:`<svg viewBox="0 0 24 24"><path d="M4 15c3 0 5-1 7-4l2 2c1.5 1.5 3.5 2 6 2v3H4Z"/><path d="M8 14h3"/></svg>`
  };
  const icon=(name,cls='rb9-icon')=>`<span class="${cls}" aria-hidden="true">${ICON[name]||ICON.today}</span>`;

  function navIcons(){
    qsa('.bottom-nav .navbtn,.desktop-nav .navbtn').forEach(b=>{
      const tab=b.dataset.tab;
      const key=tab==='today'?'today':tab==='plan'?'plan':tab==='goals'||tab==='race'?'goals':'more';
      let span=qs('span',b);
      if(!span){span=document.createElement('span');b.prepend(span)}
      span.className='rb9-nav-icon';span.innerHTML=ICON[key];
    });
  }

  function activityModeFromBox(box){
    const active=qs('[data-mode].active,[data-mode][aria-pressed="true"]',box);
    if(active?.dataset.mode==='row')return'row';if(active?.dataset.mode==='bike')return'bike';return'run';
  }
  function workoutIconFor(type,title='',box=null){
    if(box){const m=activityModeFromBox(box);if(m)return m}
    const t=String(title).toLowerCase();
    if(/concept2|roing|rowerg/.test(t))return'row';
    if(/zwift|sykkel|bike/.test(t))return'bike';
    if(/langtur/.test(t))return'long';
    if(type==='quality'||/terskel|45\/15|gate|x-element|intervall/.test(t))return'quality';
    if(type==='rest'||/hvile/.test(t))return'rest';
    return'run';
  }

  function decorateToday(){
    const card=$('todayCard');if(!card)return;
    let hero=qs('.rb9-today-identity',card);
    if(!hero){
      hero=document.createElement('div');hero.className='rb9-today-identity';
      const title=$('todayTitle');title?.parentNode?.insertBefore(hero,title);hero.append(title,$('todayDesc'));
    }
    let bubble=qs('.rb9-workout-bubble',card);if(!bubble){bubble=document.createElement('div');bubble.className='rb9-workout-bubble';hero.prepend(bubble)}
    const box=qs('.easy-choice[data-easy-slot="today"]',card);
    const type=($('todayType')?.textContent||'').toLowerCase();const name=workoutIconFor(type,$('todayTitle')?.textContent||'',box);
    bubble.innerHTML=ICON[name];bubble.dataset.kind=name;

    const metrics=qsa('.keymetrics > div',card);const mi=['heart','pulse','clock'];metrics.forEach((m,i)=>{let x=qs('.rb9-metric-icon',m);if(!x){x=document.createElement('span');x.className='rb9-metric-icon';m.prepend(x)}x.innerHTML=ICON[mi[i]]});
    card.classList.add('rb9-today-card');
  }

  function decorateChoices(){
    qsa('.easy-choice').forEach(box=>{
      box.classList.add('rb9-choice');
      qsa('[data-mode]',box).forEach(btn=>{
        const mode=btn.dataset.mode;const key=mode==='row'?'row':mode==='bike'?'bike':'run';
        let ico=qs('.rb9-choice-icon',btn);if(!ico){ico=document.createElement('span');ico.className='rb9-choice-icon';btn.prepend(ico)}ico.innerHTML=ICON[key];
        const old=qsa('span',btn).filter(s=>s!==ico&&s.querySelector('svg'));
        old.forEach(s=>s.remove());
      });
    });
  }

  function decoratePlan(){
    const plan=$('plan');if(!plan)return;
    plan.classList.add('rb9-plan');
    qsa('#weeks .day').forEach(day=>{
      const summary=qs('.day-summary',day);if(!summary)return;
      let ico=qs('.rb9-day-icon',summary);if(!ico){ico=document.createElement('span');ico.className='rb9-day-icon';const h=qs('h3',summary);summary.insertBefore(ico,h)}
      const box=qs('.easy-choice',day),tag=qs('.tag',day),title=qs('h3',summary)?.textContent||'';const kind=workoutIconFor(tag?.textContent?.toLowerCase()||'',title,box);ico.innerHTML=ICON[kind];ico.dataset.kind=kind;
      day.dataset.rb9Kind=kind;
    });
    const nav=$('rbV72WeekNav')||$('rbPlanNav');if(nav)nav.classList.add('rb9-week-nav');
    const decision=$('rbAdaptiveDecision');if(decision)decision.classList.add('rb9-coach-decision');
  }

  function healthValue(){
    let r=null;try{r=window.RunnerBearTredict?.recoverySignal?.()||null}catch{}
    if(!r){
      const cache=read('runnerbear_tredict_cache',null)||read('runnerbear_v81_tredict_cache',null)||null;
      if(cache?.recovery)r=cache.recovery;
    }
    return r;
  }
  function formatSleep(v){if(!v)return'–';const sec=Number(v)>2000?Number(v):Number(v)*60;return `${Math.floor(sec/3600)}:${String(Math.round((sec%3600)/60)).padStart(2,'0')}`}
  function capacity(){
    const p=window.RunnerBearV7?.profile?.()||read('runnerbear_v7_profile',{});
    let th={pace:p.thresholdPace||'4:02',hr:p.thresholdHr||175,source:'RunnerBear'};
    const hs=read('runfest26_threshold_history',[]);if(Array.isArray(hs)&&hs.length){const x=hs.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1);th={pace:x.pace||th.pace,hr:x.hr||th.hr,source:x.source||'Garmin'}}
    const vs=read('runfest26_vo2_history',[]);const vo=Array.isArray(vs)&&vs.length?vs.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1):null;
    return{th,vo,max:p.maxHr||188};
  }

  function ensureIntelligence(){
    const today=$('today');if(!today)return;
    let rail=$('rb9Intelligence');
    if(!rail){
      rail=document.createElement('section');rail.id='rb9Intelligence';rail.className='rb9-intelligence';
      rail.innerHTML=`
        <article class="card rb9-coach-status"><div class="kicker"><span>RB COACH · STATUS</span><span id="rb9CoachPill" class="status-pill neutral">–</span></div><div class="rb9-coach-row"><div>${icon('trend','rb9-large-line-icon')}<div><h2 id="rb9CoachTitle">Planen står</h2><p id="rb9CoachText">Kontrollert gjennomføring er målet.</p></div></div></div></article>
        <article class="card rb9-health-card"><div class="kicker"><span>KROPP I DAG</span><span id="rb9HealthSource">VENTER PÅ SYNC</span></div><div class="rb9-health-grid">
          <div>${icon('heart')}<span>HRV</span><b id="rb9Hrv">–</b><small id="rb9HrvSub">Tredict/Garmin</small></div>
          <div>${icon('moon')}<span>SØVN</span><b id="rb9Sleep">–</b><small id="rb9SleepSub">Tredict/Garmin</small></div>
          <div>${icon('pulse')}<span>HVILEPULS</span><b id="rb9Rhr">–</b><small id="rb9RhrSub">Tredict/Garmin</small></div>
          <div>${icon('bars')}<span>BELASTNING</span><b id="rb9Load">–</b><small id="rb9LoadSub">coachsignal</small></div>
        </div></article>
        <article class="card rb9-trend-card"><div class="kicker"><span>TRENINGSTREND · 28 DAGER</span><span id="rb9TrendState">BYGGES</span></div><div class="rb9-trend-main">${icon('trend','rb9-trend-icon')}<div><h3 id="rb9TrendTitle">Stabil utvikling</h3><p id="rb9TrendText">RunnerBear bygger trend fra gjennomføring og respons.</p></div></div><div class="rb9-capacity-row"><div><span>TERSKEL</span><b id="rb9Threshold">–</b><small id="rb9ThresholdSource">–</small></div><div><span>VO₂ MAKS</span><b id="rb9Vo2">–</b><small id="rb9Vo2Source">venter på API</small></div><div><span>MAKSPULS</span><b id="rb9MaxHr">–</b><small>profil</small></div></div></article>`;
      const below=qs('.below-grid',today);if(below)below.insertAdjacentElement('beforebegin',rail);else today.appendChild(rail);
    }
  }

  function coachStatus(){
    const rec=healthValue(),light=$('coachLight')?.textContent?.trim()||'';let tone='green',label='PLANEN STÅR',title='Gjennomfør planlagt',text='Ingen samlet grunn til å gjøre treningen mer aggressiv eller mer forsiktig.';
    if(rec?.level==='red'||/RØD|REDUSER/i.test(light)){tone='red';label='BREMS';title='Gjør dagen lettere';text='Belastningssignalene tilsier lavere kostnad. Kontinuitet er viktigere enn å fullføre alt som står.'}
    else if(rec?.level==='yellow'||/GUL|FLYTT/i.test(light)){tone='yellow';label='OBS';title='Planen står – med margin';text='Ett eller flere signaler avviker. Behold kontrollen og kutt heller volum enn å jage fart.'}
    return{tone,label,title,text};
  }
  function renderIntelligence(){
    ensureIntelligence();const c=coachStatus();const pill=$('rb9CoachPill');if(pill){pill.className=`status-pill ${c.tone}`;pill.textContent=c.label}$('rb9CoachTitle').textContent=c.title;$('rb9CoachText').textContent=c.text;
    const r=healthValue();if(r){$('rb9HealthSource').textContent='TREDICT · SYNC';$('rb9Hrv').textContent=r.hrv?.value?`${Math.round(r.hrv.value)} ms`:'–';$('rb9HrvSub').textContent=r.hrv?.baseline?`baseline ${Math.round(r.hrv.baseline)}`:'baseline';$('rb9Sleep').textContent=formatSleep(r.sleep?.value);$('rb9SleepSub').textContent=r.sleep?.baseline?`baseline ${formatSleep(r.sleep.baseline)}`:'baseline';$('rb9Rhr').textContent=r.rhr?.value?`${Math.round(r.rhr.value)} bpm`:'–';$('rb9RhrSub').textContent=r.rhr?.baseline?`normal ${Math.round(r.rhr.baseline)}`:'baseline';$('rb9Load').textContent=r.level==='red'?'Høy':r.level==='yellow'?'Obs':'Normal';$('rb9LoadSub').textContent='recovery-signal'}else{$('rb9HealthSource').textContent='KLAR FOR TREDICT';$('rb9Hrv').textContent='–';$('rb9Sleep').textContent='–';$('rb9Rhr').textContent='–';$('rb9Load').textContent='–'}
    const cap=capacity();$('rb9Threshold').textContent=`${cap.th.pace}/km · ${cap.th.hr} bpm`;$('rb9ThresholdSource').textContent=cap.th.source;$('rb9Vo2').textContent=cap.vo?.value??'–';$('rb9Vo2Source').textContent=cap.vo?`${cap.vo.source||'Garmin'} · ${cap.vo.date||''}`:'automatisk når API leverer';$('rb9MaxHr').textContent=`${cap.max} bpm`;
    let done=0,total=0;try{const w=currentWeek();const wd=flat.filter(f=>f.week===w.n);total=wd.length;done=wd.filter(f=>isDone(f.label)).length}catch{}
    const trend=done>=Math.max(3,total-2)?'POSITIV':done?'STABIL':'BYGGES';$('rb9TrendState').textContent=trend;$('rb9TrendTitle').textContent=trend==='POSITIV'?'Positiv utvikling':trend==='STABIL'?'Stabil utvikling':'Trenden bygges';$('rb9TrendText').textContent=total?`${done}/${total} økter registrert denne uka. Terskel og recovery brukes som støtte – ikke som ordre om å øke.`:'RunnerBear bygger trend fra faktisk gjennomføring, terskel og respons.';
  }

  function goalsPremium(){
    const goals=$('goals');if(!goals)return;goals.classList.add('rb9-goals');
    qsa('#goals .card').forEach(c=>c.classList.add('rb9-surface'));
    const sub=$('rbGoalSubnav');if(sub)sub.classList.add('rb9-segmented');
    const hero=qs('.rb-goal-hero');if(hero)hero.classList.add('rb9-goal-premium');
    const timeline=qs('.rb-season-timeline');if(timeline)timeline.classList.add('rb9-timeline-premium');
  }

  function morePremium(){
    const more=$('more');if(!more)return;more.classList.add('rb9-more');
    qsa('#more .card').forEach(c=>c.classList.add('rb9-surface'));
    const threshold=qs('.threshold-card',more);if(threshold){const k=qs('.kicker span:first-child',threshold);if(k)k.textContent='KAPASITET';const s=qs('.kicker span:last-child',threshold);if(s)s.textContent='AUTO NÅR SYNC ER KLAR'}
    qsa('#more details').forEach(d=>d.classList.add('rb9-details'));
    let sync=$('rb9SyncReadiness');if(!sync){
      sync=document.createElement('article');sync.id='rb9SyncReadiness';sync.className='card rb9-sync-card rb9-surface';sync.innerHTML=`<div class="kicker"><span>GARMIN · TREDICT</span><span>API-READY</span></div><div class="rb9-sync-main">${icon('sync','rb9-large-line-icon')}<div><h3>Datagrunnlaget er klart</h3><p>Når Tredict OAuth er på plass fylles aktiviteter, HRV, søvn og hvilepuls inn automatisk. Planlagte strukturerte økter kan senere sendes samme vei tilbake til Garmin.</p></div></div><div class="rb9-sync-scopes"><span>Aktiviteter</span><span>HRV</span><span>Søvn</span><span>Hvilepuls</span><span>Økt til Garmin · senere</span></div>`;
      const head=qs('.section-head',more);head?.insertAdjacentElement('afterend',sync);
    }
  }

  function cleanLegacyVisuals(){
    qsa('.easy-choice-buttons button').forEach(btn=>{
      const mode=btn.dataset.mode;if(!mode)return;let ico=qs('.rb9-choice-icon',btn);if(!ico){ico=document.createElement('span');ico.className='rb9-choice-icon';btn.prepend(ico)}ico.innerHTML=ICON[mode==='row'?'row':mode==='bike'?'bike':'run'];
      qsa(':scope > span',btn).filter(s=>s!==ico&&(s.textContent||'').trim()==='').forEach(s=>s.remove());
    });
    qsa('.daymeta,.easy-prescription small').forEach(el=>{el.innerHTML=el.innerHTML.replace(/👟|🚣|🚴|🏃/g,'')});
  }

  function renderV9(){
    document.documentElement.classList.add('rb9');navIcons();decorateToday();decorateChoices();decoratePlan();renderIntelligence();goalsPremium();morePremium();cleanLegacyVisuals();
  }

  const previous=window.renderAll;
  if(typeof previous==='function')window.renderAll=function(){const out=previous.apply(this,arguments);renderV9();requestAnimationFrame(renderV9);return out};
  document.addEventListener('click',e=>{if(e.target.closest('.navbtn,.easy-choice [data-mode],.rb-goal-subnav button,.rb-week-arrow,.rb-week-center')){requestAnimationFrame(renderV9);setTimeout(renderV9,50)}},true);
  const obs=new MutationObserver(()=>{clearTimeout(window.__rb9T);window.__rb9T=setTimeout(renderV9,20)});
  ['today','plan','goals','more'].forEach(id=>{const el=$(id);if(el)obs.observe(el,{subtree:true,childList:true})});
  renderV9();requestAnimationFrame(renderV9);setTimeout(renderV9,100);
})();