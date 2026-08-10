/* RunnerBear v7.6 · Season & History
   Read-first season timeline, long-term ledger and year-by-year history.
   Does not change workout selection or coach decisions. */
(function(){
  'use strict';
  const LEGACY='runfest-2026';
  const K={goals:'runnerbear_v7_goals',blocks:'runnerbear_v7_blocks',ledger:'runnerbear_v7_weekledger'};
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso=d=>{const x=d instanceof Date?d:new Date(d);const z=n=>String(n).padStart(2,'0');return`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const date=s=>new Date(String(s).slice(0,10)+'T12:00:00');
  const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const fmt=s=>{if(!s)return'–';try{return new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'}).format(date(s))}catch{return s}};
  const fmtShort=s=>{if(!s)return'–';try{return new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(date(s))}catch{return s}};
  const paceSec=p=>{const m=String(p||'').match(/(\d+):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const activeGoal=()=>window.RunnerBearV7?.activeGoal?.()||null;
  const goals=()=>{const g=window.RunnerBearV7?.goals?.()||read(K.goals,[]);return Array.isArray(g)?g:[]};
  const blocks=()=>{const b=read(K.blocks,[]);return Array.isArray(b)?b:[]};
  const goalName=id=>goals().find(g=>g.id===id)?.name||'RunnerBear';
  const yearOf=s=>s?Number(String(s).slice(0,4)):null;
  const toneForStatus=s=>s==='completed'?'green':s==='active'?'green':s==='paused'?'yellow':'neutral';
  const statusText=s=>s==='completed'?'Fullført':s==='active'?'Aktiv':s==='paused'?'Pauset':s==='archived'?'Arkivert':'Planlagt';
  const goalTypeText=t=>({race:'Løp',performance:'Prestasjon',capacity:'Kapasitet',maintenance:'Vedlikehold'}[t]||'Mål');

  function currentPlanSnapshot(){
    const g=activeGoal();if(!g||g.id===LEGACY||!window.RunnerBearAdaptive?.adaptivePlan)return null;
    const a=window.RunnerBearAdaptive.adaptivePlan(g),w=a?.weeks?.[0];if(!w)return null;
    const mon=monday(new Date()),start=iso(mon),end=iso(add(mon,6));
    return{goalId:g.id,weekStart:start,weekEnd:end,plannedKm:Number(w.km||0),focus:w.focus||'',capturedAt:new Date().toISOString(),sessions:(w.days||[]).map(d=>({date:iso(d.date),type:d.type,title:d.title,km:Number(d.km||0)}))};
  }
  function captureCurrentWeek(){
    const snap=currentPlanSnapshot();if(!snap)return;
    let rows=read(K.ledger,[]);if(!Array.isArray(rows))rows=[];
    const i=rows.findIndex(x=>x.goalId===snap.goalId&&x.weekStart===snap.weekStart),today=iso(new Date());
    if(i<0)rows.push(snap);else if(rows[i].weekEnd>=today)rows[i]=snap;
    rows.sort((a,b)=>String(a.weekStart).localeCompare(String(b.weekStart)));write(K.ledger,rows.slice(-180));
  }
  function permanentWeekRows(){
    const rows=read(K.ledger,[]);if(!Array.isArray(rows))return[];
    return rows.map(r=>{const actual=(r.sessions||[]).reduce((sum,s)=>sum+(localStorage.getItem(`runnerbear_v7_done_${r.goalId}_${s.date}`)==='1'?Number(s.km||0):0),0);const done=(r.sessions||[]).filter(s=>localStorage.getItem(`runnerbear_v7_done_${r.goalId}_${s.date}`)==='1').length;return Object.assign({},r,{actualKm:actual,done,goalName:goalName(r.goalId),source:'v7'})});
  }
  function legacyWeekRows(){
    try{
      if(typeof weeks==='undefined'||typeof flat==='undefined'||typeof isDone!=='function')return[];
      return weeks.map(w=>{const wd=flat.filter(f=>f.week===w.n),start=iso(wd[0].date),end=iso(wd[wd.length-1].date),actual=wd.filter(f=>isDone(f.label)).reduce((a,f)=>a+Number(f.km||0),0),done=wd.filter(f=>isDone(f.label)).length;return{goalId:LEGACY,goalName:'Runfest Sandnes 21K',weekStart:start,weekEnd:end,plannedKm:Number(w.km||0),actualKm:actual,done,sessions:wd.map(f=>({date:iso(f.date),type:f.type,title:f.title,km:Number(f.km||0)})),focus:w.focus||'',source:'legacy'}});
    }catch{return[]}
  }
  function weekRows(){
    const map=new Map();[...legacyWeekRows(),...permanentWeekRows()].forEach(r=>map.set(`${r.goalId}_${r.weekStart}`,r));return[...map.values()].sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
  }
  function thresholdRows(){
    try{if(typeof thresholdHistory==='function')return thresholdHistory().map(x=>({date:x.date,pace:x.pace,hr:x.hr,source:x.source||'Garmin'}))}catch{}
    let extra=[];try{extra=JSON.parse(localStorage.getItem('runfest26_threshold_history')||'[]')}catch{}
    return[{date:'2026-08-09',pace:'4:02',hr:175,source:'Garmin'},...extra].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function evidenceRows(){
    const out=[];for(const g of goals()){
      try{const rows=window.RunnerBearEvidence?.allEvidence?.(g)||[];rows.forEach(r=>{const cmp=window.RunnerBearEvidence?.compareEvidence?.(g,r)||{tone:'neutral',label:'Registrert'};out.push(Object.assign({},r,{goalName:g.name,tone:cmp.tone,label:cmp.label}))})}catch{}
    }return out.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function availableYears(){
    const ys=new Set([new Date().getFullYear()]);goals().forEach(g=>{[g.eventDate,g.createdAt,g.updatedAt,g.result?.date].forEach(x=>{const y=yearOf(x);if(y)ys.add(y)})});blocks().forEach(b=>{[b.start,b.end].forEach(x=>{const y=yearOf(x);if(y)ys.add(y)})});weekRows().forEach(w=>ys.add(yearOf(w.weekStart)));thresholdRows().forEach(x=>ys.add(yearOf(x.date)));evidenceRows().forEach(x=>ys.add(yearOf(x.date)));return[...ys].filter(Boolean).sort((a,b)=>b-a);
  }

  function seasonItems(year){
    const gs=goals(),items=[];
    blocks().forEach(b=>{if(yearOf(b.start)!==year&&yearOf(b.end)!==year)return;items.push({kind:'block',start:b.start,end:b.end,title:b.name||'Treningsblokk',subtitle:goalName(b.goalId),status:b.status||'planned',tone:toneForStatus(b.status),sort:b.start||b.end})});
    gs.filter(g=>g.type==='race'&&yearOf(g.eventDate)===year).forEach(g=>items.push({kind:'race',start:g.eventDate,end:g.eventDate,title:g.name,subtitle:`${g.priority?g.priority+'-løp · ':''}${g.targetLabel?`mål ${g.targetLabel}`:'konkurranse'}`,status:g.status,tone:toneForStatus(g.status),sort:g.eventDate,result:g.result}));
    gs.filter(g=>g.type!=='race'&&yearOf(g.createdAt)===year).forEach(g=>{if(items.some(x=>x.kind==='block'&&x.subtitle===g.name))return;items.push({kind:'goal',start:String(g.createdAt).slice(0,10),end:'',title:g.name,subtitle:goalTypeText(g.type),status:g.status,tone:toneForStatus(g.status),sort:String(g.createdAt).slice(0,10)})});
    gs.filter(g=>g.type==='race'&&g.status==='completed'&&yearOf(g.eventDate)===year).forEach(g=>items.push({kind:'recovery',start:iso(add(date(g.eventDate),1)),end:iso(add(date(g.eventDate),7)),title:'Recovery',subtitle:`Etter ${g.name}`,status:'completed',tone:'neutral',sort:iso(add(date(g.eventDate),1))}));
    return items.sort((a,b)=>String(a.sort).localeCompare(String(b.sort)));
  }
  function yearStats(year){
    const wr=weekRows().filter(w=>yearOf(w.weekStart)===year&&date(w.weekStart)<=new Date()),planned=wr.reduce((a,w)=>a+Number(w.plannedKm||0),0),actual=wr.reduce((a,w)=>a+Number(w.actualKm||0),0),quality=wr.reduce((a,w)=>a+(w.sessions||[]).filter(s=>s.type==='quality'&&localStorage.getItem(w.source==='legacy'?legacyDoneKeyForDate(w,s.date):`runnerbear_v7_done_${w.goalId}_${s.date}`)==='1').length,0),races=goals().filter(g=>g.type==='race'&&g.status==='completed'&&yearOf(g.eventDate)===year).length;
    const th=thresholdRows().filter(x=>yearOf(x.date)===year),first=th[0],last=th[th.length-1],diff=first&&last?paceSec(first.pace)-paceSec(last.pace):null;
    return{weeks:wr.length,planned,actual,avg:wr.length?actual/wr.length:0,quality,races,thresholdDiff:diff,thresholdLast:last};
  }
  function legacyDoneKeyForDate(w,ds){
    try{const f=flat.find(x=>iso(x.date)===ds);return f?`runfest26_date_${f.label.toLowerCase().replace(/\s+/g,'_')}`:'__none__'}catch{return'__none__'}
  }

  function ensureSubnav(){
    const view=document.getElementById('goals');if(!view)return;let nav=document.getElementById('rbGoalSubnav');if(nav)return;
    nav=document.createElement('div');nav.id='rbGoalSubnav';nav.className='rb-goal-subnav';nav.innerHTML='<button data-rb-goalview="now">Nå</button><button data-rb-goalview="season">Sesong</button><button data-rb-goalview="history">Historikk</button>';
    view.querySelector('.section-head')?.insertAdjacentElement('afterend',nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>setMode(b.dataset.rbGoalview));
  }
  function ensureViews(){
    const view=document.getElementById('goals');if(!view)return;ensureSubnav();if(!document.getElementById('rbSeasonView')){const s=document.createElement('div');s.id='rbSeasonView';s.className='rb-history-panel';document.getElementById('goalHistory')?.insertAdjacentElement('afterend',s)}if(!document.getElementById('rbHistoryView')){const h=document.createElement('div');h.id='rbHistoryView';h.className='rb-history-panel';document.getElementById('rbSeasonView')?.insertAdjacentElement('afterend',h)}
  }
  function mode(){return sessionStorage.getItem('runnerbear_v76_goalview')||'now'}
  function setMode(m){sessionStorage.setItem('runnerbear_v76_goalview',m);renderAllHistory()}
  function applyMode(){
    const m=mode(),dash=document.getElementById('goalDashboard'),old=document.getElementById('goalHistory'),s=document.getElementById('rbSeasonView'),h=document.getElementById('rbHistoryView');if(!dash||!s||!h)return;
    dash.style.display=m==='now'?'':'none';if(old)old.style.display=m==='now'?'':'none';s.style.display=m==='season'?'':'none';h.style.display=m==='history'?'':'none';document.querySelectorAll('#rbGoalSubnav button').forEach(b=>b.classList.toggle('active',b.dataset.rbGoalview===m));
  }

  function renderSeason(){
    const el=document.getElementById('rbSeasonView');if(!el)return;const years=availableYears(),year=Number(sessionStorage.getItem('runnerbear_v76_year')||years[0]),items=seasonItems(year),stats=yearStats(year);
    el.innerHTML=`<article class="card rb-season-hero"><div class="kicker"><span>SESONG</span><select id="rbSeasonYear">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></div><div class="rb-season-stats"><div><span>Registrert løping</span><b>${stats.actual.toFixed(1).replace('.0','')} km</b></div><div><span>Snitt / startet uke</span><b>${stats.avg.toFixed(1)} km</b></div><div><span>Kvalitetsøkter</span><b>${stats.quality}</b></div><div><span>Race fullført</span><b>${stats.races}</b></div></div>${stats.thresholdLast?`<div class="rb-season-th"><span>Siste terskel</span><b>${esc(stats.thresholdLast.pace)}/km · ${esc(stats.thresholdLast.hr)} bpm</b><small>${stats.thresholdDiff>0?`${stats.thresholdDiff} sek/km raskere enn første registrering i ${year}`:stats.thresholdDiff<0?`${Math.abs(stats.thresholdDiff)} sek/km svakere enn første registrering i ${year}`:'stabil mot første registrering'}</small></div>`:''}</article><article class="card rb-season-timeline"><div class="kicker"><span>SESONGLINJE</span><span>${items.length} elementer</span></div>${items.length?`<div class="rb-timeline">${items.map(i=>`<div class="rb-timeline-item ${i.kind}"><i></i><div class="rb-timeline-date">${fmtShort(i.start)}${i.end&&i.end!==i.start?` → ${fmtShort(i.end)}`:''}</div><div class="rb-timeline-body"><span>${i.kind==='race'?'RACE':i.kind==='block'?'BLOKK':i.kind==='recovery'?'RECOVERY':'MÅL'}</span><b>${esc(i.title)}</b><small>${esc(i.subtitle)}${i.result?.time?` · ${esc(i.result.time)}`:''}</small></div><em class="status-pill ${i.tone}">${statusText(i.status)}</em></div>`).join('')}</div>`:'<div class="rb-empty-history">Ingen sesongelementer registrert dette året ennå.</div>'}</article>${renderLoadHistory(year,true)}`;
    document.getElementById('rbSeasonYear').onchange=e=>{sessionStorage.setItem('runnerbear_v76_year',e.target.value);renderSeason()};
  }

  function renderLoadHistory(year,compact=false){
    const rows=weekRows().filter(w=>yearOf(w.weekStart)===year&&date(w.weekStart)<=new Date()).slice(compact?-12:-30),max=Math.max(1,...rows.map(w=>Number(w.plannedKm||0)));if(!rows.length)return`<article class="card rb-load-history"><div class="kicker"><span>UKESVOLUM</span><span>historikk</span></div><div class="rb-empty-history">Volumhistorikken bygges når uker blir registrert.</div></article>`;
    return`<article class="card rb-load-history"><div class="kicker"><span>UKESVOLUM</span><span>faktisk / planlagt</span></div><div class="rb-week-bars">${rows.map(w=>`<div class="rb-week-bar"><div class="rb-week-bar-label"><span>${fmtShort(w.weekStart)}</span><b>${w.actualKm.toFixed(1).replace('.0','')} / ${Number(w.plannedKm||0).toFixed(0)} km</b></div><div class="rb-week-track"><i style="width:${Math.min(100,Number(w.plannedKm||0)/max*100)}%"></i><b style="width:${Math.min(100,Number(w.actualKm||0)/max*100)}%"></b></div><small>${esc(w.goalName)}${w.focus?` · ${esc(w.focus)}`:''}</small></div>`).join('')}</div></article>`;
  }

  function renderHistory(){
    const el=document.getElementById('rbHistoryView');if(!el)return;const years=availableYears(),year=Number(sessionStorage.getItem('runnerbear_v76_history_year')||years[0]),gs=goals().filter(g=>yearOf(g.eventDate||g.createdAt||g.updatedAt)===year),races=gs.filter(g=>g.type==='race'),ths=thresholdRows().filter(x=>yearOf(x.date)===year),ev=evidenceRows().filter(x=>yearOf(x.date)===year),stats=yearStats(year);
    el.innerHTML=`<article class="card rb-history-head"><div class="kicker"><span>HISTORIKK</span><select id="rbHistoryYear">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></div><h2>${year}</h2><p>Langtidsbildet bygges fra mål, blokker, gjennomførte uker, terskel og Evidence.</p><div class="rb-history-kpis"><div><strong>${stats.actual.toFixed(1).replace('.0','')}</strong><span>km registrert</span></div><div><strong>${stats.quality}</strong><span>kvalitet</span></div><div><strong>${ev.length}</strong><span>evidence</span></div><div><strong>${races.filter(r=>r.status==='completed').length}</strong><span>race</span></div></div></article>${renderRaceHistory(races)}${renderThresholdHistory(ths)}${renderEvidenceHistory(ev)}${renderLoadHistory(year,false)}${renderGoalArchive(gs)}`;
    document.getElementById('rbHistoryYear').onchange=e=>{sessionStorage.setItem('runnerbear_v76_history_year',e.target.value);renderHistory()};
  }
  function renderRaceHistory(races){return`<article class="card rb-history-section"><div class="kicker"><span>KONKURRANSER</span><span>${races.length}</span></div>${races.length?`<div class="rb-history-rows">${races.slice().sort((a,b)=>String(b.eventDate).localeCompare(String(a.eventDate))).map(g=>`<div><span>${fmt(g.eventDate)}</span><div><b>${esc(g.name)}</b><small>${g.targetLabel?`Mål ${esc(g.targetLabel)}`:'Ingen måltid'}${g.result?.time?` · resultat ${esc(g.result.time)}`:''}</small></div><em>${statusText(g.status)}</em></div>`).join('')}</div>`:'<div class="rb-empty-history">Ingen konkurranser registrert dette året.</div>'}</article>`}
  function renderThresholdHistory(rows){return`<article class="card rb-history-section"><div class="kicker"><span>TERSKEL</span><span>${rows.length} målinger</span></div>${rows.length?`<div class="rb-th-history">${rows.slice().reverse().map((x,i,a)=>{const prev=a[i+1],d=prev?paceSec(prev.pace)-paceSec(x.pace):0;return`<div><span>${fmt(x.date)}</span><b>${esc(x.pace)}/km</b><span>${esc(x.hr)} bpm</span><em>${d>0?`+${d}s`:d<0?`${d}s`:'referanse'}</em></div>`}).join('')}</div>`:'<div class="rb-empty-history">Ingen terskelmålinger dette året.</div>'}</article>`}
  function renderEvidenceHistory(rows){return`<article class="card rb-history-section"><div class="kicker"><span>EVIDENCE</span><span>${rows.length}</span></div>${rows.length?`<div class="rb-history-rows">${rows.slice(-10).reverse().map(r=>`<div><span>${fmt(r.date)}</span><div><b>${esc(r.workoutName)}</b><small>${esc(r.goalName)} · ${r.pace?`${esc(r.pace)}/km`: 'fart –'} · HR ${r.hr||'–'} · RPE ${r.rpe||'–'}</small></div><em class="rb-history-tone ${r.tone}">${esc(r.label)}</em></div>`).join('')}</div>`:'<div class="rb-empty-history">Evidence-historikken bygges når permanente mål får registrerte nøkkeløkter.</div>'}</article>`}
  function renderGoalArchive(gs){return`<article class="card rb-history-section"><div class="kicker"><span>MÅL & BLOKKER</span><span>${gs.length}</span></div>${gs.length?`<div class="rb-goal-archive">${gs.slice().reverse().map(g=>`<div><span class="status-pill ${toneForStatus(g.status)}">${statusText(g.status)}</span><div><b>${esc(g.name)}</b><small>${goalTypeText(g.type)}${g.eventDate?` · ${fmt(g.eventDate)}`:''}</small></div></div>`).join('')}</div>`:'<div class="rb-empty-history">Ingen mål registrert dette året.</div>'}</article>`}

  function ensureMoreHistoryCard(){
    const more=document.getElementById('more'),anchor=document.getElementById('rbWorkoutLibraryCard')||document.getElementById('rbWeekRhythmCard')||document.getElementById('trainingProfileCard');if(!more||!anchor)return;let card=document.getElementById('rbHistoryShortcut');if(card)return;card=document.createElement('article');card.id='rbHistoryShortcut';card.className='card rb-history-shortcut';card.innerHTML='<div class="kicker"><span>SESONG & HISTORIKK</span><span>LANGSIKTIG</span></div><div><h3>Se hele løperreisen</h3><p>Mål, blokker, race, terskel, Evidence og ukesvolum samlet år for år.</p></div><button class="secondary" id="openRunnerHistory">Åpne historikk</button>';anchor.insertAdjacentElement('afterend',card);document.getElementById('openRunnerHistory').onclick=()=>{document.querySelector('.navbtn[data-tab="goals"]')?.click();setTimeout(()=>setMode('history'),0)};
  }

  function renderAllHistory(){ensureViews();captureCurrentWeek();renderSeason();renderHistory();applyMode();ensureMoreHistoryCard()}
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;renderAllHistory()})}
  const goalDash=document.getElementById('goalDashboard'),goalOldHistory=document.getElementById('goalHistory');if(goalDash)new MutationObserver(queue).observe(goalDash,{childList:true,subtree:true});if(goalOldHistory)new MutationObserver(queue).observe(goalOldHistory,{childList:true,subtree:true});
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const r=prev.apply(this,arguments);queue();return r};
  document.addEventListener('click',e=>{if(e.target.closest('.navbtn[data-tab="goals"],#saveGoal,#archiveGoal,[data-activate-goal],#saveRaceResult,#saveProfile,#saveRhythm,.rb-save-evidence'))setTimeout(queue,0)},true);
  window.RunnerBearHistory={weekRows,thresholdRows,evidenceRows,seasonItems,yearStats,render:renderAllHistory,setMode};
  queue();
})();