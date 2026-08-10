/* RunnerBear v7.2–7.3 · Flexible Week Builder + Adaptive Coach
   Permanent-goal layer. Legacy Runfest plan is intentionally left unchanged. */
(function(){
  'use strict';
  const PROFILE='runnerbear_v7_profile';
  const LEGACY='runfest-2026';
  const DAY=['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  const FULL=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const iso=d=>{const z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};
  const date=s=>new Date(s+'T12:00:00');
  const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const same=(a,b)=>iso(a)===iso(b);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function baseProfile(){return window.RunnerBearV7?.profile?.()||read(PROFILE,{})}
  function rhythm(){
    const p=baseProfile(),r=p.weekRhythm||{};
    return{
      runDays:Array.isArray(r.runDays)?r.runDays:[1,2,3,4,6],
      qualityDays:Array.isArray(r.qualityDays)?r.qualityDays:[1,4],
      longRunDay:Number.isInteger(r.longRunDay)?r.longRunDay:6,
      strengthDays:Array.isArray(r.strengthDays)?r.strengthDays:[0],
      crossDays:Array.isArray(r.crossDays)?r.crossDays:[0,5],
      allowCross:r.allowCross!==false
    };
  }
  function activeGoal(){return window.RunnerBearV7?.activeGoal?.()||null}
  function isPermanent(g){return !!g&&g.id!==LEGACY}
  function keyDone(g,d){return`runnerbear_v7_done_${g.id}_${iso(d)}`}
  function keyFeedback(g,d){return`runnerbear_v7_feedback_${g.id}_${iso(d)}`}
  function weekCheckKey(g,mon){return`runnerbear_v7_weekcheck_${g.id}_${iso(mon)}`}

  function allFeedback(g,days=21){
    const cutoff=add(new Date(),-days),rows=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(!k||!k.startsWith(`runnerbear_v7_feedback_${g.id}_`))continue;
      const ds=k.slice(k.lastIndexOf('_')+1),d=date(ds);if(d<cutoff)continue;
      const v=read(k,{});rows.push(Object.assign({date:ds},v));
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function doneCount(g,mon){let n=0;for(let i=0;i<7;i++)if(localStorage.getItem(keyDone(g,add(mon,i)))==='1')n++;return n}

  function decision(g){
    const p=baseProfile(),r=rhythm(),mon=monday(new Date()),fb=allFeedback(g),recent=fb.slice(-4),wk=localStorage.getItem(weekCheckKey(g,mon))||'';
    const worse=recent.some(x=>x.achilles==='worse'),hard=recent.some(x=>Number(x.rpe)>=9),costly=recent.some(x=>Number(x.rpe)>=8);
    const conflict=r.qualityDays.some(d=>!r.runDays.includes(d)||d===r.longRunDay)||r.qualityDays.length<Math.min(2,Number(p.qualityPerWeek)||2);
    const completed=doneCount(g,mon),enough=recent.length>=2&&completed>=4;
    if(worse||hard||wk==='heavy')return{mode:'reduce',label:'REDUSER',tone:'red',volume:.88,quality:1,title:'Beskytt kontinuiteten',text:worse?'Akillesresponsen trumfer kalenderen. Neste uke får lavere støtbelastning og bare én kvalitetsøkt.':hard?'Minst én økt kostet for mye. Volumet reduseres før intensiteten får utvikle seg.':'Kroppen er meldt tung. RunnerBear reduserer volum og fjerner ekstra kvalitet.',why:['Ingen treningsgjeld','Intensiteten økes ikke','Én kvalitet er nok til responsen er normal']};
    if(conflict)return{mode:'move',label:'FLYTT',tone:'yellow',volume:1,quality:Math.min(Number(p.qualityPerWeek)||2,2),title:'Beskytt avstanden mellom nøkkeløktene',text:'Foretrukne kvalitetsdager kolliderer med tilgjengelige løpedager eller langtur. RunnerBear flytter øktene, ikke komprimerer dem.',why:['Minst 48 t mellom kvalitet når mulig','Langtur skjermes','Ingen back-to-back kvalitet']};
    if(enough&&!costly&&wk!=='tired'&&recent.every(x=>!x.rpe||Number(x.rpe)<=7)&&!recent.some(x=>x.achilles==='worse'))return{mode:'progress',label:'PROGRESSER',tone:'green',volume:1.03,quality:Math.min(Number(p.qualityPerWeek)||2,2),title:'Liten progresjon – samme kontroll',text:'Responsen ser repeterbar ut. RunnerBear legger kun på en liten mengde, ikke høyere fart eller ekstra kvalitetsdag.',why:['Ca. 3 % volumprogresjon','Samme intensitetsramme','Ingen bonusøkt på gode bein']};
    return{mode:'hold',label:'STÅ',tone:'neutral',volume:1,quality:g.type==='maintenance'?1:Math.min(Number(p.qualityPerWeek)||2,2),title:'Planen står',text:costly||wk==='tired'?'Kostnaden er litt høyere, men ikke nok til å endre hele strukturen. Hold samme intensitet og la neste respons avgjøre.':'Dataene støtter å fortsette uten å gjøre treningen mer aggressiv.',why:['Repeterbar terskel','Easy betyr easy','Progresjon skjer uke for uke']};
  }

  function chooseQualityDays(r,qCount){
    const candidates=[...new Set([...r.qualityDays,...r.runDays])].filter(d=>r.runDays.includes(d)&&d!==r.longRunDay);
    const out=[];
    for(const d of candidates){if(out.length>=qCount)break;if(out.every(x=>Math.abs(x-d)>=2)&&Math.abs(r.longRunDay-d)>=2)out.push(d)}
    for(const d of candidates){if(out.length>=qCount)break;if(!out.includes(d)&&out.every(x=>Math.abs(x-d)>=2))out.push(d)}
    return out.slice(0,qCount);
  }
  function estimateQualityKm(title){if(/10 min/.test(title))return 13;if(/8 min/.test(title))return 12;if(/6 min/.test(title))return 11;if(/45\/15/.test(title))return 9;if(/X-element/i.test(title))return 10;return 10}
  function normalizeSession(x){return Object.assign({type:'rest',title:'Hvile',desc:'',detail:'',km:0},x||{})}

  function scheduleWeek(g,w,idx,dec){
    const p=baseProfile(),r=rhythm(),mon=add(monday(new Date()),idx*7),target=Math.max(20,Math.round(Number(w.km||p.weeklyKm||45)*dec.volume));
    const baseDays=(w.days||[]).map(normalizeSession),qualities=baseDays.filter(d=>d.type==='quality'),longBase=baseDays.find(d=>/langtur/i.test(d.title))||{type:'easy',title:'Rolig langtur',desc:'Rolig og jevnt.',detail:'Ingen skjult moderat avslutning.'};
    const easyBase=baseDays.filter(d=>d.type==='easy'&&!/langtur/i.test(d.title));
    const qCount=Math.min(dec.quality,qualities.length||dec.quality),qDays=chooseQualityDays(r,qCount),slots=Array(7).fill(null);
    const longDay=r.runDays.includes(r.longRunDay)?r.longRunDay:(r.runDays.slice().sort((a,b)=>b-a)[0]??6);
    const longKm=Math.max(10,Math.round(target*.30));slots[longDay]=Object.assign({},longBase,{km:longKm,source:'long'});
    qDays.forEach((d,i)=>{const q=Object.assign({},qualities[i]||qualities[0]||{type:'quality',title:'6 × 6 min subterskel',desc:'60 s rolig jogg',detail:'Kontrollert under terskel.'});q.km=estimateQualityKm(q.title);q.source='quality';if(dec.mode==='reduce')q.detail=`${q.detail} Redusert volum denne uka; stopp med tydelig kontroll.`;slots[d]=q});
    const runOpen=r.runDays.filter(d=>!slots[d]);
    const usedKm=slots.filter(Boolean).reduce((a,s)=>a+Number(s.km||0),0),remaining=Math.max(runOpen.length*5,target-usedKm),each=Math.max(5,Math.round(remaining/Math.max(1,runOpen.length)));
    runOpen.forEach((d,i)=>{const e=Object.assign({},easyBase[i%Math.max(1,easyBase.length)]||{type:'easy',title:'Rolig',desc:'Restitusjon.',detail:'Snakketempo.'});e.type='easy';e.km=each;e.title=/km/.test(e.title)?`${each} km${/strides/i.test(e.title)?' + strides':' rolig'}`:`${each} km rolig`;e.source='easy';slots[d]=e});
    for(let d=0;d<7;d++)if(!slots[d]){const strength=r.strengthDays.includes(d),cross=r.allowCross&&r.crossDays.includes(d);slots[d]=cross?{type:'cross',title:strength?'Cross + styrke':'Cross lett',desc:'30–50 min svært lett.',detail:strength?'Aerob cross + 15–20 min løpestyrke.':'Zwift eller Concept2 i ren easy-intensitet.',km:0,source:'cross'}:{type:'rest',title:strength?'Styrke / hvile':'Hvile',desc:'Ingen planlagt løping.',detail:strength?'Kort styrke hvis kroppen er frisk.':'Ingen treningsgjeld.',km:0,source:'rest'}}
    r.strengthDays.forEach(d=>{if(slots[d]&&slots[d].type==='easy')slots[d].detail+=` · 15–20 min styrke kan legges etter økten.`});
    const control=(window.RunnerBearV7?.controlsFor?.(g)||[]).find(c=>c.date>=iso(mon)&&c.date<=iso(add(mon,6)));
    if(control){const di=Math.max(0,Math.min(6,Math.round((date(control.date)-mon)/86400000)));slots[di]={type:'quality',title:`${control.name} · ${control.workout}`,desc:'Kontrollpunkt.',detail:`${control.target||'Kontrollert'}. ${control.note||''}`,km:estimateQualityKm(control.workout),source:'control'};for(let x=0;x<7;x++)if(x!==di&&slots[x]?.type==='quality'&&Math.abs(x-di)<2)slots[x]={type:'easy',title:'Rolig · kontrollpunkt beskyttes',desc:'Lav kostnad.',detail:'Kvaliteten flyttes ut av denne uka fremfor å ligge tett.',km:Math.max(5,Math.round(target*.12)),source:'easy'}}
    if(g.type==='race'&&g.eventDate){const race=date(g.eventDate);for(let d=0;d<7;d++){const dd=add(mon,d),delta=Math.round((race-dd)/86400000);if(delta===0)slots[d]={type:'race',title:`${g.name}`,desc:'Konkurransedag.',detail:'Åpne kontrollert. Målet er en ambisjon; responsen styrer siste del.',km:0,source:'race'};else if(delta>0&&delta<=3)slots[d]=delta===1?{type:'rest',title:'Hvile / valgfri shakeout',desc:'Friskhet først.',detail:'0–20 min ekstremt lett hvis det gjør deg bedre.',km:0,source:'taper'}:{type:'easy',title:'Kort race-week økt',desc:'Rolig + noen få strides.',detail:'Ingen form skal bygges nå.',km:4,source:'taper'}}}
    return{n:idx+1,start:mon,end:add(mon,6),range:`${new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(mon)}–${new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(add(mon,6))}`,phase:dec.mode==='reduce'?'Absorbere':idx===0?'Nå':'Rullerende',km:target,focus:dec.text,days:slots.map((s,d)=>Object.assign({date:add(mon,d),label:`${DAY[d]} ${new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(add(mon,d))}`},s))};
  }

  function adaptivePlan(g){const base=window.RunnerBearV7?.generateRollingPlan?.(g);if(!base)return null;const dec=decision(g);return{decision:dec,weeks:base.map((w,i)=>scheduleWeek(g,w,i,dec))}}

  function renderDecision(g,dec){const plan=document.getElementById('plan');if(!plan)return;let card=document.getElementById('rbAdaptiveDecision');if(!card){card=document.createElement('article');card.id='rbAdaptiveDecision';card.className='card rb-adaptive-decision';const anchor=document.getElementById('rbV72WeekNav')||plan.querySelector('.section-head');anchor?.insertAdjacentElement('afterend',card)}card.innerHTML=`<div class="kicker"><span>RB COACH · UKEBESLUTNING</span><span class="status-pill ${dec.tone}">${dec.label}</span></div><h3>${esc(dec.title)}</h3><p>${esc(dec.text)}</p><div class="rb-decision-points">${dec.why.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`}
  function nav(planData){const plan=document.getElementById('plan');if(!plan)return 0;let bar=document.getElementById('rbV72WeekNav');if(!bar){bar=document.createElement('div');bar.id='rbV72WeekNav';bar.className='rb-plan-nav rb-v72-nav';bar.innerHTML='<button class="rb-week-arrow" data-v72="-1">‹</button><button class="rb-week-center"><span id="rbV72Index"></span><strong id="rbV72Range"></strong><small>rullerende plan</small></button><button class="rb-week-arrow" data-v72="1">›</button>';plan.querySelector('.section-head')?.insertAdjacentElement('afterend',bar);bar.querySelectorAll('[data-v72]').forEach(b=>b.onclick=()=>{const i=Math.max(0,Math.min(3,Number(sessionStorage.getItem('runnerbear_v72_week')||0)+Number(b.dataset.v72)));sessionStorage.setItem('runnerbear_v72_week',String(i));renderFlexiblePlan()});bar.querySelector('.rb-week-center').onclick=()=>{sessionStorage.setItem('runnerbear_v72_week','0');renderFlexiblePlan()}}const i=Math.max(0,Math.min(3,Number(sessionStorage.getItem('runnerbear_v72_week')||0))),w=planData.weeks[i];bar.querySelector('#rbV72Index').textContent=`UKE ${i+1} AV 4`;bar.querySelector('#rbV72Range').textContent=w.range;const a=bar.querySelectorAll('.rb-week-arrow');a[0].disabled=i===0;a[1].disabled=i===3;return i}
  function renderFlexiblePlan(){
    const g=activeGoal();if(!isPermanent(g)){document.getElementById('rbAdaptiveDecision')?.remove();document.getElementById('rbV72WeekNav')?.remove();return}
    const data=adaptivePlan(g);if(!data)return;document.getElementById('rbPlanNav')?.remove();document.querySelector('#plan .load-card')?.setAttribute('style','display:none');const idx=nav(data);renderDecision(g,data.decision);const w=data.weeks[idx],root=document.getElementById('weeks');if(!root)return;
    root.innerHTML=`<section class="week rb-v72-week"><div class="weekhead"><div><span class="phase">${esc(w.phase)}</span><h2>Uke ${idx+1} · ${esc(w.range)}</h2><div class="muted small">${esc(w.focus)}</div></div><div><b>${w.km} km</b><div class="muted small">adaptiv ramme</div></div></div><div class="rb-week-brief"><div class="rb-week-intent"><span>UKAS JOBB</span><b>${esc(w.focus)}</b></div><div class="rb-week-stats"><div><strong>${w.km}</strong><span>løpskm</span></div><div><strong>${w.days.filter(d=>d.type==='quality').length}</strong><span>kvalitet</span></div><div><strong>${w.days.filter(d=>/langtur/i.test(d.title)).length}</strong><span>langtur</span></div><div><strong>${w.days.filter(d=>localStorage.getItem(keyDone(g,d.date))==='1').length}/7</strong><span>registrert</span></div></div></div><div class="days">${w.days.map(d=>{const done=localStorage.getItem(keyDone(g,d.date))==='1',tod=same(d.date,new Date());const label=d.type==='quality'?'Kvalitet':d.type==='race'?'Race':d.type==='easy'?'Rolig':d.type==='cross'?'Cross':'Hvile';return`<article class="day ${done?'done ':''}${tod?'today open':''}" data-v72-day="${iso(d.date)}"><div class="day-summary"><span class="daydate">${esc(d.label)}</span><h3>${esc(d.title)}</h3><span class="daystatus">${done?'✓':tod?'I DAG':'›'}</span></div><div class="day-body"><span class="tag ${d.type}">${label}</span><div class="daydetail">${esc(d.desc)}</div><div class="daydetail">${esc(d.detail)}</div><div class="intent"><b>Hensikt:</b> ${d.type==='quality'?'Kontrollert stimulus som kan gjentas.':d.type==='easy'?'Støtt neste kvalitetsøkt.':d.type==='cross'?'Aerob støtte uten ekstra løpsstøt.':d.type==='race'?'Gjennomfør målet med kontrollert åpning.':'Restitusjon er planlagt trening.'}</div>${d.km?`<div class="daymeta">${d.km} km planlagt</div>`:''}<div class="day-actions"><label class="complete"><input type="checkbox" data-v72-done="${iso(d.date)}" ${done?'checked':''}> <span>Gjennomført</span></label></div></div></article>`}).join('')}</div></section>`;
    const cards=[...root.querySelectorAll('.day')];cards.forEach(c=>{c.querySelector('.day-summary').onclick=()=>{const open=!c.classList.contains('open');cards.forEach(x=>x.classList.remove('open'));if(open)c.classList.add('open')}});root.querySelectorAll('[data-v72-done]').forEach(i=>i.onchange=e=>{localStorage.setItem(`runnerbear_v7_done_${g.id}_${e.target.dataset.v72Done}`,e.target.checked?'1':'0');renderFlexiblePlan()});patchTodayFromPlan(g,data.weeks[0]);
  }

  function patchTodayFromPlan(g,w){const d=w.days.find(x=>same(x.date,new Date()));if(!d)return;const t=document.getElementById('todayType');if(t){t.className=`tag ${d.type}`;t.textContent=d.type==='quality'?'Kvalitet':d.type==='race'?'Race':d.type==='easy'?'Rolig':d.type==='cross'?'Cross':'Hvile'}const title=document.getElementById('todayTitle'),desc=document.getElementById('todayDesc'),km=document.getElementById('todayKm'),purpose=document.getElementById('todayPurpose'),coach=document.getElementById('todayCoach');if(title)title.textContent=d.title;if(desc)desc.textContent=d.desc;if(km)km.textContent=d.km?`${d.km} km`:'–';if(purpose)purpose.textContent=d.type==='quality'?'Kontrollert stimulus som kan gjentas.':d.type==='easy'?'Gjør neste kvalitet bedre.':d.type==='cross'?'Aerob støtte uten ekstra løpsstøt.':d.type==='race'?'Utfør raceplanen med kontrollert åpning.':'Restitusjon og kontinuitet.';if(coach){const dec=decision(g);coach.textContent=`RB Coach · ${dec.label}: ${dec.title}.`}}

  function ensureRhythmCard(){const profile=document.getElementById('trainingProfileCard');if(!profile)return;let card=document.getElementById('rbWeekRhythmCard');if(!card){card=document.createElement('article');card.id='rbWeekRhythmCard';card.className='card rb-rhythm-card';profile.insertAdjacentElement('afterend',card)}const r=rhythm(),p=baseProfile();card.innerHTML=`<div class="kicker"><span>UKESRYTME</span><span>FLEKSIBEL</span></div><div class="rb-rhythm-head"><div><h3>Treningen skal passe uka di</h3><p>RunnerBear beskytter avstanden mellom kvalitet, langtur og restitusjon.</p></div><button class="secondary" id="editRhythm">Rediger ukerytme</button></div><div class="rb-rhythm-summary"><div><span>Løpedager</span><b>${r.runDays.map(d=>DAY[d]).join(' · ')}</b></div><div><span>Kvalitet foretrekkes</span><b>${r.qualityDays.map(d=>DAY[d]).join(' · ')}</b></div><div><span>Langtur</span><b>${FULL[r.longRunDay]}</b></div><div><span>Styrke</span><b>${r.strengthDays.length?r.strengthDays.map(d=>DAY[d]).join(' · '):'Fleksibelt'}</b></div></div><p class="rb-rhythm-note">${p.qualityPerWeek||2} kvalitetsøkt${Number(p.qualityPerWeek)===1?'':'er'} er taket. Gode bein legger ikke automatisk til en ekstra.</p>`;document.getElementById('editRhythm').onclick=openRhythmEditor}
  function dayChecks(name,selected){return FULL.map((d,i)=>`<label class="rb-day-check"><input type="checkbox" name="${name}" value="${i}" ${selected.includes(i)?'checked':''}><span>${DAY[i]}</span></label>`).join('')}
  function openRhythmEditor(){const r=rhythm();document.getElementById('rhythmModal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="rb-modal-backdrop" id="rhythmModal"><div class="rb-modal rb-rhythm-modal"><div class="rb-modal-head"><div><span>RUNNERBEAR</span><h2>Ukerytme</h2></div><button id="closeRhythm">×</button></div><div class="rb-rhythm-form"><fieldset><legend>Hvilke dager kan du normalt løpe?</legend><div class="rb-day-grid">${dayChecks('runDay',r.runDays)}</div></fieldset><fieldset><legend>Foretrukne kvalitetsdager</legend><div class="rb-day-grid">${dayChecks('qualityDay',r.qualityDays)}</div><small>RunnerBear flytter dem hvis avstanden til langtur eller annen kvalitet blir for kort.</small></fieldset><label>Foretrukket langturdag<select id="rhythmLong">${FULL.map((d,i)=>`<option value="${i}" ${i===r.longRunDay?'selected':''}>${d}</option>`).join('')}</select></label><fieldset><legend>Styrkedager</legend><div class="rb-day-grid">${dayChecks('strengthDay',r.strengthDays)}</div></fieldset><fieldset><legend>Cross-training mulig</legend><div class="rb-day-grid">${dayChecks('crossDay',r.crossDays)}</div></fieldset><label class="rb-check"><input id="rhythmCross" type="checkbox" ${r.allowCross?'checked':''}> Bruk Zwift / Concept2 på ikke-løpedager når det passer</label><div class="rb-modal-actions"><button class="complete" id="saveRhythm">Lagre ukerytme</button></div></div></div></div>`);document.getElementById('closeRhythm').onclick=()=>document.getElementById('rhythmModal').remove();document.getElementById('saveRhythm').onclick=saveRhythm}
  function checked(name){return[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>Number(x.value)).sort((a,b)=>a-b)}
  function saveRhythm(){const runDays=checked('runDay'),qualityDays=checked('qualityDay'),strengthDays=checked('strengthDay'),crossDays=checked('crossDay'),longRunDay=Number(document.getElementById('rhythmLong').value);if(runDays.length<3)return alert('Velg minst tre mulige løpedager.');if(!runDays.includes(longRunDay))return alert('Langturdagen må også være valgt som mulig løpedag.');const p=read(PROFILE,baseProfile());p.weekRhythm={runDays,qualityDays,longRunDay,strengthDays,crossDays,allowCross:document.getElementById('rhythmCross').checked};p.updatedAt=new Date().toISOString();write(PROFILE,p);document.getElementById('rhythmModal').remove();ensureRhythmCard();try{window.RunnerBearV7?.renderGoals?.()}catch{}renderFlexiblePlan()}

  function apply(){ensureRhythmCard();renderFlexiblePlan()}
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const r=prev.apply(this,arguments);requestAnimationFrame(apply);return r};
  document.addEventListener('click',e=>{if(e.target.closest('#saveProfile,#saveGoal,[data-activate-goal],#archiveGoal'))setTimeout(apply,0)},true);
  requestAnimationFrame(apply);
  window.RunnerBearAdaptive={rhythm,decision,adaptivePlan,renderFlexiblePlan};
})();