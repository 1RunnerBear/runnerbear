/* RunnerBear v10.9 · result-first coach and goal lifecycle
   Garmin stays the detailed training record. RunnerBear turns the available
   training, recovery and Concept2 signals into a calm next decision. */
(function(){
  'use strict';

  const K={
    cache:'runnerbear_tredict_cache_v1',match:'runnerbear_tredict_match_',adjustments:'runfest26_week_adjustments',
    moves:'runnerbear_v107_plan_moves',locks:'runnerbear_v107_plan_locks',control:'runnerbear_v107_coach_control',
    log:'runnerbear_v107_coach_log',seen:'runnerbear_v107_seen_actions',planView:'runnerbear_v107_plan_view',selected:'runnerbear_v108_selected_day',exclusions:'runnerbear_v108_match_exclusions',shoes:'runnerbear_v108_shoes',goals:'runnerbear_v109_goals'
  };
  const $=id=>document.getElementById(id),qs=(s,r=document)=>r?.querySelector?.(s)||null,qsa=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
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
  const policy=()=>engine()?.policy?.()||{profile:{baseKm:50,maxKm:55,minRunDays:5,flexibleSessions:2,thresholdHr:173,maxHr:188},anchorKm:50,normalRange:[48,52]};
  const control=()=>localStorage.getItem(K.control)||'autopilot';
  const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const DISTANCES={five:{label:'5 km',short:'5K'},ten:{label:'10 km',short:'10K'},half:{label:'Halvmaraton',short:'21K'},marathon:{label:'Maraton',short:'42K'}};
  const DEFAULT_GOAL={id:'runfest-2026',name:'Runfest Sandnes 21K',date:'2026-10-03',distance:'half',targetSeconds:4980,aspirationSeconds:4800,status:'active',created:'2026-08-10T00:00:00.000Z'};

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
      today:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3"/><circle cx="12" cy="12" r="4"/>',
      plan:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
      goal:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      check:'<path d="m7 12 3 3 7-7"/>',
      info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
      lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      move:'<path d="m8 7-4 4 4 4M4 11h11a5 5 0 0 1 5 5"/>',
      swap:'<path d="m7 7 3-3 3 3M10 4v12m7 1-3 3-3-3m3 3V8"/>',
      run:'<circle cx="13" cy="4" r="2"/><path d="m10 9 3-2 2 3 3 1m-8-2-2 5-4 2m8-4-2 4-1 5m5-7 3 5"/>',
      row:'<circle cx="8" cy="5" r="2"/><path d="m6 9 4 2 3 5m-7-7-2 6m0 3h14M14 7l5 7"/>',
      bike:'<circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/><path d="m6 17 4-8 4 8m-7-4h9l-3-6h3"/>',
      sync:'<path d="M20 7h-5V2M4 17h5v5"/><path d="M18 5a8 8 0 0 0-13 3m1 11a8 8 0 0 0 13-3"/>'
    };
    return `<svg class="rb107-icon" viewBox="0 0 24 24" aria-hidden="true">${p[n]||p.info}</svg>`;
  };

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
    const moves=read(K.moves,{}),adjustments=read(K.adjustments,{});
    const rows=rawSchedule().map(p=>{
      const a=adjustments[p.label]||{},ds=moves[p.ds]||p.ds;
      return {...p,...a,baseDs:p.ds,sourceLabel:p.label,ds,date:dateFrom(ds),label:formatDate(ds,{weekday:'short',day:'numeric',month:'short'}).replace('.','')};
    });
    return applyGoalRaces(rows).sort((a,b)=>a.ds.localeCompare(b.ds));
  }
  function planFor(ds){return effectiveSchedule().find(p=>p.ds===ds)||null}
  function basePlan(baseDs){return effectiveSchedule().find(p=>p.baseDs===baseDs)||null}
  function flexible(p){return!!p&&(p.type==='cross'||(p.type==='rest'&&/zwift|concept2|roing|sykkel/i.test(`${p.title} ${p.desc} ${p.detail}`)))}
  function choiceKey(p){return`runfest26_easychoice_${String(p?.sourceLabel||p?.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`}
  function choiceFor(p){
    const saved=localStorage.getItem(choiceKey(p));if(saved)return saved;
    const text=`${p?.title||''} ${p?.desc||''}`;return /concept2|roing/i.test(text)?'row':/zwift|sykkel/i.test(text)?'bike':'rest';
  }
  function prescription(p){
    if(!flexible(p))return p;
    const mode=choiceFor(p),base={...p,mode};
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
    const x=prescription(p),text=`${x.detail||''} ${x.desc||''}`;
    const pace=text.match(/(\d:\d{2})\s*[–-]\s*(\d:\d{2})\s*\/\s*km/i),hr=text.match(/(?:puls|HR)[^0-9]{0,30}(\d{3})\s*[–-]\s*(\d{3})/i);
    const duration=text.match(/(\d+)\s*(?:–|-)?\s*(\d+)?\s*min/i);
    return{
      work:x.km?(x.type==='quality'?`ca. ${Math.max(1,roundHalf(x.km-1))}–${roundHalf(x.km+1)} km`:`${String(roundHalf(x.km)).replace('.0','')} km`):duration?`${duration[1]}${duration[2]?`–${duration[2]}`:''} min`:x.type==='rest'?'Hvile':'Se detalj',
      pace:pace?`${pace[1]}–${pace[2]}/km`:x.type==='easy'?'rolig':x.type==='quality'?'kontrollert':'lett',
      hr:hr?`${hr[1]}–${hr[2]} bpm`:x.type==='easy'?'130–148 bpm':x.type==='quality'?'under terskel':'lav kostnad'
    };
  }
  function workoutStructure(p){
    const x=prescription(p);if(!x||!['quality','race'].includes(x.type))return null;
    return{
      warmup:'10–15 min rolig. Fortsett ved behov og trykk rundetasten når du er klar.',
      activation:'Valgfritt: 2–4 korte, kontrollerte stigninger. Full kontroll – ikke sprint.',
      main:`${x.title}. ${x.desc||''} ${x.detail||''}`.trim(),
      cooldown:'10–15 min svært rolig. Avslutt med rundetasten når det passer.',
      estimate:x.km?`ca. ${Math.max(1,roundHalf(x.km-1))}–${roundHalf(x.km+1)} km totalt`:'fleksibel total',
      garmin:'Åpen oppvarming → hovedserie → åpen nedjogg'
    };
  }
  function workoutStructureHtml(p){
    const s=workoutStructure(p);if(!s)return'';
    return `<div class="rb108-structure"><div class="rb108-structure-head"><span>Garmin-klar øktstruktur</span><strong>${esc(s.estimate)}</strong></div><ol><li><b>Oppvarming</b><span>${esc(s.warmup)}</span></li><li><b>Aktivering · valgfritt</b><span>${esc(s.activation)}</span></li><li><b>Hoveddel</b><span>${esc(s.main)}</span></li><li><b>Nedjogg</b><span>${esc(s.cooldown)}</span></li></ol><small>${esc(s.garmin)}. RunnerBear kan publisere strukturen via Tredict til Garmin-kalenderen.</small></div>`;
  }
  function garminWorkout(p){
    const x=prescription(p);if(!x||!['easy','quality','race'].includes(x.type)||Number(x.km||0)<=0)return null;const target=targetFor(p);
    return{externalId:`runnerbear-${p.baseDs}-${shoeSlug(p.title)}`,date:p.ds,title:x.title,type:x.type,km:Number(x.km||p.km||0),desc:x.desc||'',detail:x.detail||'',purpose:purposeFor(x),target:`${target.pace||''} ${target.hr||''}`.trim()};
  }
  function garminQueue(days=7){return effectiveSchedule().filter(p=>p.ds>=today()&&p.ds<=addDays(today(),days)&&!isDone(p)).map(garminWorkout).filter(Boolean)}
  function tredictPlanQueue(){return effectiveSchedule().filter(p=>p.ds>=today()&&!isDone(p)).map(garminWorkout).filter(Boolean)}
  function feedbackKey(p){return`runfest26_fb_${String(p?.sourceLabel||p?.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`}
  function feedbackFor(p){return read(feedbackKey(p),{})}
  function normalizeActivity(a){
    const s=a?.summary||a?.extendedSummary||{};
    return{id:String(a?.id||a?._id||''),date:a?.date||'',ds:a?.ds||localIso(a?.date),sportType:String(a?.sportType||'').toLowerCase(),subSportType:String(a?.subSportType||'').toLowerCase(),title:a?.title||s.title||'',duration:Number(a?.duration??s.duration??s.durationTotal)||0,distance:Number(a?.distance??s.distance)||0,pace:Number(a?.pace??s.pace)||0,heartrate:Number(a?.heartrate??s.heartrate)||0,heartrateMax:Number(a?.heartrateMax??s.heartrateMax)||0,power:Number(a?.power??s.power)||0,cadence:Number(a?.cadence??s.cadence)||0,ascent:Number(a?.ascent??s.ascent??s?.altitude?.ascent)||0,temperature:Number(a?.temperature??s.temperature)||0,detail:a?.detail||null,raw:a};
  }
  function activities(){
    const rows=read(K.cache,{}).activities;
    return(Array.isArray(rows)&&rows.length?rows:(engine()?.activities?.()||[])).map(normalizeActivity).filter(a=>a.id&&a.ds);
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
  function activityScore(p,a){
    const dd=Math.abs(dayDiff(a.ds,p.ds));if(dd>1)return-Infinity;
    const kind=sportKind(a,p),runPlan=['easy','quality','race'].includes(p.type),allowed=runPlan?kind==='run':flexible(p)?['run','row','bike'].includes(kind):p.type==='rest'?false:true;
    let score=dd===0?48:12;score+=allowed?28:-45;
    if(!allowed)return score;
    const plannedKm=Number(p.km||0),actualKm=a.distance/1000;
    if(plannedKm&&actualKm){const ratio=actualKm/plannedKm;score+=Math.max(-12,24-Math.abs(1-ratio)*48);if(/langtur/i.test(p.title)&&ratio>=.7&&ratio<=1.3)score+=8}
    if(p.type==='quality'&&a.heartrate>=145)score+=7;
    if(flexible(p)&&sportKind(a,p)===choiceFor(p))score+=8;
    if(flexible(p)&&kind==='row'&&a.duration>=1500)score+=6;
    return score;
  }
  function manualCandidates(p){return activities().filter(a=>a.ds===p?.ds).map(a=>({a,score:activityScore(p,a)})).filter(x=>x.score>20).sort((a,b)=>b.score-a.score).slice(0,2)}
  function matchPickerHtml(p){
    if(!p||matchFor(p))return'';const candidates=manualCandidates(p);if(!candidates.length)return'';
    return `<div class="rb108-candidates"><span>Aktivitet funnet · velg kobling</span>${candidates.map(({a})=>`<button data-rb108-match-id="${esc(a.id)}" data-base-ds="${esc(p.baseDs)}"><b>${esc(a.title||sportLabel(a,p))}</b><small>${fmtTime(a.duration)}${a.distance?` · ${(a.distance/1000).toFixed(1).replace('.',',')} km`:''}</small></button>`).join('')}</div>`;
  }
  function matchStatus(p,a){
    const kind=sportKind(a,p),plannedKm=Number(p.km||0),actualKm=a.distance/1000,ratio=plannedKm&&actualKm?actualKm/plannedKm:1,analysis=a.detail?.analysis,expected=expectedIntervals(p),blocks=analysis?.workBlocks?.length||0;
    if(flexible(p)&&['run','row','bike'].includes(kind))return{code:'alternative',label:`Erstattet av ${kind==='row'?'Concept2':kind==='bike'?'Zwift':'rolig jogg'}`};
    if(p.type==='quality'&&expected&&blocks&&analysis?.confidence==='high'&&blocks<expected)return{code:'partial',label:'Delvis gjennomført'};
    if(p.type==='quality'&&ratio<.58)return{code:'partial',label:'Delvis gjennomført'};
    if((ratio<.9||ratio>1.1)&&plannedKm)return{code:'deviation',label:'Gjennomført med avvik'};
    return{code:'planned',label:'Gjennomført som planlagt'};
  }
  let matchCache={signature:'',map:new Map(),used:new Set()};
  function allMatches(){
    const acts=activities(),plans=effectiveSchedule(),signature=`${acts.map(a=>`${a.id}:${a.ds}:${a.distance}:${a.duration}:${a.heartrate}:${a.detail?.analysis?.confidence||''}:${a.detail?.analysis?.workBlocks?.length||0}`).join('|')}#${plans.map(p=>`${p.baseDs}:${p.ds}:${p.type}:${p.title}:${p.km}:${p.bRace?.id||''}:${choiceFor(p)}`).join('|')}`;
    if(matchCache.signature===signature)return matchCache;
    const map=new Map(),used=new Set(),excluded=read(K.exclusions,{});
    plans.forEach(p=>{for(const ds of [p.ds,p.baseDs]){const saved=read(K.match+ds,null),id=String(saved?.activityId||saved?.activity?.id||'');const a=acts.find(x=>x.id===id);if(a&&!used.has(a.id)&&excluded[p.baseDs]!==a.id){const status=matchStatus(p,a);map.set(p.baseDs,{activity:a,score:100,confidence:'high',status,automatic:!!saved?.automatic,saved:true});used.add(a.id);break}}});
    plans.forEach(p=>{if(map.has(p.baseDs))return;const ranked=acts.filter(a=>!used.has(a.id)&&excluded[p.baseDs]!==a.id).map(a=>({a,score:activityScore(p,a)})).filter(x=>x.score>=58).sort((a,b)=>b.score-a.score);if(!ranked.length)return;const best=ranked[0],margin=best.score-(ranked[1]?.score??0),confidence=best.score>=82&&margin>=8?'high':best.score>=68&&margin>=5?'likely':'unclear';if(confidence==='unclear')return;const status=matchStatus(p,best.a);map.set(p.baseDs,{activity:best.a,score:best.score,confidence,status,automatic:true,saved:false});used.add(best.a.id);if(confidence==='high'&&best.a.ds===p.ds){write(K.match+p.ds,{activityId:best.a.id,activity:best.a,planned:{date:p.ds,type:p.type,title:p.title,km:Number(p.km||0),label:p.sourceLabel,source:'runnerbear-v10.9'},automatic:true,matchedAt:new Date().toISOString(),matcher:'runnerbear-v10.9-intent'})}});
    matchCache={signature,map,used};return matchCache;
  }
  function matchFor(p){return p?allMatches().map.get(p.baseDs)||null:null}
  function activityFor(p){return matchFor(p)?.activity||null}
  function isDone(p){return!!matchFor(p)}
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
    if(!a)return[];const work=a.detail?.analysis||{},blocks=Array.isArray(work.workBlocks)?work.workBlocks:[],kind=sportKind(a,p);
    if(p?.type==='quality'&&blocks.length){
      const drift=Math.round(Number(work.hrDrift)||0),fade=Math.round(Number(work.paceFade)||0);
      return[
        ['Arbeidsdel',work.workDuration?fmtTime(work.workDuration):`${blocks.length} blokker`],
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
    const match=matchFor(p),status=match?.status||{code:'extra',label:'Ekstra aktivitet'},kind=sportKind(a,p),plannedKm=Number(p?.km||0),actualKm=a.distance/1000,ratio=plannedKm&&actualKm?actualKm/plannedKm:1,max=Number(policy().profile.maxHr||188),pct=a.heartrate?Math.round(a.heartrate/max*100):0,work=a.detail?.analysis||{},blocks=Array.isArray(work.workBlocks)?work.workBlocks:[];
    let tone='green',headline=status.label,review=reviewFor(p,a),consequence='Planen står. Ingen endring er nødvendig.';
    if(status.code==='partial'){tone='yellow';headline='Delvis gjennomført';review='Økten er godkjent som delvis gjennomført. Det som mangler skal ikke tas igjen senere.';consequence='Belastningen registreres som lavere enn planlagt. Neste økt beholdes.'}
    if(status.code==='deviation'&&ratio>1.18){tone='yellow';review=`Økten ble ${Math.round((ratio-1)*100)} % lengre enn planlagt. Hensikten kan fortsatt være truffet, men den ekstra belastningen teller.`;consequence='Neste kvalitetsøkt beholdes foreløpig, men starter konservativt.'}
    if(p?.type==='easy'&&pct>76){tone='yellow';headline='Rolig økt · høyere kostnad';review=`Snittpulsen var ${pct} % av makspuls. Det er høyere enn ønsket for en ren rolig dag.`;consequence='Planen står, men uten bonusfart eller ekstra volum.'}
    if(p?.type==='quality'&&blocks.length){
      const expected=expectedIntervals(p),hr=Math.round(work.workHr||0),drift=Math.round(work.hrDrift||0),pace=Math.round(work.workPace||0);
      if((expected&&blocks.length<Math.ceil(expected*.7))||hr>Number(policy().profile.thresholdHr||173)+1||drift>12)tone='yellow';
      const blockCopy=expected&&blocks.length===expected?`${blocks.length} arbeidsdrag identifisert`:expected&&blocks.length>expected?`arbeidsdelen identifisert i ${blocks.length} blokker`:`${blocks.length}${expected?` av omtrent ${expected}`:''} arbeidsblokker identifisert`;
      review=`${blockCopy} · ${fmtPace(pace)}/km ved ${hr||'–'} bpm${drift?` · pulsutvikling ${drift>0?'+':''}${drift} bpm`:''}. ${tone==='green'?'Arbeidsdelen ser kontrollert og repeterbar ut.':'Arbeidsdelen kostet mer eller ble kortere enn planlagt.'}`;
      consequence=tone==='green'?'Planen står. Økten støtter videre kontrollert terskelarbeid.':'Neste kvalitetsøkt beholdes, men RunnerBear legger ikke på fart eller volum.';
    }
    if(flexible(p)&&kind==='row'&&pct&&pct<=72){headline='Aerob økt · riktig erstattet';review=`Concept2-økten traff lav aerob belastning (${pct} % av makspuls${a.power?` · ${Math.round(a.power)} W`:''}). Løp og Zwift regnes som avsluttede alternativer for dagen.`;consequence='Dagens økt er komplett. Ingen joggetur skal tas igjen.'}
    const comparable=activities().filter(x=>x.id!==a.id&&x.ds<a.ds&&sportKind(x,p)===kind&&Math.abs(dayDiff(a.ds,x.ds))<=120).slice(0,8),reference=comparable.length?comparable.reduce((sum,x)=>sum+(x.heartrate||0),0)/comparable.filter(x=>x.heartrate).length:0;
    const comparison=reference&&a.heartrate?`Snittpulsen er ${Math.abs(Math.round(a.heartrate-reference))} bpm ${a.heartrate<=reference?'lavere':'høyere'} enn snittet i ${comparable.length} nylige, sammenlignbare ${kind==='run'?'løpeøkter':'økter'}.`:'Sammenligningsgrunnlaget bygges etter hvert som flere like økter får detaljdata.';
    const basis=`Basert på Garmin/Tredict, ${match?.confidence==='high'?'sikker':'sannsynlig'} planmatch${blocks.length?`, ${blocks.length} identifiserte arbeidsblokker`:''} og siste 30 dagers belastning.`;
    return{tone,headline,review,consequence,comparison,basis,status,blocks,work,ratio,pct,kind};
  }
  function verdictFor(p,a,x=analysisFor(p,a)){
    if(x.tone==='yellow')return{overline:'Gjennomført · coachvurdert',title:x.status.code==='partial'?'Godkjent som delvis økt':'Gjennomført med margin',badge:'Med margin'};
    if(flexible(p))return{overline:'Aerob støtte · fullført',title:x.kind==='row'?'Concept2 traff hensikten':x.kind==='bike'?'Zwift traff hensikten':'Rolig løp traff hensikten',badge:'Fullført'};
    if(p?.type==='quality')return{overline:'Kontrollert kvalitet · fullført',title:'Fulltreff på hensikten',badge:'Fulltreff'};
    if(/langtur/i.test(String(p?.title||'')))return{overline:'Langtur · fullført',title:'Aerob jobb gjennomført',badge:'Planen står'};
    if(p?.type==='easy')return{overline:'Rolig løp · fullført',title:'Rolig betyr rolig',badge:'God kontroll'};
    return{overline:'Dagens økt · fullført',title:x.headline||'Økten er registrert',badge:'Fullført'};
  }
  function comparisonHtml(p,a){
    const t=targetFor(p),w=a.detail?.analysis||{},plannedKm=Number(p?.km||0),actualKm=a.distance/1000,actualPace=w.workPace?`${fmtPace(w.workPace)}/km`:a.duration&&actualKm?`${fmtPace(a.duration/actualKm)}/km`:'–',actualHr=w.workHr?`${Math.round(w.workHr)} bpm`:a.heartrate?`${Math.round(a.heartrate)} bpm`:'–';
    const rows=[['Arbeid',t.work,plannedKm&&actualKm?`${actualKm.toFixed(1).replace('.',',')} km`:w.workDuration?fmtTime(w.workDuration):fmtTime(a.duration)],['Fart / styring',t.pace,actualPace],['Puls',t.hr,actualHr]];
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
    if(entry.undo.kind==='remove-adjustment'){
      const all=read(K.adjustments,{});delete all[entry.undo.label];write(K.adjustments,all);
    }else{
      const {key,had,value}=entry.undo;if(had)localStorage.setItem(key,value);else localStorage.removeItem(key);
    }
    entry.message=`Angret: ${entry.message}`;delete entry.undo;write(K.log,rows);toast('Endringen er angret');renderAll();
  }
  function snapshot(key){return{key,had:localStorage.getItem(key)!==null,value:localStorage.getItem(key)||''}}
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
  function moveWorkout(p,delta){
    if(!p||p.ds<today())return toast('Gjennomførte eller tidligere dager flyttes ikke.');
    const target=addDays(p.ds,delta),other=planFor(target);if(!other||other.week!==p.week)return toast('Økten kan bare flyttes innenfor samme uke.');
    if(isLocked(p)||isLocked(other))return toast('En av øktene er låst. Lås opp før du flytter.');
    if(isDone(p)||isDone(other))return toast('En utført økt kan ikke byttes.');
    const before=snapshot(K.moves),moves=read(K.moves,{}),pOld=p.ds,oOld=other.ds;
    moves[p.baseDs]=oOld;moves[other.baseDs]=pOld;
    if(moves[p.baseDs]===p.baseDs)delete moves[p.baseDs];if(moves[other.baseDs]===other.baseDs)delete moves[other.baseDs];
    const hypothetical=rawSchedule().map(x=>({type:x.type,ds:moves[x.ds]||x.ds})).filter(x=>x.type==='quality'||x.type==='race').sort((a,b)=>a.ds.localeCompare(b.ds));
    if(hypothetical.some((x,i)=>i&&dayDiff(x.ds,hypothetical[i-1].ds)<2))return toast('Flyttingen ville lagt kvalitetsøkter på dager etter hverandre.');
    write(K.moves,moves);state.selectedDs=oOld;addLog(`${p.title} flyttet til ${formatDate(oOld,{weekday:'long',day:'numeric',month:'short'})}.`,'manual',before);toast('Økten er flyttet med belastningskontroll');renderAll();
  }
  function adapt(p,reason){
    if(!p||isLocked(p))return toast('Økten er låst. Lås opp før den endres.');
    const before=snapshot(K.adjustments),all=read(K.adjustments,{}),base={created:new Date().toISOString(),source:'runnerbear-v10.9'};
    if(reason==='skip'||reason==='achilles')all[p.sourceLabel]={...base,reason,type:'rest',title:'Hvile · økten utgår',desc:'Ingen treningsgjeld.',detail:reason==='achilles'?'Akillesrespons trumfer kalenderen. Fortsett med neste planlagte dag når signalet er rolig.':'Økten flyttes ikke til en annen dag, og kilometer tas ikke igjen.',km:0,shoe:'',fuel:''};
    else{
      const factor=reason==='time'?.68:.78,km=Math.max(p.type==='quality'?6:4,roundHalf(Number(p.km||0)*factor));
      all[p.sourceLabel]={...base,reason,type:p.type,title:`Kortversjon · ${p.title}`,desc:'Lavere arbeidsvolum, samme intensitetskontroll.',detail:`${p.detail||''} Kutt volum, ikke øk farten.`,km,shoe:p.shoe,fuel:p.fuel};
    }
    write(K.adjustments,all);addLog(`${p.title} er tilpasset: ${reason==='time'?'kortere tid':reason==='tired'?'sliten kropp':reason==='achilles'?'akillesrespons':'økten utgår'}.`,'manual',before);toast('Dagen er tilpasset uten treningsgjeld');renderAll();
  }
  function balanceFlexChoice(p){
    if(choiceFor(p)!=='run'||control()!=='autopilot')return;
    const rows=effectiveSchedule().filter(x=>x.week===p.week),cap=Number(policy().profile.maxKm||55),total=rows.reduce((s,x)=>s+kmFor(x),0),overflow=roundHalf(total-cap);
    if(overflow<=0)return;const next=rows.find(x=>x.ds>p.ds&&x.type==='easy'&&!/langtur/i.test(x.title)&&!isLocked(x));if(!next)return;
    const all=read(K.adjustments,{}),km=Math.max(5,roundHalf(next.km-overflow));if(km>=next.km)return;
    all[next.sourceLabel]={created:new Date().toISOString(),reason:'auto-flex-volume',type:next.type,title:String(next.title).replace(/^\d+(?:[.,]\d+)?\s*km/i,`${String(km).replace('.',',')} km`),desc:next.desc,detail:`${next.detail||''} Automatisk balansert fordi en fleksibel dag ble valgt som løp.`,km,shoe:next.shoe,fuel:next.fuel};write(K.adjustments,all);
  }
  function setChoice(p,mode){
    if(!flexible(p))return;const key=choiceKey(p),before=snapshot(key);localStorage.setItem(key,mode);balanceFlexChoice(p);
    addLog(`${formatDate(p.ds,{weekday:'long'})}: ${mode==='run'?'rolig jogg':mode==='row'?'Concept2':mode==='bike'?'Zwift':'hvile'} er valgt.`,'manual',before);renderAll();
  }
  function runAutopilot(){
    if(control()!=='autopilot')return;const d=engine()?.decision?.();if(d?.level!=='red')return;
    const actionId=`auto-red:${today()}`,p=planFor(today());if(read(K.seen,{})[actionId]||!p||p.type!=='quality'||isLocked(p)||read(K.adjustments,{})[p.sourceLabel]?.reason==='auto-recovery-red')return;
    const before=snapshot(K.adjustments),all=read(K.adjustments,{});all[p.sourceLabel]={created:new Date().toISOString(),reason:'auto-recovery-red',type:'rest',title:'Hvile · kvalitet utgår',desc:'RunnerBear har registrert et tydelig belastningssignal.',detail:'Ingen treningsgjeld. Neste planlagte kvalitetsøkt flyttes ikke frem.',km:0,shoe:'',fuel:''};write(K.adjustments,all);
    addLog(`Tydelig belastningssignal: ${p.title} er tatt ut. Ingen treningsgjeld.`,'auto',before,actionId);
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

  const state={selectedDs:sessionStorage.getItem(K.selected)||'',planView:sessionStorage.getItem(K.planView)||'plan',openWeek:null,moveOpen:false,adaptOpen:false,completedId:'',doneScroll:0,goalManagerOpen:false,goalEditor:''};
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
  function todaySignalsHtml(){
    const h=healthSignal(),r=h.r||{},t=trend30();
    return `<div class="rb108-signal-grid"><details class="rb107-card rb108-signal ${h.tone}"><summary><span class="rb108-signal-dot"></span><div><small>Helsebilde</small><b>${esc(h.title)}</b><p>${esc(h.copy)}</p></div><strong>＋</strong></summary><div class="rb108-signal-body"><div><span>HRV</span><b>${r.hrv?.value?`${Math.round(r.hrv.value)} ms`:'Mangler'}</b><small>${r.hrv?.baseline?`normal ${Math.round(r.hrv.baseline)} ms`:'ingen sikker normal'}</small></div><div><span>Søvn</span><b>${formatSleep(r.sleep?.value)}</b><small>${r.sleep?.baseline?`normal ${formatSleep(r.sleep.baseline)}`:'ingen sikker normal'}</small></div><div><span>Hvilepuls</span><b>${r.rhr?.value?`${Math.round(r.rhr.value)} bpm`:'Mangler'}</b><small>${r.rhr?.baseline?`normal ${Math.round(r.rhr.baseline)} bpm`:'ingen sikker normal'}</small></div></div></details><details class="rb107-card rb108-signal ${t.tone}"><summary><span class="rb108-signal-dot"></span><div><small>30 dager</small><b>${esc(t.title)}</b><p>${esc(t.copy)}</p></div><strong>＋</strong></summary><div class="rb108-trend-body"><div><span>Løpsmengde</span><b>${t.weekly.toFixed(1).replace('.',',')} km/uke</b></div><div><span>Retning</span><b>${t.delta>0?'+':''}${t.delta} %</b></div><p>${esc(t.threshold)}</p><small>Concept2 og Zwift teller i aerob belastning, aldri som falske løpskilometer.</small></div></details></div>`;
  }
  function decision(){return engine()?.decision?.()||{level:'green',headline:'Planen står',message:'Belastningen er innenfor rammene.'}}
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
    return effectiveSchedule().filter(p=>p.type==='quality'&&p.baseDs<=today()).map(p=>{const f=feedbackFor(p),a=activityFor(p),work=a?.detail?.analysis,ps=Number(work?.workPace)||paceSec(f.pace),hr=Number(work?.workHr)||Number(f.hr||0);return ps&&hr?{date:p.baseDs,label:p.title,pace:Math.round(ps),hr:Math.round(hr),rpe:Number(f.rpe||0),source:work?.workBlocks?.length?'Garmin arbeidsdel':'manuell'}:null}).filter(Boolean).slice(-8);
  }
  function thresholdCopy(){
    const rows=thresholdEvidence(),history=engine()?.thresholdHistory?.()||[];if(rows.length<2&&history.length>=2){const first=history[0],last=history.at(-1),delta=paceSec(first.pace)-paceSec(last.pace),change=delta>0?`${delta} sek/km raskere terskelfart`:delta<0?`${Math.abs(delta)} sek/km roligere terskelfart`:'en stabil terskel';return`Garmin-kapasiteten viser ${change} over registrert historikk. Økt-for-økt-trenden blir strengere når arbeidsdelen kan skilles sikkert fra oppvarming og nedjogg.`}if(rows.length<2)return'Bygger trend. Når arbeidsdel fra terskeløktene er tilgjengelig, sammenlignes fart ved lik puls — ikke bare én løs terskelverdi.';
    const first=rows[0],last=rows.at(-1),delta=first.pace-last.pace,hr=Math.abs(first.hr-last.hr);if(hr<=3&&delta>0)return`Samme puls · ${delta} sek/km raskere fra ${formatDate(first.date,{day:'numeric',month:'short'})} til ${formatDate(last.date,{day:'numeric',month:'short'})}.`;
    return`Siste ${rows.length} terskeløkter er koblet. RunnerBear prioriterer kontrollert arbeidsfart ved sammenlignbar puls.`;
  }
  function chartSvg(history){
    const rows=history.length?history:[{date:today(),pace:'4:02',hr:173}],vals=rows.map(x=>paceSec(x.pace)).filter(Boolean),min=Math.min(...vals)-2,max=Math.max(...vals)+2,w=560,h=120,p=14;
    const pts=rows.map((x,i)=>{const v=paceSec(x.pace),px=rows.length===1?w/2:p+i*(w-p*2)/(rows.length-1),py=p+(v-min)/(max-min||1)*(h-p*2);return[px,py]}),path=pts.map(x=>x.join(',')).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Utvikling i terskelfart"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#e0e7e2"/><polyline points="${path}" fill="none" stroke="#4d7a5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(x=>`<circle cx="${x[0]}" cy="${x[1]}" r="4" fill="#fff" stroke="#4d7a5b" stroke-width="3"/>`).join('')}</svg>`;
  }

  function resultCardHtml(p,context='today'){
    const a=activityFor(p);if(!a)return'';const metrics=resultMetrics(a,p),x=analysisFor(p,a),v=verdictFor(p,a,x),match=matchFor(p);
    return `<article class="rb107-card rb109-result-card ${x.tone} ${context==='plan'?'compact':''}">
      <header class="rb109-result-head"><div class="rb109-result-mark">${icon('check')}</div><div><span class="rb107-overline">${esc(v.overline)}</span><h2>${esc(v.title)}</h2><p>${esc(p.title)} · ${esc(match?.status?.label||'Matchet med dagens økt')}</p></div><strong class="rb109-result-badge ${x.tone}">${esc(v.badge)}</strong></header>
      <div class="rb109-result-metrics">${metrics.slice(0,4).map(m=>`<div><span>${esc(m[0])}</span><b>${esc(m[1])}</b></div>`).join('')}</div>
      <section class="rb109-coach-verdict"><span>RB Coach</span><p>${esc(x.review)}</p><div><b>${esc(x.consequence.split('.')[0]||'Planen står')}</b><small>${esc(x.consequence)}</small></div></section>
      ${context==='plan'?`<button class="rb107-button secondary rb109-open-analysis" data-rb109-open-completed="${esc(a.id)}">Se full analyse</button>`:`<div class="rb109-result-details"><details><summary>Se drag og analyse <span>↓</span></summary>${analysisDetailsHtml(p,a)}${x.blocks.length?`<div class="rb109-block-list">${x.blocks.slice(0,20).map(b=>`<span><b>${b.index}</b>${fmtTime(b.duration)} · ${fmtPace(b.pace)}/km${b.hr?` · ${Math.round(b.hr)} bpm`:''}</span>`).join('')}</div>`:''}</details><details><summary>Planlagt økt og detaljer <span>↓</span></summary>${plannedDetailsHtml(p)}</details></div>`}
    </article>`;
  }
  function flexHtml(p){
    if(!flexible(p))return'';const completed=matchFor(p);if(completed){const kind=sportKind(completed.activity,p),label=kind==='row'?'Concept2':kind==='bike'?'Zwift':'rolig jogg';return`<div class="rb108-flex-complete"><span>${icon('check')}</span><div><b>Dagens aerobe økt er gjennomført via ${label}</b><small>De andre alternativene er lukket. Ingen treningsgjeld.</small></div><button data-rb108-unmatch="${esc(p.baseDs)}">Endre kobling</button></div>`}const selected=choiceFor(p),items=[['run','run','Rolig jogg'],['row','row','Concept2'],['bike','bike','Zwift']];
    return `<div class="rb107-flex-panel"><span>Velg dagens aerobe alternativ</span><div class="rb107-flex-grid">${items.map(x=>`<button class="rb107-choice ${selected===x[0]?'active':''}" data-rb107-choice="${x[0]}" data-base-ds="${p.baseDs}">${icon(x[1])}<span>${x[2]}</span></button>`).join('')}</div>${matchPickerHtml(p)}</div>`;
  }
  function plannedWorkoutHtml(base,d,suggest){
    const p=prescription(base),target=targetFor(base);
    return `<article class="rb107-card rb107-workout"><div class="rb107-workout-top"><div><span class="rb107-type ${p.type}">${typeLabel(p.type)}</span><h2>${esc(p.title)}</h2><p class="rb107-workout-lead">${esc(p.desc||'')}</p></div></div>
      <div class="rb107-metrics"><div class="rb107-metric"><span>Arbeid</span><b>${esc(target.work)}</b></div><div class="rb107-metric"><span>Styring</span><b>${esc(target.pace)}</b></div><div class="rb107-metric"><span>Puls</span><b>${esc(target.hr)}</b></div></div>
      <div class="rb107-workout-body"><div class="rb107-purpose"><span>Hensikt</span><p>${esc(purposeFor(p))}</p></div>${flexHtml(base)}${!flexible(base)?matchPickerHtml(base):''}
        <div class="rb107-workout-actions"><button class="rb107-button secondary" data-rb107-toggle-details>Se økten</button><button class="rb107-button ghost" data-rb107-toggle-adapt>Tilpass dagen</button></div>
        ${state.adaptOpen?`<div class="rb107-flex-panel"><span>Hva har endret seg?</span><div class="rb107-flex-grid"><button class="rb107-choice" data-rb107-adapt="tired" data-base-ds="${base.baseDs}"><span>Litt sliten</span></button><button class="rb107-choice" data-rb107-adapt="time" data-base-ds="${base.baseDs}"><span>Dårlig tid</span></button><button class="rb107-choice" data-rb107-adapt="achilles" data-base-ds="${base.baseDs}"><span>Akilles</span></button></div></div>`:''}
        <details class="rb107-details" id="rb107TodayDetails"><summary>Øktdetaljer og coachens begrunnelse</summary><div class="rb107-detail-copy">${workoutStructureHtml(base)}<div class="rb107-detail-row"><b>Gjennomføring</b><span>${esc(p.detail||p.desc||'Følg kontrollert belastning.')}</span></div>${p.shoe?`<div class="rb107-detail-row"><b>Sko</b><span>${esc(p.shoe)}</span></div>`:''}${p.fuel?`<div class="rb107-detail-row"><b>Energi</b><span>${esc(p.fuel)}</span></div>`:''}<div class="rb107-detail-row"><b>Hvorfor nå</b><span>${esc(suggest?'RunnerBear anbefaler en tryggere dag.':d.message)} Konservativ tolkning vinner når puls, pust og følelse spriker.</span></div></div></details>
      </div></article>`;
  }
  function pendingResultHtml(base){
    const candidates=manualCandidates(base);if(!candidates.length)return'';
    return `<article class="rb107-card rb109-pending"><div class="rb109-pending-mark">${icon('sync')}</div><div><span class="rb107-overline">Aktivitet registrert · analyse pågår</span><h2>Økten er hentet fra Garmin</h2><p>RunnerBear trenger bare å bekrefte koblingen før resultatet overtar denne siden.</p>${matchPickerHtml(base)}<details><summary>Planlagt økt og detaljer <span>↓</span></summary>${plannedDetailsHtml(base)}</details></div></article>`;
  }
  function todayHtml(){
    const base=planFor(today())||effectiveSchedule().find(p=>p.ds>=today())||effectiveSchedule().at(-1),d=decision(),sync=syncState(),done=isDone(base),suggest=control()==='suggest'&&d.level==='red',pending=!done&&manualCandidates(base).length>0;
    return `<div id="rb107Today" class="rb107-surface"><div class="rb107-shell">
      <header class="rb107-today-head"><div><span class="rb107-overline">${esc(formatDate(base.ds,{weekday:'long',day:'numeric',month:'long'}))}</span><h1>${done?'Godt jobbet':'God dag, Torbjørn'}</h1><p>${done?'Resultatet er analysert og tatt med videre.':pending?'Økten er registrert. RunnerBear fullfører koblingen.':'Én tydelig beslutning. Data ved behov.'}</p></div><div class="rb107-sync ${sync.stale?'stale':''}"><i></i><span>Garmin ${esc(sync.label)}</span></div></header>
      ${done?resultCardHtml(base,'today'):`${pending?pendingResultHtml(base):`<section class="rb107-card rb107-decision ${d.level}"><div class="rb107-decision-mark">${icon(d.level==='green'?'check':'info')}</div><div><span class="rb107-overline">RB Coach · ${control()==='autopilot'?'autopilot':control()==='suggest'?'foreslår':'observerer'}</span><h2>${esc(d.headline)}</h2><p>${esc(suggest?'RunnerBear anbefaler å ta dagens kvalitet ut, men venter på deg.':d.message)}</p></div>${suggest?`<button class="rb107-decision-link" data-rb107-apply-suggestion>Bruk anbefalingen</button>`:`<button class="rb107-decision-link" data-rb107-open-why>Hvorfor?</button>`}</section>`}${pending?'':plannedWorkoutHtml(base,d,suggest)}`}
      ${todaySignalsHtml()}
      ${done?'':`<section class="rb107-card rb107-silent ${d.level==='green'?'':'alert'}"><div><span class="rb107-overline">Silent Coach</span><b>${d.level==='green'?'Stille fordi alt går etter planen':'Ett signal fortjener oppmerksomhet'}</b><p>${d.level==='green'?'RunnerBear avbryter deg bare når noe bør endres.':esc(d.message)}</p></div><span>${icon(d.level==='green'?'check':'info')}</span></section>`}
    </div></div>`;
  }

  function weekStripHtml(week){
    const rows=weekRows(week),stats=weekStats(week),selected=selectedPlan();
    return `<section class="rb107-card rb107-week-strip"><div class="rb107-week-strip-head"><div><span class="rb107-overline">Uke ${week}</span><b>${esc(rows[0]&&rows.at(-1)?`${formatDate(rows[0].ds,{day:'numeric',month:'short'})} – ${formatDate(rows.at(-1).ds,{day:'numeric',month:'short'})}`:'')}</b></div><span>${stats.km} km · ${stats.runDays} løpedager</span></div><div class="rb107-days">${rows.map(p=>`<button class="rb107-day-chip ${p.ds===today()?'today':''} ${p.ds===selected?.ds?'active':''} ${isDone(p)?'done':''}" data-rb107-day="${p.ds}"><span>${formatDate(p.ds,{weekday:'short'}).replace('.','')}</span><b>${dateFrom(p.ds).getDate()}</b><i class="${p.type}"></i></button>`).join('')}</div></section>`;
  }
  function compactResultLabel(p){const a=activityFor(p);if(!a)return'';return`✓ ${verdictFor(p,a).badge}`}
  function dayDetailHtml(p){
    const x=prescription(p),t=targetFor(p),done=isDone(p),locked=isLocked(p);
    if(done)return resultCardHtml(p,'plan');
    return `<article class="rb107-card rb107-day-detail"><div class="rb107-day-detail-head"><div><span class="rb107-type ${x.type}">${typeLabel(x.type)} · ${esc(formatDate(p.ds,{weekday:'long',day:'numeric',month:'long'}))}</span><h2>${esc(x.title)}</h2><p>${esc(x.desc||'')}</p></div>${locked?'<span class="rb107-complete">Låst</span>':''}</div>
      <div class="rb107-metrics"><div class="rb107-metric"><span>Arbeid</span><b>${esc(t.work)}</b></div><div class="rb107-metric"><span>Styring</span><b>${esc(t.pace)}</b></div><div class="rb107-metric"><span>Puls</span><b>${esc(t.hr)}</b></div></div>
      <div class="rb107-note"><b>Hensikt:</b> ${esc(purposeFor(x))}<br>${esc(x.detail||'')}</div>${workoutStructureHtml(p)}${flexHtml(p)}${!flexible(p)?matchPickerHtml(p):''}
      <div class="rb107-action-grid"><button class="rb107-action ${locked?'active':''}" data-rb107-lock="${p.baseDs}">${icon('lock')}${locked?'Låst':'Lås økten'}</button><button class="rb107-action" data-rb107-move-toggle="${p.baseDs}">${icon('move')}Flytt</button></div>${state.moveOpen?`<div class="rb107-move-panel"><button class="rb107-button secondary" data-rb107-move="-1" data-base-ds="${p.baseDs}">Dagen før</button><button class="rb107-button secondary" data-rb107-move="1" data-base-ds="${p.baseDs}">Dagen etter</button><button class="rb107-button ghost" data-rb107-restore="${p.baseDs}">Gjenopprett</button></div>`:''}</article>`;
  }
  function weeksHtml(current){
    const weeks=[...new Set(effectiveSchedule().map(p=>p.week))];
    return `<div class="rb107-weeks">${weeks.map(n=>{const rows=weekRows(n),s=weekStats(n),open=(state.openWeek??current)===n;return`<section class="rb107-card rb107-week ${open?'open':''}"><button class="rb107-week-head" data-rb107-week="${n}"><div><span>${esc((window.RUNFEST_WEEKS||[]).find(w=>w.n===n)?.phase||`Uke ${n}`)}</span><b>Uke ${n} · ${esc(rows[0]&&rows.at(-1)?`${formatDate(rows[0].ds,{day:'numeric',month:'short'})}–${formatDate(rows.at(-1).ds,{day:'numeric',month:'short'})}`:'')}</b></div><strong>${s.km} km</strong></button><div class="rb107-week-body">${rows.map(p=>`<div class="rb107-week-row" data-rb107-day="${p.ds}"><span>${esc(formatDate(p.ds,{weekday:'short',day:'numeric',month:'short'}).replace('.',''))}</span><b>${esc(prescription(p).title)}</b><strong>${isDone(p)?esc(compactResultLabel(p)):p.type==='quality'?'Kvalitet':'›'}</strong></div>`).join('')}</div></section>`}).join('')}</div>`;
  }
  function completedRows(){
    const planned=effectiveSchedule().map(p=>({p,a:activityFor(p),match:matchFor(p)})).filter(x=>x.a),used=new Set(planned.map(x=>String(x.a.id||''))),extras=activities().filter(a=>!used.has(String(a.id))).map(a=>({p:null,a,match:null}));
    return[...planned,...extras].sort((a,b)=>String(b.a.date||b.a.ds||'').localeCompare(String(a.a.date||a.a.ds||'')));
  }
  function completedDetailHtml(row){
    const {p,a,match}=row,m=resultMetrics(a,p),x=p?analysisFor(p,a):null;
    return `<article class="rb107-card rb108-completed-detail"><button class="rb108-back" data-rb108-completed-back>← Tilbake til Utført</button><header><div><span class="rb107-overline">${esc(formatDate(a.ds,{weekday:'long',day:'numeric',month:'long'}))} · Garmin</span><h2>${esc(p?.title||a.title||sportLabel(a,p))}</h2><p>${esc(match?.status?.label||'Ekstra aktivitet')}</p></div><span class="rb108-verdict ${x?.tone||'neutral'}">${esc(x?.headline||'Registrert')}</span></header><div class="rb107-actual-grid">${m.map(v=>`<div><span>${esc(v[0])}</span><b>${esc(v[1])}</b></div>`).join('')}</div>${p?analysisDetailsHtml(p,a):`<div class="rb108-analysis-sections"><section><span>Coachens vurdering</span><p>Aktiviteten er registrert som ekstra belastning og kobles ikke automatisk til en planlagt økt uten tilstrekkelig sikkerhet.</p></section><section><span>Konsekvens</span><b>Belastningen tas med videre. Ingen planlagt økt markeres gjennomført.</b></section></div>`}${a.detail?.analysis?.workBlocks?.length?`<details class="rb108-blocks"><summary>Arbeidsblokker · ${a.detail.analysis.workBlocks.length} identifisert</summary><div>${a.detail.analysis.workBlocks.slice(0,20).map(b=>`<span><b>${b.index}</b>${fmtTime(b.duration)} · ${fmtPace(b.pace)}/km · ${b.hr?`${Math.round(b.hr)} bpm`:'puls mangler'}</span>`).join('')}</div></details>`:''}${p?`<button class="rb107-button ghost" data-rb108-unmatch="${esc(p.baseDs)}">Endre kobling</button>`:''}</article>`;
  }
  function completedHtml(){
    const rows=completedRows();if(!rows.length)return'<section class="rb107-card rb107-empty"><b>Ingen aktiviteter synkronisert ennå</b><p>Gjennomfør økten med Garmin. RunnerBear henter den automatisk.</p></section>';
    if(state.completedId){const row=rows.find(x=>x.a.id===state.completedId);if(row)return completedDetailHtml(row);state.completedId=''}
    return `<div class="rb107-completed-list">${rows.slice(0,60).map(({p,a,match})=>{const m=actualMetrics(a,p),title=p?.title||a.title||sportLabel(a,p),status=match?.status?.label||'Ekstra registrert';return`<article class="rb107-card rb107-completed-row" data-rb108-completed="${esc(a.id)}"><div><span>${esc(formatDate(a.ds,{weekday:'short',day:'numeric',month:'short'}))} · ${esc(status)}</span><b>${esc(title)}</b><small>${esc(sportLabel(a,p))} · ${esc(m.map(x=>x[1]).slice(0,3).join(' · '))}</small></div><strong>Se analyse →</strong></article>`}).join('')}</div>`;
  }
  function planHtml(){
    const current=weekForToday();if(!state.selectedDs)state.selectedDs=planFor(today())?.ds||weekRows(current)[0]?.ds||'';const selected=selectedPlan(),stats=weekStats(selected?.week||current);
    return `<div id="rb107Plan" class="rb107-surface"><div class="rb107-shell"><header class="rb107-section-head"><div><span class="rb107-overline">Planen åpner på i dag</span><h1>Plan</h1><p>Planlagt, utført og coachens endringer samlet.</p></div><div class="rb107-segment"><button class="${state.planView==='plan'?'active':''}" data-rb107-plan-view="plan">Plan</button><button class="${state.planView==='done'?'active':''}" data-rb107-plan-view="done">Utført</button></div></header>
      ${state.planView==='plan'?`${weekStripHtml(selected?.week||current)}<div class="rb107-week-summary"><div><span>Løpsvolum</span><b>${stats.km} km</b></div><div><span>Løpedager</span><b>${stats.runDays}</b></div><div><span>Kvalitet</span><b>${stats.quality}</b></div><div><span>Langtur</span><b>${stats.long}</b></div></div>${dayDetailHtml(selected)}${weeksHtml(selected?.week||current)}`:completedHtml()}
    </div></div>`;
  }

  function secondaryGoalsHtml(rows){
    if(!rows.length)return'';
    return `<section class='rb107-card rb109-secondary'><div class='rb109-card-head'><div><span class='rb107-overline'>På vei mot hovedmålet</span><h2>B-løp og testløp</h2></div><button data-rb109-goal-editor='secondary'>Legg til</button></div><div class='rb109-secondary-list'>${rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>`<div><time>${esc(formatDate(x.date,{day:'numeric',month:'short'}))}</time><span><b>${esc(x.name)}</b><small>${esc(distanceMeta(x.distance).label)} · ${x.effort==='controlled'?'Kontrollert gjennomføring':'Full innsats'}</small></span><button aria-label='Fjern ${esc(x.name)}' data-rb109-remove-secondary='${esc(x.id)}'>×</button></div>`).join('')}</div></section>`;
  }
  function goalHistoryHtml(rows){
    if(!rows.length)return'';const labels={completed:'Gjennomført',cancelled:'Avlyst',replaced:'Erstattet',paused:'Avsluttet'};
    return `<details class='rb107-card rb109-history'><summary><span><small>Målhistorikk</small><b>${rows.length} tidligere mål</b></span><strong>＋</strong></summary><div>${rows.slice().reverse().map(x=>`<article><span>${esc(labels[x.status]||x.status||'Arkivert')}</span><b>${esc(x.name||'Tidligere mål')}</b><small>${x.date?esc(formatDate(x.date,{day:'numeric',month:'short',year:'numeric'})):''}${x.resultSeconds?` · ${fmtTime(x.resultSeconds)}`:''}</small></article>`).join('')}</div></details>`;
  }
  function goalManagerHtml(g){
    if(!state.goalManagerOpen)return'';const p=g.primary||{name:'',date:'',distance:'half',targetSeconds:0},editor=state.goalEditor;
    const primaryForm=`<form class='rb109-goal-form' data-rb109-primary-form><label>Løp eller mål<input name='name' required value='${esc(p.name||'')}' placeholder='F.eks. Karmøy halvmaraton'></label><div><label>Dato<input name='date' type='date' min='${today()}' required value='${esc(p.date||'')}'></label><label>Distanse<select name='distance'>${Object.entries(DISTANCES).map(([key,x])=>`<option value='${key}' ${p.distance===key?'selected':''}>${x.label}</option>`).join('')}</select></label></div><label>Ønsket tid · valgfritt<input name='target' inputmode='numeric' value='${esc(timeInput(p.targetSeconds))}' placeholder='1:23:00'></label><button class='rb107-button' type='submit'>Lagre hovedmål</button></form>`;
    const secondaryForm=`<form class='rb109-goal-form' data-rb109-secondary-form><label>Løp eller test<input name='name' required placeholder='F.eks. 10 km testløp'></label><div><label>Dato<input name='date' type='date' min='${today()}' required></label><label>Distanse<select name='distance'>${Object.entries(DISTANCES).map(([key,x])=>`<option value='${key}'>${x.label}</option>`).join('')}</select></label></div><label>Gjennomføring<select name='effort'><option value='controlled'>Kontrollert · del av planen</option><option value='race'>Full innsats · planen gir mer restitusjon</option></select></label><button class='rb107-button' type='submit'>Legg til B-løp</button></form>`;
    const completeForm=`<form class='rb109-goal-form' data-rb109-complete-form><p>Resultatet lagres i målhistorikken. RunnerBear går deretter inn i en kort overgangsperiode.</p><label>Resultat · valgfritt<input name='result' inputmode='numeric' placeholder='1:22:45'></label><button class='rb107-button' type='submit'>Marker som gjennomført</button></form>`;
    return `<div class='rb109-modal' role='presentation'><section role='dialog' aria-modal='true' aria-labelledby='rb109GoalManagerTitle'><header><div><span class='rb107-overline'>Retning for coachen</span><h2 id='rb109GoalManagerTitle'>Administrer mål</h2><p>Velg bare det som faktisk skal påvirke treningsplanen.</p></div><button aria-label='Lukk' data-rb109-goal-close>×</button></header><div class='rb109-goal-options'><button class='${editor==='primary'?'active':''}' data-rb109-goal-editor='primary'><b>Sett eller bytt hovedmål</b><small>Ett aktivt A-løp</small></button><button class='${editor==='secondary'?'active':''}' data-rb109-goal-editor='secondary'><b>Legg til B-løp</b><small>Test eller kontrollert løp</small></button><button data-rb109-base-mode><b>Bygg form uten løpsdato</b><small>Bakken-prinsippene fortsetter</small></button></div>${editor==='primary'?primaryForm:editor==='secondary'?secondaryForm:editor==='complete'?completeForm:`<div class='rb109-manager-note'><b>${g.mode==='base'?'Formbygging er aktiv':g.mode==='transition'?'Overgangsperiode er aktiv':'Hovedmålet styrer planen'}</b><p>RunnerBear holder normalvolumet rundt ${roundHalf(policy().anchorKm||50)} km, minst ${policy().profile.minRunDays||5} løpedager og maksimalt ${policy().profile.flexibleSessions||2} fleksible økter.</p></div>`}${g.primary&&g.mode==='race'?`<footer><span>Avslutt aktivt mål</span><button data-rb109-goal-editor='complete'>Gjennomført</button><button data-rb109-cancel-goal>Avlyst</button></footer>`:''}</section></div>`;
  }
  function goalsHtml(){
    const g=goalState(),goal=activeGoal(),f=forecast(),hist=engine()?.thresholdHistory?.()||[],th=hist.at(-1)||{pace:'4:02',hr:173},trend=engine()?.thresholdTrend?.()||{text:'Bygger trend',tone:'neutral'},sessionEvidence=thresholdEvidence(),evidence=sessionEvidence.length?sessionEvidence:hist.slice(-4).map(x=>({date:x.date,label:'Garmin terskelestimat',pace:paceSec(x.pace),hr:x.hr})),pred=engine()?.predictions?.()||{},predictionRows=Object.entries(DISTANCES).map(([key,x])=>({key,label:x.label,value:pred?.[key]?.seconds||0,foundation:predictionFoundation(key,pred)}));
    const hero=goal?`<section class='rb107-card rb107-goal-hero rb109-goal-hero'><div><span class='rb107-overline'>${esc(distanceMeta(goal.distance).label)} · ${esc(formatDate(goal.date,{day:'numeric',month:'long',year:'numeric'}))}</span><h2>${esc(goal.name)}</h2><p>${goal.targetSeconds?`Hovedmål ${fmtTime(goal.targetSeconds)}. `:''}Løpsfarten velges av terskelrespons, kontinuitet og de spesifikke øktene.</p></div><div class='rb107-goal-now'><span>Løpskapasitet nå</span><b>${fmtTime(f.current)}</b><small>${fmtTime(f.low)}–${fmtTime(f.high)}</small></div><div class='rb107-race-range'><div><span>Måltid</span><b>${goal.targetSeconds?fmtTime(goal.targetSeconds):'Utvikling'}</b></div><div><span>Til løpet</span><b>${goalDays(goal)} dager</b></div><div><span>Langsiktig</span><b>${goal.aspirationSeconds?`sub ${fmtTime(goal.aspirationSeconds)}`:'Kontrollert fremgang'}</b></div></div></section>`:`<section class='rb107-card rb107-goal-hero rb109-goal-hero base'><div><span class='rb107-overline'>${g.mode==='transition'?'Overgangsperiode':'Bakken-prinsippene · uten løpsdato'}</span><h2>${g.mode==='transition'?'Bygg kroppen opp igjen':'Bygg form uten nedtelling'}</h2><p>${g.mode==='transition'?'Volum og kvalitet holdes lavere en kort periode før normal rytme fortsetter.':'RunnerBear utvikler terskel, kapasitet og løpsøkonomi videre uten et kunstig konkurransepress.'}</p></div><div class='rb107-goal-now'><span>Halvmaratonkapasitet</span><b>${fmtTime(pred?.half?.seconds||0)}</b><small>${esc(formDirection())} formutvikling</small></div><div class='rb107-race-range'><div><span>Normaluke</span><b>~${roundHalf(policy().anchorKm||50)} km</b></div><div><span>Løpedager</span><b>min. ${policy().profile.minRunDays||5}</b></div><div><span>Styring</span><b>Kontrollert terskel</b></div></div></section>`;
    const status=goal?`<section class='rb107-card rb109-goal-status ${f.progress.code}'><div>${icon(f.progress.code==='green'?'check':'info')}</div><div><span class='rb107-overline'>Mot målet</span><h2>${esc(f.progress.label)}</h2><p>${esc(f.progress.copy)}</p></div></section>`:`<section class='rb107-card rb109-goal-status green'><div>${icon('check')}</div><div><span class='rb107-overline'>Aktiv modus</span><h2>${g.mode==='transition'?'Trygg overgang':'Formbygging pågår'}</h2><p>Coachen fortsetter autonomt innenfor volumvernet og Bakken-kjernen.</p></div></section>`;
    return `<div id='rb107Goals' class='rb107-surface'><div class='rb107-shell'><header class='rb107-section-head rb109-goals-head'><div><span class='rb107-overline'>Fremgang, ikke pynt</span><h1>Mål</h1><p>Et stabilt kapasitetsbilde – dagsform hører hjemme under I dag.</p></div><button class='rb107-button secondary' data-rb109-goal-open>Administrer mål</button></header>${hero}${status}
      <section class='rb107-card rb109-capacity'><div class='rb109-capacity-main'><span class='rb107-overline'>${goal?distanceMeta(goal.distance).label:'Halvmaraton'} · kapasitet nå</span><b>${fmtTime(f.current)}</b><p>Sannsynlig område <strong>${fmtTime(f.low)}–${fmtTime(f.high)}</strong></p></div><div class='rb109-capacity-meta'><div><span>Formutvikling</span><b>${esc(f.form)}</b></div><div><span>Prognosegrunnlag</span><b class='${f.foundation.code}'>${esc(f.foundation.level)}</b></div></div><p class='rb109-capacity-copy'>${esc(f.foundation.copy)} Dette er et utjevnet kapasitetsestimat og hopper ikke etter én dårlig natt.</p></section>
      <section class='rb107-card rb107-predictions rb109-predictions'><div class='rb107-prediction-head'><b>Løpsprognoser</b><span class='rb107-overline'>Kapasitet · ikke dagsform</span></div>${predictionRows.map(x=>`<div class='rb107-prediction-row rb109-prediction-row ${goal?.distance===x.key?'active':''}'><span>${esc(x.label)}</span><b>${fmtTime(x.value)}</b><div><small>Grunnlag</small><strong class='rb109-foundation ${x.foundation.code}'>${esc(x.foundation.level)}</strong></div></div>`).join('')}<p class='rb107-note'>Terskel, kontinuitet, løpsmengde og langturer inngår. Concept2 gir aerob støtte, men teller aldri som falske løpskilometer.</p></section>
      ${secondaryGoalsHtml(g.secondary)}
      <section class='rb107-card rb107-threshold-card'><div class='rb107-threshold-head'><div><span class='rb107-overline'>Terskelutvikling</span><h2>Fart ved kontrollert puls</h2><p>${esc(thresholdCopy())}</p></div><div class='rb107-threshold-now'><b>${esc(th.pace)}/km</b><span>${esc(th.hr)} bpm · Garmin-anker</span></div></div><div class='rb107-chart'>${chartSvg(hist)}<div class='rb107-chart-labels'><span>${esc(hist[0]?.date||today())}</span><span>${esc(trend.text)}</span><span>${esc(hist.at(-1)?.date||today())}</span></div></div><div class='rb107-evidence'>${evidence.length?evidence.slice(-4).reverse().map(x=>`<div class='rb107-evidence-row'><span>${esc(formatDate(x.date,{day:'numeric',month:'short'}))}</span><b>${esc(x.label)}</b><strong>${fmtPace(x.pace)}/km · ${x.hr} bpm</strong></div>`).join(''):`<div class='rb107-evidence-row'><span>Neste steg</span><b>Arbeidsdel fra terskeløkter</b><strong>Bygger datagrunnlag</strong></div>`}</div></section>
      <details class='rb107-card rb109-method'><summary><span><small>Slik beregnes prognosen</small><b>Datagrunnlag og begrensninger</b></span><strong>＋</strong></summary><div><p>RunnerBear prioriterer arbeidsfart ved sammenlignbar puls, kontinuitet, løpsmengde og langturer. Kontrollert terskel veier tyngre enn raskest mulig totalsnitt.</p><p>Dagsform fra søvn, HRV og hvilepuls påvirker dagens beslutning, men får ikke flytte et stabilt løpsestimat alene.</p></div></details>
      ${goalHistoryHtml(g.history)}
    </div>${goalManagerHtml(g)}</div>`;
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
    return `<div class="rb108-shoe-summary"><b>${active.length} aktive løpesko</b><span>${retired.length} pensjonerte</span></div><div class="rb108-shoes">${active.map(row).join('')||'<p>Ingen aktive sko.</p>'}</div>${retired.length?`<details class="rb108-retired"><summary>Pensjonerte sko · ${retired.length}</summary>${retired.map(row).join('')}</details>`:''}<details class="rb108-add-shoe"><summary>＋ Legg til løpesko</summary><form data-rb108-shoe-form><label>Modell<input name="name" required placeholder="F.eks. Adidas Evo SL"></label><label>Bruksområde<select name="role"><option value="">Finn automatisk</option><option>Rolig · langtur</option><option>Terskel · progressiv</option><option>Konkurranse · kvalitet</option><option>Terreng · grus</option></select></label><label>Underlag<select name="surface"><option value="">Finn automatisk</option><option>Asfalt</option><option>Asfalt · mølle</option><option>Terreng · grus</option></select></label><div class="rb108-shoe-preview" data-rb108-shoe-preview>Skriv modellnavnet – RunnerBear foreslår type, underlag og formål før lagring.</div><button class="rb107-button secondary" type="submit">Legg til sko</button></form></details>`;
  }
  function logHtml(){
    const rows=read(K.log,[]);if(!rows.length)return'<div class="rb107-empty"><b>Ingen inngrep å vise</b><p>Silent Coach er stille når planen står.</p></div>';
    return `<div class="rb107-log">${rows.slice(0,12).map(x=>`<div class="rb107-log-row"><div><time>${esc(new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(x.at)))}</time><b>${esc(x.message)}</b><span>${x.kind==='auto'?'Automatisk innenfor rammene':'Manuell endring'}</span></div>${x.undo?`<button data-rb107-undo="${esc(x.id)}">Angre</button>`:''}</div>`).join('')}</div>`;
  }
  function moreHtml(){
    const sync=syncState(),prof=policy().profile,mode=control(),copy={observer:'Analyserer alt, men endrer aldri planen.',suggest:'Foreslår endringer og venter på godkjenning.',autopilot:'Kan justere innenfor låser, volumtak og Bakken-reglene. Alle endringer kan angres.'}[mode];
    const shoes=shoesState(),activeShoes=shoes.filter(x=>x.active!==false).length,outbound=window.RunnerBearCloud?.cachedOutbound?.()||read('runnerbear_tredict_outbound_v1',{}),planQueue=tredictPlanQueue(),weekQueue=garminQueue(),qualityWeek=weekQueue.filter(x=>x.type==='quality'||x.type==='race').length;
    let currentSignature='';try{currentSignature=window.RunnerBearTredictOutbound?.signature?.(planQueue)||''}catch{}
    const published=['published','calendar-active'].includes(outbound.status)&&outbound.planId,active=outbound.status==='calendar-active',current=published&&outbound.clientSignature===currentSignature,outStatus=active&&current?'Kalender aktiv':current?'Publisert':published?'Plan endret':outbound.status==='review-required'?'Kontroller':'Klar',outCopy=active&&current?`Alle ${outbound.calendarCount||planQueue.length} RunnerBear-øktene er bekreftet i Tredict-kalenderen. Tredict sender dem videre gjennom den aktiverte Garmin-integrasjonen.`:current?`${planQueue.length} kommende løpeøkter ligger i Tredict-planen. ${qualityWeek} kvalitetsøkter er strukturerte neste sju dager. Aktiver planen én gang i Tredict-kalenderen, og kontroller deretter statusen her.`:published?`RunnerBear-planen er endret siden siste publisering. For å unngå duplikater opprettes ingen ny versjon før du velger «Publiser oppdatert plan».`:`${planQueue.length} kommende løpeøkter er klare for en kontrollert Tredict-plan. ${qualityWeek} kvalitetsøkter er strukturerte neste sju dager.`;
    return `<div id="rb107More" class="rb107-surface"><div class="rb107-shell"><header class="rb107-section-head"><div><span class="rb107-overline">Innstillinger og sporbarhet</span><h1>Mer</h1><p>Ryddig som en innstillingsside. Åpne bare det du trenger.</p></div></header><div class="rb108-settings-list">
      <details class="rb107-card rb108-settings"><summary><div><span>Datakilder</span><b>Garmin, Concept2 og synk</b><small>${sync.stale?'Synken bør kontrolleres':`Innkommende data sist ${esc(sync.label)}`}</small></div><strong class="rb107-status ${sync.stale?'stale':''}">${sync.stale?'Sjekk':'Tilkoblet'}</strong></summary><div class="rb108-settings-body"><div class="rb107-data-row"><div><b>Garmin → RunnerBear</b><span>Aktiviteter, puls, recovery, kapasitet og 12 måneders historikk.</span></div><i></i></div><div class="rb107-data-row"><div><b>Concept2</b><span>Gjenkjennes automatisk som aerob støtte og blir aldri falske løpskilometer.</span></div><i></i></div><div class="rb107-data-row rb108-garmin-out"><div><b>RunnerBear → Tredict → Garmin</b><span>${esc(outCopy)}</span></div><strong>${esc(outStatus)}</strong></div><div class="rb108-data-actions"><button class="rb107-button secondary" data-rb108-publish-plan>${icon('sync')} ${current?'Kontroller Tredict-kalender':published?'Publiser oppdatert plan':'Publiser plan til Tredict'}</button><button class="rb107-button secondary" data-rb107-sync>Hent Garmin-data</button></div>${published?`<p class="rb107-control-copy">Tredict-plan-ID: ${esc(outbound.planId)} · ${esc(outbound.workoutCount||planQueue.length)} økter. Strukturelle endringer lager en ny kontrollert planversjon fordi Tredicts offentlige API ikke kan overskrive en aktiv kalenderøkt.</p>`:''}</div></details>
      <details class="rb107-card rb108-settings"><summary><div><span>Coach og autopilot</span><b>Kontrollnivå og treningsrammer</b><small>${mode==='autopilot'?'Autopilot aktiv':'Manuell kontroll'} · normaluke ${roundHalf(policy().anchorKm||prof.baseKm||50)} km</small></div><strong>＋</strong></summary><div class="rb108-settings-body"><div class="rb107-control"><button class="${mode==='observer'?'active':''}" data-rb107-control="observer">Observer</button><button class="${mode==='suggest'?'active':''}" data-rb107-control="suggest">Foreslå</button><button class="${mode==='autopilot'?'active':''}" data-rb107-control="autopilot">Autopilot</button></div><p class="rb107-control-copy">${esc(copy)}</p><div class="rb107-setting-row"><div><b>Volumvern</b><span>Normaluke ${roundHalf(policy().anchorKm||prof.baseKm||50)} km · maks ${prof.maxKm||55} km</span></div><strong>På</strong></div><div class="rb107-setting-row"><div><b>Løpedager</b><span>Minst ${prof.minRunDays||5} · maks ${prof.flexibleSessions||2} fleksible alternativer</span></div><strong>Låst</strong></div></div></details>
      <details class="rb107-card rb108-settings"><summary><div><span>Utstyr</span><b>Løpesko</b><small>${activeShoes} aktive · ${shoes.length-activeShoes} pensjonerte</small></div><strong>＋</strong></summary><div class="rb108-settings-body">${shoesHtml()}</div></details>
      <details class="rb107-card rb108-settings"><summary><div><span>Sporbarhet</span><b>Coachlogg</b><small>Alle automatiske og manuelle endringer kan kontrolleres.</small></div><strong>＋</strong></summary><div class="rb108-settings-body">${logHtml()}</div></details>
      <details class="rb107-card rb108-settings"><summary><div><span>Treningsfilosofi</span><b>Bakken-inspirert kjerne</b><small>Rammene coachen aldri bryter.</small></div><strong>＋</strong></summary><div class="rb108-settings-body"><div class="rb107-principles"><div><b>Kontrollert terskel</b><span>Stimulus høy nok til utvikling, lav nok til å gjentas.</span></div><div><b>Rolig betyr rolig</b><span>Rolige dager beskytter de presise kvalitetsdagene.</span></div><div><b>Intervaller gir kontroll</b><span>Pausene brukes aktivt til riktig intensitet.</span></div><div><b>Respons trumfer ego</b><span>Konservativ tolkning vinner når signalene spriker.</span></div><div><b>Ingen treningsgjeld</b><span>Tapte kilometer og kvalitetsøkter tas ikke igjen senere.</span></div><div><b>Spesifisitet sent</b><span>Halvmaratonfarten introduseres når grunnlaget tåler den.</span></div></div></div></details>
    </div></div></div>`;
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

  function mount(id,html){const section=$(id);if(!section)return;const surface=id==='race'||id==='goals'?'Goals':id[0].toUpperCase()+id.slice(1),old=qs(`#rb107${surface}`,section);if(old)old.outerHTML=html;else section.insertAdjacentHTML('beforeend',html)}
  function decorateNav(){
    const map={today:['I dag','today'],plan:['Plan','plan'],race:['Mål','goal'],goals:['Mål','goal'],more:['Mer','more']};
    qsa('.navbtn[data-tab]').forEach(b=>{const x=map[b.dataset.tab];if(!x)return;b.innerHTML=`<span>${icon(x[1])}</span>${x[0]}`});
  }
  function renderAll(){
    if(!engine())return;logAutomaticAdjustments();mount('today',todayHtml());mount('plan',planHtml());mount($('goals')?'goals':'race',goalsHtml());mount('more',moreHtml());decorateNav();decorateHeader();document.documentElement.classList.add('rb107-ready');document.documentElement.classList.remove('rb108-booting');document.body.classList.toggle('rb109-modal-open',state.goalManagerOpen);bind();
  }
  function toast(message){let el=$('rb107Toast');if(!el){el=document.createElement('div');el.id='rb107Toast';el.className='rb107-toast';document.body.appendChild(el)}el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
  function restoreMove(p){const before=snapshot(K.moves),moves=read(K.moves,{});delete moves[p.baseDs];write(K.moves,moves);state.selectedDs=p.baseDs;addLog(`${p.title} er gjenopprettet til opprinnelig dag.`,'manual',before);renderAll()}
  function applySuggestion(){const p=planFor(today());if(!p)return;adapt(p,'skip')}
  function bind(){
    qsa('[data-rb107-plan-view]').forEach(b=>b.onclick=()=>{state.planView=b.dataset.rb107PlanView;state.completedId='';sessionStorage.setItem(K.planView,state.planView);renderAll()});
    qsa('[data-rb107-day]').forEach(b=>b.onclick=()=>{const ds=b.dataset.rb107Day;if(!planFor(ds))return;state.selectedDs=ds;sessionStorage.setItem(K.selected,ds);state.openWeek=planFor(ds).week;state.planView='plan';sessionStorage.setItem(K.planView,'plan');renderAll()});
    qsa('[data-rb109-open-completed]').forEach(b=>b.onclick=()=>{state.doneScroll=window.scrollY;state.planView='done';sessionStorage.setItem(K.planView,'done');state.completedId=b.dataset.rb109OpenCompleted;renderAll();window.scrollTo({top:0,behavior:'auto'})});
    qsa('[data-rb108-completed]').forEach(b=>b.onclick=()=>{state.doneScroll=window.scrollY;state.completedId=b.dataset.rb108Completed;renderAll();window.scrollTo({top:0,behavior:'auto'})});
    qsa('[data-rb108-completed-back]').forEach(b=>b.onclick=()=>{const y=state.doneScroll;state.completedId='';renderAll();requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'}))});
    qsa('[data-rb108-unmatch]').forEach(b=>b.onclick=()=>{const p=basePlan(b.dataset.rb108Unmatch),m=matchFor(p);if(!p||!m)return;const excluded=read(K.exclusions,{});excluded[p.baseDs]=m.activity.id;write(K.exclusions,excluded);localStorage.removeItem(K.match+p.ds);if(p.baseDs!==p.ds)localStorage.removeItem(K.match+p.baseDs);matchCache={signature:'',map:new Map(),used:new Set()};state.completedId='';toast('Koblingen er åpnet for ny vurdering');renderAll()});
    qsa('[data-rb108-match-id]').forEach(b=>b.onclick=()=>{const p=basePlan(b.dataset.baseDs),a=activities().find(x=>x.id===b.dataset.rb108MatchId);if(!p||!a)return;const excluded=read(K.exclusions,{});delete excluded[p.baseDs];write(K.exclusions,excluded);write(K.match+p.ds,{activityId:a.id,activity:a,planned:{date:p.ds,type:p.type,title:p.title,km:Number(p.km||0),label:p.sourceLabel,source:'runnerbear-v10.9'},automatic:false,matchedAt:new Date().toISOString(),matcher:'manual'});matchCache={signature:'',map:new Map(),used:new Set()};toast('Aktiviteten er koblet til planen');renderAll()});
    qsa('[data-rb107-week]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.rb107Week);state.openWeek=state.openWeek===n?0:n;renderAll()});
    qsa('[data-rb107-choice]').forEach(b=>b.onclick=()=>setChoice(basePlan(b.dataset.baseDs),b.dataset.rb107Choice));
    qsa('[data-rb107-lock]').forEach(b=>b.onclick=()=>toggleLock(basePlan(b.dataset.rb107Lock)));
    qsa('[data-rb107-move-toggle]').forEach(b=>b.onclick=()=>{state.moveOpen=!state.moveOpen;renderAll()});
    qsa('[data-rb107-move]').forEach(b=>b.onclick=()=>moveWorkout(basePlan(b.dataset.baseDs),Number(b.dataset.rb107Move)));
    qsa('[data-rb107-restore]').forEach(b=>b.onclick=()=>restoreMove(basePlan(b.dataset.rb107Restore)));
    qsa('[data-rb107-toggle-adapt]').forEach(b=>b.onclick=()=>{state.adaptOpen=!state.adaptOpen;renderAll()});
    qsa('[data-rb107-adapt]').forEach(b=>b.onclick=()=>adapt(basePlan(b.dataset.baseDs),b.dataset.rb107Adapt));
    qsa('[data-rb107-toggle-details]').forEach(b=>b.onclick=()=>{const d=$('rb107TodayDetails');if(d){d.open=!d.open;d.scrollIntoView?.({block:'nearest',behavior:'smooth'})}});
    qsa('[data-rb107-open-why]').forEach(b=>b.onclick=()=>{const d=$('rb107TodayDetails');if(d){d.open=true;d.scrollIntoView?.({block:'center',behavior:'smooth'})}});
    qsa('[data-rb107-apply-suggestion]').forEach(b=>b.onclick=applySuggestion);
    qsa('[data-rb107-control]').forEach(b=>b.onclick=()=>{const before=snapshot(K.control);localStorage.setItem(K.control,b.dataset.rb107Control);addLog(`Coachnivå endret til ${b.textContent.trim()}.`,'manual',before);toast('Coachnivået er oppdatert');setTimeout(()=>{runAutopilot();renderAll()},0)});
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
    qsa('[data-rb108-publish-plan]').forEach(b=>b.onclick=async()=>{const queue=tredictPlanQueue();if(!queue.length)return toast('Ingen kommende løpeøkter å publisere');const saved=window.RunnerBearCloud?.cachedOutbound?.()||{},signature=window.RunnerBearTredictOutbound?.signature?.(queue)||'',samePlan=saved.clientSignature===signature,isCurrent=['published','calendar-active'].includes(saved.status)&&samePlan,repairable=saved.status==='review-required'&&samePlan,shouldVerify=isCurrent||repairable;b.disabled=true;b.textContent=shouldVerify?'Kontrollerer kalenderen…':'Kontrollerer planen…';try{if(shouldVerify){const result=await window.RunnerBearCloud?.verifyOutbound?.();toast(result?.active?'Tredict-kalenderen er komplett':'Planen må fortsatt aktiveres i Tredict-kalenderen')}else{await window.RunnerBearCloud?.previewOutbound?.(queue);b.textContent='Publiserer til Tredict…';const result=await window.RunnerBearCloud?.publishOutbound?.(queue);toast(result?.idempotent?'Planen finnes allerede i Tredict':'RunnerBear-planen er opprettet i Tredict')}renderAll()}catch(error){toast(error?.message||'Tredict-kontrollen feilet')}finally{b.disabled=false}});
    qsa('[data-rb107-sync]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Synkroniserer…';try{await window.RunnerBearBridge?.sync?.(true);toast('Garmin-data er oppdatert')}catch{toast('Synkronisering feilet – prøv igjen')}finally{setTimeout(renderAll,120)}});
  }
  function openPlanOnToday(){if(state.planView==='plan'){state.selectedDs=planFor(today())?.ds||state.selectedDs;sessionStorage.setItem(K.selected,state.selectedDs)}state.moveOpen=false;setTimeout(renderAll,0)}
  function init(){
    if(!engine())return setTimeout(init,50);migrateDocumentedThreshold();runAutopilot();renderAll();
    document.addEventListener('click',e=>{const nav=e.target.closest('.navbtn');if(nav?.dataset.tab==='plan')openPlanOnToday()},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.goalManagerOpen){state.goalManagerOpen=false;state.goalEditor='';renderAll()}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(renderAll,80)});
    window.addEventListener('storage',()=>setTimeout(renderAll,80));
    setTimeout(renderAll,500);setTimeout(renderAll,1400);
  }
  setTimeout(()=>{
    if(document.documentElement.classList.contains('rb107-ready'))return;
    const boot=qs('#rb108Boot div');
    if(boot)boot.innerHTML='<b>RunnerBear bruker lengre tid enn ventet</b><span>Last siden på nytt. Den gamle visningen vises ikke mens dataene er uavklarte.</span>';
  },10000);
  window.RunnerBearCoachOS={version:'10.9',effectiveSchedule,planFor,forecast,thresholdEvidence,matches:allMatches,analysisFor,workoutStructure,garminQueue,tredictPlanQueue,goalState,render:renderAll,moveWorkout,toggleLock,setChoice,adapt};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
