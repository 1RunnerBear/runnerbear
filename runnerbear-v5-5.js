/* RunnerBear v5.5 · flexible easy-day selector
   Keeps Bakken guardrails: easy stays easy, long runs remain run-first, and cross-training
   is recorded separately from actual running kilometres. Zwift is available from 9 Aug 2026. */
(function(){
  const MODE_KEY=label=>`runfest26_easychoice_${slug(label)}`;
  const modeMeta={
    run:{icon:'🏃',name:'Rolig jogg'},
    row:{icon:'🚣',name:'Concept2'},
    bike:{icon:'🚴',name:'Zwift'}
  };
  function isLongRun(f){return /langtur/i.test(f.title)}
  function isFlexible(f){return f.type==='easy'||f.type==='cross'||(f.type==='rest'&&/Zwift|roing|Concept2/i.test(f.title))}
  function bikeAvailable(f){return true}
  function defaultMode(f){
    if(isLongRun(f)||f.type==='easy')return'run';
    if(f.type==='cross')return bikeAvailable(f)?'bike':'row';
    return'row';
  }
  function selectedMode(f){
    const saved=localStorage.getItem(MODE_KEY(f.label));
    if(saved==='bike'&&!bikeAvailable(f))return defaultMode(f);
    return saved&&modeMeta[saved]?saved:defaultMode(f);
  }
  function setMode(f,mode){
    if(mode==='bike'&&!bikeAvailable(f))return;
    localStorage.setItem(MODE_KEY(f.label),mode);
  }
  function runKm(f){
    if(f.km>0)return f.km;
    if(f.type==='cross')return /31\. aug/i.test(f.label)?4.5:5.5;
    return 0;
  }
  function rowMinutes(f){
    if(isLongRun(f))return f.km>=18?'70–85':f.km>=15?'65–80':'60–75';
    const km=runKm(f);
    if(km>=9)return'45–55';
    if(km>=7)return'40–50';
    if(km>=5)return'35–45';
    return'30–40';
  }
  function bikeMinutes(f){
    if(isLongRun(f))return f.km>=18?'80–95':f.km>=15?'75–90':'70–85';
    const km=runKm(f);
    if(km>=9)return'50–60';
    if(km>=7)return'45–55';
    if(km>=5)return'40–50';
    return'35–45';
  }
  function runPrescription(f){
    const km=runKm(f);
    if(isLongRun(f))return{title:`${km} km rolig løp`,big:`${km} km`,line:'Hold planlagt rolig puls og jevn flyt. Ingen ekstra progresjon utover det som står i planen.',gear:f.shoe?`👟 ${f.shoe}`:'👟 Komfortabel roligsko'};
    if(f.type==='cross')return{title:`${km} km svært rolig løp`,big:`${km} km`,line:'HR hovedsakelig 125–142. Dette er et lett alternativ – ikke en ekstra moderat økt.',gear:'👟 Nike Vomero Premium / komfortabel easy-sko'};
    const t=targetSummary(f);
    return{title:`${km} km rolig løp`,big:`${km} km`,line:`${t.hr!=='–'?t.hr+'. ':''}Snakketempo og avslappet steg.`,gear:f.shoe?`👟 ${f.shoe}`:'👟 Komfortabel roligsko'};
  }
  function prescription(f,mode){
    if(mode==='run')return runPrescription(f);
    if(mode==='row')return{title:`Concept2 · ${rowMinutes(f)} min`,big:`${rowMinutes(f)} min`,line:'RPE 2–3/10 · 18–22 spm · jevn, lett aerob roing. Du skal kunne snakke i hele setninger.',gear:'🚣 Concept2 RowErg'};
    return{title:`Zwift · ${bikeMinutes(f)} min`,big:`${bikeMinutes(f)} min`,line:'Z1/Z2 · RPE 2–3/10 · ca. 85–95 rpm. Ingen tempo-/sweetspot-blokker.',gear:'🚴 Zwift · lett sykling'};
  }
  function selectorHTML(f,compact=false){
    const mode=selectedMode(f),p=prescription(f,mode),long=isLongRun(f),bikeOK=bikeAvailable(f);
    return`<div class="easy-choice ${compact?'compact':''}" data-easy-date="${f.label}">
      <div class="easy-choice-head"><span>${long?'ROLIG VALG · LANGTUR':'VELG ROLIG ØKT'}</span><b>${long?'LØP ANBEFALT':'VELG SELV'}</b></div>
      <div class="easy-choice-buttons">
        ${['run','row','bike'].map(m=>`<button type="button" data-mode="${m}" class="${mode===m?'active':''}" ${m==='bike'&&!bikeOK?'disabled':''}><span>${modeMeta[m].icon}</span>${modeMeta[m].name}</button>`).join('')}
      </div>
      <div class="easy-prescription"><strong>${p.title}</strong><span>${p.line}</span><small>${p.gear}</small>${long&&mode!=='run'?'<em>Cross er reserve her. Langturen er en viktig del av halvmaratonspesifisiteten når kroppen tillater løping.</em>':''}</div>
    </div>`;
  }
  function bindSelectors(root=document){
    root.querySelectorAll('[data-easy-date]').forEach(box=>{
      const f=flat.find(x=>x.label===box.dataset.easyDate);if(!f)return;
      box.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{setMode(f,btn.dataset.mode);renderAll()});
    });
  }
  function actualWeekStats(w){
    const wd=flat.filter(f=>f.week===w.n&&isDone(f.label));let run=0,row=0,bike=0;
    wd.forEach(f=>{
      if(isFlexible(f)){
        const m=selectedMode(f);if(m==='run')run+=runKm(f);else if(m==='row')row++;else if(m==='bike')bike++;
      }else if(f.km>0){run+=f.km}
    });
    return{run,row,bike,cross:row+bike};
  }
  function applyTodayMode(f){
    const mode=selectedMode(f),p=prescription(f,mode);
    if(mode==='run')return;
    $('todayPace').textContent=mode==='row'?'RPE 2–3':'Z1/Z2';
    $('todayHr').textContent=mode==='row'?'snakketempo':'RPE 2–3';
    $('todayKm').textContent=p.big;
    $('todayShoe').textContent=p.gear;
  }
  const baseRenderToday=renderToday;
  renderToday=function(){
    baseRenderToday();
    const f=nextSession();if(!isFlexible(f))return;
    const purpose=$('todayCard').querySelector('.purpose');
    if(purpose)purpose.insertAdjacentHTML('afterend',selectorHTML(f));
    bindSelectors($('todayCard'));applyTodayMode(f);
  };
  const baseRenderPlan=renderPlan;
  renderPlan=function(){
    baseRenderPlan();
    document.querySelectorAll('.day').forEach(day=>{
      const label=day.querySelector('.daydate')?.textContent;const f=flat.find(x=>x.label===label);if(!f||!isFlexible(f))return;
      const body=day.querySelector('.day-body'),actions=day.querySelector('.day-actions');
      if(body&&actions)actions.insertAdjacentHTML('beforebegin',selectorHTML(f,true));
    });
    bindSelectors($('weeks'));
  };
  const baseRenderWeekStrip=renderWeekStrip;
  renderWeekStrip=function(){
    baseRenderWeekStrip();
    const w=currentWeek(),stats=actualWeekStats(w);
    $('weekKmTop').textContent=`${stats.run.toFixed(1).replace('.0','')} løpskm · ${stats.cross} cross`;
    const minis=[...$('weekStrip').querySelectorAll('.week-mini')],wd=flat.filter(f=>f.week===w.n);
    minis.forEach((el,i)=>{const f=wd[i];if(!f||!isFlexible(f))return;const m=selectedMode(f),b=el.querySelector('b');if(b)b.insertAdjacentHTML('beforeend',` <small class="mode-mini">· ${modeMeta[m].icon} ${modeMeta[m].name}</small>`)});
  };
  const baseRenderReview=renderReview;
  renderReview=function(){
    baseRenderReview();
    const stats=actualWeekStats(currentWeek());
    $('reviewText').textContent+=` Faktisk så langt: ${stats.run.toFixed(1).replace('.0','')} løpskm${stats.cross?` + ${stats.cross} crossøkt${stats.cross===1?'':'er'}`:''}.`;
  };
  const baseBuildStatusText=buildStatusText;
  buildStatusText=function(){
    const w=currentWeek(),s=actualWeekStats(w);
    return baseBuildStatusText()+`\nFaktisk aktivitet: ${s.run.toFixed(1).replace('.0','')} løpskm · ${s.row} Concept2 · ${s.bike} Zwift.`;
  };
  const baseEvidence=evidence;
  evidence=function(){
    const ev=baseEvidence();
    const recent=flat.filter(f=>f.km>0&&f.date<=today).slice(-10);
    const runDone=recent.filter(f=>isDone(f.label)&&(!isFlexible(f)||selectedMode(f)==='run')).length;
    const idx=ev.findIndex(x=>x.name==='Kontinuitet');
    if(idx>=0&&recent.length)ev[idx]={name:'Løpsspesifisitet',state:runDone/recent.length>=.75?'green':runDone/recent.length>=.5?'yellow':'neutral',text:`${runDone}/${recent.length} siste planlagte løpeøkter ble faktisk løpt. Cross støtter formen, men teller separat.`};
    return ev;
  };
  const style=document.createElement('style');style.textContent=`
    .easy-choice{margin:14px 0;padding:13px;border:1px solid #263143;border-radius:15px;background:#0c121a}.easy-choice-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:10px;letter-spacing:.1em;font-weight:800;color:#8f9caf}.easy-choice-head b{color:#72e3a6}.easy-choice-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.easy-choice-buttons button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border:1px solid #2a3548;background:#111925;color:#dbe3ed;border-radius:10px;padding:8px;font-weight:700}.easy-choice-buttons button.active{border-color:#72e3a6;background:#13251d;color:#f5fff9}.easy-choice-buttons button:disabled{opacity:.38;cursor:not-allowed}.easy-prescription{display:grid;gap:4px;margin-top:10px;padding:10px 11px;border-radius:11px;background:#ffffff07}.easy-prescription strong{font-size:14px}.easy-prescription span,.easy-prescription small{color:#aab5c5;font-size:11px}.easy-prescription em{font-style:normal;color:#f0cd7d;font-size:10px;margin-top:3px}.easy-choice.compact{margin:11px 0;padding:10px}.easy-choice.compact .easy-prescription{padding:8px}.mode-mini{font-size:10px;color:#8f9caf;font-weight:600}@media(max-width:640px){.easy-choice-buttons button{font-size:11px;padding:8px 4px}.easy-choice-head{font-size:9px}}
  `;document.head.appendChild(style);
  renderAll();
})();
