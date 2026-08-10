/* RunnerBear v7.4–7.5 · Workout Library + Evidence Engine
   Permanent-goal layer only. Legacy Runfest remains untouched. */
(function(){
  'use strict';
  const LEGACY='runfest-2026';
  const PROFILE='runnerbear_v7_profile';
  const E_PREFIX='runnerbear_v7_evidence_';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const iso=d=>{const x=d instanceof Date?d:new Date(d);const z=n=>String(n).padStart(2,'0');return`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const date=s=>new Date(String(s).slice(0,10)+'T12:00:00');
  const secs=s=>{if(!s)return null;const m=String(s).match(/(\d+):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const pace=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`:'–';
  const activeGoal=()=>window.RunnerBearV7?.activeGoal?.()||null;
  const isPermanent=g=>!!g&&g.id!==LEGACY;
  const profile=()=>window.RunnerBearV7?.profile?.()||read(PROFILE,{});
  const fmt=s=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'}).format(date(s));

  const LIB={
    lt_5x6:{family:'long-threshold',name:'5 × 6 min subterskel',workMin:30,pause:'60 s rolig jogg',dose:'lett',compare:'5x6'},
    lt_6x6:{family:'long-threshold',name:'6 × 6 min subterskel',workMin:36,pause:'60 s rolig jogg',dose:'normal',compare:'6x6'},
    lt_5x8:{family:'long-threshold',name:'5 × 8 min subterskel',workMin:40,pause:'75 s rolig jogg',dose:'normal',compare:'5x8'},
    lt_4x10:{family:'long-threshold',name:'4 × 10 min subterskel',workMin:40,pause:'90 s rolig jogg',dose:'normal+',compare:'4x10'},
    lt_3x12:{family:'long-threshold',name:'3 × 12 min subterskel',workMin:36,pause:'90 s rolig jogg',dose:'normal',compare:'3x12'},
    st_20x45:{family:'short-threshold',name:'20 × 45/15',workMin:15,pause:'15 s flyt / jogg',dose:'lett',compare:'20x45'},
    st_30x45:{family:'short-threshold',name:'30 × 45/15',workMin:22.5,pause:'15 s flyt / jogg',dose:'normal',compare:'30x45'},
    st_3x10x45:{family:'short-threshold',name:'3 × 10 × 45/15',workMin:22.5,pause:'2 min rolig mellom seriene',dose:'normal',compare:'3x10x45'},
    st_12x400:{family:'short-threshold',name:'12 × 400 m kontrollert',workMin:18,pause:'30–40 s rolig jogg',dose:'normal',compare:'12x400'},
    x_5x3:{family:'x-element',name:'5 × 3 min X-element',workMin:15,pause:'90 s rolig jogg',dose:'lett',compare:'5x3x'},
    x_6x3:{family:'x-element',name:'6 × 3 min X-element',workMin:18,pause:'90 s rolig jogg',dose:'normal',compare:'6x3x'},
    ctrl_5x6:{family:'control',name:'5 × 6 min standardisert kontroll',workMin:30,pause:'60 s rolig jogg',dose:'control',compare:'control5x6'}
  };
  const longCycle=['lt_6x6','lt_5x8','lt_4x10','lt_3x12'];
  const shortCycle=['st_30x45','st_3x10x45','x_6x3','st_12x400'];

  function targetFor(w,p=profile()){
    const th=secs(p.thresholdPace)||242;
    if(w.family==='long-threshold')return`${pace(th+4)}–${pace(th+10)}/km · hovedsakelig under terskel`;
    if(w.family==='short-threshold')return`${pace(th-7)}–${pace(th-2)}/km på arbeidsdrag · flyt før fart`;
    if(w.family==='x-element')return`${pace(th-22)}–${pace(th-15)}/km · RPE rundt 7/10, aldri maks`;
    return`${pace(th+4)}–${pace(th+9)}/km · samme forhold når mulig`;
  }
  function purposeFor(w){
    if(w.family==='long-threshold')return'Akkumuler terskeltid med lav nok kostnad til at kvalitet kan gjentas.';
    if(w.family==='short-threshold')return'Bygg fart og flyt rundt terskel uten å gjøre økten til VO₂max-arbeid.';
    if(w.family==='x-element')return'Behold løpsøkonomi og aerob toppfart med en liten, kontrollert dose.';
    return'Mål endring i kostnad ved en standardisert stimulus – ikke jag et testresultat.';
  }
  function detailFor(w,decision){
    const tail=decision?.mode==='reduce'?' Redusert uke: stopp før planlagt slutt hvis kontrollen forsvinner.':'';
    return`${w.pause}. ${targetFor(w)}.${tail}`;
  }
  function estimateKm(w){if(w.family==='long-threshold')return w.workMin>=40?13:11;if(w.family==='short-threshold')return w.workMin>=22?10:9;if(w.family==='x-element')return 10;return 11}

  function evidenceKey(g,ds){return`${E_PREFIX}${g.id}_${ds}`}
  function allEvidence(g){
    const out=[];for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(!k||!k.startsWith(`${E_PREFIX}${g.id}_`))continue;
      const v=read(k,null);if(v&&typeof v==='object')out.push(v);
    }
    return out.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function latestEvidence(g){const a=allEvidence(g);return a[a.length-1]||null}
  function previousComparable(g,rec){return allEvidence(g).filter(x=>x.date<rec.date&&x.compareKey===rec.compareKey).slice(-1)[0]||null}
  function costTone(rec){if(!rec)return'neutral';if(rec.achilles==='worse'||Number(rec.rpe)>=9)return'red';if(Number(rec.rpe)>=8)return'yellow';return'green'}
  function compareEvidence(g,rec){
    if(!rec)return{tone:'neutral',label:'BYGGER DATA',text:'Registrer respons etter standardiserte og gjentatte kvalitetsøkter.'};
    if(rec.achilles==='worse')return{tone:'red',label:'BELASTNINGSSIGNAL',text:'Akilles var verre neste morgen. Fartstall får ikke overstyre dette signalet.'};
    const prev=previousComparable(g,rec);if(!prev)return{tone:costTone(rec),label:'FØRSTE REFERANSE',text:`${rec.workoutName} er lagret som første sammenlignbare datapunkt.`};
    const cp=secs(rec.pace),pp=secs(prev.pace),dp=cp&&pp?pp-cp:null,dh=Number(rec.hr||0)-Number(prev.hr||0),dr=Number(rec.rpe||0)-Number(prev.rpe||0);
    if(Number(rec.rpe)>=9)return{tone:'red',label:'FOR DYRT',text:'Resultatet ble registrert, men RPE er for høy til at økten tolkes som positiv terskelutvikling.'};
    if(dp!=null&&dp>=2&&dh<=2&&dr<=.5)return{tone:'green',label:'POSITIV TREND',text:`${Math.round(dp)} sek/km raskere med omtrent samme eller lavere kostnad enn forrige ${rec.workoutName}.`};
    if(dp!=null&&dp>=2&&(dh>=4||dr>=1.5))return{tone:'yellow',label:'RASKERE, MEN DYRERE',text:`Farten er ${Math.round(dp)} sek/km bedre, men puls/RPE økte tydelig. RunnerBear kaller ikke dette ren formgevinst.`};
    if(dp!=null&&dp<=-3&&dh>=0&&dr>=0)return{tone:'yellow',label:'SVAKERE RESPONS',text:`Omtrent ${Math.abs(Math.round(dp))} sek/km svakere uten lavere kostnad. Hold intensiteten konservativ.`};
    return{tone:'neutral',label:'STABILT',text:'Endringen er liten eller kostnaden flyttet seg samtidig. Behold samme ramme og bygg flere datapunkter.'};
  }
  function evidenceSummary(g){
    const rows=allEvidence(g),last=rows[rows.length-1],cmp=compareEvidence(g,last);let green=0,yellow=0,red=0;
    rows.slice(-6).forEach(r=>{const c=compareEvidence(g,r);if(c.tone==='green')green++;else if(c.tone==='yellow')yellow++;else if(c.tone==='red')red++});
    return{rows,last,cmp,green,yellow,red,signal:red?'caution':green>=2&&yellow===0?'positive':'stable'};
  }

  function selectionContext(g){
    const a=window.RunnerBearAdaptive?.adaptivePlan?.(g),idx=Math.max(0,Math.min(3,Number(sessionStorage.getItem('runnerbear_v72_week')||0))),dec=a?.decision||{mode:'hold'},ev=evidenceSummary(g);return{adaptive:a,weekIndex:idx,decision:dec,evidence:ev};
  }
  function chooseWorkout(g,weekIndex,slot,session,ctx){
    if(session?.source==='control'||/kontrollpunkt|standardisert kontroll/i.test(session?.title||''))return LIB.ctrl_5x6;
    if(session?.source==='taper'||session?.type==='race')return null;
    const dec=ctx.decision||{};
    if(dec.mode==='reduce')return slot===0?LIB.lt_5x6:null;
    if(g.type==='maintenance')return slot===0?LIB.lt_5x6:null;
    if(slot===0){
      let id=longCycle[weekIndex%longCycle.length];
      if(ctx.evidence.signal==='caution')id='lt_5x6';
      return LIB[id];
    }
    let id=shortCycle[weekIndex%shortCycle.length];
    if(ctx.evidence.signal==='caution')id='st_20x45';
    if(id.startsWith('x_')){
      const last=latestEvidence(g),recentX=last&&last.family==='x-element'&&(Date.now()-date(last.date).getTime())<18*86400000;
      if(recentX)id='st_30x45';
    }
    return LIB[id];
  }
  function sessionsForVisibleWeek(g){
    const ctx=selectionContext(g),week=ctx.adaptive?.weeks?.[ctx.weekIndex];if(!week)return{ctx,week:null,map:new Map()};
    const map=new Map();let slot=0;
    week.days.forEach(s=>{if(s.type!=='quality')return;const w=chooseWorkout(g,ctx.weekIndex,slot,s,ctx);if(w)map.set(iso(s.date),Object.assign({},w,{id:Object.keys(LIB).find(k=>LIB[k]===w),target:targetFor(w),purpose:purposeFor(w),detail:detailFor(w,ctx.decision),km:estimateKm(w)}));slot++});
    return{ctx,week,map};
  }

  function plannedWorkoutForDate(g,ds){
    const a=window.RunnerBearAdaptive?.adaptivePlan?.(g);if(!a)return null;
    for(let wi=0;wi<a.weeks.length;wi++){
      let slot=0;for(const s of a.weeks[wi].days){
        if(s.type!=='quality')continue;const w=chooseWorkout(g,wi,slot,s,{adaptive:a,weekIndex:wi,decision:a.decision,evidence:evidenceSummary(g)});if(iso(s.date)===ds&&w)return Object.assign({},w,{id:Object.keys(LIB).find(k=>LIB[k]===w),target:targetFor(w),purpose:purposeFor(w),detail:detailFor(w,a.decision),km:estimateKm(w)});slot++;
      }
    }
    return null;
  }

  function patchDay(day,g,workout){
    if(!day||!workout)return;const ds=day.dataset.v72Day;day.dataset.rbWorkout=workout.id;
    const h=day.querySelector('h3'),details=day.querySelectorAll('.daydetail'),intent=day.querySelector('.intent'),meta=day.querySelector('.daymeta');
    if(h)h.textContent=workout.name;if(details[0])details[0].textContent=`${workout.workMin} min arbeidsdrag · ${workout.pause}`;if(details[1])details[1].textContent=workout.detail;if(intent)intent.innerHTML=`<b>Hensikt:</b> ${esc(workout.purpose)}`;if(meta)meta.textContent=`ca. ${workout.km} km planlagt`;
    ensureCapture(day.querySelector('.day-body'),g,ds,workout,false);
  }
  function patchToday(g){
    const ds=iso(new Date()),w=plannedWorkoutForDate(g,ds);if(!w)return;
    document.getElementById('todayTitle').textContent=w.name;document.getElementById('todayDesc').textContent=`${w.workMin} min arbeidsdrag · ${w.pause}`;document.getElementById('todayPace').textContent=w.target.split(' · ')[0];document.getElementById('todayHr').textContent='under terskel';document.getElementById('todayKm').textContent=`ca. ${w.km} km`;document.getElementById('todayPurpose').textContent=w.purpose;
    const host=document.getElementById('v7TodayActions')||document.getElementById('todayCard');ensureCapture(host,g,ds,w,true);
  }

  function recordFor(g,ds,w){return Object.assign({goalId:g.id,date:ds,workoutId:w.id,workoutName:w.name,family:w.family,compareKey:w.compare,plannedTarget:w.target},read(evidenceKey(g,ds),{}))}
  function captureHtml(rec,compact){return`<details class="rb-evidence-capture" ${rec.savedAt?'':'open'}><summary>${rec.savedAt?'Evidence registrert · rediger':'Registrer øktdata'}</summary><div class="rb-evidence-form ${compact?'compact':''}"><label>Arbeidsfart<input data-e-field="pace" value="${esc(rec.pace||'')}" placeholder="f.eks. 4:01/km"></label><label>Snittpuls<input data-e-field="hr" type="number" value="${esc(rec.hr||'')}" placeholder="bpm"></label><label>RPE<input data-e-field="rpe" type="number" min="1" max="10" value="${esc(rec.rpe||'')}" placeholder="1–10"></label><label>Akilles neste morgen<select data-e-field="achilles"><option value="">Ikke registrert</option><option value="better" ${rec.achilles==='better'?'selected':''}>Bedre</option><option value="same" ${rec.achilles==='same'?'selected':''}>Lik</option><option value="worse" ${rec.achilles==='worse'?'selected':''}>Verre</option></select></label><label>Underlag<select data-e-field="surface"><option value="road" ${rec.surface==='road'?'selected':''}>Asfalt</option><option value="track" ${rec.surface==='track'?'selected':''}>Bane</option><option value="treadmill" ${rec.surface==='treadmill'?'selected':''}>Mølle</option><option value="trail" ${rec.surface==='trail'?'selected':''}>Grus/sti</option></select></label><label>Forhold<select data-e-field="conditions"><option value="normal" ${rec.conditions==='normal'?'selected':''}>Normale / sammenlignbare</option><option value="wind" ${rec.conditions==='wind'?'selected':''}>Vind</option><option value="heat" ${rec.conditions==='heat'?'selected':''}>Varmt</option><option value="hills" ${rec.conditions==='hills'?'selected':''}>Kupert</option></select></label><label class="wide">Notat<input data-e-field="note" value="${esc(rec.note||'')}" placeholder="kort valgfritt notat"></label><button type="button" class="secondary rb-save-evidence">Lagre evidence</button></div></details>`}
  function ensureCapture(host,g,ds,w,compact){
    if(!host||host.querySelector(`.rb-evidence-capture[data-e-date="${ds}"]`))return;const rec=recordFor(g,ds,w),wrap=document.createElement('div');wrap.className='rb-evidence-wrap';wrap.innerHTML=captureHtml(rec,compact);const d=wrap.firstElementChild;d.dataset.eDate=ds;d.dataset.eWorkout=w.id;host.appendChild(wrap);d.querySelector('.rb-save-evidence').onclick=()=>saveCapture(d,g,w);
  }
  function saveCapture(root,g,w){
    const val=n=>root.querySelector(`[data-e-field="${n}"]`)?.value?.trim?.()||root.querySelector(`[data-e-field="${n}"]`)?.value||'';
    const paceRaw=val('pace'),hr=Number(val('hr'))||null,rpe=Number(val('rpe'))||null;if(paceRaw&&!secs(paceRaw))return alert('Bruk fart som f.eks. 4:01/km.');if(rpe&&(rpe<1||rpe>10))return alert('RPE må være 1–10.');
    const rec={goalId:g.id,date:root.dataset.eDate,workoutId:w.id,workoutName:w.name,family:w.family,compareKey:w.compare,plannedTarget:w.target,pace:paceRaw.match(/\d+:\d{2}/)?.[0]||'',hr,rpe,achilles:val('achilles'),surface:val('surface'),conditions:val('conditions'),note:val('note'),savedAt:new Date().toISOString()};write(evidenceKey(g,rec.date),rec);
    write(`runnerbear_v7_feedback_${g.id}_${rec.date}`,{rpe:rec.rpe,achilles:rec.achilles,savedAt:rec.savedAt,pace:rec.pace,hr:rec.hr});localStorage.setItem(`runnerbear_v7_done_${g.id}_${rec.date}`,'1');
    renderEvidenceCard();window.RunnerBearAdaptive?.renderFlexiblePlan?.();setTimeout(apply,0);
  }

  function renderEvidenceCard(){
    const g=activeGoal(),view=document.getElementById('goals');if(!isPermanent(g)||!view){document.getElementById('rbEvidenceCard')?.remove();return}
    const s=evidenceSummary(g);let card=document.getElementById('rbEvidenceCard');if(!card){card=document.createElement('article');card.id='rbEvidenceCard';card.className='card rb-evidence-engine';const controls=view.querySelector('.rb-controls-card');(controls||document.getElementById('goalDashboard'))?.insertAdjacentElement('afterend',card)}
    const recent=s.rows.slice(-4).reverse();card.innerHTML=`<div class="kicker"><span>EVIDENCE ENGINE</span><span class="status-pill ${s.cmp.tone}">${s.cmp.label}</span></div><div class="rb-evidence-head"><div><h3>${s.rows.length?'Formsignal basert på kostnad':'Bygg dine første referanser'}</h3><p>${esc(s.cmp.text)}</p></div><div class="rb-evidence-count"><strong>${s.rows.length}</strong><span>nøkkeløkter</span></div></div>${recent.length?`<div class="rb-evidence-list">${recent.map(r=>{const c=compareEvidence(g,r);return`<div><span class="rb-e-dot ${c.tone}"></span><div><b>${esc(r.workoutName)}</b><small>${fmt(r.date)} · ${r.pace?`${r.pace}/km`: 'fart –'} · HR ${r.hr||'–'} · RPE ${r.rpe||'–'}</small></div><em>${c.label}</em></div>`}).join('')}</div>`:'<div class="rb-evidence-empty">Registrer fart, puls og RPE etter en nøkkeløkt. Samme økt senere blir automatisk sammenlignet.</div>'}`;
  }

  function renderLibraryCard(){
    const rhythm=document.getElementById('rbWeekRhythmCard')||document.getElementById('trainingProfileCard');if(!rhythm)return;let card=document.getElementById('rbWorkoutLibraryCard');if(!card){card=document.createElement('article');card.id='rbWorkoutLibraryCard';card.className='card rb-library-card';rhythm.insertAdjacentElement('afterend',card)}
    const g=activeGoal(),ctx=isPermanent(g)?selectionContext(g):null;card.innerHTML=`<div class="kicker"><span>WORKOUT LIBRARY</span><span>BAKKEN-INSPIRERT</span></div><div class="rb-library-head"><div><h3>Stimulus først, øktnavn etterpå</h3><p>RunnerBear velger dose ut fra fase og respons. Farten får aldri alene bestemme om en økt var god.</p></div><strong>${Object.keys(LIB).length}</strong></div><div class="rb-library-families"><span>Lang subterskel</span><span>Kort subterskel</span><span>X-element</span><span>Standardkontroll</span></div>${ctx?`<p class="rb-library-status">Neste blokk: <b>${ctx.evidence.signal==='caution'?'konservativ dose':ctx.evidence.signal==='positive'?'normal progresjon':'bygg flere referanser'}</b>.</p>`:''}`;
  }

  function apply(){
    const g=activeGoal();renderLibraryCard();renderEvidenceCard();if(!isPermanent(g))return;
    const data=sessionsForVisibleWeek(g);document.querySelectorAll('#weeks .rb-v72-week .day[data-v72-day]').forEach(day=>{const w=data.map.get(day.dataset.v72Day);if(w)patchDay(day,g,w)});patchToday(g);
  }

  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
  const weeks=document.getElementById('weeks');if(weeks)new MutationObserver(queue).observe(weeks,{childList:true,subtree:true});
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const r=prev.apply(this,arguments);queue();return r};
  document.addEventListener('click',e=>{if(e.target.closest('[data-v72],#saveGoal,#archiveGoal,[data-activate-goal],#saveProfile,#saveRhythm,.navbtn[data-tab="goals"]'))setTimeout(queue,0)},true);
  window.RunnerBearEvidence={library:LIB,allEvidence,evidenceSummary,compareEvidence,plannedWorkoutForDate,apply};
  queue();
})();