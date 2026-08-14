/* RunnerBear v10.24 · canonical, targeted coaching UI within locked Design Direction 1.0
   Garmin stays the detailed training record. RunnerBear turns the available
   training, recovery and Concept2 signals into a calm next decision. */
(function(){
  'use strict';

  const K={
    cache:'runnerbear_tredict_cache_v1',match:'runnerbear_tredict_match_',adjustments:'runfest26_week_adjustments',
    moves:'runnerbear_v107_plan_moves',locks:'runnerbear_v107_plan_locks',control:'runnerbear_v107_coach_control',
    log:'runnerbear_v107_coach_log',seen:'runnerbear_v107_seen_actions',planView:'runnerbear_v107_plan_view',planLens:'runnerbear_v1019b_plan_lens',selected:'runnerbear_v108_selected_day',exclusions:'runnerbear_v108_match_exclusions',shoes:'runnerbear_v108_shoes',goals:'runnerbear_v109_goals',
    profile:'runfest26_training_profile_v10',legacyProfile:'runnerbear_v7_profile',dayModes:'runnerbear_v118_day_modes',readiness:'runnerbear_v1022_daily_readiness',tredictSync:'runnerbear_v1024_tredict_sync',legacyGarminSync:'runnerbear_v1023_garmin_sync'
  };
  let eventScope=null;
  const $=id=>document.getElementById(id),qs=(s,r=document)=>r?.querySelector?.(s)||null,qsa=(s,r=eventScope||document)=>[...(r?.querySelectorAll?.(s)||[])];
  const readCache=new Map();
  let moreRenderDirty=true;
  const read=(k,f)=>{const raw=localStorage.getItem(k)||'';try{const cached=readCache.get(k);if(cached?.raw===raw)return cached.value;const value=JSON.parse(raw)??f;readCache.set(k,{raw,value});return value}catch{return f}};
  const write=(k,v)=>{const raw=JSON.stringify(v);localStorage.setItem(k,raw);readCache.set(k,{raw,value:v});moreRenderDirty=true;try{window.dispatchEvent(new CustomEvent('runnerbear:state-dirty',{detail:{key:k}}))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const roundHalf=v=>Math.round(Number(v||0)*2)/2;
  const z=n=>String(n).padStart(2,'0');
  const localIso=d=>{const x=d instanceof Date?d:new Date(d);return Number.isNaN(x.getTime())?'':`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const dateFrom=ds=>new Date(`${ds}T12:00:00`);
  const addDays=(ds,n)=>{const d=dateFrom(ds);d.setDate(d.getDate()+n);return localIso(d)};
  const dayDiff=(a,b)=>Math.round((dateFrom(a)-dateFrom(b))/86400000);
  const today=()=>localIso(new Date());
  const formatDate=(ds,opts={weekday:'long',day:'numeric',month:'long'})=>new Intl.DateTimeFormat('nb-NO',opts).format(dateFrom(ds));
  const fmtTime=sec=>{sec=Math.max(0,Math.round(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${z(m)}:${z(s)}`:`${m}:${z(s)}`};
  const fmtPace=sec=>{sec=Math.round(Number(sec)||0);return sec?`${Math.floor(sec/60)}:${z(sec%60)}`:'–'};
  const paceSec=s=>{const m=String(s||'').match(/(\d+):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0};
  const engine=()=>window.RunnerBearCoachEngine||null;
  const analysisEngine=()=>window.RunnerBearV1012||null;
  const clarityModel=()=>window.RunnerBearV1022||window.RunnerBearV1020||null;
  const planIntegrity=()=>window.RunnerBearV1024||window.RunnerBearV1023||null;
  const runtimeStats={startupAt:performance.now(),renders:{today:0,plan:0,goals:0,more:0},fullRenders:0};
  let renderCache=null;
  const mark=name=>{try{performance.mark(name)}catch{}};
  const measure=(name,start)=>{try{performance.measure(name,start)}catch{}};
  const policy=()=>engine()?.policy?.()||{profile:{baseKm:50,maxKm:55,minRunDays:5,flexibleSessions:2,thresholdHr:173,maxHr:188},anchorKm:50,normalRange:[48,52]};
  function trackEvent(name,detail={}){
    const payload={event:name,runnerbearVersion:'10.24',...detail};
    if(Array.isArray(window.dataLayer))window.dataLayer.push(payload);
    try{window.dispatchEvent(new CustomEvent('runnerbear:analytics',{detail:payload}))}catch{}
  }
  let tredictSyncService=null;
  function tredictSync(){
    if(tredictSyncService)return tredictSyncService;
    tredictSyncService=planIntegrity()?.createTredictSyncService?.({storage:localStorage,stateKey:K.tredictSync,legacyStateKey:K.legacyGarminSync,transport:()=>window.RunnerBearTredictTransport||null,onEvent:(name,detail)=>{trackEvent(name,detail);try{window.dispatchEvent(new CustomEvent('runnerbear:state-dirty',{detail:{key:K.tredictSync}}))}catch{}},debounceMs:600})||null;
    return tredictSyncService;
  }
  const DAY_NAMES=['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  function dayArray(value,fallback){
    const clean=(Array.isArray(value)?value:fallback).map(Number).filter((v,i,a)=>Number.isInteger(v)&&v>=0&&v<=6&&a.indexOf(v)===i).sort((a,b)=>a-b);
    return clean.length?clean:fallback.slice();
  }
  function trainingPreferences(){
    const p=policy(),stored=read(K.profile,{}),legacy=read(K.legacyProfile,{}),rhythm=legacy?.weekRhythm||{};
    const baseKm=Number(stored.baseKm||p.profile.baseKm||50);
    return{baseKm,normalLow:Number(stored.normalLow||p.normalRange?.[0]||Math.max(30,baseKm-2)),normalHigh:Number(stored.normalHigh||p.normalRange?.[1]||baseKm+2),maxKm:Number(stored.maxKm||p.profile.maxKm||55),runDays:dayArray(stored.runDays||rhythm.runDays,[1,2,3,4,6]),qualityDays:dayArray(stored.qualityDays||rhythm.qualityDays,[1,4]),longRunDay:dayArray([stored.longRunDay??rhythm.longRunDay],[6])[0],alternativeDays:dayArray(stored.alternativeDays||rhythm.crossDays,[0,5]),preferencesConfigured:stored.preferencesConfigured===true};
  }
  function migrateTrainingPreferences(){
    const stored=read(K.profile,{}),prefs=trainingPreferences();let changed=false;
    ['runDays','qualityDays','longRunDay','alternativeDays'].forEach(key=>{if(stored[key]==null){stored[key]=prefs[key];changed=true}});
    if(stored.preferencesVersion!==1){stored.preferencesVersion=1;changed=true}
    if(changed)write(K.profile,stored);
    if(sessionStorage.getItem(K.planView)==='overview')sessionStorage.setItem(K.planView,'plan');
  }
  const control=()=>localStorage.getItem(K.control)||'autopilot';
  const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const DISTANCES={five:{label:'5 km',short:'5K'},ten:{label:'10 km',short:'10K'},half:{label:'Halvmaraton',short:'21K'},marathon:{label:'Maraton',short:'42K'}};
  const DEFAULT_GOAL={id:'runfest-2026',name:'Runfest Sandnes 21K',date:'2026-10-03',distance:'half',targetSeconds:4980,aspirationSeconds:4800,status:'active',created:'2026-08-10T00:00:00.000Z'};
  const HERO_BANK={
    tempo:'runnerbear-hero-tempo-v1019c.webp',
    intervals:'runnerbear-hero-intervals-v1019c.webp',
    race:'runnerbear-hero-race-v1019c.webp',
    urban:'runnerbear-hero-urban-v1019c.webp',
    recovery:'runnerbear-hero-recovery-v1019c.webp',
    strength:'runnerbear-hero-strength-v1019c.webp'
  };
  const daySeed=ds=>String(ds||today()).split('').reduce((sum,x)=>sum+(Number(x)||0),0);
  function heroNameForWorkout(p){
    const x=prescription(p),text=`${x?.title||''} ${x?.desc||''}`.toLowerCase();
    if(x?.type==='race')return'race';
    if(/styrke|mobilitet/.test(text))return'strength';
    if(x?.type==='rest'||/hvile|restitusjon/.test(text))return'recovery';
    if(/45\/15|400|800|intervall|bane/.test(text))return'intervals';
    if(x?.type==='quality'||/terskel|tempo|fart/.test(text))return daySeed(p?.ds)%2?'tempo':'intervals';
    if(/langtur/.test(text))return daySeed(p?.ds)%2?'tempo':'urban';
    return daySeed(p?.ds)%2?'urban':'tempo';
  }
  function heroNameForGoal(goal){
    if(!goal)return daySeed(today())%2?'urban':'recovery';
    return ['race','tempo','urban','intervals'][Math.floor(dateFrom(today()).getTime()/604800000)%4];
  }
  const heroStyle=name=>`style="--rb119c-hero:url(${HERO_BANK[name]||HERO_BANK.urban})" data-hero="${esc(name)}"`;

  function normalizeGoalState(value){
    const g=value&&typeof value==='object'?value:{};
    return{version:1,mode:['race','base','transition'].includes(g.mode)?g.mode:'race',primary:g.primary===null?null:{...DEFAULT_GOAL,...(g.primary||{})},secondary:Array.isArray(g.secondary)?g.secondary:[],history:Array.isArray(g.history)?g.history:[],transitionUntil:g.transitionUntil||'',updatedAt:g.updatedAt||new Date().toISOString()};
  }
  function goalState(){
    let g=normalizeGoalState(read(K.goals,null));
    if(g.mode==='transition'&&g.transitionUntil&&g.transitionUntil<today()){g={...g,mode:'base',transitionUntil:'',updatedAt:new Date().toISOString()};write(K.goals,g)}
    if(!localStorage.getItem(K.goals))write(K.goals,g);
    return g;
  }
  function saveGoalState(g){g=normalizeGoalState({...g,updatedAt:new Date().toISOString()});write(K.goals,g);return g}
  function activeGoal(){const g=goalState();return g.mode==='race'?g.primary:null}
  function distanceMeta(key){return DISTANCES[key]||DISTANCES.half}
  function timeInput(seconds){seconds=Math.round(Number(seconds)||0);if(!seconds)return'';const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;return h?`${h}:${z(m)}:${z(s)}`:`${m}:${z(s)}`}
  function parseTime(value){
    const p=String(value||'').trim().split(':').map(Number);if(!p.length||p.some(x=>!Number.isFinite(x)||x<0))return 0;
    if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return 0;
  }
  function goalDays(goal){return goal?.date?Math.max(0,dayDiff(goal.date,today())):0}
  const typeLabel=t=>({quality:'Kvalitet',easy:'Rolig',cross:'Alternativ',rest:'Hvile',race:'Løp'}[t]||'Økt');
  const icon=n=>{
    const p={
      today:'<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>',
      plan:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
      goal:'<path d="M6 21V4m0 1h10l-2.5 3L16 11H6"/><path d="m9 17 3-3 3 3 3-4 3 5"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      check:'<path d="m7 12 3 3 7-7"/>',
      info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
      lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      move:'<path d="m8 7-4 4 4 4M4 11h11a5 5 0 0 1 5 5"/>',
      swap:'<path d="m7 7 3-3 3 3M10 4v12m7 1-3 3-3-3m3 3V8"/>',
      run:'<circle cx="13" cy="4" r="2"/><path d="m10 9 3-2 2 3 3 1m-8-2-2 5-4 2m8-4-2 4-1 5m5-7 3 5"/>',
      row:'<circle cx="8" cy="5" r="2"/><path d="m6 9 4 2 3 5m-7-7-2 6m0 3h14M14 7l5 7"/>',
      bike:'<circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/><path d="m6 17 4-8 4 8m-7-4h9l-3-6h3"/>',
      sync:'<path d="M20 7h-5V2M4 17h5v5"/><path d="M18 5a8 8 0 0 0-13 3m1 11a8 8 0 0 0 13-3"/>',
      profile:'<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
      book:'<path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2zM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/>',
      shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/>',
      link:'<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
      shoe:'<path d="M4 15c3 0 5-2 6-6l3 3c2 2 4 3 7 3v4H4z"/>',
      log:'<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
      coach:'<path d="M5 17.5 9.2 13l3 2.5L19 7"/><path d="M15 7h4v4"/>',
      bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      flag:'<path d="M5 21V4m0 1h11l-2 3 2 3H5"/>',
      calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>',
      chevronLeft:'<path d="m15 18-6-6 6-6"/>',
      chevronRight:'<path d="m9 18 6-6-6-6"/>',
      arrowRight:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
      arrowLeft:'<path d="M19 12H5m5-5-5 5 5 5"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0"/><circle cx="12" cy="10" r="2.5"/>',
      heartbeat:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
      strength:'<path d="M3 10v4m3-7v10m3-6h6m0-4v10m3-7v4m3-4v4"/>',
      trend:'<path d="M4 19h16M6 16v-4m4 4V8m4 8v-6m4 6V5"/>',
      mountain:'<path d="m3 19 6-10 4 5 3-5 5 10z"/>',
      leaf:'<path d="M20 4C11 4 5 9 5 15c0 3 2 5 5 5 6 0 10-7 10-16Z"/><path d="M4 21c3-6 7-9 12-12"/>',
      moon:'<path d="M20 15a8 8 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/>',
      spark:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/>',
      balance:'<path d="M12 4v16M7 7h10M5 10l-3 5h6zM19 10l-3 5h6zM8 20h8"/>',
      continuity:'<path d="M7 7h10l-3-3m3 13H7l3 3"/>',
      patience:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M9 3h6"/>',
      message:'<path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
      heart:'<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>',
      plus:'<path d="M12 5v14M5 12h14"/>'
    };
    return `<svg class="rb107-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${p[n]||p.info}</svg>`;
  };
  function appBarHtml(){return `<header class="rb119b-appbar"><div class="rb119b-wordmark">RUNNERBEAR</div><button type="button" class="rb119b-icon-button" aria-label="Varsler">${icon('bell')}</button></header>`}
  function viewTitleHtml(title,subtitle,action=''){return `<header class="rb119b-view-title"><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${action}</header>`}
  function workoutIconName(p){const x=prescription(p),text=`${x.title||''} ${x.desc||''}`.toLowerCase();if(x.type==='race')return'flag';if(/langtur|terreng/.test(text))return'mountain';if(/styrke/.test(text))return'strength';if(/concept2|roing/.test(text))return'row';if(/zwift|sykkel/.test(text))return'bike';if(x.type==='quality')return/45\/15|intervall/.test(text)?'trend':'heartbeat';if(x.type==='rest')return'moon';if(/restitusjon/.test(text))return'leaf';return'heartbeat'}

  function rawSchedule(){return engine()?.schedule?.()||[]}
  function distanceKm(key){return{five:5,ten:10,half:21.1,marathon:42.2}[key]||10}
  function applyGoalRaces(rows){
    const races=goalState().secondary.filter(x=>x.status!=='cancelled'),cap=Number(policy().profile.maxKm||55);if(!races.length)return rows;
    let out=rows.map(p=>{const race=races.find(x=>x.date===p.ds);if(!race)return p;const km=distanceKm(race.distance);return{...p,bRace:race,type:'race',title:`${race.name} · B-løp`,desc:race.effort==='controlled'?'Kontrollert testløp som del av treningsuka.':'Full innsats. RunnerBear beskytter dagene rundt.',detail:race.effort==='controlled'?'Løp kontrollert og avslutt med overskudd. Resultatet brukes som datapunkt, ikke dom.':'Ingen ekstra kvalitet tett på. Åpne kontrollert og la løpet erstatte ukas hardeste økt.',km,shoe:p.shoe||'Konkurransesko',fuel:p.fuel||''}});
    races.filter(r=>r.effort==='race').forEach(race=>{const rp=out.find(x=>x.ds===race.date);if(!rp)return;const nearby=out.filter(x=>x.week===rp.week&&x.ds!==rp.ds&&x.type==='quality'&&Math.abs(dayDiff(x.ds,rp.ds))<=3).sort((a,b)=>Math.abs(dayDiff(a.ds,rp.ds))-Math.abs(dayDiff(b.ds,rp.ds)))[0];if(nearby)out=out.map(x=>x.baseDs===nearby.baseDs?{...x,type:'easy',title:'5 km svært rolig · B-løpstilpasning',desc:'Kvalitetsøkten er tatt ut fordi B-løpet løpes med full innsats.',detail:'Ingen treningsgjeld. Rolig betyr rolig.',km:5}:x)});
    [...new Set(out.map(x=>x.week))].forEach(week=>{let total=out.filter(x=>x.week===week).reduce((s,x)=>s+Number(x.km||0),0),overflow=roundHalf(total-cap);if(overflow<=0)return;for(const p of out.filter(x=>x.week===week&&x.type==='easy'&&!x.bRace).sort((a,b)=>/langtur/i.test(a.title)-/langtur/i.test(b.title))){if(overflow<=0)break;const min=/langtur/i.test(p.title)?14:5,cut=Math.min(Math.max(0,p.km-min),overflow);if(cut<=0)continue;p.km=roundHalf(p.km-cut);p.title=String(p.title).replace(/^\d+(?:[.,]\d+)?\s*km/i,`${String(p.km).replace('.',',')} km`);p.detail=`${p.detail||''} Volum automatisk balansert rundt B-løpet.`.trim();overflow=roundHalf(overflow-cut)}});
    return out;
  }
  function effectiveSchedule(){
    if(renderCache?.schedule)return renderCache.schedule;
    const moves=read(K.moves,{}),adjustments=read(K.adjustments,{});
    const rows=rawSchedule().map(p=>{
      const a=adjustments[p.label]||{},ds=moves[p.ds]||p.ds;
      return {...p,...a,baseDs:p.ds,sourceLabel:p.label,ds,date:dateFrom(ds),label:formatDate(ds,{weekday:'short',day:'numeric',month:'short'}).replace('.','')};
    });
    const schedule=applyGoalRaces(rows).sort((a,b)=>a.ds.localeCompare(b.ds));
    if(renderCache)renderCache.schedule=schedule;
    return schedule;
  }
  function planChange(p){
    if(!p)return null;
    const raw=rawSchedule().find(x=>x.ds===p.baseDs)||p,adjustment=read(K.adjustments,{})[p.sourceLabel],moved=p.ds!==p.baseDs,dayMode=read(K.dayModes,{})[p.baseDs];
    if(!adjustment&&!moved&&!dayMode)return null;
    const reasons={
      'auto-extra-volume':'Ekstra løping er balansert mot senere rolig volum.',
      'auto-flex-volume':'Ukas løpsvolum holdes innenfor volumtaket etter at en fleksibel dag ble valgt som løp.',
      'auto-recovery-red':'Recovery- eller kroppssignal tilsier lavere belastning. Konservativ tolkning vinner.',
      tired:'Du registrerte en sliten kropp. Arbeidsvolumet er redusert, mens intensitetskontrollen beholdes.',
      'readiness-v1022':'Du brukte coachens anbefaling etter Form i dag. Bare dagens økt er endret, uten treningsgjeld.',
      time:'Du registrerte dårlig tid. Økten er forkortet uten å øke farten.',
      achilles:'Du registrerte akilles- eller hælfestesignal. Løpsstøt er erstattet med lav belastning.',
      skip:'Du registrerte at økten ikke kan gjennomføres. Den tas ut uten treningsgjeld.'
    };
    const before=moved&&!adjustment
      ?`${raw.title} · ${formatDate(p.baseDs,{weekday:'long',day:'numeric',month:'short'})}`
      :`${raw.title}${Number(raw.km||0)?` · ${roundHalf(raw.km)} km`:''}`;
    const changedPlan=dayMode?prescription(p):p;
    const after=adjustment||dayMode
      ?`${changedPlan.title}${Number(changedPlan.km||0)?` · ${roundHalf(changedPlan.km)} km`:''}`
      :`${p.title} · ${formatDate(p.ds,{weekday:'long',day:'numeric',month:'short'})}`;
    return{
      kind:adjustment?'adjustment':dayMode?'choice':'move',before,after,
      automatic:/^auto-/.test(String(adjustment?.reason||'')),
      why:dayMode?'Dette er et engangsvalg for denne dagen. Neste dag følger den opprinnelige planen igjen.':adjustment?(reasons[adjustment.reason]||'Belastningen er justert innenfor volumtak, låser og Bakken-reglene.'):'Økten er flyttet innenfor samme uke med kontroll på avstand mellom kvalitetsøktene.'
    };
  }
  function changeNoticeHtml(p,context='today'){
    const change=planChange(p);if(!change)return'';
    return `<article class="rb107-card rb117-change ${context==='plan'?'compact':''}"><header><span class="rb117-change-mark">${icon('swap')}</span><div><span class="rb107-overline">${change.automatic?'Coachen har justert':'Planen er endret'}</span><h3>${esc(change.after)}</h3></div><strong>Endret</strong></header><div class="rb117-change-route"><span>${esc(change.before)}</span><i>${icon('arrowRight')}</i><b>${esc(change.after)}</b></div><details><summary>Hvorfor?</summary><p>${esc(change.why)}</p></details><button class="rb117-undo" data-rb117-undo-change="${esc(p.baseDs)}" data-rb117-change-kind="${change.kind}">Angre endringen</button></article>`;
  }
  function planFor(ds){return effectiveSchedule().find(p=>p.ds===ds)||null}
  function basePlan(baseDs){return effectiveSchedule().find(p=>p.baseDs===baseDs)||null}
  function flexible(p){return!!p&&(p.type==='cross'||(p.type==='rest'&&/zwift|concept2|roing|sykkel/i.test(`${p.title} ${p.desc} ${p.detail}`)))}
  function choiceKey(p){return`runfest26_easychoice_${String(p?.sourceLabel||p?.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`}
  function choiceFor(p){
    const saved=localStorage.getItem(choiceKey(p));if(saved)return saved;
    const text=`${p?.title||''} ${p?.desc||''}`;return /concept2|roing/i.test(text)?'row':/zwift|sykkel/i.test(text)?'bike':'rest';
  }
  function canOneOff(p){return!!p&&p.ds>=today()&&!isDone(p)&&!isLocked(p)&&!['quality','race'].includes(p.type)&&!/langtur/i.test(p.title||'')}
  function oneOffChoiceFor(p){return read(K.dayModes,{})[p?.baseDs]||(flexible(p)?choiceFor(p):'')}
  function prescription(p){
    const mode=oneOffChoiceFor(p);if(!mode)return p;
    const base={...p,mode};
    if(mode==='run')return{...base,type:'easy',title:'5 km svært rolig',desc:'Rolig løpsalternativ innenfor ukas volumramme.',detail:'Snakketempo og lav kostnad. Ingen strides eller progresjon.',km:5,shoe:'Komfortabel roligsko'};
    if(mode==='row')return{...base,title:'Concept2 · rolig aerob',desc:'30–40 min rolig roing.',detail:'Jevn, lett belastning. Cross skal støtte løpingen, ikke bli skjult kvalitet.',km:0,shoe:''};
    if(mode==='bike')return{...base,title:'Zwift · rolig aerob',desc:'40–50 min rolig sykling.',detail:'Lett motstand og jevn tråkkfrekvens. Ingen terskeldrag.',km:0,shoe:''};
    return{...base,title:'Hvile',desc:'Ingen planlagt trening.',detail:'Restitusjon er en del av planen.',km:0,shoe:''};
  }
  function kmFor(p){return Number(prescription(p)?.km||0)}
  function purposeFor(p){
    const x=prescription(p),t=String(x.title||'').toLowerCase();
    if(x.type==='race')return'Utføre løpsplanen med kontrollert åpning og sterk avslutning.';
    if(/gate/.test(t))return'Måle om ønsket halvmaratonfart er kontrollert nok til å kvalifisere racemålet.';
    if(/45\/15|400/.test(t))return'Bygge fart og flyt med korte pauser, uten å gjøre økten unødvendig hard.';
    if(x.type==='quality')return'Akkumulere kontrollert terskelarbeid med lav nok kostnad til at kvaliteten kan gjentas.';
    if(/langtur/.test(t))return'Bygge aerob robusthet og varighet uten å gjøre langturen moderat.';
    if(x.type==='easy')return'Restitusjon og aerob grunnmur som gjør neste kvalitetsøkt bedre.';
    if(flexible(x))return'Legge til aerob støtte uten å forstyrre løpskvaliteten.';
    return'Restitusjon og kontinuitet er treningen i dag.';
  }
  function targetFor(p){
    const x=prescription(p),model=analysisEngine()?.structuredWorkout?.(x);
    if(model)return{label:model.mainMetricLabel,main:model.mainLabel,work:model.mainLabel,total:model.total.label,pace:model.paceLabel,hr:model.hrLabel,recovery:model.recoveryLabel,model};
    return{label:x.type==='quality'?'Hoveddel':'Distanse',main:x.title||'Se detalj',work:x.title||'Se detalj',total:x.km?`${roundHalf(x.km)} km`:'Fleksibel total',pace:x.type==='easy'?'Rolig':x.type==='quality'?'Kontrollert':'Lett',hr:x.type==='easy'?'130–148 bpm':x.type==='quality'?'Under terskel':'Lav kostnad'};
  }
  function workoutStructure(p){
    const x=prescription(p);if(!x||!['quality','race'].includes(x.type))return null;const model=analysisEngine()?.structuredWorkout?.(x);
    return{
      warmup:model?.warmup||'Åpen oppvarming · 10–15 min rolig. Fortsett ved behov.',
      activation:'Valgfritt: 2–4 korte, kontrollerte stigninger. Full kontroll – ikke sprint.',
      main:`${model?.mainLabel||x.title}. ${x.detail||x.desc||''}`.trim(),
      recovery:model?.recoveryLabel||'',
      cooldown:model?.cooldown||'Åpen nedjogg · 10–15 min svært rolig.',
      estimate:model?.total?.label||'Fleksibel total',
      garmin:'Åpen oppvarming → hovedserie → åpen nedjogg'
    };
  }
  function workoutStructureHtml(p){
    const s=workoutStructure(p);if(!s)return'';
    return `<div class="rb108-structure"><div class="rb108-structure-head"><span>Garmin-klar øktstruktur</span><strong>${esc(s.estimate)}</strong></div><ol><li><b>Oppvarming</b><span>${esc(s.warmup)}</span></li><li><b>Aktivering · valgfritt</b><span>${esc(s.activation)}</span></li><li><b>Hoveddel</b><span>${esc(s.main)}</span></li>${s.recovery?`<li><b>Pauser</b><span>${esc(s.recovery)}</span></li>`:''}<li><b>Nedjogg</b><span>${esc(s.cooldown)}</span></li></ol><small>${esc(s.garmin)}. RunnerBear kan publisere strukturen via Tredict til Garmin-kalenderen.</small></div>`;
  }
  function garminWorkout(p){
    const x=prescription(p);if(!x||!['easy','quality','race'].includes(x.type)||Number(x.km||0)<=0)return null;const target=targetFor(p);
    return{workoutId:p.baseDs,externalId:planIntegrity()?.stableExternalId?.(p)||`rb-workout-${p.baseDs}`,originalDate:p.baseDs,date:p.ds,title:x.title,type:x.type,km:Number(x.km||p.km||0),desc:x.desc||'',detail:x.detail||'',purpose:purposeFor(x),target:`${target.pace||''} ${target.hr||''}`.trim(),structure:workoutStructure(p)};
  }
  const TREDICT_HORIZON_DAYS=10;
  function garminQueue(days=7){return effectiveSchedule().filter(p=>p.ds>=today()&&p.ds<=addDays(today(),days)&&!isTerminal(p)).map(garminWorkout).filter(Boolean)}
  function tredictPlanQueue(days=TREDICT_HORIZON_DAYS){const horizon=Math.max(1,Math.min(31,Math.round(Number(days)||TREDICT_HORIZON_DAYS))),end=addDays(today(),horizon-1);return effectiveSchedule().filter(p=>p.ds>=today()&&p.ds<=end&&!isTerminal(p)).map(garminWorkout).filter(Boolean)}
  function feedbackKey(p){return`runfest26_fb_${String(p?.sourceLabel||p?.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`}
  function feedbackFor(p){return read(feedbackKey(p),{})}
  function normalizeActivity(a){
    const s=a?.summary||a?.extendedSummary||{};
    return{id:String(a?.id||a?._id||''),date:a?.date||'',ds:a?.ds||localIso(a?.date),sportType:String(a?.sportType||'').toLowerCase(),subSportType:String(a?.subSportType||'').toLowerCase(),title:a?.title||s.title||'',duration:Number(a?.duration??s.duration??s.durationTotal)||0,distance:Number(a?.distance??s.distance)||0,pace:Number(a?.pace??s.pace)||0,heartrate:Number(a?.heartrate??s.heartrate)||0,heartrateMax:Number(a?.heartrateMax??s.heartrateMax)||0,power:Number(a?.power??s.power)||0,cadence:Number(a?.cadence??s.cadence)||0,ascent:Number(a?.ascent??s.ascent??s?.altitude?.ascent)||0,temperature:Number(a?.temperature??s.temperature)||0,detail:a?.detail||null,raw:a};
  }
  function activities(){
    if(renderCache?.activities)return renderCache.activities;
    const rows=read(K.cache,{}).activities;
    const normalized=(Array.isArray(rows)&&rows.length?rows:(engine()?.activities?.()||[])).map(normalizeActivity).filter(a=>a.id&&a.ds);
    if(renderCache)renderCache.activities=normalized;
    return normalized;
  }
  function sportKind(a,p=null){
    const text=`${a?.title||''} ${a?.subSportType||''}`.toLowerCase();
    if(a?.sportType==='running')return'run';
    if(a?.sportType==='cycling')return'bike';
    if(a?.sportType==='rowing'||/rowing|rowerg|concept2/.test(text))return'row';
    if(a?.sportType==='misc'&&/generic/.test(a?.subSportType||'')&&a.duration>=900&&a.distance>=2000&&a.power>0)return'row';
    return'other';
  }
  function expectedIntervals(p){
    const title=String(p?.title||'');
    if(/45\/15/.test(title)){const nums=[...title.matchAll(/(\d+)\s*[×x]/g)].map(x=>Number(x[1]));return nums.length?nums.reduce((a,b)=>a*b,1):0}
    return Number(title.match(/(\d+)\s*[×x]/)?.[1]||0);
  }
  function sessionAssessment(p,a,matchConfidence='high'){
    const x=prescription(p),profile=policy().profile||{};
    return analysisEngine()?.assessSession?.({plan:{...x,ds:p?.ds,flexible:flexible(p)},activity:a,thresholdHr:Number(profile.thresholdHr||173),maxHr:Number(profile.maxHr||188),matchConfidence,flexible:flexible(p)})||{code:'limited',tone:'neutral',status:{code:'limited',label:'Begrenset analysegrunnlag'},badge:'Begrenset',title:'Begrenset analysegrunnlag',review:reviewFor(p,a),consequence:'Økten teller i belastningen. RunnerBear gjør ingen offensiv planendring på dette grunnlaget.',confidence:{code:'limited',label:'Begrenset',copy:'Detaljert arbeidsdel mangler.',confirmed:0,extras:0},model:null,kind:sportKind(a,p),blocks:[],work:a?.detail?.analysis||{},actualKm:Number(a?.distance||0)/1000,pct:0,deltaKm:0};
  }
  function activityScore(p,a){
    const dd=Math.abs(dayDiff(a.ds,p.ds));if(dd>1)return-Infinity;
    const prescribed=prescription(p),kind=sportKind(a,p),mode=oneOffChoiceFor(p),runPlan=['easy','quality','race'].includes(prescribed.type),allowed=mode?kind===mode||mode==='run'&&kind==='run':runPlan?kind==='run':flexible(p)?['run','row','bike'].includes(kind):prescribed.type==='rest'?false:true;
    let score=dd===0?48:12;score+=allowed?28:-45;
    if(!allowed)return score;
    const plannedKm=Number(p.km||0),actualKm=a.distance/1000;
    if(plannedKm&&actualKm){const ratio=actualKm/plannedKm;score+=Math.max(-12,24-Math.abs(1-ratio)*48);if(/langtur/i.test(p.title)&&ratio>=.7&&ratio<=1.3)score+=8}
    if(p.type==='quality'&&a.heartrate>=145)score+=7;
    if((flexible(p)||mode)&&sportKind(a,p)===(mode||choiceFor(p)))score+=8;
    if(flexible(p)&&kind==='row'&&a.duration>=1500)score+=6;
    return score;
  }
  function manualCandidates(p){return activities().filter(a=>a.ds===p?.ds).map(a=>({a,score:activityScore(p,a)})).filter(x=>x.score>20).sort((a,b)=>b.score-a.score).slice(0,2)}
  function matchPickerHtml(p){
    if(!p||matchFor(p))return'';const candidates=manualCandidates(p);if(!candidates.length)return'';
    return `<div class="rb108-candidates"><span>Aktivitet funnet · velg kobling</span>${candidates.map(({a})=>`<button data-rb108-match-id="${esc(a.id)}" data-base-ds="${esc(p.baseDs)}"><b>${esc(a.title||sportLabel(a,p))}</b><small>${fmtTime(a.duration)}${a.distance?` · ${(a.distance/1000).toFixed(1).replace('.',',')} km`:''}</small></button>`).join('')}</div>`;
  }
  function matchStatus(p,a){
    return sessionAssessment(p,a).status;
  }
  let matchCache={signature:'',map:new Map(),replacements:new Map(),used:new Set()};
  function allMatches(){
    if(renderCache?.matches)return renderCache.matches;
    const acts=activities(),plans=effectiveSchedule(),signature=`${acts.map(a=>`${a.id}:${a.ds}:${a.distance}:${a.duration}:${a.heartrate}:${a.detail?.analysis?.confidence||''}:${a.detail?.analysis?.workBlocks?.length||0}:${a.detail?.analysis?.workHr||0}:${a.detail?.analysis?.workPace||0}:${a.detail?.analysis?.hrDrift||0}`).join('|')}#${plans.map(p=>`${p.baseDs}:${p.ds}:${p.type}:${p.title}:${p.km}:${p.bRace?.id||''}:${oneOffChoiceFor(p)}`).join('|')}`;
    if(matchCache.signature===signature){if(renderCache)renderCache.matches=matchCache;return matchCache}
    const map=new Map(),replacements=new Map(),used=new Set(),excluded=read(K.exclusions,{}),integrity=planIntegrity();
    const allowed=(p,a)=>analysisEngine()?.matchAllowed?.({activityId:a?.id,usedIds:[...used],excludedId:excluded[p.baseDs]})??(!!a&&!used.has(a.id)&&excluded[p.baseDs]!==a.id);
    plans.forEach(p=>{for(const ds of [p.ds,p.baseDs]){const saved=read(K.match+ds,null),id=String(saved?.activityId||saved?.activity?.id||''),a=acts.find(x=>x.id===id),scheduleCompatible=a?.ds===p.ds||saved?.automatic===false;if(!scheduleCompatible||!allowed(p,a))continue;const assessment=sessionAssessment(p,a,'high'),classification=integrity?.classifySession?.({plan:prescription(p),activity:a,assessment,matchConfidence:'high',today:today(),maxHr:Number(policy().profile.maxHr||188)});if(classification?.code==='replaced')replacements.set(p.baseDs,{activity:a,score:100,confidence:'high',classification,automatic:!!saved?.automatic,saved:true});else{const status=matchStatus(p,a);map.set(p.baseDs,{activity:a,score:100,confidence:'high',status,classification,automatic:!!saved?.automatic,saved:true})}used.add(a.id);break}});
    plans.forEach(p=>{if(map.has(p.baseDs)||replacements.has(p.baseDs))return;const ranked=acts.filter(a=>allowed(p,a)&&(p.ds===p.baseDs||a.ds===p.ds)).map(a=>({a,score:activityScore(p,a)})).filter(x=>x.score>=58).sort((a,b)=>b.score-a.score);if(!ranked.length)return;const best=ranked[0],margin=best.score-(ranked[1]?.score??0),confidence=best.score>=82&&margin>=8?'high':best.score>=68&&margin>=5?'likely':'unclear';if(confidence==='unclear')return;const assessment=sessionAssessment(p,best.a,confidence),classification=integrity?.classifySession?.({plan:prescription(p),activity:best.a,assessment,matchConfidence:confidence,today:today(),maxHr:Number(policy().profile.maxHr||188)});if(classification?.code==='replaced')replacements.set(p.baseDs,{activity:best.a,score:best.score,confidence,classification,automatic:true,saved:false});else{const status=matchStatus(p,best.a);map.set(p.baseDs,{activity:best.a,score:best.score,confidence,status,classification,automatic:true,saved:false})}used.add(best.a.id);if(classification?.code!=='replaced'&&confidence==='high'&&best.a.ds===p.ds){write(K.match+p.ds,{activityId:best.a.id,activity:best.a,planned:{date:p.ds,type:p.type,title:p.title,km:Number(p.km||0),label:p.sourceLabel,source:'runnerbear-v10.24'},automatic:true,matchedAt:new Date().toISOString(),matcher:'runnerbear-v10.24-intent'})}});
    plans.forEach(p=>{if(map.has(p.baseDs)||replacements.has(p.baseDs)||p.ds>today())return;const candidates=acts.filter(a=>allowed(p,a)&&a.ds===p.ds).map(a=>{const assessment=sessionAssessment(p,a,'likely'),classification=integrity?.classifySession?.({plan:prescription(p),activity:a,assessment,matchConfidence:'likely',today:today(),maxHr:Number(policy().profile.maxHr||188)});return{a,assessment,classification}}).filter(x=>x.classification?.code==='replaced').sort((a,b)=>Number(b.a.duration||0)-Number(a.a.duration||0));if(!candidates.length)return;const best=candidates[0];replacements.set(p.baseDs,{activity:best.a,score:50,confidence:'likely',classification:best.classification,automatic:true,saved:false});used.add(best.a.id)});
    replacements.forEach((replacement,baseDs)=>{const p=plans.find(row=>row.baseDs===baseDs),id=`workout_replaced:${baseDs}:${replacement.activity.id}`,first=!read(K.seen,{})[id];addLog(`Planlagt ${p?.title||'økt'} er erstattet av ${sportLabel(replacement.activity,p)}. Planen videre står.`,'activity',null,id);if(first){queueTredictMutation('plan:workout-replaced',[p],{previousDate:p?.ds,reason:'activity-sync'});trackEvent('workout_replaced',{planType:p?.type||'',activityKind:sportKind(replacement.activity,p)})}});
    matchCache={signature,map,replacements,used};if(renderCache)renderCache.matches=matchCache;return matchCache;
  }
  function matchFor(p){return p?allMatches().map.get(p.baseDs)||null:null}
  function replacementFor(p){return p?allMatches().replacements.get(p.baseDs)||null:null}
  function cancelledFor(p){return read(K.adjustments,{})[p?.sourceLabel]?.reason==='skip'}
  function sessionState(p){
    if(!p)return{code:'planned',label:'Planlagt',terminal:false};const match=matchFor(p),replacement=replacementFor(p),integrity=planIntegrity();
    if(match)return match.classification||integrity?.classifySession?.({plan:prescription(p),activity:match.activity,assessment:sessionAssessment(p,match.activity,match.confidence),matchConfidence:match.confidence,today:today(),maxHr:Number(policy().profile.maxHr||188)})||{code:'completed',label:'Gjennomført',terminal:true};
    if(replacement)return replacement.classification;
    return integrity?.classifySession?.({plan:{...prescription(p),baseDs:p.baseDs,ds:p.ds},today:today(),cancelled:cancelledFor(p)})||{code:p.ds<today()?'expired':p.ds!==p.baseDs?'moved':'planned',label:p.ds<today()?'Utgått':p.ds!==p.baseDs?'Flyttet':'Planlagt',terminal:p.ds<today()};
  }
  function activityFor(p){return matchFor(p)?.activity||null}
  function replacementActivityFor(p){return replacementFor(p)?.activity||null}
  function isDone(p){return sessionState(p).code==='completed'}
  function isTerminal(p){return!!sessionState(p).terminal}
  function sportLabel(a,p){
    if(!a)return'';const title=String(a.title||'');
    if(a.sportType==='running')return'Løp';
    if(a.sportType==='cycling')return'Zwift / sykkel';
    if(sportKind(a,p)==='row'||/concept2|rowerg|roing/i.test(title))return'Concept2 / roing';
    return title||'Aktivitet';
  }
  function actualMetrics(a,p){
    if(!a)return[];const out=[];
    if(a.duration)out.push(['Tid',fmtTime(a.duration)]);
    if(a.distance)out.push(['Distanse',`${(Number(a.distance)/1000).toFixed(1).replace('.0','').replace('.',',')} km`]);
    if(a.heartrate)out.push(['Snittpuls',`${Math.round(a.heartrate)} bpm`]);
    if(a.power)out.push(['Effekt',`${Math.round(a.power)} W`]);
    if(a.duration&&a.distance&&a.sportType==='running')out.push(['Snittfart',`${fmtPace(a.duration/(a.distance/1000))}/km`]);
    return out;
  }
  function resultMetrics(a,p){
    if(!a)return[];const work=a.detail?.analysis||{},blocks=Array.isArray(work.workBlocks)?work.workBlocks:[],kind=sportKind(a,p),assessment=p?sessionAssessment(p,a):null;
    if(p?.type==='quality'&&blocks.length&&assessment?.confidence?.code!=='limited'){
      const drift=Math.round(Number(work.hrDrift)||0),fade=Math.round(Number(work.paceFade)||0);
      return[
        ['Hoveddel',assessment.model?.expectedIntervals?`${assessment.confidence.confirmed} drag`:work.workDuration?fmtTime(work.workDuration):`${blocks.length} blokker`],
        ['Arbeidsfart',work.workPace?`${fmtPace(work.workPace)}/km`:'–'],
        ['Arbeidspuls',work.workHr?`${Math.round(work.workHr)} bpm`:'–'],
        [/45\/15|400/i.test(String(p.title||''))?'Fartsutvikling':'Pulsdrift',/45\/15|400/i.test(String(p.title||''))?`${fade>0?'+':''}${fade} sek/km`:`${drift>0?'+':''}${drift} bpm`]
      ];
    }
    if(kind==='row')return[
      ['Tid',fmtTime(a.duration)],
      ['Snittfart',a.duration&&a.distance?`${fmtPace(a.duration/(a.distance/500))}/500 m`:'–'],
      ['Effekt',a.power?`${Math.round(a.power)} W`:'–'],
      [a.cadence?'Takt':'Snittpuls',a.cadence?`${Math.round(a.cadence)} spm`:a.heartrate?`${Math.round(a.heartrate)} bpm`:'–']
    ];
    if(kind==='bike')return[
      ['Tid',fmtTime(a.duration)],['Effekt',a.power?`${Math.round(a.power)} W`:'–'],['Snittpuls',a.heartrate?`${Math.round(a.heartrate)} bpm`:'–'],['Distanse',a.distance?`${(a.distance/1000).toFixed(1).replace('.',',')} km`:'–']
    ];
    if(kind==='run')return[
      ['Distanse',a.distance?`${(a.distance/1000).toFixed(1).replace('.',',')} km`:'–'],
      ['Tid',fmtTime(a.duration)],
      ['Snittpuls',a.heartrate?`${Math.round(a.heartrate)} bpm`:'–'],
      ['Snittfart',a.duration&&a.distance?`${fmtPace(a.duration/(a.distance/1000))}/km`:'–']
    ];
    return actualMetrics(a,p).slice(0,4);
  }
  function reviewFor(p,a){
    if(!a)return'';const max=Number(policy().profile.maxHr||188),pct=a.heartrate?Math.round(a.heartrate/max*100):0;
    if(flexible(p))return pct&&pct<=70?`Kontrollert aerob støtte (${pct} % av makspuls). Belastningen er lav nok til at neste kvalitetsøkt kan stå.`:'Alternativøkten er registrert som reell belastning. Den skal støtte terskelarbeidet, ikke bli en skjult kvalitetsøkt.';
    if(p.type==='easy')return pct&&pct<=72?`Rolig betyr rolig — og denne traff. ${pct} % av makspuls gir aerob stimulus med lav kostnad.`:pct?`Denne rolige økten kostet mer enn ønsket (${pct} % av makspuls). RunnerBear holder neste økning konservativ.`:'Rolig belastning er registrert og brukes til å beskytte neste kvalitetsøkt.';
    if(p.type==='quality')return'Kvalitetsøkten vurderes på kontroll og repeterbarhet. Puls, arbeidsfart og egen følelse brukes i neste dosering.';
    return'Gjennomføringen er registrert og inngår i den løpende belastningsvurderingen.';
  }
  function analysisFor(p,a){
    const match=matchFor(p),assessment=sessionAssessment(p,a,match?.confidence||'likely'),kind=assessment.kind,work=assessment.work||{},blocks=assessment.blocks||[],planned=effectiveSchedule().filter(q=>q.baseDs!==p.baseDs&&q.ds<p.ds).map(q=>({plan:{...prescription(q),ds:q.ds,flexible:flexible(q)},activity:activityFor(q)})).filter(x=>x.activity),comparable=analysisEngine()?.selectComparableSessions?.({...prescription(p),ds:p.ds,flexible:flexible(p)},planned,kind)||[];
    let comparison='Sammenligningsgrunnlaget bygges etter hvert som flere like økter får detaljdata.';
    if(comparable.length&&p.type==='quality'&&Number(work.workPace)>0&&Number(work.workHr)>0){
      const rows=comparable.map(x=>x.activity?.detail?.analysis||{}).filter(x=>Number(x.workPace)>0&&Number(x.workHr)>0),reference=rows.at(-1);
      if(reference){const paceGap=Math.round(Number(reference.workPace)-Number(work.workPace)),hrGap=Math.round(Number(work.workHr)-Number(reference.workHr));comparison=`Mot siste like økt er arbeidsfarten ${Math.abs(paceGap)} sek/km ${paceGap>=0?'raskere':'roligere'} ved ${Math.abs(hrGap)} bpm ${hrGap<=0?'lavere':'høyere'} arbeidspuls.`}
    }else if(comparable.length&&a.heartrate){
      const hrs=comparable.map(x=>Number(x.activity?.heartrate||0)).filter(Boolean),reference=hrs.length?hrs.reduce((sum,x)=>sum+x,0)/hrs.length:0;
      if(reference)comparison=`Mot ${hrs.length} økt${hrs.length===1?'':'er'} av samme type er snittpulsen ${Math.abs(Math.round(a.heartrate-reference))} bpm ${a.heartrate<=reference?'lavere':'høyere'}.`;
    }
    const basis=`Analysekvalitet: ${assessment.confidence.label.toLowerCase()}. Basert på Garmin/Tredict, ${match?.confidence==='high'?'sikker':'sannsynlig'} planmatch${assessment.confidence.confirmed?`, ${assessment.confidence.confirmed} planlagte arbeidsdrag bekreftet`:''} og siste 30 dagers belastning.`;
    return{...assessment,headline:assessment.title,comparison,basis,status:assessment.status,ratio:Number(p?.km||0)&&assessment.actualKm?assessment.actualKm/Number(p.km):1};
  }
  function verdictFor(p,a,x=analysisFor(p,a)){
    const overline=flexible(p)?'Aerob støtte · fullført':p?.type==='quality'?'Kontrollert kvalitet · fullført':/langtur/i.test(String(p?.title||''))?'Langtur · fullført':p?.type==='easy'?'Rolig løp · fullført':'Dagens økt · fullført';
    return{overline,title:x.title||x.headline||'Økten er registrert',badge:x.badge||'Fullført'};
  }
  function comparisonHtml(p,a){
    const t=targetFor(p),x=sessionAssessment(p,a),w=x.work||{},actualKm=Number(a.distance||0)/1000,actualPace=w.workPace?`${fmtPace(w.workPace)}/km`:a.duration&&actualKm?`${fmtPace(a.duration/actualKm)}/km`:'–',actualHr=w.workHr?`${Math.round(w.workHr)} bpm`:a.heartrate?`${Math.round(a.heartrate)} bpm`:'–',expected=x.model?.expectedIntervals||0;
    const actualMain=p.type==='quality'?(x.confidence.code==='limited'?'Ikke sikkert identifisert':expected?`${x.confidence.confirmed} av ${expected} drag`:w.workDuration?fmtTime(w.workDuration):'Identifisert'):actualKm?`${actualKm.toFixed(1).replace('.0','').replace('.',',')} km`:fmtTime(a.duration);
    const rows=[[t.label||'Hoveddel',t.main||t.work,actualMain],...(p.type==='quality'?[['Total',t.total,actualKm?`${actualKm.toFixed(1).replace('.',',')} km`:'–']]:[]),['Fart / styring',t.pace,actualPace],['Puls',t.hr,actualHr]];
    return `<div class="rb109-compare-table"><div class="head"><span></span><b>Planlagt</b><b>Utført</b></div>${rows.map(r=>`<div><span>${esc(r[0])}</span><b>${esc(r[1])}</b><b>${esc(r[2])}</b></div>`).join('')}</div>`;
  }
  function plannedDetailsHtml(p){
    const x=prescription(p);return `<div class="rb109-plan-details"><div><span>Hensikt</span><p>${esc(purposeFor(x))}</p></div><div><span>Gjennomføring</span><p>${esc(x.detail||x.desc||'Følg kontrollert belastning.')}</p></div>${x.shoe?`<div><span>Sko</span><p>${esc(x.shoe)}</p></div>`:''}${x.fuel?`<div><span>Energi</span><p>${esc(x.fuel)}</p></div>`:''}${workoutStructureHtml(p)}</div>`;
  }
  function analysisDetailsHtml(p,a){
    const x=analysisFor(p,a);
    return `<div class="rb108-analysis-sections"><section><span>Planlagt mot utført</span>${comparisonHtml(p,a)}</section><section><span>Hva coachen ser</span><p>${esc(x.review)}</p><small>${esc(x.comparison)}</small></section><section class="${x.tone}"><span>Konsekvens for planen</span><b>${esc(x.consequence)}</b></section><footer>${esc(x.basis)}</footer></div>`;
  }

  function addLog(message,kind='coach',undo=null,id=''){
    const rows=read(K.log,[]),seen=read(K.seen,{});if(id&&seen[id])return;
    if(id){seen[id]=new Date().toISOString();write(K.seen,seen)}
    rows.unshift({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:new Date().toISOString(),message,kind,undo});
    write(K.log,rows.slice(0,30));
  }
  function undoEntry(id){
    const rows=read(K.log,[]),entry=rows.find(x=>x.id===id);if(!entry?.undo)return;
    const previousDates=Object.fromEntries(effectiveSchedule().map(p=>[p.baseDs,p.ds]));
    if(entry.undo.kind==='remove-adjustment'){
      const all=read(K.adjustments,{});delete all[entry.undo.label];write(K.adjustments,all);
    }else{
      const {key,had,value}=entry.undo;if(had)localStorage.setItem(key,value);else localStorage.removeItem(key);
    }
    matchCache.signature='';
    queueTredictMutation('plan:workout-adjusted',effectiveSchedule().filter(p=>p.ds>=today()),{previousDates,reason:'coach-log-undo'});
    entry.message=`Angret: ${entry.message}`;delete entry.undo;write(K.log,rows);toast('Endringen er angret');renderAll();
  }
  function snapshot(key){return{key,had:localStorage.getItem(key)!==null,value:localStorage.getItem(key)||''}}
  function syncPayload(p,{cancelled=false}={}){
    const workout=garminWorkout(p);if(workout&&!cancelled)return workout;const x=prescription(p);
    return{workoutId:p.baseDs,externalId:planIntegrity()?.stableExternalId?.(p)||`rb-workout-${p.baseDs}`,originalDate:p.baseDs,date:p.ds,title:x.title,type:x.type,km:Number(x.km||0),cancelled:true};
  }
  function queueTredictMutation(type,plans=[],detail={}){
    const service=tredictSync(),integrity=planIntegrity();if(!service||!integrity)return;
    for(const p of plans.filter(Boolean)){
      const previousDate=detail.previousDates?.[p.baseDs]||detail.previousDate||'',cancelled=['plan:workout-replaced','plan:workout-cancelled'].includes(type)||!['easy','quality','race'].includes(prescription(p).type),workout=syncPayload(p,{cancelled}),event=integrity.planEvent(type,workout,{previousDate,newDate:p.ds,reason:detail.reason||'plan-change'});service.queue(event,workout);
    }
  }
  function logAutomaticAdjustments(){
    const seen=read(K.seen,{}),adj=read(K.adjustments,{});
    Object.entries(adj).forEach(([label,a])=>{
      if(!/^auto-/.test(a?.reason||''))return;const id=`${a.reason}:${label}:${a.created||a.km||''}`;if(seen[id])return;
      const why=a.reason==='auto-extra-volume'?'Ekstra løping er balansert mot senere rolig volum':a.reason==='auto-flex-volume'?'Valgt løpsalternativ er holdt innenfor volumtaket':'Belastningen utløste en konservativ justering';
      addLog(`${why}: ${label} er justert til ${a.km||0} km.`,'auto',{kind:'remove-adjustment',label},id);
    });
  }
  function isLocked(p){return!!read(K.locks,{})[p?.baseDs]}
  function toggleLock(p){
    if(!p)return;const before=snapshot(K.locks),locks=read(K.locks,{});if(locks[p.baseDs])delete locks[p.baseDs];else locks[p.baseDs]=true;write(K.locks,locks);
    addLog(`${p.title} er ${locks[p.baseDs]?'låst':'låst opp'}.`,'manual',before);renderAll();
  }
  function swapRows(){return effectiveSchedule().map(row=>({baseDs:row.baseDs,ds:row.ds,week:row.week,type:prescription(row).type,status:sessionState(row),locked:isLocked(row)}))}
  function swapWorkout(p,targetDs,source='fallback'){
    const other=planFor(targetDs),validation=planIntegrity()?.validateSwap?.({rows:swapRows(),sourceBaseDs:p?.baseDs||'',targetBaseDs:other?.baseDs||'',today:today()});
    if(!validation?.ok){trackEvent('plan_move_rejected',{reason:validation?.code||'invalid',source});return toast(validation?.message||'Flyttingen kan ikke gjennomføres.')}
    const before=snapshot(K.moves),moves=read(K.moves,{}),pOld=p.ds,oOld=other.ds,previousDates={[p.baseDs]:pOld,[other.baseDs]:oOld};
    moves[p.baseDs]=oOld;moves[other.baseDs]=pOld;
    if(moves[p.baseDs]===p.baseDs)delete moves[p.baseDs];if(moves[other.baseDs]===other.baseDs)delete moves[other.baseDs];
    write(K.moves,moves);state.selectedDs=oOld;matchCache.signature='';const changed=[basePlan(p.baseDs),basePlan(other.baseDs)];queueTredictMutation('plan:workout-moved',changed,{previousDates,reason:source});addLog(`${p.title} flyttet fra ${formatDate(pOld,{weekday:'long',day:'numeric',month:'short'})} til ${formatDate(oOld,{weekday:'long',day:'numeric',month:'short'})}.`,'manual',before);trackEvent('plan_workout_swapped',{source});renderAll();toast(`${p.title} er flyttet til ${formatDate(oOld,{weekday:'long'})}.`,{label:'Angre',run:()=>undoSwap(before,[p.baseDs,other.baseDs])});return true;
  }
  function undoSwap(before,baseIds=[]){
    const prior=Object.fromEntries(baseIds.map(id=>[id,basePlan(id)?.ds||'']));if(before.had)localStorage.setItem(before.key,before.value);else localStorage.removeItem(before.key);try{window.dispatchEvent(new CustomEvent('runnerbear:state-dirty',{detail:{key:before.key}}))}catch{}matchCache.signature='';const restored=baseIds.map(basePlan).filter(Boolean);queueTredictMutation('plan:workout-moved',restored,{previousDates:prior,reason:'undo'});addLog('Planflyttingen er angret.','manual');trackEvent('plan_move_undone');renderAll();toast('Planflyttingen er angret');
  }
  function moveWorkout(p,delta){
    if(!p)return;return swapWorkout(p,addDays(p.ds,delta),'fallback');
  }
  function adapt(p,reason){
    if(!p||isLocked(p))return toast('Økten er låst. Lås opp før den endres.');
    const before=snapshot(K.adjustments),all=read(K.adjustments,{}),base={created:new Date().toISOString(),source:'runnerbear-v10.13'};
    if(reason==='skip')all[p.sourceLabel]={...base,reason,type:'rest',title:'Hvile · økten utgår',desc:'Ingen treningsgjeld.',detail:'Økten flyttes ikke til en annen dag, og kilometer tas ikke igjen.',km:0,shoe:'',fuel:''};
    else if(reason==='achilles')all[p.sourceLabel]={...base,reason,type:'cross',title:'Zwift · akillesavlastning',desc:'45–60 min svært rolig sykling.',detail:'Akilles- og hælfestesignal trumfer kalenderen. Lav støtbelastning, ingen bonusarbeid og ingen aggressive hældropp under trinnnivå. Fortsett med neste planlagte løpedag først når morgenstivhet og respons er rolig.',km:0,shoe:'',fuel:''};
    else{
      const factor=reason==='time'?.68:.78,km=Math.max(p.type==='quality'?6:4,roundHalf(Number(p.km||0)*factor));
      all[p.sourceLabel]={...base,reason,type:p.type,title:`Kortversjon · ${p.title}`,desc:'Lavere arbeidsvolum, samme intensitetskontroll.',detail:`${p.detail||''} Kutt volum, ikke øk farten.`,km,shoe:p.shoe,fuel:p.fuel};
    }
    write(K.adjustments,all);const changed=basePlan(p.baseDs);queueTredictMutation(reason==='skip'?'plan:workout-cancelled':'plan:workout-adjusted',[changed],{previousDate:p.ds,reason});addLog(`${p.title} er tilpasset: ${reason==='time'?'kortere tid':reason==='tired'?'sliten kropp':reason==='achilles'?'akillesrespons':'økten utgår'}.`,'manual',before);toast('Dagen er tilpasset uten treningsgjeld');renderAll();
  }
  function balanceFlexChoice(p){
    if(oneOffChoiceFor(p)!=='run'||control()!=='autopilot')return;
    const rows=effectiveSchedule().filter(x=>x.week===p.week),cap=Number(policy().profile.maxKm||55),total=rows.reduce((s,x)=>s+kmFor(x),0),overflow=roundHalf(total-cap);
    if(overflow<=0)return;const next=rows.find(x=>x.ds>p.ds&&x.type==='easy'&&!/langtur/i.test(x.title)&&!isLocked(x));if(!next)return;
    const all=read(K.adjustments,{}),km=Math.max(5,roundHalf(next.km-overflow));if(km>=next.km)return;
    all[next.sourceLabel]={created:new Date().toISOString(),reason:'auto-flex-volume',type:next.type,title:String(next.title).replace(/^\d+(?:[.,]\d+)?\s*km/i,`${String(km).replace('.',',')} km`),desc:next.desc,detail:`${next.detail||''} Automatisk balansert fordi en fleksibel dag ble valgt som løp.`,km,shoe:next.shoe,fuel:next.fuel};write(K.adjustments,all);
  }
  function setChoice(p,mode){
    if(!canOneOff(p)&&!flexible(p))return;const before=snapshot(K.dayModes),choices=read(K.dayModes,{});choices[p.baseDs]=mode;write(K.dayModes,choices);balanceFlexChoice(p);
    const changed=basePlan(p.baseDs);queueTredictMutation('plan:workout-adjusted',[changed],{previousDate:p.ds,reason:`day-choice-${mode}`});addLog(`${formatDate(p.ds,{weekday:'long'})}: ${mode==='run'?'rolig jogg':mode==='row'?'Concept2':mode==='bike'?'Zwift':'hvile'} er valgt.`,'manual',before);renderAll();
  }
  function runAutopilot(){
    /* v10.22: even Autopilot presents a daily readiness recommendation first.
       The user must explicitly accept it; no recovery signal silently replaces
       the workout or creates a follow-up quality debt. */
    return;
  }
  function migrateDocumentedThreshold(){
    const profileKey='runfest26_training_profile_v10',profile=read(profileKey,{});
    if(!profile.thresholdHr||Number(profile.thresholdHr)===175){profile.thresholdHr=173;write(profileKey,profile)}
    const historyKey='runfest26_threshold_history',history=read(historyKey,[]);
    if(Array.isArray(history)){
      let changed=false;const next=history.map(x=>{if(String(x?.date)==='2026-08-09'&&paceSec(x?.pace)===242&&Number(x?.hr)===175){changed=true;return{...x,hr:173}}return x});
      if(changed)write(historyKey,next);
    }
    const live=window.RunnerBearPlanPolicy?.profile;if(live&&Number(live.thresholdHr)===175)live.thresholdHr=173;
  }

  const savedPlanView=sessionStorage.getItem(K.planView);
  const savedPlanLens=sessionStorage.getItem(K.planLens);
  const state={selectedDs:sessionStorage.getItem(K.selected)||'',planView:savedPlanView==='done'?'done':'plan',planLens:['week','focus','long'].includes(savedPlanLens)?savedPlanLens:'week',openWeek:null,monthKey:'',planDayViewOpen:false,planDetailOpen:false,moveOpen:false,adaptOpen:false,completedId:'',doneScroll:0,goalManagerOpen:false,goalEditor:'',workoutDetailOpen:false,workoutDetailDs:'',coachReasonOpen:false,intensityExplanationOpen:false};
  function weekForToday(){return planFor(today())?.week||effectiveSchedule().find(p=>p.ds>=today())?.week||effectiveSchedule().at(-1)?.week||1}
  function selectedPlan(){return planFor(state.selectedDs)||planFor(today())||effectiveSchedule().find(p=>p.ds>=today())||effectiveSchedule().at(-1)}
  function weekRows(n){return effectiveSchedule().filter(p=>p.week===n)}
  function weekStats(n){
    const rows=weekRows(n),km=roundHalf(rows.reduce((s,p)=>s+kmFor(p),0)),runDays=rows.filter(p=>['easy','quality','race'].includes(prescription(p).type)&&kmFor(p)>0).length,quality=rows.filter(p=>p.type==='quality'||p.type==='race').length,long=rows.filter(p=>/langtur/i.test(p.title)).length;
    return{km,runDays,quality,long};
  }
  function syncState(){
    const c=read(K.cache,{}),at=Date.parse(c.syncedAt||localStorage.getItem('runnerbear_tredict_last_sync')||0),age=at?Date.now()-at:Infinity;
    return{at,age,stale:age>6*3600000,label:at?new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date(at)):'venter på Garmin'};
  }
  function healthSignal(){
    let r=null;try{r=window.RunnerBearTredict?.recoverySignal?.()||null}catch{}
    const has=!!(r?.hrv?.value||r?.sleep?.value||r?.rhr?.value);if(!has)return{tone:'neutral',title:'Helsebildet bygges',copy:'RunnerBear har aktivitetsdata, men ikke nok ferske recovery-signaler til å gi grønt lys.',r};
    if(r.level==='red')return{tone:'red',title:'Kroppen ber om lavere belastning',copy:'Flere recovery-signaler avviker fra normalen. Dette brukes som brems, ikke som diagnose.',r};
    if(r.level==='yellow')return{tone:'yellow',title:'Litt svakere restitusjon',copy:'Ett signal avviker. Planen står med ekstra margin og uten bonusarbeid.',r};
    return{tone:'green',title:'Kroppen støtter planen',copy:'Søvn, HRV og hvilepuls er uten vesentlige avvik fra din normal.',r};
  }
  function formatSleep(sec){sec=Number(sec)||0;return sec?`${Math.floor(sec/3600)} t ${Math.round((sec%3600)/60)} min`:'–'}
  function trend30(){
    const now=dateFrom(today()),cut=new Date(now),prev=new Date(now);cut.setDate(cut.getDate()-29);prev.setDate(prev.getDate()-59);
    const rows=activities(),current=rows.filter(a=>dateFrom(a.ds)>=cut&&dateFrom(a.ds)<=now),before=rows.filter(a=>dateFrom(a.ds)>=prev&&dateFrom(a.ds)<cut),stats=xs=>{const runs=xs.filter(a=>sportKind(a)==='run'),cross=xs.filter(a=>['row','bike'].includes(sportKind(a)));return{km:runs.reduce((s,a)=>s+a.distance/1000,0),runs:runs.length,crossMin:cross.reduce((s,a)=>s+a.duration/60,0)}};
    const a=stats(current),b=stats(before),weekly=a.km*7/30,delta=b.km?Math.round((a.km/b.km-1)*100):0,threshold=engine()?.thresholdTrend?.()||{};
    const title=a.runs<4?'Bygger 30-dagerstrend':Math.abs(delta)<=8?'Stabil og kontrollert':delta>8?'Belastningen øker':'Roligere treningsperiode';
    const copy=`${weekly.toFixed(1).replace('.',',')} km/uke · ${a.runs} løpeøkter${a.crossMin?` · ${Math.round(a.crossMin)} min alternativt`:''}${b.km?` · ${delta>0?'+':''}${delta} % mot forrige 30 dager`:''}.`;
    return{title,copy,weekly,delta,threshold:threshold.text||'Terskeltrend bygges',tone:delta>18?'yellow':'green'};
  }
  function readinessState(ds=today()){
    const all=read(K.readiness,{}),saved=all?.[ds];
    if(saved&&typeof saved==='object')return{state:['fresh','tired','heavy'].includes(saved.state)?saved.state:'unknown',reasons:Array.isArray(saved.reasons)?saved.reasons:[],choice:['pending','accepted','keep'].includes(saved.choice)?saved.choice:'pending',updatedAt:saved.updatedAt||''};
    const legacy=localStorage.getItem(`runfest26_weekcheck_${weekForToday()}`)||'';
    return{state:legacy==='fresh'?'fresh':legacy==='tired'?'tired':legacy==='heavy'?'heavy':'unknown',reasons:[],choice:'pending',updatedAt:''};
  }
  function saveReadinessState(patch,ds=today()){
    const all=read(K.readiness,{}),current=readinessState(ds);all[ds]={...current,...patch,updatedAt:new Date().toISOString()};write(K.readiness,all);return all[ds];
  }
  function latestTrainingResponse(){
    const rows=effectiveSchedule().filter(p=>p.ds<=today()).map(p=>({p,fb:feedbackFor(p)})).filter(x=>Number(x.fb?.rpe)>0||x.fb?.achilles).sort((a,b)=>a.p.ds.localeCompare(b.p.ds)),last=rows.at(-1);
    return{latestRpe:Number(last?.fb?.rpe||0),achilles:last?.fb?.achilles==='worse'};
  }
  function rawPlanFor(p){return rawSchedule().find(x=>x.ds===p?.baseDs)||p||{type:'easy',title:'Planlagt økt',km:0}}
  function readinessDecision(base=planFor(today())){
    const h=healthSignal(),r=h.r||{},trend=trend30(),reported=readinessState(),response=latestTrainingResponse(),plan=rawPlanFor(base),flags=Array.isArray(r.flags)?r.flags:[];
    const input={
      subjective:{state:reported.state,reasons:reported.reasons},
      recovery:{available:!!(r.hrv?.value||r.sleep?.value||r.rhr?.value),level:r.level||'unknown',flags,sleepLow:flags.includes('sleep'),hrvLow:flags.includes('hrv'),restingHrHigh:flags.includes('rhr')},
      training:{recentLoad:trend.tone==='yellow'?'high':'normal',latestRpe:response.latestRpe,nextWorkoutType:plan?.type||'easy',rawLevel:decision().level},
      injury:{achilles:response.achilles||reported.reasons.includes('achilles')}
    };
    const result=clarityModel()?.dailyReadiness?.(input,plan);
    if(result)return{...result,reported};
    const fallback=window.RunnerBearV1020?.coachDecision?.({rawLevel:decision().level,healthTone:h.tone,hasRecoverySignals:input.recovery.available,message:decision().message})||{key:'plan_stands',headline:'Planen står',message:decision().message,readiness:{score:8,label:'Klar',copy:'Det er trygt å følge dagens plan.'}};
    return{...fallback,severity:decision().level==='red'?'red':decision().level==='yellow'?'yellow':'green',reported,planned:plan,proposed:{...plan,changed:false},requiresChoice:false};
  }
  function todaySignalsHtml(){
    const h=healthSignal(),r=h.r||{},t=trend30();
    return `<details class="rb107-card rb108-signal rb113-coach-data ${h.tone}"><summary><span class="rb108-signal-dot"></span><div><small>Kroppen i dag</small><b>${esc(h.title)}</b><p>${esc(h.copy)}</p></div><strong>Vis data</strong></summary><div class="rb108-signal-body"><div><span>HRV</span><b>${r.hrv?.value?`${Math.round(r.hrv.value)} ms`:'Mangler'}</b><small>${r.hrv?.baseline?`normal ${Math.round(r.hrv.baseline)} ms`:'ingen sikker normal'}</small></div><div><span>Søvn</span><b>${formatSleep(r.sleep?.value)}</b><small>${r.sleep?.baseline?`normal ${formatSleep(r.sleep.baseline)}`:'ingen sikker normal'}</small></div><div><span>Hvilepuls</span><b>${r.rhr?.value?`${Math.round(r.rhr.value)} bpm`:'Mangler'}</b><small>${r.rhr?.baseline?`normal ${Math.round(r.rhr.baseline)} bpm`:'ingen sikker normal'}</small></div><section class="rb113-trend-note"><span>30 dager</span><b>${esc(t.title)}</b><p>${esc(t.copy)} ${esc(t.threshold)}</p><small>Dette er coachgrunnlag. Detaljert historikk blir værende i Garmin.</small></section></div></details>`;
  }
  function recoveryScore(r){
    const ratios=[];
    if(r?.hrv?.value&&r?.hrv?.baseline)ratios.push(clamp(r.hrv.value/r.hrv.baseline,0,1.08));
    if(r?.sleep?.value&&r?.sleep?.baseline)ratios.push(clamp(r.sleep.value/r.sleep.baseline,0,1.08));
    if(r?.rhr?.value&&r?.rhr?.baseline)ratios.push(clamp(1-(r.rhr.value-r.rhr.baseline)/20,.55,1.05));
    return ratios.length?clamp(Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length*100),45,100):0;
  }
  function coachWatchHtml(){
    const h=healthSignal(),r=h.r||{},t=trend30(),rec=recoveryScore(r),reported=readinessState(),bodyLabel=reported.state==='fresh'?'Frisk':reported.state==='tired'?'Litt sliten':reported.state==='heavy'?'Tung / svært trøtt':'Ikke meldt',tone=h.tone==='red'?'obs':h.tone==='yellow'?'watch':'good';
    const rows=[
      {icon:'moon',label:'Søvn',value:r.sleep?.value?formatSleep(r.sleep.value).replace(' t ',':').replace(' min',''):'–',status:r.sleep?.value?(r.sleep.baseline&&r.sleep.value<r.sleep.baseline*.85?'lavere':'god'):'venter'},
      {icon:'heart',label:'HRV',value:r.hrv?.value?Math.round(r.hrv.value):'–',status:r.hrv?.value?(r.hrv.baseline&&r.hrv.value<r.hrv.baseline*.85?'lavere':'stabil'):'venter'},
      {icon:'leaf',label:'Restitusjon',value:rec?`${rec}%`:'–',status:rec?(rec>=85?'god':rec>=70?'følg med':'lav'):'bygges'},
      {icon:'heartbeat',label:'Belastning',value:t.weekly?`${Math.round(t.weekly)} km`:'–',status:t.tone==='yellow'?'økende':'kontroll'},
    ].sort((a,b)=>(a.value==='–')-(b.value==='–')).slice(0,4);
    return `<article class="rb119b-card rb119c-coach-watch rb1020-coach-watch"><header><div><h2>Coachen følger med</h2><p>Signalene under støtter vurderingen – de er ikke en egen beslutning.</p></div></header><div class="rb119c-health-grid">${rows.map(x=>`<div><span>${icon(x.icon)}</span><small>${esc(x.label)}</small><b>${esc(x.value)}</b><em class="${tone}"><i></i>${esc(x.status)}</em></div>`).join('')}</div><footer><span>Kroppssjekk</span><b>${esc(bodyLabel)}</b><small>${esc(t.title)}</small></footer></article>`;
  }
  function decision(){return engine()?.decision?.()||{level:'green',headline:'Planen står',message:'Belastningen er innenfor rammene.'}}
  function coachBasis(){
    const h=healthSignal(),r=h.r||{},trend=trend30(),positives=[],watch=[],sources=new Set(),hasRecoverySignals=!!(r.hrv?.value||r.sleep?.value||r.rhr?.value),status=readinessDecision();
    if(hasRecoverySignals)sources.add('Garmin');
    else watch.push('Recovery-signaler er foreløpig for få til å gi fullt grønt lys.');
    if(r.hrv?.value&&r.hrv?.baseline){(r.hrv.value>=r.hrv.baseline*.85?positives:watch).push(r.hrv.value>=r.hrv.baseline*.85?'HRV er innenfor normalområdet ditt.':'HRV ligger lavere enn normalområdet ditt.')}
    if(r.sleep?.value&&r.sleep?.baseline){(r.sleep.value>=r.sleep.baseline*.85?positives:watch).push(r.sleep.value>=r.sleep.baseline*.85?'Søvnen er tilstrekkelig.':'Søvnen ligger lavere enn normalen din.')}
    if(r.rhr?.value&&r.rhr?.baseline){(r.rhr.value<=r.rhr.baseline+3?positives:watch).push(r.rhr.value<=r.rhr.baseline+3?'Hvilepulsen er nær normalen din.':'Hvilepulsen ligger litt høyere enn normalt.')}
    if(trend.tone==='yellow')watch.push('Belastningen har økt. Unngå bonusarbeid i dag.');else positives.push('Treningsbelastningen er kontrollert.');
    const recentQuality=effectiveSchedule().filter(p=>p.type==='quality'&&isDone(p)&&p.ds<=today()).sort((a,b)=>a.ds.localeCompare(b.ds)).at(-1);
    if(recentQuality){
      const assessment=sessionAssessment(recentQuality,activityFor(recentQuality));sources.add('nylige kvalitetsøkter');
      if(assessment.highCost)watch.push('Siste kvalitetsøkt kostet mer enn ønsket.');else positives.push('Siste kvalitetsøkt ble absorbert uten et tydelig kostnadssignal.');
    }
    if(activities().some(a=>a.ds>=addDays(today(),-7))){sources.add('siste 7 dager');sources.add('Garmin')}
    if(status.reported?.state!=='unknown')sources.add('Form i dag');
    if(status.signals?.poorSleep)watch.push('Dårlig søvn inngår som et reelt coachsignal.');
    if(status.signals?.achilles)watch.push('Akilles- eller hælfestesignal overstyrer friskhetsfølelse.');
    if(status.signals?.illness)watch.push('Sykdomsfølelse utelukker kvalitetsbelastning.');
    if(!watch.length&&hasRecoverySignals)watch.push('Ingen tydelige varselsignaler i dagens grunnlag.');
    return{...status,positives:[...new Set(positives)].slice(0,4),watch:[...new Set(watch)].slice(0,3),sources:[...sources]};
  }
  function predictionFoundation(distance,pred,evidence=thresholdEvidence().length){
    const long=Number(pred?.long||0),anchor=Number(pred?.anchor||policy().anchorKm||50),history=engine()?.thresholdHistory?.()?.length||0;
    let level='Begrenset',code='limited',copy='RunnerBear trenger flere relevante økter før området kan bli smalere.';
    if(distance==='marathon'){
      if(evidence>=3&&long>=24&&anchor>=55){level='Solid';code='solid';copy=`${evidence} relevante kvalitetsøkter, ${Math.round(long)} km langtur og ${roundHalf(anchor)} km løpsbase.`}
      else if(evidence>=2&&long>=18){level='Tilstrekkelig';code='adequate';copy=`Terskelgrunnlaget er godt, men maratonestimatet mangler lengre langturer og høyere spesifikt volum.`}
      else copy='Maratonestimatet har foreløpig lite spesifikt langturgrunnlag.';
    }else if(evidence>=4&&history>=2&&(distance!=='half'||long>=14)){level='Solid';code='solid';copy=`${evidence} relevante kvalitetsøkter${long?` og lengste tur ${Math.round(long)} km`:''} gir god dekning.`}
    else if(evidence>=1||history>=2){level='Tilstrekkelig';code='adequate';copy=`${Math.max(evidence,history)} relevante datapunkter støtter estimatet; flere like økter vil snevre inn området.`}
    return{level,code,copy,evidence,long,anchor};
  }
  function formDirection(){const t=engine()?.thresholdTrend?.()||{delta:0};return t.delta>1?'Svakt stigende':t.delta<-1?'Midlertidig avventende':'Stabil'}
  function goalProgress(f,goal){
    if(!goal?.targetSeconds)return{code:'neutral',label:'Bygger kapasitet',copy:'Målet har ingen fast tid. RunnerBear styrer etter kontrollert utvikling.'};
    if(f.foundation.code==='limited')return{code:'neutral',label:'For lite grunnlag',copy:'RunnerBear viser estimatet, men venter på flere relevante økter før retningen vurderes.'};
    const gap=f.current-goal.targetSeconds,weeks=Math.max(0,goalDays(goal)/7),reachable=Math.max(45,weeks*14+30);
    if(gap<=30)return{code:'green',label:'På rett kurs',copy:gap<=0?'Dagens kapasitet støtter allerede måltiden. Fortsett kontrollert.':'Dagens kapasitet ligger tett på målet, og utviklingen støtter retningen.'};
    if(gap<=reachable)return{code:'green',label:'Innen rekkevidde',copy:`Det gjenstår omtrent ${Math.max(1,Math.round(gap/5)*5)} sekunder, et realistisk løft med ${Math.max(1,Math.round(weeks))} uker igjen.`};
    return{code:'amber',label:'Krever tydelig framgang',copy:'Dagens kapasitetsbilde støtter ikke måltiden ennå. Planen prioriterer utvikling uten å jage farten.'};
  }
  function forecast(){
    const pred=engine()?.predictions?.()||{},goal=activeGoal(),distance=goal?.distance||'half',current=Number(pred?.[distance]?.seconds||pred?.half?.seconds||5100),foundation=predictionFoundation(distance,pred),baseSpread={five:22,ten:35,half:50,marathon:150}[distance]||50,multiplier=foundation.code==='solid'?1:foundation.code==='adequate'?1.45:2.1,spread=Math.round(baseSpread*multiplier),weeks=goal?.date?Math.max(0,dayDiff(goal.date,today())/7):0;
    const out={...pred,goal,distance,current,low:current-spread,high:current+spread,weeks,foundation,form:formDirection()};out.progress=goalProgress(out,goal);return out;
  }
  function thresholdEvidence(){
    return effectiveSchedule().filter(p=>p.type==='quality'&&p.baseDs<=today()).map(p=>{const f=feedbackFor(p),a=activityFor(p),assessment=a?sessionAssessment(p,a):null,work=assessment?.confidence?.code!=='limited'?a?.detail?.analysis:null,ps=Number(work?.workPace)||paceSec(f.pace),hr=Number(work?.workHr)||Number(f.hr||0),family=analysisEngine()?.workoutFamily?.(prescription(p))||p.title;return ps&&hr?{date:p.baseDs,label:p.title,pace:Math.round(ps),hr:Math.round(hr),rpe:Number(f.rpe||0),source:work?.workBlocks?.length?'Garmin arbeidsdel':'manuell',family}:null}).filter(Boolean).slice(-12);
  }
  function comparableThresholdEvidence(rows=thresholdEvidence()){
    const groups=new Map();rows.forEach(x=>groups.set(x.family,[...(groups.get(x.family)||[]),x]));return[...groups.values()].sort((a,b)=>b.length-a.length||String(b.at(-1)?.date||'').localeCompare(String(a.at(-1)?.date||'')))[0]||[];
  }
  function thresholdCopy(){
    const rows=comparableThresholdEvidence(),history=engine()?.thresholdHistory?.()||[];if(rows.length<2&&history.length>=2){const first=history[0],last=history.at(-1),delta=paceSec(first.pace)-paceSec(last.pace),change=delta>0?`${delta} sek/km raskere terskelfart`:delta<0?`${Math.abs(delta)} sek/km roligere terskelfart`:'en stabil terskel';return`Garmin-kapasiteten viser ${change} over registrert historikk. Økt-for-økt-trenden blir strengere når arbeidsdelen kan skilles sikkert fra oppvarming og nedjogg.`}if(rows.length<2)return'Bygger trend. Når samme økttype er gjennomført flere ganger, sammenlignes fart ved lik puls — ikke ulike kvalitetsøkter mot hverandre.';
    const first=rows[0],last=rows.at(-1),delta=first.pace-last.pace,hr=Math.abs(first.hr-last.hr);if(hr<=3&&delta>0)return`Samme puls · ${delta} sek/km raskere fra ${formatDate(first.date,{day:'numeric',month:'short'})} til ${formatDate(last.date,{day:'numeric',month:'short'})}.`;
    return`Siste ${rows.length} terskeløkter er koblet. RunnerBear prioriterer kontrollert arbeidsfart ved sammenlignbar puls.`;
  }
  function chartSvg(history){
    const rows=history.length?history:[{date:today(),pace:'4:02',hr:173}],paceValue=x=>typeof x.pace==='number'?x.pace:paceSec(x.pace),vals=rows.map(paceValue).filter(Boolean),min=Math.min(...vals)-2,max=Math.max(...vals)+2,w=560,h=120,p=14;
    const pts=rows.map((x,i)=>{const v=paceValue(x),px=rows.length===1?w/2:p+i*(w-p*2)/(rows.length-1),py=p+(v-min)/(max-min||1)*(h-p*2);return[px,py]}),path=pts.map(x=>x.join(',')).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Utvikling i terskelfart"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#e0e7e2"/><polyline points="${path}" fill="none" stroke="#4d7a5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(x=>`<circle cx="${x[0]}" cy="${x[1]}" r="4" fill="#fff" stroke="#4d7a5b" stroke-width="3"/>`).join('')}</svg>`;
  }

  function resultCardHtml(p,context='today'){
    const a=activityFor(p);if(!a)return'';const metrics=resultMetrics(a,p),x=analysisFor(p,a),v=verdictFor(p,a,x),match=matchFor(p);
    return `<article class="rb107-card rb109-result-card ${x.tone} ${context==='plan'?'compact':''}">
      <div class="rb113-result-hero"><header class="rb109-result-head"><div class="rb109-result-mark">${icon('check')}</div><div><span class="rb107-overline">Dagens resultat</span><h2>${esc(v.title)}</h2><p>${esc(p.title)} · ${esc(match?.status?.label||'Matchet med dagens økt')}</p></div><strong class="rb109-result-badge ${x.tone}">${esc(v.badge)}</strong></header>
      <div class="rb109-result-metrics">${metrics.slice(0,4).map(m=>`<div><span>${esc(m[0])}</span><b>${esc(m[1])}</b></div>`).join('')}</div>
      <section class="rb109-coach-verdict"><span>Coachens vurdering</span><p>${esc(x.review)}</p><small class="rb1012-confidence">Analysegrunnlag · ${esc(x.confidence.label)}</small><div><b>${esc(x.consequence.split('.')[0]||'Planen står')}</b><small>${esc(x.consequence)}</small></div></section></div>
      ${context==='plan'?`<button class="rb107-button secondary rb109-open-analysis" data-rb109-open-completed="${esc(a.id)}">Vis full coachanalyse</button>`:`<div class="rb109-result-details"><details><summary>Vis full coachanalyse <span>${icon('chevronRight')}</span></summary>${analysisDetailsHtml(p,a)}${x.blocks.length?`<div class="rb109-block-list">${x.blocks.slice(0,20).map(b=>`<span><b>${b.index}</b>${fmtTime(b.duration)} · ${fmtPace(b.pace)}/km${b.hr?` · ${Math.round(b.hr)} bpm`:''}</span>`).join('')}</div>`:''}</details><details><summary>Vis opprinnelig plan <span>${icon('chevronRight')}</span></summary>${plannedDetailsHtml(p)}</details></div>`}
    </article>`;
  }
  function replacementCardHtml(p,context='today'){
    const replacement=replacementFor(p),a=replacement?.activity;if(!a)return'';const metrics=resultMetrics(a,p),coach=replacement.classification?.coach||planIntegrity()?.replacementCoach?.(prescription(p),a,sessionAssessment(p,a),Number(policy().profile.maxHr||188))||{headline:'Den planlagte økten er erstattet',message:'Faktisk aktivitet er registrert.',consequence:'Planen videre står. Ingen treningsgjeld.'};
    return `<article class="rb107-card rb1023-replacement ${context==='plan'?'compact':''}"><header><div><span class="rb107-overline">Faktisk aktivitet · planintegritet</span><h2>${esc(coach.headline)}</h2></div><strong class="rb1023-replacement-badge">Erstattet</strong></header><div class="rb1023-original"><small>Opprinnelig plan</small><del>${esc(prescription(p).title)}</del></div><div class="rb1023-actual"><span><small>Erstattet av</small><b>${esc(a.title||sportLabel(a,p))}</b></span><strong>${esc(metrics.map(row=>row[1]).slice(0,2).join(' · '))}</strong></div><p>${esc(coach.message)}</p><footer>${esc(coach.consequence)}</footer>${context==='plan'?`<button class="rb107-button secondary rb109-open-analysis" data-rb109-open-completed="${esc(a.id)}">Se faktisk aktivitet</button>`:`<details><summary>Vis opprinnelig plan <span>${icon('chevronRight')}</span></summary>${plannedDetailsHtml(p)}</details>`}</article>`;
  }
  function terminalStatusCardHtml(p){
    const status=sessionState(p);if(!['cancelled','expired'].includes(status.code))return'';return `<article class="rb107-card rb1023-terminal"><span class="rb107-overline">${esc(status.label)}</span><h2>${esc(prescription(p).title)}</h2><p>${status.code==='cancelled'?'Økten er tatt ut av planen og skal ikke tas igjen.':'Ingen relevant aktivitet ble registrert. Planen går videre uten treningsgjeld.'}</p></article>`;
  }
  function flexHtml(p){
    if(!canOneOff(p)&&!flexible(p))return'';const completed=matchFor(p);if(completed){const kind=sportKind(completed.activity,p),label=kind==='row'?'Concept2':kind==='bike'?'Zwift':'rolig jogg';return`<div class="rb108-flex-complete"><span>${icon('check')}</span><div><b>Dagens aerobe økt er gjennomført via ${label}</b><small>De andre alternativene er lukket. Ingen treningsgjeld.</small></div><button data-rb108-unmatch="${esc(p.baseDs)}">Endre kobling</button></div>`}const selected=oneOffChoiceFor(p),items=[['run','run','Løp'],['row','row','Concept2'],['bike','bike','Zwift'],['rest','moon','Hvile']];
    return `<div class="rb107-flex-panel rb118-one-off"><span>Kun denne dagen</span><small>Velg løp, alternativ trening eller hvile. Neste dag følger planen igjen.</small><div class="rb107-flex-grid">${items.map(x=>`<button class="rb107-choice ${selected===x[0]?'active':''}" data-rb107-choice="${x[0]}" data-base-ds="${p.baseDs}">${icon(x[1])}<span>${x[2]}</span></button>`).join('')}</div>${matchPickerHtml(p)}</div>`;
  }
  function plannedWorkoutHtml(base,d,suggest){
    const p=prescription(base),target=targetFor(base);
    return `<article class="rb107-card rb107-workout"><div class="rb107-workout-top"><div><span class="rb107-overline rb117-state">Dagens plan · før økten</span><span class="rb107-type ${p.type}">${typeLabel(p.type)}</span><h2>${esc(p.title)}</h2><p class="rb107-workout-lead">${esc(p.desc||'')}</p></div></div>
      <div class="rb107-metrics"><div class="rb107-metric"><span>${esc(target.label)}</span><b>${esc(target.main)}</b></div><div class="rb107-metric"><span>Styring</span><b>${esc(target.pace)}</b></div><div class="rb107-metric"><span>Puls</span><b>${esc(target.hr)}</b></div></div>
      <div class="rb107-workout-body"><div class="rb107-purpose"><span>Hensikt</span><p>${esc(purposeFor(p))}</p></div>${flexHtml(base)}${!canOneOff(base)&&!flexible(base)?matchPickerHtml(base):''}
        <div class="rb107-workout-actions"><button class="rb107-button secondary" data-rb107-toggle-details>Vis øktstruktur</button><button class="rb107-button ghost" data-rb107-toggle-adapt>Tilpass dagen</button></div>
        ${state.adaptOpen?`<div class="rb107-flex-panel"><span>Hva har endret seg?</span><div class="rb107-flex-grid"><button class="rb107-choice" data-rb107-adapt="tired" data-base-ds="${base.baseDs}"><span>Litt sliten</span></button><button class="rb107-choice" data-rb107-adapt="time" data-base-ds="${base.baseDs}"><span>Dårlig tid</span></button><button class="rb107-choice" data-rb107-adapt="achilles" data-base-ds="${base.baseDs}"><span>Akilles / hælfeste</span></button></div></div>`:''}
        <details class="rb107-details" id="rb107TodayDetails"><summary>Planlagt økt og gjennomføring</summary><div class="rb107-detail-copy">${workoutStructureHtml(base)}<div class="rb107-detail-row"><b>Gjennomføring</b><span>${esc(p.detail||p.desc||'Følg kontrollert belastning.')}</span></div>${p.shoe?`<div class="rb107-detail-row"><b>Sko</b><span>${esc(p.shoe)}</span></div>`:''}${p.fuel?`<div class="rb107-detail-row"><b>Energi</b><span>${esc(p.fuel)}</span></div>`:''}<div class="rb107-detail-row"><b>Hvorfor nå</b><span>${esc(suggest?'RunnerBear anbefaler en tryggere dag.':d.message)} Konservativ tolkning vinner når puls, pust og følelse spriker.</span></div></div></details>
      </div></article>`;
  }
  function pendingResultHtml(base){
    const candidates=manualCandidates(base);if(!candidates.length)return'';
    return `<article class="rb107-card rb109-pending"><div class="rb109-pending-mark">${icon('sync')}</div><div><span class="rb107-overline">Aktivitet registrert · analyse pågår</span><h2>Økten er hentet fra Garmin</h2><p>RunnerBear trenger bare å bekrefte koblingen før resultatet overtar denne siden.</p>${matchPickerHtml(base)}<details><summary>Vis opprinnelig plan <span>${icon('chevronRight')}</span></summary>${plannedDetailsHtml(base)}</details></div></article>`;
  }
  function greeting(){const hour=new Date().getHours();return hour<10?'God morgen, Torbjørn':hour<17?'God dag, Torbjørn':'God kveld, Torbjørn'}
  function raceMetaHtml(){
    const goal=activeGoal();return `<div class="rb119b-day-meta"><div class="rb119b-race-pill">${icon('flag')}<span><small>${esc(goal?.name||'Formbygging')}</small><b>${goal?`${goalDays(goal)} dager igjen`:'Uten løpsdato'}</b></span></div><time datetime="${today()}"><span>${esc(formatDate(today(),{weekday:'long'}))}</span><b>${esc(formatDate(today(),{day:'numeric',month:'short'}).replace('.',''))}</b></time></div>`;
  }
  function workoutHeroHtml(base){
    const p=prescription(base),target=targetFor(base),structure=workoutStructure(base),focus=p.type==='quality'?'Terskel':p.type==='race'?'Løp':/langtur/i.test(p.title||'')?'Utholdenhet':p.type==='easy'?'Rolig':typeLabel(p.type),main=target.main||p.desc||p.title,recovery=structure?.recovery||p.detail||'',total=structure?.estimate||target.total||'Fleksibel total',distance=Number(p.km||0)?`${String(roundHalf(p.km)).replace('.',',')} km`:'Fleksibel',planStatus=sessionState(base),status=planStatus.code==='planned'?(p.type==='rest'?'Hviledag':'Se økt'):planStatus.label;
    return `<button type="button" class="rb119b-workout-hero rb1020-workout-hero" data-rb1020-workout-open="${esc(base.ds)}" aria-label="Åpne øktdetaljer for ${esc(p.title)}" ${heroStyle(heroNameForWorkout(base))}><span class="rb1020-hero-status">${esc(status)} ${icon('chevronRight')}</span><span class="rb119b-hero-icon">${icon(workoutIconName(base))}</span><div class="rb119b-workout-copy"><h2>${esc(p.title)}</h2><p>${esc(main)}</p>${recovery?`<small>${esc(recovery)}</small>`:''}</div><div class="rb119b-hero-metrics"><div>${icon('clock')}<span><small>Total tid</small><b>${esc(total)}</b></span></div><div>${icon('pin')}<span><small>Distanse</small><b>${esc(distance)}</b></span></div><div>${icon('goal')}<span><small>Fokus</small><b>${esc(focus)}</b></span></div></div></button>`;
  }
  function todayCoachHtml(base,d,suggest){
    const coach=coachBasis(),reported=coach.reported||readinessState(),stateLabel={fresh:'Frisk',tired:'Litt redusert',heavy:'Klart redusert',unknown:'Ikke meldt'}[reported.state]||'Ikke meldt',reasonLabels={poor_sleep:'dårlig søvn',fatigue:'generell tretthet',heavy_legs:'tunge bein',stress:'stress',illness:'sykdomsfølelse',achilles:'akilles / hælfeste'},reportedReasons=(reported.reasons||[]).map(x=>reasonLabels[x]).filter(Boolean),planned=coach.planned||rawPlanFor(base),proposed=coach.proposed||planned,choice=reported.choice||'pending';
    const recommendation=coach.requiresChoice?`<section class="rb1022-recommendation ${esc(coach.severity)}"><div class="rb1022-recommendation-grid"><span><small>Du meldte</small><b>${esc(stateLabel)}${reportedReasons.length?` · ${esc(reportedReasons.join(' · '))}`:''}</b></span><span><small>Coach anbefaler</small><b>${esc(coach.headline)}</b></span><span><small>Planlagt</small><b>${esc(planned.title||'Planlagt økt')}</b></span><span><small>Forslag</small><b>${esc(proposed.title||'Hvile')}</b></span></div><p><small>Begrunnelse</small>${esc(coach.message)}</p><div class="rb1022-recommendation-actions"><button type="button" class="primary" data-rb1022-accept ${choice==='accepted'?'disabled':''}>${choice==='accepted'?'Anbefalingen er brukt':'Bruk anbefalingen'}</button><button type="button" data-rb1022-keep ${choice==='keep'?'disabled':''}>${choice==='keep'?'Planlagt økt beholdes':'Behold planlagt økt'}</button></div>${choice==='keep'?'<small class="rb1022-caution">Du har valgt å beholde kvalitetsøkten. Hold første del konservativ og avslutt hvis kontrollen forsvinner.</small>':''}</section>`:'';
    return `<article class="rb119b-card rb119b-coach-card rb1022-coach-card"><header><h2>Coachens vurdering</h2><span class="rb119b-quote">“</span></header><div><span class="rb119b-coach-avatar" aria-hidden="true">RB</span><p><b>${esc(coach.headline)}</b>${esc(coach.message)}</p></div>${recommendation}<button type="button" data-rb107-open-why>Hvorfor? ${icon('chevronRight')}</button></article>`;
  }
  function readinessCardHtml(){
    const readiness=coachBasis().readiness,score=readiness.score,label=readiness.label,copy=readiness.copy;
    return `<article class="rb119b-card rb119b-readiness"><h2>Klarhet i dag</h2><div class="rb119b-readiness-main"><span class="rb119b-readiness-icon">${icon('leaf')}</span><div><b>${label}</b><small>${copy}</small></div><strong>${score}<span>/10</span></strong></div><div class="rb119b-progress" role="progressbar" aria-label="Klarhet i dag" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="10"><i style="width:${score*10}%"></i></div></article>`;
  }
  function todayActionsHtml(base,d,suggest){
    const reported=readinessState(),reasons=[['poor_sleep','Dårlig søvn'],['fatigue','Generell tretthet'],['heavy_legs','Tunge bein'],['stress','Stress'],['illness','Sykdomsfølelse'],['achilles','Akilles / hælfeste']];
    return `<section class="rb119b-card rb1022-form-today"><header><div><h2>Form i dag</h2><p>Oppdaterer coachbeslutningen umiddelbart.</p></div><span>${reported.state==='unknown'?'Ikke meldt':'Lagret'}</span></header><div class="rb1022-form-states rb1023-form-states"><button class="${reported.state==='fresh'?'active':''}" data-rb1022-form="fresh">${icon('leaf')}<span><b>Frisk</b><small>Ingen subjektive problemer</small></span></button><button class="${reported.state==='tired'?'active':''}" data-rb1022-form="tired">${icon('moon')}<span><b>Litt redusert</b><small>Planen står ofte med mindre volum</small></span></button><button class="${reported.state==='heavy'?'active':''}" data-rb1022-form="heavy">${icon('heartbeat')}<span><b>Klart redusert</b><small>Lavkostalternativ, hvile eller økten utgår</small></span></button></div>${reported.state!=='fresh'&&reported.state!=='unknown'?`<div class="rb1022-form-reasons"><small>Hva påvirker formen?</small><div>${reasons.map(([key,label])=>`<button class="${reported.reasons.includes(key)?'active':''}" data-rb1022-reason="${key}">${esc(label)}</button>`).join('')}</div></div>`:''}<footer><button data-rb107-adapt="time" data-base-ds="${base.baseDs}">${icon('clock')} Bare dårlig tid i dag</button></footer></section>`;
  }
  function keyAdvice(p){
    const x=prescription(p),text=String(x.title||'').toLowerCase();
    if(x.type==='quality')return/45\/15|intervall/.test(text)?'Åpne kontrollert. Målet er jevn kvalitet gjennom hele serien, ikke maksimal fart på de første dragene.':'Finn kontroll tidlig. Stopp progresjonen før pust, puls eller steg mister den repeterbare følelsen.';
    if(/langtur/.test(text))return'La første halvdel være tydelig rolig. Varigheten er stimulusen; farten skal ikke gjøre turen til skjult kvalitet.';
    if(x.type==='easy')return'Snakketempo hele veien. Denne økten skal gjøre neste kvalitetsdag bedre, ikke bevise form.';
    if(x.type==='rest')return'Restitusjon er planlagt trening i dag. Ingen økt skal tas igjen.';
    return'Hold belastningen lett og jevn. Alternativ trening skal støtte løpingen, ikke konkurrere med den.';
  }
  function workoutIntensityHtml(p){
    const x=prescription(p),target=targetFor(p);if(x.type==='rest')return'';
    const rows=[];
    if(target.hr&&target.hr!=='Lav kostnad')rows.push(['Puls',target.hr]);
    if(target.pace&&target.pace!=='Lett')rows.push(['Fart / styring',target.pace]);
    rows.push(['RPE',x.type==='quality'||x.type==='race'?'6–7 av 10 · kontrollert':x.type==='easy'?'2–3 av 10':'2–4 av 10']);
    return `<section class="rb1020-detail-section"><span>Intensitetsmål</span><div class="rb1020-target-grid">${rows.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join('')}</div></section>`;
  }
  function simpleStructureHtml(p){
    const x=prescription(p),s=workoutStructure(p);if(s)return workoutStructureHtml(p);
    if(x.type==='rest')return `<div class="rb1020-simple-structure"><div><b>Hvile</b><span>${esc(x.detail||'Planlagt restitusjon mellom belastningsdagene.')}</span></div></div>`;
    return `<div class="rb1020-simple-structure"><div><b>Gjennomføring</b><span>${esc(x.desc||x.title)}</span></div><div><b>Styring</b><span>${esc(x.detail||'Jevn, kontrollert belastning.')}</span></div></div>`;
  }
  function workoutDetailModalHtml(p){
    if(!p)return'';const x=prescription(p),planStatus=sessionState(p),a=activityFor(p)||replacementActivityFor(p),done=planStatus.terminal,status=planStatus.code==='planned'?(x.type==='rest'?'Hviledag':'Planlagt'):planStatus.label,metrics=a?resultMetrics(a,p):[];
    return `<div class="rb1020-modal" data-rb1020-modal-backdrop="workout"><section class="rb1020-sheet rb1020-workout-sheet" role="dialog" aria-modal="true" aria-labelledby="rb1020WorkoutTitle"><header><div><span>${esc(status)} · ${esc(formatDate(p.ds,{weekday:'long',day:'numeric',month:'long'}))}</span><h2 id="rb1020WorkoutTitle">${esc(x.title)}</h2><p>${esc(typeLabel(x.type))}</p></div><button type="button" data-rb1020-modal-close="workout" aria-label="Lukk øktdetaljer">${icon('close')}</button></header><div class="rb1020-sheet-body">${a?`<section class="rb1020-detail-section"><span>${planStatus.code==='replaced'?'Faktisk aktivitet · erstattet':'Gjennomført'}</span><div class="rb1020-result-grid">${metrics.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join('')}</div></section>`:''}<section class="rb1020-detail-section"><span>Øktstruktur</span>${simpleStructureHtml(p)}</section>${workoutIntensityHtml(p)}<section class="rb1020-coach-key"><span>Coachens nøkkelråd</span><p>${esc(planStatus.code==='replaced'?replacementFor(p)?.classification?.coach?.consequence||'Planen videre står. Ingen treningsgjeld.':keyAdvice(p))}</p></section>${x.shoe||x.fuel?`<section class="rb1020-detail-section rb1020-practical"><span>Praktisk</span>${x.shoe?`<p><b>Sko</b>${esc(x.shoe)}</p>`:''}${x.fuel?`<p><b>Energi</b>${esc(x.fuel)}</p>`:''}</section>`:''}${flexHtml(p)}${!canOneOff(p)&&!flexible(p)?matchPickerHtml(p):''}${!done?garminStatusHtml(p):''}</div></section></div>`;
  }
  function coachReasonModalHtml(){
    const coach=coachBasis(),positives=coach.positives.length?coach.positives:['Belastningsbildet gir ikke grunnlag for en offensiv endring.'],question=coach.requiresChoice?'Hvorfor anbefales en endring?':'Hvorfor står planen?';
    return `<div class="rb1020-modal" data-rb1020-modal-backdrop="coach"><section class="rb1020-sheet rb1020-reason-sheet" role="dialog" aria-modal="true" aria-labelledby="rb1020ReasonTitle"><header><div><span>${esc(question)}</span><h2 id="rb1020ReasonTitle">${esc(coach.headline)}</h2></div><button type="button" data-rb1020-modal-close="coach" aria-label="Lukk coachvurderingen">${icon('close')}</button></header><div class="rb1020-sheet-body"><p class="rb1020-reason-lead">${esc(coach.message)}</p><section><h3>Det som taler for økten</h3><ul>${positives.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h3>Det vi følger med på</h3><ul>${coach.watch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><footer><span>Datagrunnlag</span><b>${esc(coach.sources.length?coach.sources.join(' · '):'plan og tilgjengelig treningshistorikk')}</b></footer></div></section></div>`;
  }
  function todayHtml(){
    const base=planFor(today())||effectiveSchedule().find(p=>p.ds>=today())||effectiveSchedule().at(-1),d=decision(),sync=syncState(),planStatus=sessionState(base),terminal=planStatus.terminal,coach=coachBasis(),suggest=coach.requiresChoice&&coach.reported?.choice==='pending',pending=!terminal&&manualCandidates(base).length>0,result=planStatus.code==='completed'?resultCardHtml(base,'today'):planStatus.code==='replaced'?replacementCardHtml(base,'today'):terminalStatusCardHtml(base);
    return `<div id="rb107Today" class="rb107-surface rb119b rb119b-today"><div class="rb107-shell">${appBarHtml()}${raceMetaHtml()}${viewTitleHtml(terminal?'Dagens resultat':'Dagens økt',terminal?planStatus.label:'')}
      ${workoutHeroHtml(base)}${changeNoticeHtml(base)}${terminal?result:`${pending?pendingResultHtml(base):''}${todayCoachHtml(base,d,suggest)}${readinessCardHtml()}${coachWatchHtml()}${todayActionsHtml(base,d,suggest)}`}
      <div class="rb119b-sync ${sync.stale?'stale':''}"><i></i><span>Garmin ${esc(sync.label)}</span></div>
    </div>${qs('.view.active')?.id==='today'&&state.workoutDetailOpen?workoutDetailModalHtml(planFor(state.workoutDetailDs)||base):''}${qs('.view.active')?.id==='today'&&state.coachReasonOpen?coachReasonModalHtml():''}</div>`;
  }

  function weekStripHtml(week){
    const rows=weekRows(week),stats=weekStats(week),selected=selectedPlan();
    return `<section class="rb107-card rb107-week-strip"><div class="rb107-week-strip-head"><button data-rb113-week-step="-1" aria-label="Forrige uke">‹</button><div><span class="rb107-overline">Uke ${week}</span><b>${esc(rows[0]&&rows.at(-1)?`${formatDate(rows[0].ds,{day:'numeric',month:'short'})} – ${formatDate(rows.at(-1).ds,{day:'numeric',month:'short'})}`:'')}</b></div><button data-rb113-week-step="1" aria-label="Neste uke">›</button></div><div class="rb107-days">${rows.map(p=>{const s=sessionState(p);return`<button class="rb107-day-chip ${p.ds===today()?'today':''} ${p.ds===selected?.ds?'active':''} ${s.terminal?'done':''} ${s.code} ${planChange(p)?'adjusted':''}" data-rb107-day="${p.ds}" aria-label="${esc(`${formatDate(p.ds)} · ${s.label}${planChange(p)?' · planen er endret':''}`)}"><span>${formatDate(p.ds,{weekday:'short'}).replace('.','')}</span><b>${dateFrom(p.ds).getDate()}</b><i class="${p.type}"></i></button>`}).join('')}</div></section>`;
  }
  function compactResultLabel(p){const stateValue=sessionState(p);if(stateValue.code==='replaced')return`Erstattet · ${sportLabel(replacementActivityFor(p),p)}`;const a=activityFor(p);if(!a)return stateValue.label;return`Fullført · ${verdictFor(p,a).badge}`}
  function dayDetailHtml(p){
    const x=prescription(p),t=targetFor(p),status=sessionState(p),done=status.terminal,locked=isLocked(p);
    if(done)return `${status.code==='completed'?resultCardHtml(p,'plan'):status.code==='replaced'?replacementCardHtml(p,'plan'):terminalStatusCardHtml(p)}${changeNoticeHtml(p,'plan')}`;
    return `<article class="rb107-card rb107-day-detail"><div class="rb107-day-detail-head"><div><span class="rb107-type ${x.type}">${typeLabel(x.type)} · ${esc(formatDate(p.ds,{weekday:'long',day:'numeric',month:'long'}))}</span><h2>${esc(x.title)}</h2><p>${esc(x.desc||'')}</p></div>${locked?'<span class="rb107-complete">Låst</span>':''}</div>
      <div class="rb107-metrics"><div class="rb107-metric"><span>${esc(t.label)}</span><b>${esc(t.main)}</b></div><div class="rb107-metric"><span>Styring</span><b>${esc(t.pace)}</b></div><div class="rb107-metric"><span>Puls</span><b>${esc(t.hr)}</b></div></div>
      ${changeNoticeHtml(p,'plan')}<details class="rb113-plan-details"><summary>Åpne økten <span>${icon('chevronRight')}</span></summary><div><div class="rb107-note"><b>Hensikt:</b> ${esc(purposeFor(x))}<br>${esc(x.detail||'')}</div>${workoutStructureHtml(p)}${flexHtml(p)}${!canOneOff(p)&&!flexible(p)?matchPickerHtml(p):''}<div class="rb107-action-grid"><button class="rb107-action ${locked?'active':''}" data-rb107-lock="${p.baseDs}">${icon('lock')}${locked?'Låst':'Lås økten'}</button><button class="rb107-action" data-rb107-move-toggle="${p.baseDs}">${icon('move')}Flytt</button></div>${state.moveOpen?moveFallbackHtml(p):''}</div></details></article>`;
  }
  function weeksHtml(current){
    const weeks=[...new Set(effectiveSchedule().map(p=>p.week))];
    return `<div class="rb107-weeks">${weeks.map(n=>{const rows=weekRows(n),s=weekStats(n),open=(state.openWeek??current)===n;return`<section class="rb107-card rb107-week ${open?'open':''}"><button class="rb107-week-head" data-rb107-week="${n}"><div><span>${esc((window.RUNFEST_WEEKS||[]).find(w=>w.n===n)?.phase||`Uke ${n}`)}</span><b>Uke ${n} · ${esc(rows[0]&&rows.at(-1)?`${formatDate(rows[0].ds,{day:'numeric',month:'short'})}–${formatDate(rows.at(-1).ds,{day:'numeric',month:'short'})}`:'')}</b></div><strong>${s.km} km</strong></button><div class="rb107-week-body">${rows.map(p=>`<div class="rb107-week-row" data-rb107-day="${p.ds}"><span>${esc(formatDate(p.ds,{weekday:'short',day:'numeric',month:'short'}).replace('.',''))}</span><b>${esc(prescription(p).title)}</b><strong>${isDone(p)?esc(compactResultLabel(p)):p.type==='quality'?'Kvalitet':'›'}</strong></div>`).join('')}</div></section>`}).join('')}</div>`;
  }
  function completedRows(){
    const planned=effectiveSchedule().map(p=>({p,a:activityFor(p)||replacementActivityFor(p),match:matchFor(p),replacement:replacementFor(p),status:sessionState(p)})).filter(x=>x.a),used=new Set(planned.map(x=>String(x.a.id||''))),extras=activities().filter(a=>!used.has(String(a.id))).map(a=>({p:null,a,match:null,replacement:null,status:null}));
    return[...planned,...extras].sort((a,b)=>String(b.a.date||b.a.ds||'').localeCompare(String(a.a.date||a.a.ds||'')));
  }
  function completedDetailHtml(row){
    const {p,a,match,replacement,status}=row,m=resultMetrics(a,p),isReplacement=status?.code==='replaced',x=p&&!isReplacement?analysisFor(p,a):null,coach=replacement?.classification?.coach;
    return `<article class="rb107-card rb108-completed-detail"><button class="rb108-back" data-rb108-completed-back>${icon('arrowLeft')} Tilbake til Utført</button><header><div><span class="rb107-overline">${esc(formatDate(a.ds,{weekday:'long',day:'numeric',month:'long'}))} · Garmin</span><h2>${esc(isReplacement?a.title||sportLabel(a,p):p?.title||a.title||sportLabel(a,p))}</h2><p>${esc(isReplacement?'Erstattet planlagt økt':match?.status?.label||'Ekstra aktivitet')}</p></div><span class="rb108-verdict ${x?.tone||'neutral'}">${esc(isReplacement?'Erstattet':x?.headline||'Registrert')}</span></header><div class="rb107-actual-grid">${m.map(v=>`<div><span>${esc(v[0])}</span><b>${esc(v[1])}</b></div>`).join('')}</div>${isReplacement?`<div class="rb108-analysis-sections"><section><span>Opprinnelig plan</span><p><del>${esc(prescription(p).title)}</del></p></section><section><span>Coachens vurdering</span><p>${esc(coach?.message||'Aktiviteten erstattet den planlagte økten.')}</p></section><section class="yellow"><span>Konsekvens for planen</span><b>${esc(coach?.consequence||'Planen videre står. Ingen treningsgjeld.')}</b></section></div>`:p?analysisDetailsHtml(p,a):`<div class="rb108-analysis-sections"><section><span>Coachens vurdering</span><p>Aktiviteten er registrert som ekstra belastning og kobles ikke automatisk til en planlagt økt uten tilstrekkelig sikkerhet.</p></section><section><span>Konsekvens</span><b>Belastningen tas med videre. Ingen planlagt økt markeres gjennomført.</b></section></div>`}${a.detail?.analysis?.workBlocks?.length?`<details class="rb108-blocks"><summary>Teknisk blokkdiagnostikk · ${a.detail.analysis.workBlocks.length} registrert</summary><div>${a.detail.analysis.workBlocks.slice(0,20).map(b=>`<span><b>${b.index}</b>${fmtTime(b.duration)} · ${fmtPace(b.pace)}/km · ${b.hr?`${Math.round(b.hr)} bpm`:'puls mangler'}</span>`).join('')}</div></details>`:''}${p?`<button class="rb107-button ghost" data-rb108-unmatch="${esc(p.baseDs)}">Endre kobling</button>`:''}</article>`;
  }
  function completedHtml(){
    const rows=completedRows();if(!rows.length)return'<section class="rb107-card rb107-empty"><b>Ingen aktiviteter synkronisert ennå</b><p>Gjennomfør økten med Garmin. RunnerBear henter den automatisk.</p></section>';
    if(state.completedId){const row=rows.find(x=>x.a.id===state.completedId);if(row)return completedDetailHtml(row);state.completedId=''}
    return `<div class="rb107-completed-list">${rows.slice(0,60).map(({p,a,match,status})=>{const m=actualMetrics(a,p),replaced=status?.code==='replaced',title=replaced?a.title||sportLabel(a,p):p?.title||a.title||sportLabel(a,p),label=replaced?'Erstattet':match?.status?.label||'Ekstra registrert';return`<article class="rb107-card rb107-completed-row" data-rb108-completed="${esc(a.id)}"><div><span>${esc(formatDate(a.ds,{weekday:'short',day:'numeric',month:'short'}))} · ${esc(label)}</span><b>${esc(title)}</b><small>${esc(sportLabel(a,p))} · ${esc(m.map(x=>x[1]).slice(0,3).join(' · '))}</small></div><strong>Åpne analyse →</strong></article>`}).join('')}</div>`;
  }
  function fourWeeksHtml(current){
    const weeks=[...new Set(effectiveSchedule().map(p=>p.week))],start=Math.max(0,weeks.indexOf(current)),visible=weeks.slice(start,start+4);
    return `<div class="rb118-rolling-plan">${visible.map((n,index)=>{const rows=weekRows(n),s=weekStats(n),label=index===0?'Denne uken':index===1?'Neste uke':`Foreløpig · uke ${index+1}`,provisional=index>1;return`<section class="rb107-card rb118-plan-week ${provisional?'provisional':''}"><header><div><span>${esc(label)}</span><b>${esc(rows[0]&&rows.at(-1)?`${formatDate(rows[0].ds,{day:'numeric',month:'long'})} – ${formatDate(rows.at(-1).ds,{day:'numeric',month:'long'})}`:'')}</b></div><strong>${s.km} km</strong></header><div class="rb118-week-days">${rows.map(p=>{const x=prescription(p),planStatus=sessionState(p),changed=planChange(p),action=p.ds===today()&&!planStatus.terminal&&decision().level==='red',tone=planStatus.terminal?'approved':changed?'attention':action?'action':provisional?'uncertain':x.type==='quality'||x.type==='race'?'workout':'neutral',status=planStatus.code!=='planned'?planStatus.label:changed?'Endret':action?'Se i dag':provisional?'Foreløpig':x.type==='quality'||x.type==='race'?'Kvalitet':typeLabel(x.type);return`<button class="rb118-plan-row ${tone} ${planStatus.code} ${p.ds===state.selectedDs?'active':''}" data-rb107-day="${p.ds}"><time><b>${esc(formatDate(p.ds,{weekday:'short'}).replace('.',''))}</b><span>${dateFrom(p.ds).getDate()}</span></time><span><b>${esc(x.title)}</b><small>${esc(x.desc||'')}</small></span><i>${esc(status)}</i></button>`}).join('')}</div></section>`}).join('')}</div>`;
  }
  function canDragPlan(p){return!!p&&p.ds>=today()&&!isLocked(p)&&!isTerminal(p)}
  function tredictStatusFor(p){const service=tredictSync(),externalId=planIntegrity()?.stableExternalId?.(p)||`rb-workout-${p?.baseDs||''}`,item=service?.status?.(externalId)||{status:'not_synced'};return{...item,available:service?.available?.()===true,externalId}}
  function garminStatusHtml(p){
    const stateValue=tredictStatusFor(p),labels={synced:'Synkronisert via Tredict',pending:'Sender til Tredict…',syncing:'Sender til Tredict…',awaiting_activation:'Klar i Tredict – aktiver planen',review_required:'Kontroller Tredict-kalenderen',error:'Tredict-synk feilet',not_synced:stateValue.available?'Venter på Tredict-synk':'Tredict-transporten er ikke tilgjengelig'},label=labels[stateValue.status]||labels.not_synced;
    return `<div class="rb1023-garmin-status ${esc(stateValue.status)}"><i></i><span>${esc(label)}</span>${stateValue.status==='error'?`<button data-rb1023-garmin-retry="${esc(stateValue.externalId)}">Prøv igjen</button>`:''}</div>`;
  }
  function planRowHtml(p){
    const x=prescription(p),planStatus=sessionState(p),changed=planChange(p),isToday=p.ds===today(),draggable=canDragPlan(p),tone=isToday&&!planStatus.terminal?'key':planStatus.code==='completed'?'done':planStatus.code==='replaced'?'replaced':['cancelled','expired'].includes(planStatus.code)?'cancelled':planStatus.code==='moved'?'moved':changed?'changed':'',status=planStatus.code==='planned'?(isToday?'I dag':x.type==='quality'||x.type==='race'?'Nøkkel':'Planlagt'):planStatus.label,locked=isLocked(p)||planStatus.terminal;
    return `<button class="rb119b-plan-row ${tone} ${draggable?'rb1023-draggable':''} ${locked?'rb1023-locked':''}" data-rb107-day="${p.ds}" data-rb1023-drag-base="${esc(p.baseDs)}" ${draggable?'draggable="true"':''} aria-label="${esc(`${formatDate(p.ds)} · ${x.title} · ${status}${draggable?' · kan flyttes':''}`)}"><time><span>${esc(formatDate(p.ds,{weekday:'short'}).replace('.',''))}</span><b>${dateFrom(p.ds).getDate()}</b></time><span class="rb119b-plan-type">${icon(workoutIconName(p))}</span><span class="rb119b-plan-copy"><b>${esc(x.title)}</b><small>${esc(x.desc||targetFor(p).main||typeLabel(x.type))}</small></span><span class="rb119b-plan-status"><small>${esc(status)}</small>${planStatus.code==='completed'?icon('check'):locked?icon('lock'):`<i aria-hidden="true"></i>`}</span>${draggable?'<span class="rb1023-drag-handle" aria-hidden="true"></span>':''}</button>`;
  }
  function monthKeyFor(ds){const d=dateFrom(ds||today());return`${d.getFullYear()}-${z(d.getMonth()+1)}`}
  function monthDate(key){const [year,month]=String(key||monthKeyFor()).split('-').map(Number);return new Date(year,Math.max(0,(month||1)-1),1,12)}
  function monthCalendarHtml(){
    const cursor=monthDate(state.monthKey||monthKeyFor(state.selectedDs||today())),year=cursor.getFullYear(),month=cursor.getMonth(),first=new Date(year,month,1,12),start=new Date(first),offset=(first.getDay()+6)%7;start.setDate(start.getDate()-offset);const plans=new Map(effectiveSchedule().map(p=>[p.ds,p]));
    const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const ds=localIso(d),p=plans.get(ds),outside=d.getMonth()!==month,planStatus=p?sessionState(p):null,kind=p?(p.type==='quality'||p.type==='race'?'high':p.type==='rest'?'rest':'planned'):'',stateLabel=planStatus?.label?.toLowerCase()||'planlagt';return`<button class="${outside?'outside ':''}${ds===today()?'today ':''}${ds===state.selectedDs?'selected ':''}${kind} ${planStatus?.terminal?'done ':''}${planStatus?.code||''}" data-rb119c-calendar-day="${ds}" ${p?`aria-label="${esc(formatDate(ds))} · ${stateLabel}"`:`disabled aria-label="${esc(formatDate(ds))} · ingen økt i planen"`}><span>${d.getDate()}</span>${p?`<i aria-hidden="true"></i>`:''}</button>`}).join('');
    const label=new Intl.DateTimeFormat('nb-NO',{month:'long',year:'numeric'}).format(first);return `<section id="rb119cMonth" class="rb119b-card rb119c-month" tabindex="-1"><header><h2>${esc(label[0].toUpperCase()+label.slice(1))}</h2><div><button data-rb119c-month-step="-1" aria-label="Forrige måned">${icon('chevronLeft')}</button><button data-rb119c-month-step="1" aria-label="Neste måned">${icon('chevronRight')}</button></div></header><div class="rb119c-weekdays">${['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map(x=>`<span>${x}</span>`).join('')}</div><div class="rb119c-month-grid">${days}</div><footer><span><i class="planned"></i>Planlagt</span><span><i class="done"></i>Gjennomført</span><span><i class="high"></i>Kvalitetsøkt</span><span><i class="rest"></i>Hviledag</span></footer></section>`;
  }
  function focusHtml(week){
    const rows=weekRows(week),quality=rows.filter(p=>p.type==='quality'||p.type==='race'),long=rows.find(p=>/langtur/i.test(p.title||'')),easy=rows.filter(p=>prescription(p).type==='easy'),next=quality.find(p=>p.ds>=today())||quality[0];
    const cards=[
      {icon:'heartbeat',label:'Ukens kvalitet',title:next?.title||'Kontrollert terskel',copy:quality.length?`${quality.length} nøkkeløkt${quality.length===1?'':'er'} · hold igjen på bonusarbeid`:'Ingen ekstra kvalitet denne uken',ds:next?.ds},
      {icon:'mountain',label:'Utholdenhet',title:long?.title||'Langturen bygges gradvis',copy:long?`${formatDate(long.ds,{weekday:'long',day:'numeric',month:'short'})} · ${roundHalf(long.km)} km`:'Retningen beholdes uten å jage volum',ds:long?.ds},
      {icon:'leaf',label:'Balansen',title:`${easy.length} rolige støttedager`,copy:'Easy betyr easy. Restitusjon beskytter neste kvalitetsøkt.'}
    ];
    return `<section class="rb119c-focus"><header><span>Ukens retning</span><h2>Kontroll først. Fremgang gjennom repeterbarhet.</h2></header><div>${cards.map(x=>`<button ${x.ds?`data-rb107-day="${x.ds}"`:''}><span>${icon(x.icon)}</span><small>${esc(x.label)}</small><b>${esc(x.title)}</b><p>${esc(x.copy)}</p>${x.ds?icon('chevronRight'):''}</button>`).join('')}</div></section>`;
  }
  function longTermHtml(week){
    const weeks=[...new Set(effectiveSchedule().map(p=>p.week))],at=Math.max(0,weeks.indexOf(week)),goal=activeGoal(),visible=weeks.slice(at,at+4);return `<section class="rb119c-long"><header><span>Langsiktig retning</span><h2>${goal?`Mot ${esc(goal.name)}`:'Bygg en robust normaluke'}</h2><p>${goal?`${goalDays(goal)} dager igjen. Ukevis progresjon vises som retning, ikke som en ny detaljplan.`:'Kontinuitet, kontrollert terskel og skadefri mengde styrer.'}</p></header><div>${visible.map((n,index)=>{const rows=weekRows(n),s=weekStats(n),phase=(window.RUNFEST_WEEKS||[]).find(w=>w.n===n)?.phase||(!index?'Nå':'Bygg videre');return`<button data-rb119c-week-start="${rows[0]?.ds||''}"><span><small>${index===0?'Denne uken':index===1?'Neste steg':'Retning'}</small><b>Uke ${n} · ${esc(phase)}</b></span><span><strong>${s.km} km</strong><small>${s.quality} kvalitet · ${s.runDays} løpedager</small></span>${icon('chevronRight')}</button>`}).join('')}</div></section>`;
  }
  function planListHtml(week,lens){
    if(lens==='focus')return focusHtml(week);
    if(lens==='long')return longTermHtml(week);
    return `<div class="rb119b-plan-list">${weekRows(week).map(planRowHtml).join('')}</div>`;
  }
  function planOverviewHtml(week){
    const rows=weekRows(week),s=weekStats(week),prefs=trainingPreferences(),max=Math.max(1,...rows.map(p=>Number(kmFor(p)||0)*(p.type==='quality'?1.35:1))),score=clamp(Math.round(s.km/Math.max(1,prefs.normalHigh)*78+s.quality*7),0,100),weeks=[...new Set(effectiveSchedule().map(p=>p.week))],at=Math.max(0,weeks.indexOf(week)),progress=Math.round((at+1)/Math.max(1,weeks.length)*100),points=weeks.map((n,i)=>{const km=weekStats(n).km,x=8+i*(104/Math.max(1,weeks.length-1)),y=45-clamp(km/Math.max(1,prefs.maxKm),0,1)*35;return`${x},${y}`}).join(' ');
    return `<div class="rb119b-plan-overview"><article class="rb119b-card rb119b-load"><h2>Treningsbelastning</h2><small>Denne uken</small><div class="rb119b-load-head"><strong>${score}<span>/100</span></strong><em><i></i>${score>86?'Høy':score>62?'Moderat':'Rolig'}</em></div><div class="rb119b-bars">${rows.map(p=>`<span><i class="${p.ds===today()?'active':''}" style="height:${Math.max(14,Math.round(Number(kmFor(p)||0)/max*100))}%"></i><small>${esc(formatDate(p.ds,{weekday:'short'}).replace('.',''))}</small></span>`).join('')}</div></article><article class="rb119b-card rb119b-plan-progress"><h2>Fremdrift</h2><small>${esc(activeGoal()?.name||'Formbygging')}</small><strong>${progress}<span>%</span></strong><svg viewBox="0 0 120 50" role="img" aria-label="Planfremdrift"><polyline points="${points}"/></svg><p>${at+1} av ${weeks.length} uker</p></article></div>`;
  }
  function dayActivity(p){
    const matched=activityFor(p)||replacementActivityFor(p);if(matched)return matched;
    if(!p||!['rest','cross'].includes(prescription(p).type))return null;
    return activities().filter(a=>a.ds===p.ds).sort((a,b)=>Number(b.duration||0)-Number(a.duration||0))[0]||null;
  }
  function activityDeviates(p,a){
    if(!p||!a)return false;const x=prescription(p),kind=sportKind(a,p);
    if(x.type==='rest')return true;
    if(x.type==='cross')return!['row','bike'].includes(kind);
    if(['easy','quality','race'].includes(x.type)&&kind!=='run')return true;
    if(x.type==='quality'){
      const assessment=sessionAssessment(p,a),work=a.detail?.analysis||{},threshold=Number(policy().profile.thresholdHr||173),looksEasy=/rolig|easy|recovery/i.test(a.title||'')||(!work.workBlocks?.length&&Number(a.heartrate||0)>0&&Number(a.heartrate)<threshold*.84);
      return looksEasy&&assessment.confidence?.code==='limited';
    }
    return false;
  }
  function planDayState(p,a){
    return sessionState(p);
  }
  function moveFallbackHtml(p){
    if(!canDragPlan(p))return'';const rows=swapRows(),options=weekRows(p.week).filter(other=>other.baseDs!==p.baseDs).map(other=>({other,validation:planIntegrity()?.validateSwap?.({rows,sourceBaseDs:p.baseDs,targetBaseDs:other.baseDs,today:today()})})).filter(x=>x.validation?.ok);
    return `<div class="rb1023-move-fallback"><span>Bytt med en gyldig dag denne uken</span><div class="rb1023-move-options">${options.map(({other})=>`<button data-rb107-move-to="${esc(other.ds)}" data-base-ds="${esc(p.baseDs)}"><b>${esc(formatDate(other.ds,{weekday:'long',day:'numeric',month:'short'}))}</b><small>${esc(prescription(other).title)}</small></button>`).join('')||'<small>Ingen trygg flytting er tilgjengelig akkurat nå.</small>'}</div></div>`;
  }
  function dayViewHtml(p){
    if(!p)return'';const x=prescription(p),a=dayActivity(p),day=planDayState(p,a),metrics=a?resultMetrics(a,p):[],assessment=a&&activityFor(p)?sessionAssessment(p,a):null,plannedAmount=Number(x.km||0)?`${String(roundHalf(x.km)).replace('.',',')} km`:targetFor(p).total||'Fleksibel mengde';
    const planned=`<div class="rb1020-day-plan"><span>Planlagt</span><b>${esc(x.title)}</b><small>${esc(plannedAmount)} · ${esc(x.desc||typeLabel(x.type))}</small></div>`;
    const actual=a?`<div class="rb1020-day-actual"><span>${day.code==='replaced'?'Faktisk aktivitet':'Gjennomført'}</span><b>${esc(a.title||sportLabel(a,p))}</b><small>${esc(metrics.map(row=>row[1]).slice(0,3).join(' · '))}</small></div>`:'';
    let body='';
    if(day.code==='replaced'){const coach=replacementFor(p)?.classification?.coach;body=`<div class="rb1020-day-comparison">${planned}${actual}</div><p class="rb1020-day-coach">${esc(coach?.message||'Dagens aktivitet erstattet den planlagte økten. Den opprinnelige økten tas ikke igjen.')}</p><button class="rb1020-day-link" data-rb109-open-completed="${esc(a.id)}">Se faktisk aktivitet ${icon('chevronRight')}</button>`}
    else if(day.code==='completed')body=`${actual}<div class="rb1020-result-grid">${metrics.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join('')}</div><p class="rb1020-day-coach">${esc(assessment?.review||reviewFor(p,a))}</p><button class="rb1020-day-link" data-rb109-open-completed="${esc(a.id)}">Se gjennomføringen ${icon('chevronRight')}</button>`;
    else if(day.code==='expired'||day.code==='cancelled')body=`${planned}<p class="rb1020-day-coach">${day.code==='cancelled'?'Økten er tatt ut og skal ikke tas igjen.':'Ingen relevant aktivitet ble matchet med denne dagen. Planen går videre uten treningsgjeld.'}</p><button class="rb1020-day-link" data-rb1020-day-workout="${esc(p.ds)}">Se den opprinnelige økten ${icon('chevronRight')}</button>`;
    else if(day.code==='rest')body=`${planned}<p class="rb1020-day-coach">Planlagt restitusjon mellom belastningsdagene.</p><button class="rb1020-day-link" data-rb1020-day-workout="${esc(p.ds)}">Se hviledagen ${icon('chevronRight')}</button>`;
    else body=`${planned}<div class="rb1020-day-metrics"><div><span>Type</span><b>${esc(typeLabel(x.type))}</b></div><div><span>Mengde</span><b>${esc(plannedAmount)}</b></div></div><button class="rb1020-day-link" data-rb1020-day-workout="${esc(p.ds)}">Åpne øktdetaljer ${icon('chevronRight')}</button><div class="rb107-action-grid"><button class="rb107-action ${isLocked(p)?'active':''}" data-rb107-lock="${p.baseDs}">${icon('lock')}${isLocked(p)?'Låst':'Lås økten'}</button><button class="rb107-action" data-rb107-move-toggle="${p.baseDs}">${icon('move')}Flytt</button></div>${state.moveOpen?moveFallbackHtml(p):''}${garminStatusHtml(p)}`;
    return `<section class="rb119b-card rb1020-day-view ${esc(day.code)}"><header><div><span>${esc(formatDate(p.ds,{weekday:'long',day:'numeric',month:'long'}))}</span><h2>${esc(x.title)}</h2></div><strong>${esc(day.label)}</strong></header>${body}</section>`;
  }
  function planHtml(){
    const current=weekForToday();if(!state.selectedDs)state.selectedDs=planFor(today())?.ds||weekRows(current)[0]?.ds||'';const selected=selectedPlan(),week=state.openWeek||selected?.week||current,rows=weekRows(week),goal=activeGoal(),subtitle=goal?`${distanceMeta(goal.distance).label} · ${Math.max(0,Math.ceil(goalDays(goal)/7))} uker igjen`:'Formbygging · uten sluttdato',range=rows.length?`${formatDate(rows[0].ds,{day:'numeric',month:'short'}).replace('.','')}–${formatDate(rows.at(-1).ds,{day:'numeric',month:'short'}).replace('.','')}`:'';
    if(!state.monthKey)state.monthKey=monthKeyFor(selected?.ds||today());
    const normalPlan=`<div class="rb119b-segments" role="tablist" aria-label="Planvisning"><button class="${state.planLens==='week'?'active':''}" data-rb119b-plan-lens="week">Uke</button><button class="${state.planLens==='focus'?'active':''}" data-rb119b-plan-lens="focus">Fokus</button><button class="${state.planLens==='long'?'active':''}" data-rb119b-plan-lens="long">Langsiktig</button></div>${planListHtml(week,state.planLens)}${planOverviewHtml(week)}<button class="rb119b-completed-link" data-rb107-plan-view="done">Gjennomførte økter og coachanalyser ${icon('chevronRight')}</button>`;
    const dayPlan=`<button class="rb119b-back rb1020-back-plan" data-rb1020-day-close>${icon('arrowLeft')} Tilbake til planen</button>${dayViewHtml(selected)}`;
    return `<div id="rb107Plan" class="rb107-surface rb119b rb119b-plan"><div class="rb107-shell">${appBarHtml()}${viewTitleHtml(state.planView==='done'?'Gjennomførte økter':state.planDayViewOpen?'Valgt dag':'Din plan',state.planView==='done'?'Resultater og coachanalyser':state.planDayViewOpen?formatDate(selected.ds,{weekday:'long',day:'numeric',month:'long'}):subtitle)}
      ${state.planView==='done'?`<button class="rb119b-back" data-rb107-plan-view="plan">${icon('arrowLeft')} Tilbake til plan</button>${completedHtml()}`:`<div class="rb119b-week-controls"><div><button data-rb113-week-step="-1" aria-label="Forrige uke">${icon('chevronLeft')}</button><b>Uke ${week} · ${esc(range)}</b><button data-rb113-week-step="1" aria-label="Neste uke">${icon('chevronRight')}</button></div><button data-rb119c-month-focus>${icon('calendar')}<span>Månedsoversikt</span></button></div>${monthCalendarHtml()}${state.planDayViewOpen?dayPlan:normalPlan}`}
    </div>${qs('.view.active')?.id==='plan'&&state.workoutDetailOpen?workoutDetailModalHtml(planFor(state.workoutDetailDs)||selected):''}</div>`;
  }

  function secondaryGoalsHtml(rows){
    if(!rows.length)return'';
    return `<section class='rb107-card rb109-secondary'><div class='rb109-card-head'><div><span class='rb107-overline'>På vei mot hovedmålet</span><h2>B-løp og testløp</h2></div><button data-rb109-goal-editor='secondary'>Legg til</button></div><div class='rb109-secondary-list'>${rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>`<div><time>${esc(formatDate(x.date,{day:'numeric',month:'short'}))}</time><span><b>${esc(x.name)}</b><small>${esc(distanceMeta(x.distance).label)} · ${x.effort==='controlled'?'Kontrollert gjennomføring':'Full innsats'}</small></span><button aria-label='Fjern ${esc(x.name)}' data-rb109-remove-secondary='${esc(x.id)}'>${icon('close')}</button></div>`).join('')}</div></section>`;
  }
  function goalHistoryHtml(rows){
    if(!rows.length)return'';const labels={completed:'Gjennomført',cancelled:'Avlyst',replaced:'Erstattet',paused:'Avsluttet'};
    return `<details class='rb107-card rb109-history'><summary><span><small>Målhistorikk</small><b>${rows.length} tidligere mål</b></span><strong>${icon('chevronRight')}</strong></summary><div>${rows.slice().reverse().map(x=>`<article><span>${esc(labels[x.status]||x.status||'Arkivert')}</span><b>${esc(x.name||'Tidligere mål')}</b><small>${x.date?esc(formatDate(x.date,{day:'numeric',month:'short',year:'numeric'})):''}${x.resultSeconds?` · ${fmtTime(x.resultSeconds)}`:''}</small></article>`).join('')}</div></details>`;
  }
  function goalManagerHtml(g){
    if(!state.goalManagerOpen)return'';const p=g.primary||{name:'',date:'',distance:'half',targetSeconds:0},editor=state.goalEditor;
    const primaryForm=`<form class='rb109-goal-form' data-rb109-primary-form><label>Løp eller mål<input name='name' required value='${esc(p.name||'')}' placeholder='F.eks. Karmøy halvmaraton'></label><div><label>Dato<input name='date' type='date' min='${today()}' required value='${esc(p.date||'')}'></label><label>Distanse<select name='distance'>${Object.entries(DISTANCES).map(([key,x])=>`<option value='${key}' ${p.distance===key?'selected':''}>${x.label}</option>`).join('')}</select></label></div><label>Ønsket tid · valgfritt<input name='target' inputmode='numeric' value='${esc(timeInput(p.targetSeconds))}' placeholder='1:23:00'></label><button class='rb107-button' type='submit'>Lagre hovedmål</button></form>`;
    const secondaryForm=`<form class='rb109-goal-form' data-rb109-secondary-form><label>Løp eller test<input name='name' required placeholder='F.eks. 10 km testløp'></label><div><label>Dato<input name='date' type='date' min='${today()}' required></label><label>Distanse<select name='distance'>${Object.entries(DISTANCES).map(([key,x])=>`<option value='${key}'>${x.label}</option>`).join('')}</select></label></div><label>Gjennomføring<select name='effort'><option value='controlled'>Kontrollert · del av planen</option><option value='race'>Full innsats · planen gir mer restitusjon</option></select></label><button class='rb107-button' type='submit'>Legg til B-løp</button></form>`;
    const completeForm=`<form class='rb109-goal-form' data-rb109-complete-form><p>Resultatet lagres i målhistorikken. RunnerBear går deretter inn i en kort overgangsperiode.</p><label>Resultat · valgfritt<input name='result' inputmode='numeric' placeholder='1:22:45'></label><button class='rb107-button' type='submit'>Marker som gjennomført</button></form>`;
    return `<div class='rb109-modal' role='presentation'><section role='dialog' aria-modal='true' aria-labelledby='rb109GoalManagerTitle'><header><div><span class='rb107-overline'>Retning for coachen</span><h2 id='rb109GoalManagerTitle'>Administrer mål</h2><p>Velg bare det som faktisk skal påvirke treningsplanen.</p></div><button aria-label='Lukk' data-rb109-goal-close>${icon('close')}</button></header><div class='rb109-goal-options'><button class='${editor==='primary'?'active':''}' data-rb109-goal-editor='primary'><b>Sett eller bytt hovedmål</b><small>Ett aktivt A-løp</small></button><button class='${editor==='secondary'?'active':''}' data-rb109-goal-editor='secondary'><b>Legg til B-løp</b><small>Test eller kontrollert løp</small></button><button data-rb109-base-mode><b>Bygg form uten løpsdato</b><small>Bakken-prinsippene fortsetter</small></button></div>${editor==='primary'?primaryForm:editor==='secondary'?secondaryForm:editor==='complete'?completeForm:`<div class='rb109-manager-note'><b>${g.mode==='base'?'Formbygging er aktiv':g.mode==='transition'?'Overgangsperiode er aktiv':'Hovedmålet styrer planen'}</b><p>RunnerBear holder normalvolumet rundt ${roundHalf(policy().anchorKm||50)} km, minst ${policy().profile.minRunDays||5} løpedager og maksimalt ${policy().profile.flexibleSessions||2} fleksible økter.</p></div>`}${g.primary&&g.mode==='race'?`<footer><span>Avslutt aktivt mål</span><button data-rb109-goal-editor='complete'>Gjennomført</button><button data-rb109-cancel-goal>Avlyst</button></footer>`:''}</section></div>`;
  }

  function gateNumber(title){const m=String(title||'').match(/gate\s*(\d+)/i);return m?Number(m[1]):0}
  function gatePace(p){
    const source=rawSchedule().find(x=>x.ds===p.baseDs)||p,text=`${source.detail||''} ${source.desc||''}`,m=text.match(/(\d:\d{2})\s*[–-]\s*(\d:\d{2})\s*\/km/i);
    return m?`${m[1]}–${m[2]}/km`:targetFor(p).pace||'Kontrollert styring';
  }
  function goalGates(){
    const rows=effectiveSchedule().map(p=>{const source=rawSchedule().find(x=>x.ds===p.baseDs)||p,n=gateNumber(source.title);return n?{plan:p,number:n,title:source.title,pace:gatePace(p),done:isDone(p),result:localStorage.getItem(`runfest26_gate${n}`)||''}:null}).filter(Boolean).sort((a,b)=>a.plan.ds.localeCompare(b.plan.ds));
    const next=rows.find(x=>!x.done&&x.plan.ds>=today())||null,after=next?rows.find(x=>x.plan.ds>next.plan.ds&&!x.done)||null:null;
    return{rows,next,after,completed:rows.filter(x=>x.done||x.result).length};
  }
  function fasterSignal(){
    const cutoff=addDays(today(),-28),rows=(engine()?.thresholdHistory?.()||[]).filter(x=>x.date>=cutoff).sort((a,b)=>xDate(a).localeCompare(xDate(b))),first=rows[0],last=rows.at(-1);
    if(!first||!last||first===last)return{value:'Bygger trend',copy:'Trenger to målinger innen 28 dager'};
    const delta=paceSec(first.pace)-paceSec(last.pace);if(delta>0)return{value:`${delta} sek/km`,copy:'raskere siste 28 dager'};if(delta<0)return{value:`${Math.abs(delta)} sek/km`,copy:'roligere siste 28 dager'};return{value:'Stabil',copy:'siste 28 dager'};
  }
  function xDate(x){return String(x?.date||'')}
  function saferSignal(){
    const d=decision();if(d.level==='red')return{tone:'red',value:'Avlastning',copy:'Coach har redusert belastningen'};if(d.level==='yellow')return{tone:'amber',value:'Følg med',copy:'Behold margin i neste økt'};return{tone:'green',value:'Belastning stabil',copy:'Planen beskytter kontinuiteten'};
  }
  function thresholdDevelopmentHtml(sessionEvidence){
    const rows=comparableThresholdEvidence(sessionEvidence),count=rows.length,ready=count>=3;
    if(!ready)return `<details class='rb107-card rb116-disclosure rb116-threshold-wait'><summary><span class='rb116-disclosure-mark'>${count}</span><div><b>Terskelutvikling</b><small>${count} av 3 valide, sammenlignbare økter</small></div><strong>›</strong></summary><div class='rb116-disclosure-body'><b>Trend vises etter 3 valide terskeløkter</b><p>RunnerBear sammenligner arbeidsfart ved liknende puls og økttype. Oppvarming, nedjogg og ufullstendige arbeidsdeler får ikke lage en falsk trend.</p></div></details>`;
    const visible=rows.slice(-8),first=visible[0],last=visible.at(-1),delta=first.pace-last.pace;
    return `<details class='rb107-card rb116-disclosure rb116-threshold-ready'><summary><span class='rb116-disclosure-mark'>✓</span><div><b>Terskelutvikling</b><small>${delta>0?`${delta} sek/km raskere ved sammenlignbar puls`:'Stabil kontrollert terskel'} · ${count} valide økter</small></div><strong>›</strong></summary><div class='rb116-disclosure-body'><div class='rb107-chart'>${chartSvg(visible)}<div class='rb107-chart-labels'><span>${esc(formatDate(first.date,{day:'numeric',month:'short'}))}</span><span>${esc(thresholdCopy())}</span><span>${esc(formatDate(last.date,{day:'numeric',month:'short'}))}</span></div></div><div class='rb107-evidence'>${visible.slice(-4).reverse().map(x=>`<div class='rb107-evidence-row'><span>${esc(formatDate(x.date,{day:'numeric',month:'short'}))}</span><b>${esc(x.label)}</b><strong>${fmtPace(x.pace)}/km · ${x.hr} bpm</strong></div>`).join('')}</div></div></details>`;
  }
  function predictionDisclosureHtml(f,predictionRows){
    return `<details class='rb107-card rb116-disclosure rb116-forecast'><summary><span class='rb116-disclosure-mark'>i</span><div><b>Prognosegrunnlag</b><small>${esc(f.foundation.level)} sikkerhet · kapasitet, ikke dagsform</small></div><strong>›</strong></summary><div class='rb116-disclosure-body'><div class='rb116-prediction-grid'>${predictionRows.map(x=>`<div class='${f.goal?.distance===x.key?'active':''}'><span>${esc(x.label)}</span><b>${x.value?fmtTime(x.value):'–'}</b><small>${esc(x.foundation.level)} grunnlag</small></div>`).join('')}</div><p>${esc(f.foundation.copy)} RunnerBear prioriterer kontrollert arbeidsfart, kontinuitet, løpsmengde og langturer. Concept2 gir aerob støtte, men blir aldri falske løpskilometer.</p></div></details>`;
  }
  function goalJourneyHtml(goal,f){
    const gates=goalGates(),next=gates.next,after=gates.after,fast=fasterSignal(),safe=saferSignal(),baseReady=Number(policy().anchorKm||0)>=45;
    const active=next?`<button class='rb116-gate' data-rb116-open-gate='${esc(next.plan.ds)}'><span class='rb116-path-dot active'></span><div><small>Gate ${next.number} · neste beslutningspunkt</small><time>${esc(formatDate(next.plan.ds,{weekday:'long',day:'numeric',month:'long'}))}</time><b>${esc(String(next.title).replace(/^gate\s*\d+\s*·?\s*/i,''))} · ${esc(next.pace)} kontrollert</b><p>Godkjennes bare med stabil pust, kontrollert puls og uten økt akillesreaksjon dagen etter.</p><em>Åpne økten i Plan →</em></div></button>`:`<div class='rb116-gate complete'><span class='rb116-path-dot done'>✓</span><div><small>Beslutningsporter</small><b>Alle planlagte Gate-økter er gjennomført</b><p>Coachen bruker responsen til å låse konkurransefarten.</p></div></div>`;
    const future=after?`<div class='rb116-gate future'><span class='rb116-path-dot'></span><div><small>Deretter · Gate ${after.number}</small><b>${esc(formatDate(after.plan.ds,{day:'numeric',month:'long'}))} · ${esc(after.pace)} kontrollert</b><p>Spiss farten uten å ofre overskudd eller skadefri kontinuitet.</p></div></div>`:`<div class='rb116-gate future'><span class='rb116-path-dot'></span><div><small>Konkurranseklar</small><b>Målet bekreftes av kapasitet og respons</b><p>Spiss farten, hold deg frisk og lever på konkurransedagen.</p></div></div>`;
    return `<section class='rb107-card rb116-journey'><header><span class='rb107-overline'>Veien mot målet</span><h2>Bevis, ikke prosent</h2></header><div class='rb116-path'><div class='rb116-gate complete'><span class='rb116-path-dot done'>✓</span><div><small>Grunnform</small><b>${baseReady?'Grunnform etablert':'Grunnform bygges'}</b><p>${baseReady?`Normaluka rundt ${roundHalf(policy().anchorKm||50)} km gir fundamentet.`:'Kontinuitet og rolig volum bygges først.'}</p></div></div>${active}${future}</div><div class='rb116-coach-strip'><span class='rb116-coach-mark'>${icon('coach')}</span><div><b>Bakken-coachen sier</b><p>${next?`Gate ${next.number} ${formatDate(next.plan.ds,{day:'numeric',month:'long'})} avgjør om ${goal.targetSeconds?fmtTime(goal.targetSeconds):'målet'} fortsatt er riktig mål.`:f.progress.copy}</p></div></div><div class='rb116-outcomes'><div><span>Raskere</span><b>${esc(fast.value)}</b><small>${esc(fast.copy)}</small></div><div class='${safe.tone}'><span>Skadefri</span><b>${esc(safe.value)}</b><small>${esc(safe.copy)}</small></div></div></section>`;
  }
  function paceForDistance(seconds,distance){return seconds?`${fmtPace(seconds/distanceKm(distance))}/km`:'–'}
  function goalHeroFidelityHtml(goal,g,pred){
    const distance=goal?distanceMeta(goal.distance).label:'Formbygging',title=goal?.name||'Bygg formen rolig',date=goal?.date?formatDate(goal.date,{day:'numeric',month:'long',year:'numeric'}):'Uten sluttdato';
    return `<section class="rb119b-goal-hero" ${heroStyle(heroNameForGoal(goal))}><span class="rb119b-hero-icon">${icon('flag')}</span><div><small>${esc(title)}</small><h2>${esc(distance)}</h2></div><footer>${icon('calendar')}<b>${esc(date)}</b><i></i><span>${goal?`${goalDays(goal)} dager igjen`:`~${roundHalf(policy().anchorKm||50)} km normaluke`}</span></footer></section>`;
  }
  function goalCorridorHtml(goal,f){
    const position=clamp(Math.round((f.current-f.low)/Math.max(1,f.high-f.low)*100),4,96);return `<section class="rb119b-goal-corridor"><header><h2>Målkorridor</h2><span>${icon('info')}</span></header><div class="rb119b-corridor-bar"><i></i><b style="left:${position}%"></b></div><div class="rb119b-corridor-values"><div><small>Beste scenario</small><b>${fmtTime(f.low)}</b><span>${paceForDistance(f.low,f.distance)}</span></div><div><small>Mål</small><b>${fmtTime(f.current)}</b><span>${paceForDistance(f.current,f.distance)}</span></div><div><small>Trygt scenario</small><b>${fmtTime(f.high)}</b><span>${paceForDistance(f.high,f.distance)}</span></div></div></section>`;
  }
  function goalEvidenceHtml(f,pred){
    const threshold=(engine()?.thresholdHistory?.()||[]).at(-1),voRows=read('runfest26_vo2_history',[]),vo=Array.isArray(voRows)?voRows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1):null,long=Number(pred?.long||0),rows=[{icon:'heartbeat',label:'Terskel',value:threshold?`${esc(threshold.pace)}<small>/km</small>`:'Bygges',sub:threshold?`${threshold.hr} bpm`:'Trenger data',width:threshold?72:28},{icon:'spark',label:'VO₂maks',value:vo?String(Number(vo.value).toFixed(Number(vo.value)%1?1:0)):'–',sub:vo?'ml/kg/min':'Ikke registrert',width:vo?65:20},{icon:'mountain',label:'Langturkapasitet',value:long?`${roundHalf(long)}<small> km</small>`:'–',sub:long?'Siste 35 dager':'Bygges',width:long?clamp(long/30*100,22,94):20}];
    return `<section class="rb119b-evidence"><h2>Bevisgrunnlag</h2><div>${rows.map(x=>`<article><span>${icon(x.icon)}</span><small>${esc(x.label)}</small><b>${x.value}</b><em>${esc(x.sub)}</em><i><u style="width:${x.width}%"></u></i></article>`).join('')}</div></section>`;
  }
  function goalMilestonesHtml(goal,f){
    const gates=goalGates(),items=[];if(gates.next)items.push({icon:'calendar',label:'Neste milepæl',title:String(gates.next.title).replace(/^gate\s*\d+\s*·?\s*/i,'')||`Gate ${gates.next.number}`,when:`Om ${Math.max(0,dayDiff(gates.next.plan.ds,today()))} dager`,ds:gates.next.plan.ds});if(gates.after)items.push({icon:'mountain',label:`Gate ${gates.after.number}`,title:gates.after.pace,when:`Om ${Math.max(0,dayDiff(gates.after.plan.ds,today()))} dager`,ds:gates.after.plan.ds});if(goal)items.push({icon:'flag',label:'Konkurransedag',title:goal.name,when:`Om ${goalDays(goal)} dager`});if(!items.length)items.push({icon:'continuity',label:'Neste milepæl',title:'Kontinuitet i normaluka',when:f.progress.label});
    return `<section class="rb119b-milestones"><h2>Veien videre</h2><div>${items.slice(0,3).map(x=>`<button ${x.ds?`data-rb116-open-gate="${esc(x.ds)}"`:''}><span>${icon(x.icon)}</span><span><small>${esc(x.label)}</small><b>${esc(x.title)}</b></span><em>${esc(x.when)}</em>${icon('chevronRight')}</button>`).join('')}</div></section>`;
  }
  function goalsHtml(){
    const g=goalState(),goal=activeGoal(),f=forecast(),sessionEvidence=thresholdEvidence(),pred=engine()?.predictions?.()||{},predictionRows=Object.entries(DISTANCES).map(([key,x])=>({key,label:x.label,value:pred?.[key]?.seconds||0,foundation:predictionFoundation(key,pred)}));
    const subtitle=goal?`${distanceMeta(goal.distance).label} · ${Math.max(0,Math.ceil(goalDays(goal)/7))} uker igjen`:'Formbygging · uten sluttdato',action=`<button class="rb119b-title-action" data-rb109-goal-open aria-label="Administrer mål">${icon('more')}</button>`;
    return `<div id='rb107Goals' class='rb107-surface rb119b rb119b-goals'><div class='rb107-shell'>${appBarHtml()}${viewTitleHtml('Ditt mål',subtitle,action)}${goalHeroFidelityHtml(goal,g,pred)}<article class="rb119b-card rb119b-expected"><div><h2>Forventet måltid</h2><strong>${fmtTime(f.current)}</strong><span>${paceForDistance(f.current,f.distance)}</span></div><em class="${f.progress.code}"><i></i>${esc(f.progress.code==='green'?'I rute':f.progress.label)}</em></article>${goalCorridorHtml(goal,f)}${goalEvidenceHtml(f,pred)}${goalMilestonesHtml(goal,f)}<div class="rb119b-supporting-insight">${thresholdDevelopmentHtml(sessionEvidence)}${predictionDisclosureHtml(f,predictionRows)}${secondaryGoalsHtml(g.secondary)}${goalHistoryHtml(g.history)}</div></div>${goalManagerHtml(g)}</div>`;
  }

  const KNOWN_SHOES={
    'Adidas Adios Pro 4':{role:'Konkurranse · terskel',surface:'Asfalt',plate:'Karbonplate'},
    'Nike Zoom Fly 6':{role:'Terskel · progressiv',surface:'Asfalt · mølle',plate:'Plate'},
    'Xtep 360X 3.0':{role:'Tempo · terskel',surface:'Asfalt · mølle',plate:'Plate'},
    'Nike Vomero 18':{role:'Rolig · strides',surface:'Asfalt',plate:'Uten plate'},
    'Nike Vomero 18 Plus':{role:'Langtur · rolig',surface:'Asfalt',plate:'Uten plate'},
    'Nike Vomero Premium':{role:'Restitusjon · rolig',surface:'Asfalt',plate:'Uten plate'},
    'VJ Ultra 3':{role:'Rolig · langtur',surface:'Grus · lett terreng',plate:'Uten plate'}
  };
  function classifyShoe(name){
    if(KNOWN_SHOES[name])return{...KNOWN_SHOES[name],confidence:'Høy'};const n=String(name||'').toLowerCase();
    if(/pro|elite|metaspeed|vaporfly|alphafly/.test(n))return{role:'Konkurranse · kvalitet',surface:'Asfalt',plate:'Sannsynlig plate',confidence:'Middels'};
    if(/trail|terra|speedgoat|ultra/.test(n))return{role:'Rolig · langtur',surface:'Terreng · grus',plate:'Uavklart',confidence:'Middels'};
    if(/vomero|nimbus|glycerin|clifton|novablast/.test(n))return{role:'Rolig · langtur',surface:'Asfalt',plate:'Uten plate',confidence:'Middels'};
    return{role:'Uavklart bruk',surface:'Uavklart underlag',plate:'Uavklart',confidence:'Lav'};
  }
  function shoeSlug(name){return String(name||'shoe').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||`shoe-${Date.now()}`}
  function shoesState(){
    let rows=read(K.shoes,null);if(Array.isArray(rows)&&rows.length)return rows;
    let names=[];try{names=typeof shoeMeta!=='undefined'?Object.keys(shoeMeta):[]}catch{}rows=names.map(name=>({id:shoeSlug(name),name,active:true,created:new Date().toISOString(),...classifyShoe(name)}));write(K.shoes,rows);return rows;
  }
  function shoeKm(name){let km=0;effectiveSchedule().forEach(p=>{if(!isDone(p))return;const f=feedbackFor(p),used=f.shoe||String(p.shoe||'').split('/')[0].trim();if(used===name)km+=activityFor(p)?.distance?activityFor(p).distance/1000:Number(p.km||0)});return roundHalf(km)}
  function shoesHtml(){
    const rows=shoesState(),active=rows.filter(x=>x.active!==false),retired=rows.filter(x=>x.active===false),row=x=>`<div class="rb108-shoe-row"><div><b>${esc(x.name)}</b><span>${esc(x.role)} · ${esc(x.surface)} · ${esc(x.plate)}</span><small>${esc(x.confidence)} sikkerhet i klassifiseringen</small></div><strong>${shoeKm(x.name)} km</strong><button data-rb108-shoe-toggle="${esc(x.id)}">${x.active===false?'Aktiver':'Pensjoner'}</button></div>`;
    return `<div class="rb108-shoe-summary"><b>${active.length} aktive løpesko</b><span>${retired.length} pensjonerte</span></div><div class="rb108-shoes">${active.map(row).join('')||'<p>Ingen aktive sko.</p>'}</div>${retired.length?`<details class="rb108-retired"><summary>Pensjonerte sko · ${retired.length}</summary>${retired.map(row).join('')}</details>`:''}<details class="rb108-add-shoe"><summary>${icon('plus')} Legg til løpesko</summary><form data-rb108-shoe-form><label>Modell<input name="name" required placeholder="F.eks. Adidas Evo SL"></label><label>Bruksområde<select name="role"><option value="">Finn automatisk</option><option>Rolig · langtur</option><option>Terskel · progressiv</option><option>Konkurranse · kvalitet</option><option>Terreng · grus</option></select></label><label>Underlag<select name="surface"><option value="">Finn automatisk</option><option>Asfalt</option><option>Asfalt · mølle</option><option>Terreng · grus</option></select></label><div class="rb108-shoe-preview" data-rb108-shoe-preview>Skriv modellnavnet – RunnerBear foreslår type, underlag og formål før lagring.</div><button class="rb107-button secondary" type="submit">Legg til sko</button></form></details>`;
  }
  function logHtml(){
    const rows=read(K.log,[]);if(!rows.length)return'<div class="rb107-empty"><b>Ingen inngrep å vise</b><p>Coachen er stille når planen står.</p></div>';
    return `<div class="rb107-log">${rows.slice(0,12).map(x=>`<div class="rb107-log-row"><div><time>${esc(new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(x.at)))}</time><b>${esc(x.message)}</b><span>${x.kind==='auto'?'Automatisk innenfor rammene':'Manuell endring'}</span></div>${x.undo?`<button data-rb107-undo="${esc(x.id)}">Angre</button>`:''}</div>`).join('')}</div>`;
  }
  function dayChoices(name,selected,type='checkbox'){
    const values=Array.isArray(selected)?selected:[selected];return `<div class="rb118-day-choices">${DAY_NAMES.map((label,i)=>`<label><input type="${type}" name="${name}" value="${i}" ${values.includes(i)?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
  }
  function trainingPreferencesHtml(){
    const p=trainingPreferences();return `<form class="rb118-preferences" data-rb118-preferences-form><p>Coachen bruker valgene som preferanser. Belastningsvern og avstand mellom kvalitetsøkter kan overstyre dem.</p><div class="rb118-volume-grid"><label>Normalvolum<input name="baseKm" type="number" min="30" max="80" step="1" value="${p.baseKm}"><span>km/uke</span></label><label>Coachområde fra<input name="normalLow" type="number" min="25" max="80" step="1" value="${p.normalLow}"><span>km</span></label><label>Coachområde til<input name="normalHigh" type="number" min="30" max="85" step="1" value="${p.normalHigh}"><span>km</span></label><label>Øvre grense<input name="maxKm" type="number" min="35" max="90" step="1" value="${p.maxKm}"><span>km</span></label></div><fieldset><legend>Vanlige løpedager</legend>${dayChoices('runDays',p.runDays)}</fieldset><fieldset><legend>Foretrukne kvalitetsdager</legend>${dayChoices('qualityDays',p.qualityDays)}</fieldset><fieldset><legend>Langturdag</legend>${dayChoices('longRunDay',p.longRunDay,'radio')}</fieldset><fieldset><legend>Alternative dager</legend><small>Concept2, Zwift eller hvile kan velges på disse dagene.</small>${dayChoices('alternativeDays',p.alternativeDays)}</fieldset><button class="rb107-button" type="submit">Lagre treningspreferanser</button></form>`;
  }
  function saveTrainingPreferences(form){
    const fd=new FormData(form),num=name=>Number(fd.get(name)),runDays=dayArray(fd.getAll('runDays').map(Number),[]),qualityDays=dayArray(fd.getAll('qualityDays').map(Number),[]),alternativeDays=dayArray(fd.getAll('alternativeDays').map(Number),[]),longRunDay=Number(fd.get('longRunDay')),baseKm=num('baseKm'),normalLow=num('normalLow'),normalHigh=num('normalHigh'),maxKm=num('maxKm');
    if(runDays.length<3)return toast('Velg minst tre løpedager');if(!qualityDays.length||qualityDays.some(x=>!runDays.includes(x)))return toast('Kvalitetsdager må være valgte løpedager');if(!runDays.includes(longRunDay))return toast('Langturdagen må være en valgt løpedag');if(!(normalLow<=baseKm&&baseKm<=normalHigh&&normalHigh<=maxKm))return toast('Volum må følge: coach fra ≤ normal ≤ coach til ≤ øvre grense');
    const before=snapshot(K.profile),stored=read(K.profile,{});Object.assign(stored,{baseKm,normalLow,normalHigh,maxKm,minRunDays:runDays.length,flexibleSessions:Math.min(2,alternativeDays.length),runDays,qualityDays,longRunDay,alternativeDays,preferencesConfigured:true,preferencesVersion:1});write(K.profile,stored);
    const legacy=read(K.legacyProfile,{});legacy.weekRhythm={...(legacy.weekRhythm||{}),runDays,qualityDays,longRunDay,crossDays:alternativeDays,allowCross:alternativeDays.length>0};write(K.legacyProfile,legacy);addLog('Treningspreferansene er oppdatert.','manual',before);toast('Treningspreferansene er lagret');setTimeout(()=>location.reload(),450);
  }
  function thresholdHistoryCardHtml(){
    const rows=(engine()?.thresholdHistory?.()||[]).filter(x=>x?.date&&paceSec(x?.pace)&&Number(x?.hr)>0).slice(-8),last=rows.at(-1),first=rows[0];
    if(!rows.length)return `<article class="rb119b-card rb119b-threshold-card rb1020-threshold-empty"><header><div><h2>Terskelhistorikk</h2></div><small>Bygges</small></header><div><b>Ingen terskeldata ennå</b><p>Gjennomfør representative kvalitetsøkter for å bygge terskelhistorikken.</p></div></article>`;
    if(rows.length===1)return `<article class="rb119b-card rb119b-threshold-card rb1020-threshold-single"><header><div><h2>Terskel</h2><strong>${esc(last.pace)}<span>/km</span></strong></div><small>${esc(last.hr)} bpm</small></header><div><span>Sist estimert ${esc(formatDate(last.date,{day:'numeric',month:'long'}))}</span><p>Vi trenger flere representative økter før vi viser utvikling.</p></div></article>`;
    if(rows.length===2)return `<article class="rb119b-card rb119b-threshold-card rb1020-threshold-pair"><header><div><h2>Terskelhistorikk</h2><strong>${esc(last.pace)}<span>/km</span></strong></div><small>2 datapunkter</small></header><div>${rows.map(x=>`<p><span>${esc(formatDate(x.date,{day:'numeric',month:'short'}))}</span><b>${esc(x.pace)}/km · ${esc(x.hr)} bpm</b></p>`).join('')}</div><footer><span>Flere representative økter trengs før en trendlinje gir mening.</span></footer></article>`;
    return `<article class="rb119b-card rb119b-threshold-card"><header><div><h2>Terskelhistorikk</h2><strong>${esc(last.pace)}<span>/km</span></strong></div><small>Siste ${Math.max(1,Math.round(Math.max(1,dayDiff(last.date,first.date))/7))} uker</small></header><div class="rb119b-threshold-chart">${chartSvg(rows)}</div><footer><span>${esc(formatDate(first.date,{day:'numeric',month:'short'}).replace('.',''))}</span><span>${esc(formatDate(last.date,{day:'numeric',month:'short'}).replace('.',''))}</span></footer></article>`;
  }
  function shoeRotationCardHtml(shoes){
    const active=shoes.filter(x=>x.active!==false).slice(0,3);return `<article class="rb119b-card rb119b-shoe-card"><h2>Skorotasjon</h2><div>${active.map(x=>`<div><span class="rb119b-shoe-mark">${icon('shoe')}</span><b>${esc(x.name)}</b><small>${shoeKm(x.name)} km</small><em>${esc(x.role.split(' · ')[0])}</em>${icon('chevronRight')}</div>`).join('')||`<p>Legg til sko i verktøy og innstillinger.</p>`}</div></article>`;
  }
  function intensityProfile(){
    const profile=policy().profile||{},history=(engine()?.thresholdHistory?.()||[]).filter(x=>Number(x?.hr)>0),latest=history.at(-1),thresholdHr=Number(latest?.hr||profile.thresholdHr||0),maxHr=Number(profile.maxHr||0),model=clarityModel()?.deriveIntensityRanges?.({thresholdHr,maxHr});
    return{...model,thresholdSource:latest?.source||'treningsprofil',thresholdDate:latest?.date||'',valid:clarityModel()?.validateIntensityRanges?.(model)!==false};
  }
  function rangeLabel(row){return row.min==null?`≤ ${row.max} bpm`:row.max==null?`≥ ${row.min} bpm`:`${row.min}–${row.max} bpm`}
  function intensityDistributionModel(){
    const profile=intensityProfile();return clarityModel()?.intensityDistribution?.({activities:activities(),ranges:profile.ranges||[],now:dateFrom(today()),days:28,minValidSeconds:600})||{available:false,totalActivities:0,coveredActivities:0,missingActivities:0,totalValidSeconds:0,rows:[],insight:'RunnerBear venter på detaljerte pulsdata før treningsfordelingen tolkes.'};
  }
  function intensityCardHtml(){
    const profile=intensityProfile(),rows=profile.ranges||[];
    const source=`Basert på ${profile.thresholdSource||'treningsprofil'} ${profile.thresholdHr} bpm og makspuls ${profile.maxHr} bpm.${profile.thresholdDate?` Siste terskeldata ${formatDate(profile.thresholdDate,{day:'numeric',month:'long',year:'numeric'})}.`:''} Oppdateres når RunnerBear får en nyere pålitelig terskelverdi.`;
    return `<article class="rb119b-card rb1020-intensity rb1022-areas"><header><div><h2>Dine intensitetsområder</h2><p>Personlige pulsintervaller uten overlapp.</p></div><span>${profile.valid?'Personlig':'Kontroller data'}</span></header><div class="rb1020-intensity-list">${rows.map(x=>`<div class="${x.key}"><div><b>${esc(x.label)}</b><small>${esc(x.description)}</small></div><strong>${esc(rangeLabel(x))}</strong></div>`).join('')}</div><footer><p>${esc(source)}</p><button type="button" data-rb1020-intensity-explain>Hvordan beregnes dette? ${icon('chevronRight')}</button></footer></article>`;
  }
  function intensityDistributionCardHtml(){
    const distribution=intensityDistributionModel(),coverage=distribution.totalActivities?`${distribution.coveredActivities} av ${distribution.totalActivities} løpeøkter har tilstrekkelige pulsdetaljer.`:'Ingen løpeøkter med detaljerte pulsdata i vinduet.';
    if(!distribution.available)return `<article class="rb119b-card rb1022-distribution empty"><header><div><h2>Intensitetsfordeling</h2><p>Siste 28 dager · faktisk gjennomført løping</p></div><span>Datakvalitet</span></header><div class="rb1022-distribution-empty"><b>Ikke nok detaljerte pulsdata ennå</b><p>Snittpuls og makspuls brukes ikke til å late som hele økten var i én sone.</p><small>${esc(coverage)}</small></div></article>`;
    return `<article class="rb119b-card rb1022-distribution"><header><div><h2>Intensitetsfordeling</h2><p>Siste 28 dager · faktisk gjennomført løping</p></div><span>${Math.round(distribution.totalValidSeconds/60)} min pulsdata</span></header><div class="rb1022-distribution-list">${distribution.rows.map(x=>`<div class="${x.key}"><b>${esc(x.label)}</b><span aria-hidden="true"><i style="width:${clamp(x.percent,0,100)}%"></i></span><strong>${x.percent} %</strong></div>`).join('')}</div><footer><p>${esc(distribution.insight)}</p><small>${esc(coverage)} Concept2, Zwift, styrke og planlagte økter er ekskludert.</small></footer></article>`;
  }
  function intensityExplanationModalHtml(){
    const p=intensityProfile();return `<div class="rb1020-modal" data-rb1020-modal-backdrop="intensity"><section class="rb1020-sheet rb1020-intensity-sheet" role="dialog" aria-modal="true" aria-labelledby="rb1020IntensityTitle"><header><div><span>Personlig treningsmodell</span><h2 id="rb1020IntensityTitle">Hvordan beregnes dette?</h2></div><button type="button" data-rb1020-modal-close="intensity" aria-label="Lukk forklaringen">${icon('close')}</button></header><div class="rb1020-sheet-body"><p class="rb1020-reason-lead">Pulsområdene beregnes kun fra siste gyldige terskelpuls og makspulsen i treningsprofilen. De dekorative søylene fra tidligere versjoner er fjernet.</p><section><h3>Grunnlaget akkurat nå</h3><ul><li>Individuell terskel: ${esc(p.thresholdHr)} bpm${p.thresholdDate?` · ${esc(formatDate(p.thresholdDate,{day:'numeric',month:'short'}))}`:''}</li><li>Makspuls i treningsprofilen: ${esc(p.maxHr)} bpm</li><li>Terskelkilde: ${esc(p.thresholdSource)}</li></ul></section><p class="rb1020-method-note">28-dagersfordelingen beregnes separat fra tidsoppløste Garmin-pulsdata i Tredict-aktivitetsdetaljen. Snittpuls brukes aldri som erstatning for en pulsserie.</p></div></section></div>`;
  }
  function principlesCardHtml(){
    const rows=[['patience','Tålmodighet'],['continuity','Kontinuitet'],['spark','Kvalitet'],['balance','Balanse'],['trend','Spesifisitet']];return `<article class="rb119b-card rb119b-principles"><h2>Bakken-prinsippene</h2><div>${rows.map(x=>`<span><i>${icon(x[0])}</i><small>${x[1]}</small></span>`).join('')}</div></article>`;
  }
  function moreHtml(){
    const sync=syncState(),prefs=trainingPreferences(),mode=control(),copy={observer:'Analyserer alt, men endrer aldri planen.',suggest:'Foreslår endringer og venter på godkjenning.',autopilot:'Kan justere innenfor låser, volumtak og Bakken-reglene. Alle endringer kan angres.'}[mode];
    const shoes=shoesState(),activeShoes=shoes.filter(x=>x.active!==false).length,outbound=window.RunnerBearCloud?.cachedOutbound?.()||read('runnerbear_tredict_outbound_v1',{}),planQueue=tredictPlanQueue(),weekEnd=addDays(today(),6),weekQueue=planQueue.filter(x=>x.date<=weekEnd),qualityWeek=weekQueue.filter(x=>x.type==='quality'||x.type==='race').length;
    let currentSignature='';try{currentSignature=window.RunnerBearTredictOutbound?.signature?.(planQueue)||''}catch{}
    const published=['published','awaiting-calendar-activation','calendar-active','review-required'].includes(outbound.status)&&outbound.planId,active=outbound.status==='calendar-active',review=outbound.status==='review-required',current=published&&outbound.clientSignature===currentSignature,outStatus=active&&current?'Kalender aktiv':review?'Kontroller':current?'Klar i Tredict':published?'Plan endret':'Klar',outCopy=active&&current?`Alle ${outbound.calendarCount||planQueue.length} RunnerBear-øktene de neste 10 dagene er bekreftet i Tredict-kalenderen. Tredict sender dem videre gjennom Garmin-integrasjonen.`:review?(outbound.message||'Tredict-kalenderen må kontrolleres før neste automatiske endring.') : current?`${planQueue.length} løpeøkter i den rullerende 10-dagersperioden ligger i Tredict-planen. Aktiver planen i Tredict-kalenderen; deretter kan eksisterende økter flyttes automatisk via Tredict.`:published?`10-dagersplanen er endret siden siste synkronisering. Publiser den oppdaterte planen til Tredict.`:`${planQueue.length} løpeøkter de neste 10 dagene er klare for Tredict. ${qualityWeek} kvalitetsøkter er strukturerte neste sju dager.`;
    const service=tredictSync(),transportState=service?.all?.()||{items:{},queue:[]},currentTransportIds=new Set(planQueue.map(x=>String(x.externalId||''))),transportItems=Object.values(transportState.items||{}).filter(x=>currentTransportIds.has(String(x.externalId||''))),transportError=transportItems.some(x=>x.status==='error'),transportBusy=transportItems.some(x=>['pending','syncing'].includes(x.status)),transportReview=transportItems.some(x=>x.status==='review_required'),transportAction=transportItems.some(x=>x.status==='awaiting_activation')||outbound.status==='awaiting-calendar-activation',transportAvailable=service?.available?.()===true,transportLabel=transportError?'Synkfeil':transportReview?'Kontroller':transportBusy?'Synkroniserer':active?'Automatisk':transportAction?'Aktiver én gang':transportAvailable?'Klar':'Ikke tilgjengelig',transportCopy=transportError?'Tredict-synk feilet. RunnerBear-planen er fortsatt lagret og riktig.':transportReview?'Kontroller Tredict-kalenderen. RunnerBear gjør ingen risikabel overskriving.':transportBusy?'Planendringer er lagret og sendes til Tredict i bakgrunnen.':active?'Planendringer flyttes automatisk via Tredict og videre til Garmin.':transportAction?'Planen er klar i Tredict. Aktiver den én gang i kalenderen for sømløs videre synkronisering.':transportAvailable?'RunnerBear sender planendringer til Tredict, som synkroniserer dem videre til Garmin.':'Tredict-transporten er midlertidig utilgjengelig. Endringer beholdes trygt i køen.';
    const setting=(iconName,title,sub,body)=>`<details class="rb119b-setting"><summary><span>${icon(iconName)}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>${icon('chevronRight')}</summary><div class="rb119b-setting-body">${body}</div></details>`;
    const group=(title,body)=>`<section class="rb1020-insight-group"><h2>${esc(title)}</h2>${body}</section>`;
    return `<div id="rb107More" class="rb107-surface rb119b rb119b-more"><div class="rb107-shell">${appBarHtml()}${viewTitleHtml('Mer innsikt','Utvikling, utstyr og treningsstyring')}${group('Utvikling',thresholdHistoryCardHtml())}${group('Utstyr',shoeRotationCardHtml(shoes))}${group('Treningen din',`${intensityCardHtml()}${intensityDistributionCardHtml()}${principlesCardHtml()}`)}<section class="rb119b-card rb119b-onward"><h2>Veien videre</h2><details><summary><span>${icon('message')}</span><span><b>Spør coachen</b><small>Få råd fra RunnerBear-coachen</small></span>${icon('chevronRight')}</summary><div><b>${esc(coachBasis().headline)}</b><p>${esc(coachBasis().message)}</p></div></details><details><summary><span>${icon('heart')}</span><span><b>Skadefri</b><small>Styrke, mobilitet og skadeforebygging</small></span>${icon('chevronRight')}</summary><div><b>Skadefri fremdrift er en del av målet</b><p>Akilles- eller hælfestesignal kan erstatte løping med 45–60 min rolig Zwift. En Gate godkjennes ikke hvis reaksjonen øker dagen etter.</p></div></details></section><section class="rb119b-tools"><h2>Verktøy og innstillinger</h2>${setting('profile','Treningsprofil',`${prefs.baseKm} km/uke · ${prefs.runDays.length} løpedager`,trainingPreferencesHtml())}${setting('link','Datakilder',`Garmin ${sync.stale?'må oppdateres':'tilkoblet'} · Concept2 aktiv`,`<div class="rb107-data-row"><div><b>Garmin → RunnerBear</b><span>Aktiviteter, puls, recovery, kapasitet og historikk.</span></div><i></i></div><div class="rb107-data-row"><div><b>Concept2</b><span>Aerob støtte, aldri falske løpskilometer.</span></div><i></i></div><div class="rb1023-garmin-summary"><div><span><b>RunnerBear → Tredict → Garmin</b><small>${esc(transportCopy)}</small></span><strong>${esc(transportLabel)}</strong></div>${transportError?`<button class="rb107-button secondary" data-rb1023-garmin-retry="">Prøv Tredict-synk igjen</button>`:''}</div><details class="rb1023-calendar-diagnostic"><summary>Tredict-kalender</summary><div><p>${esc(outCopy)}</p><button class="rb107-button secondary" data-rb108-publish-plan>${icon('sync')} ${current?'Kontroller Tredict-kalenderen':published?'Publiser oppdatert plan':'Publiser plan til Tredict'}</button></div></details><div class="rb108-data-actions"><button class="rb107-button secondary" data-rb107-sync>Hent Garmin-data</button></div>`)}${setting('plan','Plan og autopilot',mode==='autopilot'?'Autopilot aktiv':'Manuell kontroll',`<div class="rb107-control"><button class="${mode==='observer'?'active':''}" data-rb107-control="observer">Observer</button><button class="${mode==='suggest'?'active':''}" data-rb107-control="suggest">Foreslå</button><button class="${mode==='autopilot'?'active':''}" data-rb107-control="autopilot">Autopilot</button></div><p class="rb107-control-copy">${esc(copy)}</p>`)}${setting('shoe','Løpesko',`${activeShoes} aktive · ${shoes.length-activeShoes} pensjonerte`,shoesHtml())}${setting('log','Coachlogg','Automatiske og manuelle endringer',logHtml())}${setting('info','Om RunnerBear','Versjon 10.24 · privat coachmiljø','<b>RunnerBear 10.24</b><p>Garmin registrerer. RunnerBear tolker og planlegger. Tredict frakter planendringer videre til Garmin.</p>')}</section></div>${qs('.view.active')?.id==='more'&&state.intensityExplanationOpen?intensityExplanationModalHtml():''}</div>`;
  }

  function archivePrimary(status,resultSeconds=0){
    const g=goalState();if(!g.primary)return g;g.history.push({...g.primary,status,resultSeconds:Number(resultSeconds)||0,closedAt:new Date().toISOString()});g.primary=null;return g;
  }
  function setPrimaryGoal(form){
    const fd=new FormData(form),name=String(fd.get('name')||'').trim(),date=String(fd.get('date')||''),distance=String(fd.get('distance')||'half'),targetRaw=String(fd.get('target')||'').trim(),targetSeconds=parseTime(targetRaw);if(!name||!date)return toast('Navn og dato må fylles ut');if(date<today())return toast('Velg en dato frem i tid');if(targetRaw&&!targetSeconds)return toast('Skriv måltid som 1:23:00 eller 37:30');
    let g=goalState(),old=g.primary,identityChanged=!!old&&(old.name!==name||old.date!==date||old.distance!==distance);if(identityChanged)g=archivePrimary('replaced');
    g.mode='race';g.transitionUntil='';g.primary={id:identityChanged||!old?uid('goal'):old.id,name,date,distance,targetSeconds,aspirationSeconds:identityChanged?0:Number(old?.aspirationSeconds||0),status:'active',created:identityChanged||!old?new Date().toISOString():old.created,updatedAt:new Date().toISOString()};saveGoalState(g);state.goalManagerOpen=false;state.goalEditor='';addLog(`Hovedmål satt til ${name}.`,'manual');toast('Hovedmålet er oppdatert');renderAll();
  }
  function addSecondaryGoal(form){
    const fd=new FormData(form),name=String(fd.get('name')||'').trim(),date=String(fd.get('date')||''),distance=String(fd.get('distance')||'five'),effort=String(fd.get('effort')||'controlled');if(!name||!date)return toast('Navn og dato må fylles ut');if(date<today())return toast('Velg en dato frem i tid');const g=goalState();g.secondary.push({id:uid('b-race'),name,date,distance,effort,status:'active',created:new Date().toISOString()});saveGoalState(g);state.goalManagerOpen=false;state.goalEditor='';addLog(`B-løp lagt til: ${name} (${effort==='controlled'?'kontrollert':'full innsats'}).`,'manual');toast('B-løpet er lagt til');renderAll();
  }
  function enterBaseMode(){let g=goalState();if(g.primary)g=archivePrimary('paused');g.mode='base';g.transitionUntil='';saveGoalState(g);state.goalManagerOpen=false;state.goalEditor='';addLog('Målmodus endret til formbygging uten løpsdato.','manual');toast('Formbygging uten løpsdato er aktiv');renderAll()}
  function completePrimary(form){const result=parseTime(new FormData(form).get('result'));let g=archivePrimary('completed',result);g.mode='transition';g.transitionUntil=addDays(today(),7);saveGoalState(g);state.goalManagerOpen=false;state.goalEditor='';addLog('Hovedmålet er gjennomført. En kort overgangsperiode er aktiv.','manual');toast('Resultatet er lagret');renderAll()}
  function cancelPrimary(){let g=archivePrimary('cancelled');g.mode='base';g.transitionUntil='';saveGoalState(g);state.goalManagerOpen=false;state.goalEditor='';addLog('Hovedmålet er avlyst. Formbygging fortsetter uten treningsgjeld.','manual');toast('Målet er flyttet til historikken');renderAll()}
  function decorateHeader(){
    const box=qs('.topbar .race-count');if(!box)return;const goal=activeGoal(),mode=goal?'race':goalState().mode;box.dataset.rb109='1';box.dataset.rb109Mode=mode;
    if(goal)box.innerHTML=`<b><span id='countdown'>${goalDays(goal)}</span> dager</b><span>til ${esc(goal.name)}</span>`;
    else box.innerHTML=`<b><span id='countdown'>${goalState().mode==='transition'?'7':'–'}</span> ${goalState().mode==='transition'?'dager':'modus'}</b><span>${goalState().mode==='transition'?'rolig overgang':'formbygging uten løpsdato'}</span>`;
  }
  function decorateBrand(){
    const brand=qs('.topbar .brand');if(!brand)return;
    brand.innerHTML=`<div class="rb"><img src="runnerbear-brand-mark-flat.svg?v=1022" alt=""></div><div><b>RunnerBear</b><span>Bakken-coach</span></div>`;
  }
  function mount(id,html){const section=$(id);if(!section)return;const surface=id==='race'||id==='goals'?'Goals':id[0].toUpperCase()+id.slice(1),old=qs(`#rb107${surface}`,section);if(old)old.outerHTML=html;else section.insertAdjacentHTML('beforeend',html)}
  function decorateNav(){
    const map={today:['I dag','today'],plan:['Plan','plan'],race:['Mål','goal'],goals:['Mål','goal'],more:['Mer','more']};
    qsa('.navbtn[data-tab]').forEach(b=>{const x=map[b.dataset.tab];if(!x||b.dataset.rb1021Nav==='1')return;b.innerHTML=`<span>${icon(x[1])}</span>${x[0]}`;b.dataset.rb1021Nav='1'});
  }
  function activeView(){return qs('.view.active')?.id||'today'}
  function finishRender(id,startMark){
    decorateHeader();
    document.documentElement.classList.add('rb107-ready');
    document.documentElement.classList.remove('rb108-booting');
    document.body.classList.toggle('rb109-modal-open',state.goalManagerOpen||state.workoutDetailOpen||state.coachReasonOpen||state.intensityExplanationOpen);
    bind($(id));
    runtimeStats.renders[id==='race'||id==='goals'?'goals':id]++;
    mark(`runnerbear:${id}:rendered`);measure(`runnerbear:${id}:render`,startMark);
  }
  function renderToday(){const start='runnerbear:today:render:start';mark(start);logAutomaticAdjustments();mount('today',todayHtml());finishRender('today',start)}
  function renderPlan(){const start='runnerbear:plan:render:start';mark(start);mount('plan',planHtml());finishRender('plan',start)}
  function renderGoals(){const id=$('goals')?'goals':'race',start='runnerbear:goals:render:start';mark(start);mount(id,goalsHtml());finishRender(id,start)}
  let moreRenderReady=false,moreRenderVersion=0;
  function moreShellHtml(){return `<div id="rb107More" class="rb107-surface rb119b rb119b-more"><div class="rb107-shell">${appBarHtml()}${viewTitleHtml('Mer innsikt','Utvikling, utstyr og treningsstyring')}<section class="rb1020-insight-group"><h2>Oppdaterer innsikten</h2><article class="rb119b-card"><p>Treningsdata, utstyr og innstillinger gjøres klare.</p></article></section></div></div>`}
  function renderMore(){
    const existing=qs('#rb107More',$('more'));
    if(moreRenderReady&&!moreRenderDirty&&existing)return;
    const start='runnerbear:more:render:start';mark(start);
    if(!existing)mount('more',moreShellHtml());
    finishRender('more',start);
    const version=++moreRenderVersion;
    const hydrate=()=>{
      if(version!==moreRenderVersion||activeView()!=='more')return;
      const previous=renderCache;renderCache={};const fullStart='runnerbear:more:hydrate:start';mark(fullStart);
      try{mount('more',moreHtml());moreRenderReady=true;moreRenderDirty=false;finishRender('more',fullStart)}finally{renderCache=previous}
    };
    if(typeof requestIdleCallback==='function')requestIdleCallback(hydrate,{timeout:650});else setTimeout(hydrate,80);
  }
  function renderView(id=activeView()){
    if(!engine()||!clarityModel())return;
    const previous=renderCache;renderCache={};
    try{
      if(id==='today')return renderToday();
      if(id==='plan')return renderPlan();
      if(id==='race'||id==='goals')return renderGoals();
      if(id==='more')return renderMore();
    }finally{renderCache=previous}
  }
  function renderAll(){return renderView(activeView())}
  function switchView(tab,{scroll=true}={}){
    const target=tab==='goals'&&$('goals')?'goals':tab;
    if(target==='plan')openPlanOnToday(false);
    qsa('.view').forEach(v=>v.classList.toggle('active',v.id===target));
    qsa('.navbtn').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));
    renderView(target);
    try{window.dispatchEvent(new CustomEvent('runnerbear:view',{detail:{view:target}}))}catch{}
    if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  }
  function toast(message,action=null){let el=$('rb107Toast');if(!el){el=document.createElement('div');el.id='rb107Toast';el.className='rb107-toast';document.body.appendChild(el)}el.replaceChildren();const label=document.createElement('span');label.textContent=message;el.appendChild(label);if(action?.label&&typeof action.run==='function'){const button=document.createElement('button');button.type='button';button.textContent=action.label;button.onclick=()=>{clearTimeout(toast.timer);el.classList.remove('show');action.run()};el.appendChild(button)}el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),action?5200:2600)}
  function restoreMove(p){const before=snapshot(K.moves),moves=read(K.moves,{}),partner=Object.keys(moves).find(key=>moves[key]===p.baseDs),previousDates={[p.baseDs]:p.ds};if(partner)previousDates[partner]=basePlan(partner)?.ds||'';delete moves[p.baseDs];if(partner)delete moves[partner];write(K.moves,moves);matchCache.signature='';state.selectedDs=p.baseDs;const restored=[basePlan(p.baseDs),partner?basePlan(partner):null].filter(Boolean);queueTredictMutation('plan:workout-moved',restored,{previousDates,reason:'restore'});addLog(`${p.title} er gjenopprettet til opprinnelig dag.`,'manual',before);trackEvent('plan_move_undone');renderAll()}
  function undoVisibleChange(p,kind){
    if(!p)return;
    if(kind==='choice'){
      const before=snapshot(K.dayModes),previousDate=p.ds,all=read(K.dayModes,{});delete all[p.baseDs];write(K.dayModes,all);matchCache.signature='';const restored=planFor(p.baseDs)||basePlan(p.baseDs);queueTredictMutation('plan:workout-adjusted',[restored],{previousDate,reason:'choice-undo'});addLog(`${p.title}: engangsvalget er fjernet.`,'manual',before);toast('Dagen følger planen igjen');renderAll();return;
    }
    if(kind==='adjustment'){
      const previousDate=p.ds,all=read(K.adjustments,{});delete all[p.sourceLabel];write(K.adjustments,all);matchCache.signature='';const restored=planFor(p.baseDs)||basePlan(p.baseDs);queueTredictMutation('plan:workout-adjusted',[restored],{previousDate,reason:'adjustment-undo'});addLog(`${p.title}: synlig planendring er angret.`,'manual');toast('Planendringen er angret');renderAll();return;
    }
    const before=snapshot(K.moves),moves=read(K.moves,{}),partner=Object.keys(moves).find(key=>moves[key]===p.baseDs),previousDates={[p.baseDs]:p.ds};if(partner)previousDates[partner]=planFor(moves[partner])?.ds||moves[partner];delete moves[p.baseDs];if(partner)delete moves[partner];write(K.moves,moves);matchCache.signature='';state.selectedDs=p.baseDs;queueTredictMutation('plan:workout-moved',[basePlan(p.baseDs),partner?basePlan(partner):null].filter(Boolean),{previousDates,reason:'visible-move-undo'});addLog(`${p.title} er flyttet tilbake til opprinnelig dag.`,'manual',before);toast('Flyttingen er angret');renderAll();
  }
  function clearReadinessAdjustment(p){
    if(!p)return false;const all=read(K.adjustments,{});if(all[p.sourceLabel]?.reason!=='readiness-v1022')return false;delete all[p.sourceLabel];write(K.adjustments,all);return true;
  }
  function setFormToday(value){
    const p=planFor(today()),stateValue=['fresh','tired','heavy'].includes(value)?value:'unknown',current=readinessState(),reasons=stateValue==='fresh'?[]:current.reasons,cleared=clearReadinessAdjustment(p);if(cleared)queueTredictMutation('plan:workout-adjusted',[basePlan(p.baseDs)],{previousDate:p.ds,reason:'readiness-reset'});saveReadinessState({state:stateValue,reasons,choice:'pending'});addLog(`Form i dag: ${stateValue==='fresh'?'frisk':stateValue==='tired'?'litt redusert':'klart redusert'}.`,'manual');trackEvent('daily_readiness_changed',{state:stateValue});renderAll();
  }
  function toggleReadinessReason(reason){
    const current=readinessState(),reasons=current.reasons.includes(reason)?current.reasons.filter(x=>x!==reason):[...current.reasons,reason],p=planFor(today()),cleared=clearReadinessAdjustment(p);if(cleared)queueTredictMutation('plan:workout-adjusted',[basePlan(p.baseDs)],{previousDate:p.ds,reason:'readiness-reason-reset'});saveReadinessState({state:current.state==='unknown'?'tired':current.state,reasons,choice:'pending'});trackEvent('daily_readiness_reason_changed',{reason,selected:reasons.includes(reason)});renderAll();
  }
  function acceptReadinessRecommendation(){
    const p=planFor(today()),coach=readinessDecision(p);if(!p||!coach.requiresChoice)return;if(isLocked(p))return toast('Økten er låst. Lås opp før anbefalingen brukes.');
    const before=snapshot(K.adjustments),all=read(K.adjustments,{}),x=coach.proposed;all[p.sourceLabel]={created:new Date().toISOString(),source:'runnerbear-v10.24',reason:'readiness-v1022',type:x.type,title:x.title,desc:x.desc,detail:x.detail,km:Number(x.km||0),shoe:x.shoe||'',fuel:x.fuel||''};write(K.adjustments,all);const changed=basePlan(p.baseDs);queueTredictMutation('plan:workout-adjusted',[changed],{previousDate:p.ds,reason:'daily-readiness'});saveReadinessState({choice:'accepted'});addLog(`${coach.planned.title} er tilpasset etter Form i dag: ${x.title}. Ingen treningsgjeld.`,'manual',before);trackEvent('daily_readiness_recommendation',{choice:'accepted',severity:coach.severity});toast('Coachens anbefaling er brukt');renderAll();
  }
  function keepPlannedWorkout(){
    const p=planFor(today()),coach=readinessDecision(p);if(!p)return;const before=snapshot(K.adjustments),cleared=clearReadinessAdjustment(p);if(cleared)queueTredictMutation('plan:workout-adjusted',[basePlan(p.baseDs)],{previousDate:p.ds,reason:'keep-planned'});saveReadinessState({choice:'keep'});addLog(`${coach.planned?.title||p.title} beholdes etter brukerens valg, med forsiktighetsråd.`,'manual',before);trackEvent('daily_readiness_recommendation',{choice:'keep',severity:coach.severity});toast('Planlagt økt beholdes med margin');renderAll();
  }
  const dragState={baseDs:'',active:false,timer:0,startX:0,startY:0,targetBaseDs:'',suppressClickUntil:0};
  function clearDragVisuals(){qsa('[data-rb1023-drag-base]',document).forEach(row=>row.classList.remove('rb1023-dragging','rb1023-drop-valid','rb1023-drop-target','rb1023-drop-invalid'));document.body.classList.remove('rb1023-drag-active')}
  function markDragTargets(baseDs){
    const rows=swapRows();qsa('[data-rb1023-drag-base]',document).forEach(row=>{const target=row.dataset.rb1023DragBase;if(target===baseDs)return;const result=planIntegrity()?.validateSwap?.({rows,sourceBaseDs:baseDs,targetBaseDs:target,today:today()});row.classList.toggle('rb1023-drop-valid',result?.ok===true);row.classList.toggle('rb1023-drop-invalid',result?.ok!==true)})
  }
  function beginDrag(row,source){
    const p=basePlan(row?.dataset.rb1023DragBase);if(!p||!canDragPlan(p))return false;dragState.baseDs=p.baseDs;dragState.active=true;dragState.targetBaseDs='';row.classList.add('rb1023-dragging');document.body.classList.add('rb1023-drag-active');markDragTargets(p.baseDs);trackEvent('plan_drag_started',{source});try{navigator.vibrate?.(12)}catch{}return true;
  }
  function hoverDragTarget(row){qsa('.rb1023-drop-target',document).forEach(x=>x.classList.remove('rb1023-drop-target'));if(!row?.classList.contains('rb1023-drop-valid')){dragState.targetBaseDs='';return}row.classList.add('rb1023-drop-target');dragState.targetBaseDs=row.dataset.rb1023DragBase}
  function finishDrag(source){
    clearTimeout(dragState.timer);const sourcePlan=basePlan(dragState.baseDs),target=basePlan(dragState.targetBaseDs),active=dragState.active;clearDragVisuals();dragState.active=false;dragState.baseDs='';dragState.targetBaseDs='';if(active&&sourcePlan&&target){dragState.suppressClickUntil=Date.now()+650;swapWorkout(sourcePlan,target.ds,source)}
  }
  function bindDragAndDrop(){
    qsa('[data-rb1023-drag-base]').forEach(row=>{
      row.ondragstart=e=>{if(!beginDrag(row,'desktop'))return e.preventDefault();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',row.dataset.rb1023DragBase)};
      row.ondragover=e=>{if(!dragState.active)return;const result=planIntegrity()?.validateSwap?.({rows:swapRows(),sourceBaseDs:dragState.baseDs,targetBaseDs:row.dataset.rb1023DragBase,today:today()});if(result?.ok){e.preventDefault();e.dataTransfer.dropEffect='move';hoverDragTarget(row)}};
      row.ondragleave=e=>{if(!row.contains(e.relatedTarget))row.classList.remove('rb1023-drop-target')};
      row.ondrop=e=>{e.preventDefault();hoverDragTarget(row);finishDrag('desktop')};
      row.ondragend=()=>{if(dragState.active)finishDrag('desktop-cancel')};
      row.onpointerdown=e=>{if(e.pointerType==='mouse'||e.button!==0)return;dragState.startX=e.clientX;dragState.startY=e.clientY;dragState.baseDs=row.dataset.rb1023DragBase;clearTimeout(dragState.timer);dragState.timer=setTimeout(()=>{if(beginDrag(row,'mobile'))try{row.setPointerCapture(e.pointerId)}catch{}},380)};
      row.onpointermove=e=>{if(!dragState.active){if(Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>9)clearTimeout(dragState.timer);return}e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-rb1023-drag-base]');hoverDragTarget(target)};
      row.onpointerup=e=>{clearTimeout(dragState.timer);if(dragState.active){e.preventDefault();finishDrag('mobile')}};
      row.onpointercancel=()=>{clearTimeout(dragState.timer);if(dragState.active){clearDragVisuals();dragState.active=false;dragState.baseDs='';dragState.targetBaseDs=''}};
    });
  }
  function bind(scope=document){
    const previousScope=eventScope;eventScope=scope||document;
    try{
    qsa('[data-rb107-plan-view]').forEach(b=>b.onclick=()=>{state.planView=b.dataset.rb107PlanView;state.completedId='';state.planDayViewOpen=false;sessionStorage.setItem(K.planView,state.planView);renderAll()});
    qsa('[data-rb119b-plan-lens]').forEach(b=>b.onclick=()=>{state.planLens=b.dataset.rb119bPlanLens;state.planDetailOpen=false;state.planDayViewOpen=false;sessionStorage.setItem(K.planLens,state.planLens);renderAll()});
    qsa('[data-rb107-day]').forEach(b=>b.onclick=()=>{if(Date.now()<dragState.suppressClickUntil)return;const ds=b.dataset.rb107Day;if(!planFor(ds))return;state.selectedDs=ds;state.planDayViewOpen=true;state.planDetailOpen=false;sessionStorage.setItem(K.selected,ds);state.openWeek=planFor(ds).week;state.monthKey=monthKeyFor(ds);state.planView='plan';sessionStorage.setItem(K.planView,'plan');trackEvent('calendar_day_selected',{date:ds,source:'plan'});renderAll()});
    qsa('[data-rb119c-detail-close]').forEach(b=>b.onclick=()=>{state.planDetailOpen=false;renderAll()});
    qsa('[data-rb119c-month-step]').forEach(b=>b.onclick=()=>{const d=monthDate(state.monthKey);d.setMonth(d.getMonth()+Number(b.dataset.rb119cMonthStep));state.monthKey=monthKeyFor(localIso(d));renderAll()});
    qsa('[data-rb119c-calendar-day]').forEach(b=>b.onclick=()=>{const ds=b.dataset.rb119cCalendarDay,p=planFor(ds);if(!p)return;state.selectedDs=ds;state.openWeek=p.week;state.planLens='week';state.planDayViewOpen=true;state.planDetailOpen=false;sessionStorage.setItem(K.selected,ds);sessionStorage.setItem(K.planLens,'week');trackEvent('calendar_day_selected',{date:ds,source:'calendar'});renderAll();requestAnimationFrame(()=>qs('.rb1020-day-view')?.scrollIntoView({block:'start',behavior:'smooth'}))});
    qsa('[data-rb119c-week-start]').forEach(b=>b.onclick=()=>{const ds=b.dataset.rb119cWeekStart,p=planFor(ds);if(!p)return;state.selectedDs=ds;state.openWeek=p.week;state.monthKey=monthKeyFor(ds);state.planLens='week';state.planDayViewOpen=false;state.planDetailOpen=false;sessionStorage.setItem(K.selected,ds);sessionStorage.setItem(K.planLens,'week');renderAll()});
    qsa('[data-rb119c-month-focus]').forEach(b=>b.onclick=()=>$('rb119cMonth')?.focus({preventScroll:false}));
    qsa('[data-rb113-open-next]').forEach(b=>b.onclick=()=>{const ds=b.dataset.rb113OpenNext;if(!planFor(ds))return;state.selectedDs=ds;sessionStorage.setItem(K.selected,ds);state.openWeek=planFor(ds).week;state.planView='plan';sessionStorage.setItem(K.planView,'plan');renderAll();(qs('.bottom-nav .navbtn[data-tab="plan"]')||qs('.desktop-nav .navbtn[data-tab="plan"]'))?.click()});
    qsa('[data-rb116-open-gate]').forEach(b=>b.onclick=()=>{const ds=b.dataset.rb116OpenGate;if(!planFor(ds))return;state.selectedDs=ds;sessionStorage.setItem(K.selected,ds);state.openWeek=planFor(ds).week;state.planView='plan';sessionStorage.setItem(K.planView,'plan');renderAll();(qs('.bottom-nav .navbtn[data-tab="plan"]')||qs('.desktop-nav .navbtn[data-tab="plan"]'))?.click()});
    qsa('[data-rb113-week-step]').forEach(b=>b.onclick=()=>{const weeks=[...new Set(effectiveSchedule().map(p=>p.week))],selected=selectedPlan(),at=weeks.indexOf(selected?.week),next=weeks[clamp(at+Number(b.dataset.rb113WeekStep),0,weeks.length-1)],rows=weekRows(next);if(!rows.length||next===selected?.week)return;const weekday=dateFrom(selected.ds).getDay(),target=rows.find(p=>dateFrom(p.ds).getDay()===weekday)||rows[0];state.selectedDs=target.ds;state.openWeek=next;state.monthKey=monthKeyFor(target.ds);state.planDetailOpen=false;sessionStorage.setItem(K.selected,target.ds);renderAll()});
    qsa('[data-rb109-open-completed]').forEach(b=>b.onclick=()=>{state.doneScroll=window.scrollY;state.planView='done';sessionStorage.setItem(K.planView,'done');state.completedId=b.dataset.rb109OpenCompleted;trackEvent('workout_history_opened',{activityId:state.completedId});renderAll();window.scrollTo({top:0,behavior:'auto'})});
    qsa('[data-rb108-completed]').forEach(b=>b.onclick=()=>{state.doneScroll=window.scrollY;state.completedId=b.dataset.rb108Completed;trackEvent('workout_history_opened',{activityId:state.completedId});renderAll();window.scrollTo({top:0,behavior:'auto'})});
    qsa('[data-rb108-completed-back]').forEach(b=>b.onclick=()=>{const y=state.doneScroll;state.completedId='';renderAll();requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'}))});
    qsa('[data-rb108-unmatch]').forEach(b=>b.onclick=()=>{const p=basePlan(b.dataset.rb108Unmatch),m=matchFor(p)||replacementFor(p);if(!p||!m)return;const excluded=read(K.exclusions,{});excluded[p.baseDs]=m.activity.id;write(K.exclusions,excluded);localStorage.removeItem(K.match+p.ds);if(p.baseDs!==p.ds)localStorage.removeItem(K.match+p.baseDs);matchCache={signature:'',map:new Map(),replacements:new Map(),used:new Set()};state.completedId='';toast('Koblingen er åpnet for ny vurdering');renderAll()});
    qsa('[data-rb108-match-id]').forEach(b=>b.onclick=()=>{const p=basePlan(b.dataset.baseDs),a=activities().find(x=>x.id===b.dataset.rb108MatchId);if(!p||!a)return;const excluded=read(K.exclusions,{});delete excluded[p.baseDs];write(K.exclusions,excluded);write(K.match+p.ds,{activityId:a.id,activity:a,planned:{date:p.ds,type:p.type,title:p.title,km:Number(p.km||0),label:p.sourceLabel,source:'runnerbear-v10.24'},automatic:false,matchedAt:new Date().toISOString(),matcher:'manual'});matchCache={signature:'',map:new Map(),replacements:new Map(),used:new Set()};toast('Aktiviteten er koblet til planen');renderAll()});
    qsa('[data-rb107-week]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.rb107Week);state.openWeek=state.openWeek===n?0:n;renderAll()});
    qsa('[data-rb107-choice]').forEach(b=>b.onclick=()=>setChoice(basePlan(b.dataset.baseDs),b.dataset.rb107Choice));
    qsa('[data-rb107-lock]').forEach(b=>b.onclick=()=>toggleLock(basePlan(b.dataset.rb107Lock)));
    qsa('[data-rb107-move-toggle]').forEach(b=>b.onclick=()=>{state.moveOpen=!state.moveOpen;renderAll()});
    qsa('[data-rb107-move]').forEach(b=>b.onclick=()=>moveWorkout(basePlan(b.dataset.baseDs),Number(b.dataset.rb107Move)));
    qsa('[data-rb107-move-to]').forEach(b=>b.onclick=()=>swapWorkout(basePlan(b.dataset.baseDs),b.dataset.rb107MoveTo,'fallback'));
    qsa('[data-rb107-restore]').forEach(b=>b.onclick=()=>restoreMove(basePlan(b.dataset.rb107Restore)));
    qsa('[data-rb107-toggle-adapt]').forEach(b=>b.onclick=()=>{state.adaptOpen=!state.adaptOpen;renderAll()});
    qsa('[data-rb107-adapt]').forEach(b=>b.onclick=()=>b.dataset.rb107Adapt==='tired'?setFormToday('tired'):adapt(basePlan(b.dataset.baseDs),b.dataset.rb107Adapt));
    qsa('[data-rb1022-form]').forEach(b=>b.onclick=()=>setFormToday(b.dataset.rb1022Form));
    qsa('[data-rb1022-reason]').forEach(b=>b.onclick=()=>toggleReadinessReason(b.dataset.rb1022Reason));
    qsa('[data-rb1022-accept]').forEach(b=>b.onclick=acceptReadinessRecommendation);
    qsa('[data-rb1022-keep]').forEach(b=>b.onclick=keepPlannedWorkout);
    qsa('[data-rb1023-garmin-retry]').forEach(b=>b.onclick=async()=>{b.disabled=true;tredictSync()?.retry?.(b.dataset.rb1023GarminRetry||'');try{await tredictSync()?.flush?.();toast(tredictSync()?.available?.()?'Tredict-synk er startet':'Tredict-transporten er fortsatt utilgjengelig. Endringen ligger trygt i køen.')}finally{renderAll()}});
    qsa('[data-rb1020-workout-open],[data-rb1020-day-workout]').forEach(b=>b.onclick=()=>{state.workoutDetailDs=b.dataset.rb1020WorkoutOpen||b.dataset.rb1020DayWorkout||today();state.workoutDetailOpen=true;trackEvent('today_workout_opened',{date:state.workoutDetailDs});renderAll();requestAnimationFrame(()=>qs('.rb1020-workout-sheet [data-rb1020-modal-close]')?.focus())});
    qsa('[data-rb107-open-why]').forEach(b=>b.onclick=()=>{state.coachReasonOpen=true;trackEvent('coach_reason_opened');renderAll();requestAnimationFrame(()=>qs('.rb1020-reason-sheet [data-rb1020-modal-close]')?.focus())});
    qsa('[data-rb1020-intensity-explain]').forEach(b=>b.onclick=()=>{state.intensityExplanationOpen=true;trackEvent('intensity_explanation_opened');renderAll();requestAnimationFrame(()=>qs('.rb1020-intensity-sheet [data-rb1020-modal-close]')?.focus())});
    qsa('[data-rb1020-modal-close]').forEach(b=>b.onclick=()=>{const kind=b.dataset.rb1020ModalClose;if(kind==='workout')state.workoutDetailOpen=false;if(kind==='coach')state.coachReasonOpen=false;if(kind==='intensity')state.intensityExplanationOpen=false;renderAll()});
    qsa('[data-rb1020-modal-backdrop]').forEach(el=>el.onclick=e=>{if(e.target!==el)return;const kind=el.dataset.rb1020ModalBackdrop;if(kind==='workout')state.workoutDetailOpen=false;if(kind==='coach')state.coachReasonOpen=false;if(kind==='intensity')state.intensityExplanationOpen=false;renderAll()});
    qsa('[data-rb1020-day-close]').forEach(b=>b.onclick=()=>{state.planDayViewOpen=false;trackEvent('calendar_day_closed',{date:state.selectedDs});renderAll()});
    qsa('[data-rb107-control]').forEach(b=>b.onclick=()=>{const before=snapshot(K.control);localStorage.setItem(K.control,b.dataset.rb107Control);addLog(`Coachnivå endret til ${b.textContent.trim()}.`,'manual',before);toast('Coachnivået er oppdatert');setTimeout(()=>{runAutopilot();renderAll()},0)});
    qsa('[data-rb118-preferences-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();saveTrainingPreferences(form)});
    qsa('[data-rb108-shoe-toggle]').forEach(b=>b.onclick=()=>{const rows=shoesState(),shoe=rows.find(x=>x.id===b.dataset.rb108ShoeToggle);if(!shoe)return;shoe.active=shoe.active===false;shoe.updated=new Date().toISOString();write(K.shoes,rows);toast(shoe.active?'Skoen er aktiv igjen':'Skoen er pensjonert');renderAll()});
    qsa('[data-rb108-shoe-form]').forEach(form=>{const input=qs('[name="name"]',form),preview=qs('[data-rb108-shoe-preview]',form);input.oninput=()=>{const x=classifyShoe(input.value.trim());preview.textContent=`Forslag: ${x.role} · ${x.surface} · ${x.plate} · ${x.confidence.toLowerCase()} sikkerhet.`};form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form),name=String(fd.get('name')||'').trim();if(!name)return;const rows=shoesState();if(rows.some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast('Skoen finnes allerede');const auto=classifyShoe(name),role=String(fd.get('role')||'')||auto.role,surface=String(fd.get('surface')||'')||auto.surface;rows.push({id:shoeSlug(name),name,role,surface,plate:auto.plate,confidence:auto.confidence,active:true,created:new Date().toISOString()});write(K.shoes,rows);toast('Skoen er lagt til og klassifisert');renderAll()}});
    qsa('[data-rb109-goal-open]').forEach(b=>b.onclick=()=>{state.goalManagerOpen=true;state.goalEditor='';renderAll()});
    qsa('[data-rb109-goal-close]').forEach(b=>b.onclick=()=>{state.goalManagerOpen=false;state.goalEditor='';renderAll()});
    qsa('.rb109-modal').forEach(el=>el.onclick=e=>{if(e.target!==el)return;state.goalManagerOpen=false;state.goalEditor='';renderAll()});
    qsa('[data-rb109-goal-editor]').forEach(b=>b.onclick=()=>{state.goalManagerOpen=true;state.goalEditor=b.dataset.rb109GoalEditor;renderAll()});
    qsa('[data-rb109-base-mode]').forEach(b=>b.onclick=enterBaseMode);
    qsa('[data-rb109-cancel-goal]').forEach(b=>b.onclick=cancelPrimary);
    qsa('[data-rb109-primary-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();setPrimaryGoal(form)});
    qsa('[data-rb109-secondary-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();addSecondaryGoal(form)});
    qsa('[data-rb109-complete-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();completePrimary(form)});
    qsa('[data-rb109-remove-secondary]').forEach(b=>b.onclick=()=>{const g=goalState(),race=g.secondary.find(x=>x.id===b.dataset.rb109RemoveSecondary);g.secondary=g.secondary.filter(x=>x.id!==b.dataset.rb109RemoveSecondary);saveGoalState(g);if(race)addLog(`B-løp fjernet: ${race.name}.`,'manual');toast('B-løpet er fjernet');renderAll()});
    qsa('[data-rb107-undo]').forEach(b=>b.onclick=()=>undoEntry(b.dataset.rb107Undo));
    qsa('[data-rb117-undo-change]').forEach(b=>b.onclick=()=>undoVisibleChange(basePlan(b.dataset.rb117UndoChange),b.dataset.rb117ChangeKind));
    qsa('[data-rb108-publish-plan]').forEach(b=>b.onclick=async()=>{const queue=tredictPlanQueue();if(!queue.length)return toast('Ingen kommende løpeøkter å publisere');const saved=window.RunnerBearCloud?.cachedOutbound?.()||{},signature=window.RunnerBearTredictOutbound?.signature?.(queue)||'',samePlan=saved.clientSignature===signature,isCurrent=['published','awaiting-calendar-activation','calendar-active'].includes(saved.status)&&samePlan,repairable=saved.status==='review-required'&&samePlan,shouldVerify=isCurrent||repairable;b.disabled=true;b.textContent=shouldVerify?'Kontrollerer kalenderen…':'Kontrollerer planen…';try{if(shouldVerify){const result=await window.RunnerBearCloud?.verifyOutbound?.();toast(result?.active?'Tredict-kalenderen er komplett':'Planen må fortsatt aktiveres eller kontrolleres i Tredict-kalenderen')}else{await window.RunnerBearCloud?.previewOutbound?.(queue);b.textContent='Publiserer til Tredict…';const result=await window.RunnerBearCloud?.publishOutbound?.(queue);toast(result?.idempotent?'Planen finnes allerede i Tredict':'RunnerBear-planen er opprettet i Tredict')}renderAll()}catch(error){toast(error?.message||'Tredict-kontrollen feilet')}finally{b.disabled=false}});
    qsa('[data-rb107-sync]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Synkroniserer…';try{await window.RunnerBearBridge?.sync?.(true);toast('Garmin-data er oppdatert')}catch{toast('Synkronisering feilet – prøv igjen')}finally{renderAll()}});
    bindDragAndDrop();
    }finally{eventScope=previousScope}
  }
  function openPlanOnToday(shouldRender=true){if(state.planView==='plan'){state.selectedDs=planFor(today())?.ds||state.selectedDs;state.monthKey=monthKeyFor(state.selectedDs||today());state.planDetailOpen=false;state.planDayViewOpen=false;sessionStorage.setItem(K.selected,state.selectedDs)}state.moveOpen=false;if(shouldRender)renderPlan()}
  function init(){
    mark('runnerbear:init:start');
    if(!engine()||!clarityModel()||!planIntegrity()){
      console.error(JSON.stringify({event:'runnerbear_fatal_init',build:'10.24',reason:'canonical core unavailable'}));
      const boot=qs('#rb108Boot div');if(boot)boot.innerHTML='<b>RunnerBear kunne ikke starte</b><span>Last siden på nytt. Ingen treningsdata er endret.</span>';
      return;
    }
    migrateDocumentedThreshold();migrateTrainingPreferences();tredictSync()?.init?.();runAutopilot();decorateNav();decorateBrand();renderToday();
    document.addEventListener('click',e=>{const nav=e.target.closest('.navbtn[data-tab]');if(nav){e.preventDefault();switchView(nav.dataset.tab)}},true);
    document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(state.goalManagerOpen||state.workoutDetailOpen||state.coachReasonOpen||state.intensityExplanationOpen){state.goalManagerOpen=false;state.goalEditor='';state.workoutDetailOpen=false;state.coachReasonOpen=false;state.intensityExplanationOpen=false;renderAll()}});
    let storageFrame=0;
    window.addEventListener('storage',e=>{if(e.key&&!/^(runnerbear_|runfest26_|rb)/i.test(e.key))return;if(e.key)readCache.delete(e.key);moreRenderDirty=true;cancelAnimationFrame(storageFrame);storageFrame=requestAnimationFrame(renderAll)});
    window.addEventListener('runnerbear:state-dirty',()=>{moreRenderDirty=true});
    mark('runnerbear:first-render');measure('runnerbear:startup','runnerbear:init:start');
  }
  setTimeout(()=>{
    if(document.documentElement.classList.contains('rb107-ready'))return;
    const boot=qs('#rb108Boot div');
    if(boot)boot.innerHTML='<b>RunnerBear bruker lengre tid enn ventet</b><span>Last siden på nytt. Den gamle visningen vises ikke mens dataene er uavklarte.</span>';
  },10000);
  window.RunnerBearCoachOS={version:'10.24',effectiveSchedule,planFor,forecast,thresholdEvidence,matches:allMatches,analysisFor,sessionAssessment,sessionState,replacementFor,workoutStructure,garminQueue,tredictPlanQueue,goalState,trainingPreferences,intensityProfile,intensityDistribution:intensityDistributionModel,coachBasis,heroBank:HERO_BANK,render:renderAll,renderView,renderToday,renderPlan,renderGoals,renderMore,switchView,metrics:runtimeStats,moveWorkout,swapWorkout,toggleLock,setChoice,adapt,tredictSync:tredictSync()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
