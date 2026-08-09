/* RunnerBear v5.9 · shoe response intelligence, smart rescheduling and race-week mode
   Design guardrails:
   - Shoe/Achilles insight is descriptive only; association is never presented as causation.
   - Rescheduling swaps one workout with one low-cost day inside the same week and rejects
     changes that compress key sessions or create training debt.
   - Race week reduces decision noise. It does not invent fitness or add training. */
(function(){
  const SWAP_KEY='runfest26_schedule_swaps';
  const RACE_GOAL_KEY='runfest26_race_goal_seconds';
  const RACE_CHECK_KEY='runfest26_raceweek_checklist';
  const RACE_WEEK_START=new Date(2026,8,28,0,0,0,0);
  const RACE_WEEK_END=new Date(2026,9,4,23,59,59,999);

  function safeJson(key,fallback){
    try{const v=JSON.parse(localStorage.getItem(key)||'');return v&&typeof v==='object'?v:fallback}catch{return fallback}
  }
  function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12)}
  function dayDiff(a,b){return Math.round((startOfDay(b)-startOfDay(a))/86400000)}
  function workoutByLabel(label){return flat.find(f=>f.label===label)}
  function isLongRun(f){return !!f&&/langtur/i.test(f.title)}
  function isKey(f){return !!f&&(f.type==='quality'||f.type==='race'||isLongRun(f))}
  function isLowCost(f){return !!f&&!isKey(f)}
  function isGate(f){return !!f&&/gate/i.test(f.title)}

  // -----------------------------
  // Smart schedule swaps
  // -----------------------------
  function readSwaps(){
    const raw=safeJson(SWAP_KEY,[]);if(!Array.isArray(raw))return[];
    const valid=[];const used=new Set();
    raw.forEach(x=>{
      if(!x||typeof x.a!=='string'||typeof x.b!=='string'||x.a===x.b)return;
      const a=workoutByLabel(x.a),b=workoutByLabel(x.b);if(!a||!b||a.week!==b.week||used.has(x.a)||used.has(x.b))return;
      used.add(x.a);used.add(x.b);valid.push({a:x.a,b:x.b,created:x.created||''});
    });
    return valid;
  }
  function writeSwaps(swaps){localStorage.setItem(SWAP_KEY,JSON.stringify(swaps))}
  function partnerLabel(label,swaps=readSwaps()){
    const p=swaps.find(x=>x.a===label||x.b===label);if(!p)return null;return p.a===label?p.b:p.a;
  }
  function effectiveDate(f,swaps=readSwaps()){
    const p=partnerLabel(f.label,swaps),other=p&&workoutByLabel(p);return other?other.date:f.date;
  }
  function effectiveLabel(f,swaps=readSwaps()){
    const p=partnerLabel(f.label,swaps);return p||f.label;
  }
  function sortedSchedule(swaps=readSwaps()){
    return [...flat].sort((a,b)=>effectiveDate(a,swaps)-effectiveDate(b,swaps));
  }
  function scheduleIsSafe(swaps){
    const sched=sortedSchedule(swaps);
    const keys=sched.filter(isKey).sort((a,b)=>effectiveDate(a,swaps)-effectiveDate(b,swaps));
    for(let i=1;i<keys.length;i++){
      const prev=keys[i-1],cur=keys[i],gap=dayDiff(effectiveDate(prev,swaps),effectiveDate(cur,swaps));
      if(gap<2)return false;
    }
    const race=flat.find(f=>f.type==='race');
    if(race){
      const rd=effectiveDate(race,swaps);
      const raceWeekQuality=flat.filter(f=>f.week===8&&f.type==='quality');
      if(raceWeekQuality.some(f=>dayDiff(effectiveDate(f,swaps),rd)<3))return false;
    }
    return true;
  }
  function candidateSwaps(f){
    if(!f||f.type==='race'||isDone(f.label)||partnerLabel(f.label))return[];
    const maxDelta=1;
    const base=readSwaps();
    return flat.filter(t=>t.week===f.week&&t.label!==f.label&&!isDone(t.label)&&!partnerLabel(t.label,base)&&Math.abs(dayDiff(f.date,t.date))<=maxDelta)
      .filter(t=>isLowCost(t))
      .map(t=>{
        const test=[...base,{a:f.label,b:t.label,created:new Date().toISOString()}];
        return{target:t,safe:scheduleIsSafe(test),delta:dayDiff(f.date,t.date)};
      })
      .filter(x=>x.safe)
      .sort((a,b)=>{
        const restScore=x=>x.target.type==='rest'?0:x.target.type==='cross'?1:2;
        return restScore(a)-restScore(b)||Math.abs(a.delta)-Math.abs(b.delta)||a.delta-b.delta;
      });
  }
  function applySwap(f,target){
    if(!f||!target)return;
    const swaps=readSwaps();
    if(partnerLabel(f.label,swaps)||partnerLabel(target.label,swaps))return;
    const next=[...swaps,{a:f.label,b:target.label,created:new Date().toISOString()}];
    if(!scheduleIsSafe(next))return;
    writeSwaps(next);renderAll();
  }
  function clearSwap(label){
    writeSwaps(readSwaps().filter(x=>x.a!==label&&x.b!==label));renderAll();
  }

  const originalNextSession=nextSession;
  nextSession=function(){
    const swaps=readSwaps(),sched=sortedSchedule(swaps);
    const exact=sched.find(f=>sameDay(effectiveDate(f,swaps),today)&&!isDone(f.label));
    if(exact)return exact;
    const future=sched.find(f=>effectiveDate(f,swaps)>today&&!isDone(f.label));
    return future||sched.find(f=>!isDone(f.label)||f.type==='race')||originalNextSession();
  };

  function ensureMovePanel(){
    const card=$('todayCard');if(!card)return;
    const row=card.querySelector('.action-row');if(!row)return;
    let btn=$('moveWorkoutBtn');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.id='moveWorkoutBtn';btn.textContent='Flytt økt';row.appendChild(btn);
      btn.onclick=()=>{$('moveWorkoutPanel')?.classList.toggle('hidden')};
    }
    if(!$('moveWorkoutPanel')){
      const p=document.createElement('div');p.id='moveWorkoutPanel';p.className='move-workout-panel hidden';row.insertAdjacentElement('afterend',p);
    }
  }
  function renderMovePanel(f){
    ensureMovePanel();const btn=$('moveWorkoutBtn'),panel=$('moveWorkoutPanel');if(!btn||!panel||!f)return;
    const movable=f.type!=='race'&&!isDone(f.label);
    btn.classList.toggle('hidden',!movable);
    if(!movable){panel.classList.add('hidden');return}
    const partner=partnerLabel(f.label),other=partner&&workoutByLabel(partner);
    if(partner&&other){
      btn.textContent='Flyttet økt';
      panel.innerHTML=`<div class="move-head"><b>Smart flytting aktiv</b><span>Planstrukturen er kontrollert</span></div><p><strong>${f.title}</strong> er flyttet fra ${f.label} til ${partner}. <span>${other.title}</span> går motsatt vei.</p><button type="button" class="secondary" id="resetMove">Tilbakestill flytting</button>`;
      $('resetMove').onclick=()=>clearSwap(f.label);return;
    }
    btn.textContent='Flytt økt';
    const choices=candidateSwaps(f);
    panel.innerHTML=`<div class="move-head"><b>Smart flytting</b><span>ingen treningsgjeld</span></div><p>RunnerBear tilbyr bare bytter som beholder key-øktene adskilt og ikke flytter løpet.</p>${choices.length?`<div class="move-options">${choices.map((x,i)=>`<button type="button" data-move-target="${x.target.label}" class="${i===0?'recommended':''}"><span>${x.delta<0?'←':'→'} ${x.target.label}${i===0?' · anbefalt':''}</span><b>Bytt med ${x.target.title}</b></button>`).join('')}</div>`:'<div class="move-none">Ingen trygg flytting ±1 dag uten å svekke rytmen. Da er det bedre å hoppe over/tilpasse enn å komprimere uka.</div>'}`;
    panel.querySelectorAll('[data-move-target]').forEach(b=>b.onclick=()=>applySwap(f,workoutByLabel(b.dataset.moveTarget)));
  }
  function postprocessPlanMoves(){
    const swaps=readSwaps();
    document.querySelectorAll('#weeks .week').forEach(sec=>{
      const h=sec.querySelector('.weekhead h2')?.textContent||'',m=h.match(/Uke\s+(\d+)/),wn=m?Number(m[1]):null;if(!wn)return;
      const wd=flat.filter(f=>f.week===wn),days=sec.querySelector('.days'),nodes=[...days.querySelectorAll('.day')];
      if(nodes.length!==wd.length)return;
      nodes.forEach((node,i)=>{node.dataset.originalLabel=wd[i].label});
      nodes.forEach(node=>{
        const f=workoutByLabel(node.dataset.originalLabel);if(!f)return;
        const ed=effectiveDate(f,swaps),el=effectiveLabel(f,swaps),date=node.querySelector('.daydate'),status=node.querySelector('.daystatus');
        if(date)date.textContent=el;
        node.classList.toggle('today',sameDay(ed,today));
        if(sameDay(ed,today))node.classList.add('open');
        if(status)status.textContent=isDone(f.label)?'✓':sameDay(ed,today)?'I DAG':'›';
        node.querySelectorAll('.move-badge').forEach(x=>x.remove());
        if(partnerLabel(f.label,swaps)){
          const badge=document.createElement('div');badge.className='move-badge';badge.textContent=`Flyttet · opprinnelig ${f.label}`;
          node.querySelector('.day-summary')?.appendChild(badge);
        }
        injectEasyRunShoeLog(node,f);
      });
      nodes.sort((a,b)=>effectiveDate(workoutByLabel(a.dataset.originalLabel),swaps)-effectiveDate(workoutByLabel(b.dataset.originalLabel),swaps)).forEach(n=>days.appendChild(n));
    });
  }
  function postprocessWeekStrip(){
    const w=currentWeek(),wd=flat.filter(f=>f.week===w.n),wrap=$('weekStrip'),nodes=[...wrap.querySelectorAll('.week-mini')],swaps=readSwaps();
    if(nodes.length!==wd.length)return;
    nodes.forEach((n,i)=>n.dataset.originalLabel=wd[i].label);
    nodes.forEach(n=>{
      const f=workoutByLabel(n.dataset.originalLabel),ed=effectiveDate(f,swaps),span=n.querySelector('span');if(!f)return;
      n.classList.toggle('today',sameDay(ed,today));
      if(span)span.textContent=`${effectiveLabel(f,swaps).split(' ')[0]} · ${f.km?f.km+' km':classLabel[f.type]}`;
    });
    nodes.sort((a,b)=>effectiveDate(workoutByLabel(a.dataset.originalLabel),swaps)-effectiveDate(workoutByLabel(b.dataset.originalLabel),swaps)).forEach(n=>wrap.appendChild(n));
  }

  // -----------------------------
  // Shoe × Achilles intelligence
  // -----------------------------
  function flexibleMode(f){
    const saved=localStorage.getItem(`runfest26_easychoice_${slug(f.label)}`);if(saved)return saved;
    if(f.type==='easy')return'run';if(/Zwift/i.test(f.title))return'bike';if(/Concept2|roing/i.test(f.title))return'row';if(f.type==='cross')return'bike';return null;
  }
  function shoeResponseData(){
    const rows=[];
    flat.forEach(f=>{
      const fb=getFeedback(f.label);if(!fb?.shoe||!shoeMeta[fb.shoe]||!['better','same','worse'].includes(fb.achilles))return;
      rows.push({f,shoe:fb.shoe,achilles:fb.achilles});
    });
    return rows;
  }
  function shoeStats(){
    const stats={};Object.keys(shoeMeta).forEach(s=>stats[s]={shoe:s,n:0,better:0,same:0,worse:0});
    shoeResponseData().forEach(x=>{const s=stats[x.shoe];s.n++;s[x.achilles]++});
    return Object.values(stats).filter(x=>x.n>0).sort((a,b)=>b.n-a.n||a.shoe.localeCompare(b.shoe));
  }
  function shoePattern(s){
    if(s.n<3)return{level:'neutral',label:'BYGGER DATA',text:'Minst 3 komplette registreringer før RunnerBear viser et mønster.'};
    const worse=s.worse/s.n;
    if(s.n>=5&&s.worse===0)return{level:'green',label:'STABILT I DINE DATA',text:'Ingen «verre neste morgen» i de registrerte øktene. Fortsett å tolke dette sammen med økttype og belastning.'};
    if(s.n>=4&&worse>=.5)return{level:'yellow',label:'FØLG MED',text:'«Verre neste morgen» går igjen i flere registreringer. Dette er et mønster å følge, ikke bevis på at skoen er årsaken.'};
    return{level:'neutral',label:'BLANDET RESPONS',text:'Ingen tydelig retning ennå. Flere like økter gjør sammenligningen mer nyttig.'};
  }
  function ensureShoeInsight(){
    const wall=$('shoeWall'),card=wall?.closest('.card');if(!wall||!card)return;
    if(!$('shoeAchillesInsight')){
      const panel=document.createElement('section');panel.id='shoeAchillesInsight';panel.className='shoe-achilles-insight';
      panel.innerHTML=`<div class="metric-divider"></div><div class="kicker"><span>SKO × AKILLES</span><span>personlig mønster</span></div><p class="shoe-intro">Bygges kun fra økter der du har registrert <b>faktisk sko</b> og akillesrespons neste morgen.</p><div id="shoeResponseList"></div><p id="shoeDataQuality" class="shoe-data-quality"></p><p class="shoe-causality">Mønster ≠ årsak. Terreng, fart, volum og dagsform kan påvirke samme respons.</p>`;
      wall.insertAdjacentElement('afterend',panel);
    }
  }
  function renderShoeInsight(){
    ensureShoeInsight();const list=$('shoeResponseList'),quality=$('shoeDataQuality');if(!list||!quality)return;
    const stats=shoeStats(),complete=shoeResponseData().length,achTotal=flat.filter(f=>['better','same','worse'].includes(getFeedback(f.label)?.achilles)).length;
    list.innerHTML=stats.length?stats.map(s=>{const p=shoePattern(s);return`<div class="shoe-response ${p.level}"><div><b>${s.shoe}</b><span>${s.n} registrering${s.n===1?'':'er'}</span></div><strong>${p.label}</strong><div class="shoe-response-counts"><span>↑ ${s.better} bedre</span><span>→ ${s.same} lik</span><span>↓ ${s.worse} verre</span></div><small>${p.text}</small></div>`}).join(''):'<div class="shoe-empty">Ingen komplette sko + akilles-registreringer ennå.</div>';
    quality.textContent=achTotal?`${complete}/${achTotal} akillesregistreringer har også eksplisitt faktisk sko. Velg sko i etter-økt-feedback for bedre datakvalitet.`:'Velg faktisk sko + akillesrespons etter nøkkeløkter for å bygge denne analysen.';
  }
  function injectEasyRunShoeLog(node,f){
    node.querySelectorAll('.shoe-achilles-quick').forEach(x=>x.remove());
    if(!isDone(f.label)||f.type==='quality'||f.type==='race'||isLongRun(f)||flexibleMode(f)!=='run')return;
    const body=node.querySelector('.day-body');if(!body)return;
    const fb=getFeedback(f.label),opts=Object.keys(shoeMeta).map(s=>`<option value="${s}" ${fb.shoe===s?'selected':''}>${s}</option>`).join('');
    const box=document.createElement('details');box.className='shoe-achilles-quick';box.innerHTML=`<summary>Sko + akilles neste morgen</summary><div class="shoe-quick-grid" data-shoe-log="${f.label}"><select name="shoe"><option value="">Faktisk sko</option>${opts}</select><div><button type="button" data-shoe-ach="better" class="${fb.achilles==='better'?'active':''}">Bedre</button><button type="button" data-shoe-ach="same" class="${fb.achilles==='same'?'active':''}">Lik</button><button type="button" data-shoe-ach="worse" class="${fb.achilles==='worse'?'active':''}">Verre</button></div></div>`;
    body.appendChild(box);
    const grid=box.querySelector('[data-shoe-log]');grid.querySelector('select').onchange=e=>{const v=getFeedback(f.label);if(e.target.value)v.shoe=e.target.value;else delete v.shoe;setFeedback(f.label,v);renderAll()};
    grid.querySelectorAll('[data-shoe-ach]').forEach(b=>b.onclick=()=>{const v=getFeedback(f.label);v.achilles=b.dataset.shoeAch;setFeedback(f.label,v);renderAll()});
  }

  // -----------------------------
  // Race-week mode
  // -----------------------------
  function actualRaceWeek(){return today>=RACE_WEEK_START&&today<=RACE_WEEK_END}
  function raceChecklist(){const v=safeJson(RACE_CHECK_KEY,{});return Array.isArray(v)?{}:v}
  function writeRaceChecklist(v){localStorage.setItem(RACE_CHECK_KEY,JSON.stringify(v))}
  function selectedRaceGoal(){
    const saved=Number(localStorage.getItem(RACE_GOAL_KEY)||0);if([4980,5040,5100].includes(saved))return saved;
    const active=Number(document.querySelector('.goal.active')?.dataset.goal||4980);return[4980,5040,5100].includes(active)?active:4980;
  }
  function raceTargetInfo(){
    const selected=selectedRaceGoal(),g2=gateVal(2);
    if(g2==='red')return{seconds:5070,title:'1:24:30–1:25',pace:'ca. 4:00–4:02/km',note:'Gate 2 var rød. Racefarten skal ikke tvinges.'};
    if(g2==='yellow'&&selected<5040)return{seconds:5040,title:'ca. 1:24',pace:'ca. 3:59/km',note:'Gate 2 var gul. La løpet komme til deg før eventuell progresjon.'};
    const labels={4980:'1:23',5040:'1:24',5100:'1:25'};
    return{seconds:selected,title:labels[selected],pace:`${paceFmt(selected/21.0975)}/km`,note:g2==='green'?'Gate 2 støtter valgt mål. Åpne fortsatt kontrollert.':'Målet er foreløpig en korridor; Gate 2 er ikke registrert.'};
  }
  function ensureRaceWeekUI(){
    const aside=document.querySelector('#today aside.stack');if(aside&&!$('raceWeekCard')){
      const card=document.createElement('article');card.id='raceWeekCard';card.className='card race-week-card hidden';
      card.innerHTML=`<div class="kicker"><span>RACE WEEK</span><span id="raceWeekDays">–</span></div><h2>Friskhet &gt; formjakt</h2><div class="race-week-target"><span>RACEMÅL</span><strong id="raceWeekTarget">–</strong><b id="raceWeekPace">–</b></div><p id="raceWeekNote"></p><div class="race-week-checks" id="raceWeekChecks"></div><div class="race-week-rules"><b>Denne uka</b><span>Ingen ekstra volum · behold korte doser fart · ingen nye sko, gel eller formtester.</span></div>`;
      aside.insertBefore(card,aside.firstChild);
    }
    const race=$('race'),head=race?.querySelector('.section-head');
    if(race&&head&&!$('raceWeekFeatureNote')){
      const note=document.createElement('div');note.id='raceWeekFeatureNote';note.className='race-week-feature-note';note.innerHTML='<b>Race Week-modus</b><span>Aktiveres automatisk 28. september. Da forenkles «I dag» til friskhet, raceplan og gjennomføring.</span>';
      head.insertAdjacentElement('afterend',note);
    }
  }
  function renderRaceWeek(){
    ensureRaceWeekUI();const active=actualRaceWeek(),card=$('raceWeekCard');document.body.classList.toggle('race-week-mode',active);if(!card)return;
    card.classList.toggle('hidden',!active);if(!active)return;
    const days=Math.max(0,Math.ceil((startOfDay(RACE)-startOfDay(today))/86400000)),t=raceTargetInfo(),checks=raceChecklist();
    $('raceWeekDays').textContent=days===0?'LØPSDAG':`${days} dager`;$('raceWeekTarget').textContent=t.title;$('raceWeekPace').textContent=t.pace;$('raceWeekNote').textContent=t.note;
    const items=[['shoes','Racesko testet og bestemt'],['fuel','Frokost + gel-plan testet'],['logistics','Transport/start/oppvarming avklart'],['achilles','Akilles stabil siste morgen']];
    $('raceWeekChecks').innerHTML=items.map(([k,l])=>`<label><input type="checkbox" data-race-check="${k}" ${checks[k]?'checked':''}><span>${l}</span></label>`).join('');
    $('raceWeekChecks').querySelectorAll('[data-race-check]').forEach(i=>i.onchange=()=>{const v=raceChecklist();v[i.dataset.raceCheck]=i.checked;writeRaceChecklist(v);renderRaceWeek()});
  }
  function bindRaceGoalPersistence(){
    document.querySelectorAll('.goal').forEach(b=>{
      if(b.dataset.rbGoalBound)return;b.dataset.rbGoalBound='1';
      b.addEventListener('click',()=>{localStorage.setItem(RACE_GOAL_KEY,b.dataset.goal);renderRaceWeek()});
    });
  }

  // -----------------------------
  // Renderer integration
  // -----------------------------
  const previousRenderToday=renderToday;
  renderToday=function(){
    previousRenderToday();const f=nextSession();if(!f)return;
    const ed=effectiveDate(f),moved=partnerLabel(f.label);
    $('todayDate').textContent=sameDay(ed,today)?(moved?'I dag · flyttet':'I dag'):effectiveLabel(f);
    renderMovePanel(f);renderRaceWeek();
  };

  const previousRenderPlan=renderPlan;
  renderPlan=function(){previousRenderPlan();postprocessPlanMoves()};

  const previousRenderWeekStrip=renderWeekStrip;
  renderWeekStrip=function(){previousRenderWeekStrip();postprocessWeekStrip()};

  const previousRenderShoes=renderShoes;
  renderShoes=function(){previousRenderShoes();renderShoeInsight()};

  const previousBuildStatusText=buildStatusText;
  buildStatusText=function(){
    const swaps=readSwaps(),shoe=shoeStats().filter(s=>s.n>=3).map(s=>`${s.shoe}: ${s.better}/${s.same}/${s.worse} bedre/lik/verre`).join('; ');
    return previousBuildStatusText()+`${swaps.length?`\nFlyttede økter: ${swaps.map(x=>`${x.a} ↔ ${x.b}`).join(', ')}.`:''}${shoe?`\nSko × akilles: ${shoe}.`:''}`;
  };

  const previousRenderAll=renderAll;
  renderAll=function(){previousRenderAll();renderRaceWeek();bindRaceGoalPersistence()};

  if($('weekFilter'))$('weekFilter').onchange=()=>renderPlan();

  ensureMovePanel();ensureShoeInsight();ensureRaceWeekUI();bindRaceGoalPersistence();renderAll();
})();
