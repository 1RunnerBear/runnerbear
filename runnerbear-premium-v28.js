/* RunnerBear v8.2.2 · authoritative flexible-activity state
   One source of truth for Today + Plan. Legacy easy-day renderers may create UI,
   but this layer owns the final visible activity state. */
(function(){
  'use strict';

  const ICONS={
    run:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15.5" cy="4.2" r="1.7"/><path d="M13.4 7.1 10.7 10l2.2 2.2 2.1 3.4M13.4 7.1l3 2.1 2.8-.4M10.7 10l-3.4 3.9M15 15.6l3.4 2.5M12.9 12.2l-1.7 4.8-4.1 2"/></svg>`,
    row:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6.2" r="1.6"/><path d="M9.2 8.2 12 11l4.1-1.2M10.9 11.1 8.1 14.4h5.1l2.6 3.2M3 18.3h13.4M5 20.8h10.2M16.2 9.2l2.1 8.4M18.4 8.7h2.4M20 8.7l1 8.9M18.2 17.6h3.4"/></svg>`,
    bike:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.1"/><circle cx="18" cy="17" r="3.1"/><path d="M6 17 9.6 10h4l4.4 7M9.6 10 12 17h6M8.6 7.7h3M13.6 10l1.3-2.5h2.2"/></svg>`
  };
  const META={run:{label:'Rolig jogg',tag:'Rolig'},row:{label:'Concept2',tag:'Cross'},bike:{label:'Zwift',tag:'Cross'}};
  const $=id=>document.getElementById(id);
  const slugLocal=s=>String(s||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'');
  const keyFor=f=>`runfest26_easychoice_${slugLocal(f.label)}`;
  const isLong=f=>/langtur/i.test(f?.title||'');
  const strength=f=>/styrke/i.test(`${f?.title||''} ${f?.desc||''}`)?' + planlagt styrke':'';

  function modeDefault(f){
    if(!f)return'run';
    if(isLong(f)||f.type==='easy')return'run';
    if(/Concept2|roing/i.test(f.title||''))return'row';
    if(/Zwift|sykkel/i.test(f.title||''))return'bike';
    if(f.type==='cross')return'bike';
    return'run';
  }
  function modeFor(f){const saved=localStorage.getItem(keyFor(f));return META[saved]?saved:modeDefault(f)}
  function setMode(f,mode){if(f&&META[mode])localStorage.setItem(keyFor(f),mode)}
  function runKm(f){if(Number(f?.km)>0)return Number(f.km);if(f?.type==='cross')return 5.5;if(f?.type==='rest')return 5;return 0}
  function rowMinutes(f){const km=runKm(f);if(isLong(f))return km>=18?'70–85':km>=15?'65–80':'60–75';if(km>=9)return'45–55';if(km>=7)return'40–50';if(km>=5)return'35–45';return'30–40'}
  function bikeMinutes(f){const km=runKm(f);if(isLong(f))return km>=18?'80–95':km>=15?'75–90':'70–85';if(km>=9)return'50–60';if(km>=7)return'45–55';if(km>=5)return'40–50';return'35–45'}
  function baseTarget(f){try{return typeof targetSummary==='function'?targetSummary(f):{pace:'rolig',hr:'–'}}catch{return{pace:'rolig',hr:'–'}}}

  function prescription(f,mode){
    const extra=strength(f),km=runKm(f);
    if(mode==='row'){
      const mins=rowMinutes(f);return{title:`Concept2 · ${mins} min${extra}`,big:`${mins} min`,pace:'RPE 2–3',hr:'snakketempo',line:'RPE 2–3/10 · 18–22 spm · jevn, lett aerob roing. Du skal kunne snakke i hele setninger.',detail:'Ingen terskeldrag eller hard avslutning.',gear:'Concept2 RowErg · Cross',purpose:'Legge til aerob belastning uten ekstra løpsstøt og bevare friske løpebein.',coach:'Hold roingen aerob. Den skal støtte løpingen, ikke bli en ekstra terskeløkt.'};
    }
    if(mode==='bike'){
      const mins=bikeMinutes(f);return{title:`Zwift · ${mins} min${extra}`,big:`${mins} min`,pace:'Z1/Z2',hr:'RPE 2–3',line:'Z1/Z2 · RPE 2–3/10 · ca. 85–95 rpm. Ingen tempo-/sweetspot-blokker.',detail:'Jevn lett sykling hele veien.',gear:'Zwift · Cross',purpose:'Legge til aerob belastning uten ekstra løpsstøt og bevare friske løpebein.',coach:'Hold sykkelen aerob. Den skal støtte løpingen, ikke bli en ekstra terskeløkt.'};
    }
    const t=baseTarget(f);
    if(isLong(f))return{title:`${km} km rolig løp`,big:`${km} km`,pace:t.pace==='lett / fri'?'rolig':t.pace,hr:t.hr==='–'?'130–148 bpm':t.hr,line:'Rolig, jevn langtur. Hold intensiteten lav nok til at varigheten er selve stimulusen.',detail:'Ingen ekstra progresjon utover det som står i planen.',gear:f.shoe||'Komfortabel roligsko',purpose:'Bygge aerob robusthet og varighet uten å gjøre langturen til en moderat kvalitetsøkt.',coach:'Langturens verdi ligger i varighet og lave kostnader, ikke i å vise form.'};
    if(f.type==='cross'||f.type==='rest')return{title:`${km||5} km svært rolig løp${extra}`,big:`${km||5} km`,pace:'svært rolig',hr:'125–142 bpm',line:'HR hovedsakelig 125–142. Dette er et lett løpsalternativ – ikke en ekstra moderat økt.',detail:'Snakketempo og avslappet steg.',gear:'Nike Vomero Premium / komfortabel easy-sko',purpose:'Restitusjon og aerob grunnmur med svært lav kostnad. Denne økten skal gjøre neste kvalitetsøkt bedre.',coach:'Rolig betyr rolig. La kvaliteten få eie de raske minuttene.'};
    return{title:`${km} km rolig løp`,big:`${km} km`,pace:t.pace==='lett / fri'?'rolig':t.pace,hr:t.hr==='–'?'130–148 bpm':t.hr,line:`${t.hr&&t.hr!=='–'?t.hr+'. ':''}Snakketempo og avslappet steg.`,detail:f.detail||'Jevn, rolig belastning.',gear:f.shoe||'Komfortabel roligsko',purpose:'Restitusjon og aerob grunnmur. Denne økten skal gjøre neste kvalitetsøkt bedre.',coach:'Rolig betyr produktivt. La kvaliteten få eie de raske minuttene.'};
  }
  function icon(mode,cls='rb-aicon'){return `<span class="${cls}" aria-hidden="true">${ICONS[mode]}</span>`}
  function findWorkout(box){const label=box?.dataset?.easyDate;if(!label||typeof flat==='undefined'||!Array.isArray(flat))return null;return flat.find(x=>x.label===label)||null}
  function paintButtons(box,mode){box.querySelectorAll('[data-mode]').forEach(btn=>{const m=btn.dataset.mode;if(!META[m])return;btn.innerHTML=`${icon(m)}<span>${META[m].label}</span>`;btn.classList.toggle('active',m===mode);btn.setAttribute('aria-pressed',m===mode?'true':'false');btn.setAttribute('aria-label',META[m].label)});box.classList.add('rb-authoritative-choice')}
  function paintPrescription(box,p){const card=box.querySelector('.easy-prescription');if(!card)return;const strong=card.querySelector('strong'),line=card.querySelector('span'),small=card.querySelector('small');if(strong)strong.textContent=p.title;if(line)line.textContent=p.line;if(small)small.textContent=p.gear}
  function paintTag(el,mode,long=false){if(!el)return;el.className=`tag ${mode==='run'?'easy':'cross'} rb-actual-mode`;el.innerHTML=`${icon(mode,'rb-tag-aicon')}<span>${long&&mode==='run'?'Langtur':META[mode].tag}</span>`}
  function syncToday(box,f,mode,p){if(box.dataset.easySlot!=='today')return;const set=(id,val)=>{const el=$(id);if(el)el.textContent=val};set('todayTitle',p.title);set('todayDesc',p.line);set('todayPace',p.pace);set('todayHr',p.hr);set('todayKm',p.big);set('todayPurpose',p.purpose);set('todayShoe',p.gear);set('todayCoach',`RB Coach · ${p.coach}`);paintTag($('todayType'),mode,isLong(f))}
  function syncPlan(box,f,mode,p){if(box.dataset.easySlot==='today')return;const day=box.closest('.day');if(!day)return;const title=day.querySelector('.day-summary h3');if(title)title.textContent=p.title;paintTag(day.querySelector('.day-body .tag'),mode,isLong(f));const details=day.querySelectorAll('.day-body > .daydetail');if(details[0])details[0].textContent=p.line;if(details[1])details[1].textContent=p.detail;const intent=day.querySelector('.day-body > .intent');if(intent)intent.innerHTML=`<b>Hensikt:</b> ${p.purpose}`;const gear=day.querySelector('.day-body > .daymeta:not(.fuel)');if(gear)gear.textContent=p.gear;day.dataset.rbActualMode=mode}
  function syncBox(box){const f=findWorkout(box);if(!f)return;const mode=modeFor(f),p=prescription(f,mode);paintButtons(box,mode);paintPrescription(box,p);syncToday(box,f,mode,p);syncPlan(box,f,mode,p)}
  function syncWeekStrip(){if(typeof flat==='undefined'||!Array.isArray(flat)||typeof currentWeek!=='function')return;let wd=[];try{const w=currentWeek();wd=flat.filter(f=>f.week===w.n)}catch{return}document.querySelectorAll('#weekStrip .week-mini').forEach((el,i)=>{const f=wd[i];if(!f)return;const flexible=f.type==='easy'||f.type==='cross'||(f.type==='rest'&&/Zwift|roing|Concept2/i.test(f.title));if(!flexible)return;const mode=modeFor(f),b=el.querySelector('b');if(!b)return;let mini=b.querySelector('.mode-mini');if(!mini){mini=document.createElement('small');mini.className='mode-mini';b.appendChild(mini)}mini.innerHTML=` · ${icon(mode,'rb-mini-aicon')}<span>${META[mode].label}</span>`})}
  function syncAll(){document.querySelectorAll('.easy-choice[data-easy-date]').forEach(syncBox);syncWeekStrip();document.documentElement.classList.add('rb-activity-state-v28')}

  document.addEventListener('click',e=>{const btn=e.target.closest('.easy-choice[data-easy-date] [data-mode]');if(!btn||!META[btn.dataset.mode])return;const box=btn.closest('.easy-choice'),f=findWorkout(box);if(!f)return;setMode(f,btn.dataset.mode);requestAnimationFrame(syncAll);setTimeout(syncAll,30)},true);

  const previous=window.renderAll;
  if(typeof previous==='function')window.renderAll=function(){const out=previous.apply(this,arguments);syncAll();requestAnimationFrame(syncAll);return out};

  syncAll();requestAnimationFrame(syncAll);setTimeout(syncAll,80);
})();