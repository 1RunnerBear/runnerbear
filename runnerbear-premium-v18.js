/* RunnerBear v7.1 · Permanent Coach stabilizer
   Race-aware calendar projection + legacy gate bridge. */
(function(){
  'use strict';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const goals=()=>{const x=read('runnerbear_v7_goals',[]);return Array.isArray(x)?x:[]};
  const active=()=>{const gs=goals(),id=localStorage.getItem('runnerbear_v7_active_goal');return gs.find(g=>g.id===id&&g.status!=='archived'&&g.status!=='completed')||gs.find(g=>g.status==='active')||null};
  const controls=g=>read('runnerbear_v7_controls',[]).filter(c=>c.goalId===g?.id);
  const date=s=>new Date(s+'T12:00:00');
  const dayDiff=(a,b)=>Math.round((date(b)-date(a))/86400000);
  const pace=s=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;
  const distKm={ '5k':5,'10k':10,half:21.0975,marathon:42.195 };
  const distName={ '5k':'5 km','10k':'10 km',half:'Halvmaraton',marathon:'Maraton' };
  function targetPace(g){return g?.targetSeconds&&distKm[g.distance]?g.targetSeconds/distKm[g.distance]:null}
  function legacyGateValue(n){return localStorage.getItem(`runfest26_gate${n}`)||''}
  function setLegacyGate(n,tone){localStorage.setItem(`runfest26_gate${n}`,tone);try{window.renderAll()}catch{location.reload()}}

  function specificWorkout(g,delta){
    const tp=targetPace(g);if(!tp)return null;
    if(delta===0)return{type:'race',title:`${distName[g.distance]||'Race'} · ${g.name}`,desc:'Konkurransedag.',detail:`Målfart ${pace(tp)}/km er ambisjon. Åpne kontrollert og la responsen bestemme siste del.`,intent:'Utfør raceplanen uten å bruke de første kilometerne til å bevise form.'};
    if(delta<0)return delta>=-3?{type:'easy',title:'Recovery / hvile',desc:'Løpet er gjennomført.',detail:'Ingen treningsgjeld. Gåtur eller svært lett aktivitet etter følelse.',intent:'Absorber konkurransen før neste blokk.'}:{type:'easy',title:'Rolig tilbake til rytme',desc:'Lav kostnad.',detail:'Kun lett trening til kroppen føles normal igjen.',intent:'Bygg kontinuitet før ny kvalitet.'};
    if(delta===1)return{type:'rest',title:'Hvile / valgfri shakeout',desc:'Friskhet først.',detail:'0–20 min ekstremt lett hvis det gjør deg bedre. Ellers full hvile.',intent:'Ingenting kan bygges dagen før. Bare bevar friskhet.'};
    if(delta===2)return{type:'easy',title:'4–5 km rolig + 4 strides',desc:'Kort og kvikt.',detail:'Strides 10–15 s. Full kontroll og lange pauser.',intent:'Vekk beina uten å skape kostnad.'};
    if(delta===3)return{type:'easy',title:'5–6 km svært rolig',desc:'Restitusjon.',detail:'Snakketempo. Ingen styrke.',intent:'Beskytt race-friskheten.'};
    if(delta===4)return{type:'quality',title:'4 × 4 min subterskel',desc:'75 s rolig jogg.',detail:'Kort kontrolløkt under terskel. Avslutt med mye igjen.',intent:'Behold rytmen – ikke bygg form nå.'};
    if(delta<=7)return{type:'easy',title:'Rolig · race week',desc:'Kortere enn normalt.',detail:'Easy means easy. Ingen progressiv avslutning.',intent:'Reduser volum og behold frekvens.'};
    if(delta<=12){
      const title=g.distance==='half'?'2 × 3 km race-spesifikk':g.distance==='10k'?'3 × 2 km race-spesifikk':g.distance==='5k'?'5 × 1 km kontrollert':'2 × 5 km maratonspesifikk';
      return{type:'quality',title,desc:'Kontrollert spesifisitet.',detail:`Rundt ${pace(tp+3)}–${pace(tp+7)}/km der det er relevant. Ingen pressing.`,intent:'Koble terskelmotoren til konkurransekravet uten å gjøre økten til en test.'};
    }
    return null;
  }
  function controlWorkout(g,iso){const c=controls(g).find(x=>x.date===iso);if(!c)return null;return{type:'quality',title:`${c.name} · ${c.workout}`,desc:'Kontrollpunkt.',detail:`${c.target||'Kontrollert'}. ${c.note||''}`,intent:'Kvalifiser neste beslutning. Ikke vinn testen.'}}
  function sessionOverride(g,iso){if(!g||g.type!=='race'||!g.eventDate)return null;return controlWorkout(g,iso)||specificWorkout(g,dayDiff(iso,g.eventDate))}

  function patchPlan(){
    const g=active();if(!g||g.id==='runfest-2026'||g.type!=='race')return;
    document.querySelectorAll('#weeks .rb-v7-week').forEach(sec=>{
      let containsRace=false,containsTaper=false;
      sec.querySelectorAll('.day').forEach(day=>{const input=day.querySelector('[data-v7-date]'),iso=input?.dataset.v7Date;if(!iso)return;const o=sessionOverride(g,iso);if(!o)return;const delta=dayDiff(iso,g.eventDate);containsRace=containsRace||delta===0;containsTaper=containsTaper||(delta>0&&delta<=7);const h=day.querySelector('h3'),tag=day.querySelector('.tag'),details=day.querySelectorAll('.daydetail'),intent=day.querySelector('.intent');if(h)h.textContent=o.title;if(tag){tag.className=`tag ${o.type}`;tag.textContent=o.type==='race'?'Race':o.type==='quality'?'Kvalitet':o.type==='rest'?'Hvile':'Rolig'}if(details[0])details[0].textContent=o.desc;if(details[1])details[1].textContent=o.detail;if(intent)intent.innerHTML=`<b>Hensikt:</b> ${o.intent}`;if(delta<0)day.classList.add('rb-post-race-day')});
      const phase=sec.querySelector('.phase'),focus=sec.querySelector('.weekhead .muted.small'),right=sec.querySelector('.weekhead>div:last-child>b');if(containsRace){if(phase)phase.textContent='RACE WEEK';if(focus)focus.textContent='Friskhet, rytme og gjennomføring.';if(right)right.textContent='Race week'}else if(containsTaper){if(phase)phase.textContent='Taper';if(focus)focus.textContent='Reduser kostnad. Behold små doser kvalitet.'}
    });
  }
  function patchToday(){
    const g=active();if(!g||g.id==='runfest-2026'||g.type!=='race')return;const now=new Date(),iso=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,o=sessionOverride(g,iso);if(!o)return;
    const type=document.getElementById('todayType');document.getElementById('todayTitle').textContent=o.title;document.getElementById('todayDesc').textContent=o.desc;document.getElementById('todayPace').textContent=o.type==='race'&&targetPace(g)?`${pace(targetPace(g))}/km`:o.type==='quality'?'kontrollert':'rolig';document.getElementById('todayHr').textContent=o.type==='quality'?'under terskel':'–';document.getElementById('todayPurpose').textContent=o.intent;if(type){type.className=`tag ${o.type}`;type.textContent=o.type==='race'?'Race':o.type==='quality'?'Kvalitet':o.type==='rest'?'Hvile':'Rolig'}
  }
  function patchPlanHeader(){const g=active(),head=document.querySelector('#plan .section-head');if(!head)return;const eye=head.querySelector('.eyebrow'),p=head.querySelector('p');if(g&&g.id!=='runfest-2026'){if(eye)eye.textContent='RULLERENDE BLOKK';if(p)p.textContent=g.type==='race'?'Fire uker frem. Terskel først, spesifisitet når løpet nærmer seg.':'Fire uker frem. Planen bøyes etter respons – uten treningsgjeld.'}else{if(eye)eye.textContent='8 UKER';if(p)p.textContent='Presisjon over innsats. Rolig betyr rolig. Kvalitet skal kunne gjentas.'}}
  function patchNavIcon(){document.querySelectorAll('.navbtn[data-tab="goals"] span').forEach(s=>s.textContent='◎')}

  function installLegacyGateBridge(){
    const view=document.getElementById('goals');if(!view||view.dataset.gateBridge)return;view.dataset.gateBridge='1';view.addEventListener('click',e=>{const b=e.target.closest('[data-control]');if(!b)return;const id=b.dataset.control,n=id==='runfest-g1'?1:id==='runfest-g2'?2:0;if(!n)return;e.preventDefault();e.stopImmediatePropagation();const current=legacyGateValue(n),r=prompt(`Gate ${n}: skriv grønn, gul eller rød.`,current==='green'?'grønn':current==='yellow'?'gul':current==='red'?'rød':'grønn');if(!r)return;const v=r.toLowerCase(),tone=v.startsWith('g')?'green':v.startsWith('r')?'red':'yellow';setLegacyGate(n,tone)},true)
  }
  function refreshAfterGoalActions(){document.addEventListener('click',e=>{if(e.target.closest('#saveGoal,#archiveGoal,[data-activate-goal],#saveProfile'))setTimeout(()=>{try{window.renderAll()}catch{}},0)},true)}
  function apply(){patchPlan();patchToday();patchPlanHeader();patchNavIcon();installLegacyGateBridge()}
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const r=prev.apply(this,arguments);requestAnimationFrame(apply);return r};
  refreshAfterGoalActions();requestAnimationFrame(apply);
})();