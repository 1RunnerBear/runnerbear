/* RunnerBear v5.10 · aerobic efficiency, Achilles load map and adaptive week coach
   Guardrails:
   - Trends are descriptive; no single metric changes training pace or race goal.
   - Week revisions can only maintain or reduce load. They never add quality or training debt.
   - Achilles patterning is observational, never causal or diagnostic.
   - Standardized aerobic comparisons prefer the same context and similar effort. */
(function(){
  const AERO_KEY='runfest26_aerobic_efficiency_history';
  const ADJ_KEY='runfest26_week_adjustments';
  const REV_META_PREFIX='runfest26_week_revision_meta_';
  const SWAP_KEY='runfest26_schedule_swaps';

  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'');return v&&typeof v==='object'?v:fallback}catch{return fallback}}
  function localDate(d=new Date()){const z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
  function dayDiff(a,b){const x=new Date(a.getFullYear(),a.getMonth(),a.getDate(),12),y=new Date(b.getFullYear(),b.getMonth(),b.getDate(),12);return Math.round((y-x)/86400000)}
  function workoutByLabel(label){return flat.find(f=>f.label===label)}
  function isLongRun(f){return !!f&&/langtur/i.test(f.title)}
  function isKey(f){return !!f&&(f.type==='quality'||f.type==='race'||isLongRun(f))}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  // -----------------------------
  // Schedule helpers (compatible with v5.9 smart swaps)
  // -----------------------------
  function readSwaps(){
    const rows=readJson(SWAP_KEY,[]);return Array.isArray(rows)?rows.filter(x=>x&&x.a&&x.b):[];
  }
  function swapPartner(label){const s=readSwaps().find(x=>x.a===label||x.b===label);return s?(s.a===label?s.b:s.a):null}
  function effectiveDate(f){const p=swapPartner(f.label),o=p&&workoutByLabel(p);return o?o.date:f.date}
  function effectiveLabel(f){return swapPartner(f.label)||f.label}

  // -----------------------------
  // Week adjustments / Before → After coach
  // -----------------------------
  function readAdjustments(){const x=readJson(ADJ_KEY,{});return x&&!Array.isArray(x)?x:{}}
  function writeAdjustments(x){localStorage.setItem(ADJ_KEY,JSON.stringify(x))}
  function adjustmentFor(f){return f?readAdjustments()[f.label]||null:null}
  function applyAdjustment(f){
    if(!f)return f;const a=adjustmentFor(f);if(!a)return f;
    return Object.assign({},f,{type:a.type||f.type,title:a.title||f.title,desc:a.desc||f.desc,detail:a.detail||f.detail,shoe:a.shoe===undefined?f.shoe:a.shoe,fuel:a.fuel===undefined?f.fuel:a.fuel,km:a.km===undefined?f.km:Number(a.km),rbRevision:a});
  }
  function revisionMeta(w=currentWeek()){return readJson(`${REV_META_PREFIX}${w.n}`,null)}
  function weekAdjustments(w=currentWeek()){
    const all=readAdjustments(),out={};flat.filter(f=>f.week===w.n).forEach(f=>{if(all[f.label])out[f.label]=all[f.label]});return out;
  }
  function clearWeekRevision(w=currentWeek()){
    const all=readAdjustments();flat.filter(f=>f.week===w.n).forEach(f=>delete all[f.label]);writeAdjustments(all);localStorage.removeItem(`${REV_META_PREFIX}${w.n}`);renderAll();
  }
  function reducedKm(f,factor=.78){return Math.max(f.km?Math.round(f.km*factor):0,f.km>=5?4:0)}
  function noProgressionDetail(f){return`${f.detail||''} Revidert: helt rolig; ingen progresjon eller ekstra fart.`.trim()}
  function replacement(reason,f,kind){
    const base={reason,created:new Date().toISOString()};
    if(kind==='rest')return Object.assign(base,{type:'rest',title:'Hvile / smertefri cross',desc:'Planlagt løping utgår i denne reviderte dagen.',detail:'Ingen treningsgjeld. Velg eventuelt lett Concept2/Zwift bare hvis det kjennes bra.',km:0,shoe:'',fuel:''});
    if(kind==='easy5')return Object.assign(base,{type:'easy',title:'5 km svært rolig',desc:'Kort vedlikehold i stedet for planlagt belastning.',detail:'Snakketempo. Ingen strides eller progresjon.',km:5,shoe:'Nike Vomero Premium',fuel:''});
    return base;
  }
  function precheckReason(f){
    if(!f)return null;const v=readJson(`runfest26_precheck_${slug(f.label)}`,{}),vals=Object.values(v).filter(x=>['g','y','r'].includes(x));
    if(vals.length<3)return null;
    const reds=vals.filter(x=>x==='r').length,yellows=vals.filter(x=>x==='y').length;
    if(v.achilles==='r')return'achilles';
    if((v.warmup==='r'&&(v.legs!=='g'||v.sleep==='r'||v.achilles==='y'))||reds>=2)return'tired';
    if(reds>=1||yellows>=2)return'caution';
    return null;
  }
  function revisionTrigger(f){
    if(!f)return null;
    const adapt=localStorage.getItem(adaptKey(f.label));if(['achilles','tired','time','skip'].includes(adapt))return adapt;
    const pre=precheckReason(f);if(pre==='achilles'||pre==='tired')return pre;
    if(weekCheck()==='heavy'&&isKey(f))return'tired';
    return null;
  }
  function reasonName(r){return({achilles:'Akilles',tired:'Tung/sliten kropp',time:'Dårlig tid',skip:'Kan ikke i dag'}[r]||'Belastning')}
  function proposalForWeek(f,reason){
    if(!f||!reason)return null;const w=weeks.find(x=>x.n===f.week)||currentWeek(),days=flat.filter(x=>x.week===w.n).sort((a,b)=>effectiveDate(a)-effectiveDate(b));
    const nowDate=effectiveDate(f),changes={};
    const set=(x,a)=>{changes[x.label]=Object.assign({reason,created:new Date().toISOString()},a)};

    if(reason==='achilles'){
      if(f.km>0||f.type==='quality'||isLongRun(f))set(f,replacement(reason,f,'rest'));
      days.filter(x=>x.label!==f.label&&dayDiff(nowDate,effectiveDate(x))===1&&x.km>0).forEach(x=>set(x,replacement(reason,x,'rest')));
      days.filter(x=>dayDiff(nowDate,effectiveDate(x))>=2&&dayDiff(nowDate,effectiveDate(x))<=3&&isLongRun(x)).forEach(x=>set(x,{type:'easy',title:`${reducedKm(x,.75)} km rolig · uten progresjon`,desc:'Revidert langtur med lavere støtbelastning.',detail:noProgressionDetail(x),km:reducedKm(x,.75),shoe:x.shoe,fuel:x.fuel,reason,created:new Date().toISOString()}));
    }
    if(reason==='tired'){
      if(f.type==='quality'&&!/gate/i.test(f.title))set(f,{type:'quality',title:reduceWorkoutTitle(f.title),desc:'Revidert kvalitetsøkt: lavere arbeidsvolum, samme kontroll.',detail:`${f.detail} Start konservativt. Samme eller litt roligere fart enn planen; stopp før økten blir dyr.`,km:reducedKm(f,.78),shoe:f.shoe,fuel:f.fuel,reason,created:new Date().toISOString()});
      else if(/gate/i.test(f.title))set(f,replacement(reason,f,'easy5'));
      else if(isLongRun(f))set(f,{type:'easy',title:`${reducedKm(f,.78)} km rolig`,desc:'Kortere langtur for å absorbere belastningen.',detail:noProgressionDetail(f),km:reducedKm(f,.78),shoe:f.shoe,fuel:f.fuel,reason,created:new Date().toISOString()});
      else if(f.km>0)set(f,{type:'easy',title:`${Math.max(4,reducedKm(f,.8))} km svært rolig`,desc:'Kortere og lettere enn opprinnelig.',detail:'Snakketempo. Ingen ekstra strides eller progresjon.',km:Math.max(4,reducedKm(f,.8)),shoe:f.shoe,fuel:'',reason,created:new Date().toISOString()});
      days.filter(x=>x.label!==f.label&&isLongRun(x)&&dayDiff(nowDate,effectiveDate(x))>0).forEach(x=>set(x,{type:'easy',title:`${x.km} km rolig · ingen progresjon`,desc:x.desc,detail:noProgressionDetail(x),km:x.km,shoe:x.shoe,fuel:x.fuel,reason,created:new Date().toISOString()}));
    }
    if(reason==='time'){
      if(/gate/i.test(f.title))set(f,replacement(reason,f,'easy5'));
      else if(f.type==='quality')set(f,{type:'quality',title:reduceWorkoutTitle(f.title),desc:'Kortversjon med bevart intensitetskontroll.',detail:`${f.detail} Kutt volum, ikke øk farten.`,km:reducedKm(f,.72),shoe:f.shoe,fuel:f.fuel,reason,created:new Date().toISOString()});
      else if(isLongRun(f))set(f,{type:'easy',title:'60 min rolig',desc:'Kortere langtur uten kompensasjon.',detail:'Rolig hele veien. Ingen tempo for å hente inn kilometer.',km:Math.min(f.km||10,10),shoe:f.shoe,fuel:'',reason,created:new Date().toISOString()});
      else if(f.km>0)set(f,replacement(reason,f,'easy5'));
      else set(f,{type:f.type,title:f.title,desc:f.desc,detail:f.detail,km:f.km,shoe:f.shoe,fuel:f.fuel,reason,created:new Date().toISOString()});
    }
    if(reason==='skip')set(f,{type:'rest',title:'Hvile · økten utgår',desc:'Dagens økt droppes uten å flytte treningsgjeld videre i uka.',detail:'Fortsett med neste planlagte dag. Ingen kilometer skal hentes inn senere.',km:0,shoe:'',fuel:'',reason,created:new Date().toISOString()});

    // Never let a revision increase planned run volume.
    Object.keys(changes).forEach(label=>{const orig=workoutByLabel(label),a=changes[label];if(orig&&Number(a.km||0)>orig.km)a.km=orig.km});
    const changed=Object.keys(changes).filter(label=>{const o=workoutByLabel(label),a=changes[label];return o&&(a.title!==o.title||a.type!==o.type||Number(a.km)!==o.km||a.detail!==o.detail)});
    if(!changed.length)return null;
    return{week:w,reason,changes,changed};
  }
  function applyProposal(p){
    if(!p)return;const all=readAdjustments();flat.filter(f=>f.week===p.week.n).forEach(f=>delete all[f.label]);Object.assign(all,p.changes);writeAdjustments(all);
    localStorage.setItem(`${REV_META_PREFIX}${p.week.n}`,JSON.stringify({reason:p.reason,created:new Date().toISOString(),labels:p.changed}));renderAll();
  }
  function plannedWeekKm(w,withAdj=true){return flat.filter(f=>f.week===w.n).reduce((sum,f)=>sum+(withAdj?applyAdjustment(f):f).km,0)}

  const baseNextSession=nextSession;
  nextSession=function(){return applyAdjustment(baseNextSession())};

  function ensureRevisionCard(){
    if($('weekRevisionCard'))return;const review=document.querySelector('.week-review');if(!review)return;
    const card=document.createElement('article');card.id='weekRevisionCard';card.className='card week-revision-card hidden';review.insertAdjacentElement('afterend',card);
  }
  function revisionRow(f,a){return`<div class="revision-row"><div><span>${esc(effectiveLabel(f))}</span><b>${esc(f.title)}</b><small>${f.km?f.km+' km':classLabel[f.type]}</small></div><i>→</i><div><span>REVIDERT</span><b>${esc(a.title)}</b><small>${a.km?`${a.km} km`:(a.type==='rest'?'hvile':'0 km')}</small></div></div>`}
  function renderRevisionCard(){
    ensureRevisionCard();const card=$('weekRevisionCard');if(!card)return;const w=currentWeek(),active=weekAdjustments(w),meta=revisionMeta(w),activeLabels=Object.keys(active);
    if(activeLabels.length){
      card.classList.remove('hidden');card.innerHTML=`<div class="kicker"><span>RB COACH · REVIDERT UKE</span><span>aktiv</span></div><div class="revision-active-head"><h2>Planen er bøyd – ikke brutt</h2><b>${plannedWeekKm(w,true)} km revidert · original ${w.km} km</b></div><p>Ingen ekstra kvalitet er lagt til. Endringene reduserer eller bevarer belastningen.</p><div class="revision-list">${activeLabels.map(l=>revisionRow(workoutByLabel(l),active[l])).join('')}</div><button type="button" class="secondary" id="resetWeekRevision">Tilbakestill revidert uke</button>`;
      $('resetWeekRevision').onclick=()=>clearWeekRevision(w);return;
    }
    const f=nextSession(),reason=revisionTrigger(f),proposal=proposalForWeek(workoutByLabel(f?.label),reason);
    if(!proposal){card.classList.add('hidden');card.innerHTML='';return}
    const before=plannedWeekKm(w,false),after=flat.filter(x=>x.week===w.n).reduce((s,x)=>s+Number((proposal.changes[x.label]?.km??x.km)||0),0);
    card.classList.remove('hidden');card.innerHTML=`<div class="kicker"><span>RB COACH · FORSLAG</span><span>FØR → ETTER</span></div><h2>Revider resten av uka?</h2><p><strong>${reasonName(reason)}</strong> gjør at RunnerBear foreslår en mindre kostbar uke. Ingen tapte kilometer flyttes til senere dager.</p><div class="revision-load"><div><span>ORIGINAL PLAN</span><b>${before} km</b></div><i>→</i><div><span>FORSLAG</span><b>${after} km</b></div></div><div class="revision-list">${proposal.changed.map(l=>revisionRow(workoutByLabel(l),proposal.changes[l])).join('')}</div><div class="revision-guardrails">✓ Ingen ny kvalitet · ✓ Ingen raskere fart · ✓ Ingen økt løpsmengde</div><button type="button" class="complete revision-apply" id="applyWeekRevision">Bruk revidert uke</button>`;
    $('applyWeekRevision').onclick=()=>applyProposal(proposal);
  }

  function postprocessRevisionPlan(){
    const all=readAdjustments();document.querySelectorAll('#weeks .week').forEach(sec=>{const m=sec.querySelector('.weekhead h2')?.textContent.match(/Uke\s+(\d+)/),w=m&&weeks.find(x=>x.n===Number(m[1]));if(!w)return;const has=Object.keys(weekAdjustments(w)).length,b=sec.querySelector('.weekhead>div:last-child>b');if(b)b.textContent=has?`${plannedWeekKm(w,true)} km · revidert`:`${w.km} km`});document.querySelectorAll('#weeks .day').forEach(node=>{
      node.querySelectorAll('.revision-badge,.revision-purpose').forEach(x=>x.remove());
      const label=node.dataset.originalLabel||node.querySelector('.daydate')?.textContent,f=workoutByLabel(label),a=f&&all[f.label];if(!f||!a)return;
      const ef=applyAdjustment(f),h=node.querySelector('h3'),tag=node.querySelector('.tag'),body=node.querySelector('.day-body');if(h)h.textContent=ef.title;
      if(tag){tag.className=`tag ${ef.type}`;tag.textContent=classLabel[ef.type]||ef.type}
      const details=[...node.querySelectorAll('.day-body > .daydetail')];if(details[0])details[0].textContent=ef.desc;if(details[1])details[1].textContent=ef.detail;
      const intent=node.querySelector('.intent');if(intent)intent.innerHTML=`<b>Revidert hensikt:</b> ${esc(workoutPurpose(ef))}`;
      node.querySelectorAll('.easy-choice,.plan-smart-move,.shoe-achilles-quick').forEach(x=>x.remove());
      if(a.shoe===''||ef.type==='rest')node.querySelectorAll('.daymeta').forEach(x=>x.remove());
      if(ef.type!=='quality'&&ef.type!=='race'&&!isLongRun(ef))node.querySelectorAll('.feedback,.stimulus').forEach(x=>x.remove());
      const badge=document.createElement('div');badge.className='revision-badge';badge.textContent=`REVIDERT · ${reasonName(a.reason)}`;node.querySelector('.day-summary')?.appendChild(badge);
    });
  }
  function defaultEasyMode(f){const saved=localStorage.getItem(`runfest26_easychoice_${slug(f.label)}`);if(saved)return saved;if(f.type==='easy')return'run';if(/Zwift/i.test(f.title))return'bike';if(/Concept2|roing/i.test(f.title))return'row';if(f.type==='cross')return'bike';return null}
  function fallbackRunKm(f){if(f.km>0)return f.km;if(f.type==='cross')return 5.5;if(f.type==='rest'&&/31\. aug|21\. sep/i.test(f.label))return 5;return 0}
  function postprocessRevisionStrip(){
    const all=readAdjustments();document.querySelectorAll('#weekStrip .week-mini').forEach(n=>{
      const label=n.dataset.originalLabel||'',f=workoutByLabel(label),a=f&&all[f.label];if(!f||!a)return;const ef=applyAdjustment(f),b=n.querySelector('b'),s=n.querySelector('span');if(b)b.textContent=ef.title;if(s)s.textContent=`${effectiveLabel(f).split(' ')[0]} · ${ef.km?ef.km+' km':classLabel[ef.type]}`;n.classList.add('revised');
    });
    const w=currentWeek();if(!Object.keys(weekAdjustments(w)).length)return;let run=0,cross=0;flat.filter(f=>f.week===w.n&&isDone(f.label)).forEach(f=>{const a=adjustmentFor(f),ef=applyAdjustment(f);if(a){if(ef.type==='cross')cross++;else if(ef.type!=='rest')run+=Number(ef.km||0);return}const mode=defaultEasyMode(f);if((f.type==='easy'||f.type==='cross'||f.type==='rest')&&mode&&mode!=='run'){cross++;return}if(f.type==='cross'&&mode!=='run'){cross++;return}run+=mode==='run'?fallbackRunKm(f):Number(f.km||0)});
    $('weekKmTop').textContent=`${run.toFixed(1).replace('.0','')} / ${plannedWeekKm(w,true)} løpskm${cross?` · ${cross} cross`:''}`;
  }

  // -----------------------------
  // Standardized aerobic efficiency
  // -----------------------------
  const aeroContext={route:'Fast rolig rute',mill:'Mølle',flat:'Flat ute'};
  function readAero(){
    const rows=readJson(AERO_KEY,[]);if(!Array.isArray(rows))return[];
    return rows.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&aeroContext[x.context]&&paceSec(x.pace)&&Number(x.hr)>=90&&Number(x.hr)<=190&&Number(x.rpe)>=1&&Number(x.rpe)<=6)
      .map(x=>({date:x.date,context:x.context,pace:x.pace.match(/\d:\d{2}/)[0],hr:Number(x.hr),rpe:Number(x.rpe),label:x.label||'',note:x.note||''})).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function writeAero(rows){localStorage.setItem(AERO_KEY,JSON.stringify(rows))}
  function saveAero(item){
    const rows=readAero(),idx=item.label?rows.findIndex(x=>x.label===item.label):-1;if(idx>=0)rows[idx]=item;else rows.push(item);writeAero(rows);renderAll();
  }
  function comparableAero(){
    const h=readAero();if(h.length<2)return null;const latest=h[h.length-1],candidates=h.slice(0,-1).filter(x=>x.context===latest.context).map(x=>({x,score:Math.min(Math.abs(x.hr-latest.hr)/4,Math.abs(paceSec(x.pace)-paceSec(latest.pace))/8)+Math.abs(x.rpe-latest.rpe)/2})).sort((a,b)=>a.score-b.score);
    const prev=candidates[0]?.x||null;if(!prev)return{latest,prev:null};
    const similarHr=Math.abs(prev.hr-latest.hr)<=4,similarPace=Math.abs(paceSec(prev.pace)-paceSec(latest.pace))<=8,similarRpe=Math.abs(prev.rpe-latest.rpe)<=1;
    return(similarHr||similarPace)&&similarRpe?{latest,prev}:{latest,prev:null};
  }
  function aeroInsight(){
    const p=comparableAero();if(!p)return{level:'neutral',title:'Bygg aerob baseline',text:'Logg en rolig standardøkt på samme rute eller mølle. RunnerBear sammenligner bare når forhold og innsats er rimelig like.'};
    if(!p.prev)return{level:'neutral',title:'Trenger sammenlignbart punkt',text:'Du har aerobdata, men ikke to punkter med samme kontekst og tilsvarende puls/fart + RPE ennå.'};
    const l=p.latest,o=p.prev,paceGain=paceSec(o.pace)-paceSec(l.pace),hrGain=o.hr-l.hr,rpeGain=o.rpe-l.rpe;
    if((Math.abs(l.hr-o.hr)<=4&&paceGain>=5&&rpeGain>=-1)||(Math.abs(paceSec(l.pace)-paceSec(o.pace))<=8&&hrGain>=4&&rpeGain>=0))return{level:'green',title:'Aerob kostnad peker ned',text:`Mot ${o.date}: ${paceGain>0?`${paceGain} sek/km raskere`:paceGain<0?`${Math.abs(paceGain)} sek/km roligere`:'samme fart'}, ${hrGain>0?`${hrGain} bpm lavere`:hrGain<0?`${Math.abs(hrGain)} bpm høyere`:'samme puls'} og RPE ${l.rpe}. Positivt, men ikke grunn til å gjøre easy raskere.`};
    if((Math.abs(paceSec(l.pace)-paceSec(o.pace))<=8&&l.hr-o.hr>=5)||(Math.abs(l.hr-o.hr)<=4&&paceGain<=-8)||l.rpe-o.rpe>=2)return{level:'yellow',title:'Rolig arbeid koster mer akkurat nå',text:`Mot ${o.date} er responsen dyrere under sammenlignbare forhold. Ikke jag pace på rolige dager; se dette sammen med søvn, trafikklys og neste kvalitetsøkt.`};
    return{level:'neutral',title:'Aerob respons er stabil',text:`Sammenlignet med ${o.date} er endringen liten. Stabil easy-effektivitet er helt fint mens kvalitetsarbeidet får eie progresjonen.`};
  }
  function ensureAeroCard(){
    if($('aeroEfficiencyCard'))return;const control=$('controlTrendCard'),more=$('more');if(!more)return;
    const card=document.createElement('article');card.id='aeroEfficiencyCard';card.className='card aero-card';card.innerHTML=`<div class="kicker"><span>AEROB EFFEKTIVITET</span><span>rolig · standardisert</span></div><div id="aeroInsight" class="aero-insight neutral"></div><div id="aeroList" class="aero-list"></div><details class="add-aero"><summary>+ Registrer aerobase-punkt</summary><div class="aero-form"><input id="aeroDate" type="date"><select id="aeroContext"><option value="route">Fast rolig rute</option><option value="mill">Mølle</option><option value="flat">Flat ute</option></select><input id="aeroPace" placeholder="fart 5:30"><input id="aeroHr" type="number" min="90" max="190" placeholder="snittpuls"><input id="aeroRpe" type="number" min="1" max="6" placeholder="RPE 1–6"><button type="button" id="addAero">Lagre</button></div></details><p class="aero-note">Dette måler om samme rolige arbeid ser ut til å koste mindre. Det flytter aldri easy-farten opp automatisk.</p>`;
    (control||more.querySelector('.more-grid'))?.insertAdjacentElement('afterend',card);$('aeroDate').value=localDate();$('addAero').onclick=()=>{
      const date=$('aeroDate').value,context=$('aeroContext').value,pace=$('aeroPace').value.trim(),hr=Number($('aeroHr').value),rpe=Number($('aeroRpe').value);if(!date||!aeroContext[context]||!paceSec(pace)||hr<90||hr>190||rpe<1||rpe>6){alert('Fyll inn dato, kontekst, fart, snittpuls og rolig RPE 1–6.');return}saveAero({date,context,pace:pace.match(/\d:\d{2}/)[0],hr,rpe,label:'',note:''});$('aeroPace').value='';$('aeroHr').value='';$('aeroRpe').value='';
    };
  }
  function renderAero(){
    ensureAeroCard();const box=$('aeroInsight'),list=$('aeroList');if(!box||!list)return;const ins=aeroInsight(),h=readAero();box.className=`aero-insight ${ins.level}`;box.innerHTML=`<b>${ins.title}</b><span>${ins.text}</span>`;list.innerHTML=[...h].reverse().slice(0,8).map((x,i)=>`<div class="aero-row"><span>${x.date}</span><b>${x.pace}/km</b><span>${x.hr} bpm</span><span>RPE ${x.rpe}</span><small>${aeroContext[x.context]}</small><button type="button" data-aero-del="${h.length-1-i}">Slett</button></div>`).join('');list.querySelectorAll('[data-aero-del]').forEach(b=>b.onclick=()=>{const rows=readAero(),i=Number(b.dataset.aeroDel);if(i>=0&&i<rows.length){rows.splice(i,1);writeAero(rows);renderAll()}});
  }
  function injectAeroQuick(node,f){
    node.querySelectorAll('.aero-quick').forEach(x=>x.remove());const ef=f?applyAdjustment(f):null;if(!f||!ef||ef.type!=='easy'||isLongRun(ef)||!isDone(f.label))return;const actions=node.querySelector('.day-actions');if(!actions)return;const existing=readAero().find(x=>x.label===f.label);
    const d=document.createElement('details');d.className='aero-quick';d.innerHTML=`<summary>${existing?'✓ Aerobase registrert':'+ Aerobase kontrollpunkt (valgfritt)'}</summary><div class="aero-quick-grid"><select data-aq="context">${Object.entries(aeroContext).map(([k,v])=>`<option value="${k}" ${existing?.context===k?'selected':''}>${v}</option>`).join('')}</select><input data-aq="pace" placeholder="fart 5:30" value="${esc(existing?.pace||'')}"><input data-aq="hr" type="number" min="90" max="190" placeholder="snittpuls" value="${existing?.hr||''}"><input data-aq="rpe" type="number" min="1" max="6" placeholder="RPE" value="${existing?.rpe||''}"><button type="button">Lagre</button></div>`;d.querySelector('button').onclick=()=>{const context=d.querySelector('[data-aq="context"]').value,pace=d.querySelector('[data-aq="pace"]').value.trim(),hr=Number(d.querySelector('[data-aq="hr"]').value),rpe=Number(d.querySelector('[data-aq="rpe"]').value);if(!paceSec(pace)||hr<90||hr>190||rpe<1||rpe>6){alert('Legg inn fart, puls og rolig RPE 1–6.');return}saveAero({date:localDate(effectiveDate(f)),context,pace:pace.match(/\d:\d{2}/)[0],hr,rpe,label:f.label,note:''})};actions.insertAdjacentElement('afterend',d);
  }

  // -----------------------------
  // Achilles load map
  // -----------------------------
  function loadType(f){const t=f.title.toLowerCase();if(isLongRun(f))return'Langtur';if(/gate|hm-spesifikk/.test(t))return'HM / Gate';if(/45\/15|400|x-element/.test(t))return'Fart / korte drag';if(f.type==='quality')return'Subterskel';if(f.type==='easy')return'Rolig';if(f.type==='race')return'Race';return classLabel[f.type]||f.type}
  function paceBand(p){const s=paceSec(p);if(!s)return null;return s<240?'<4:00/km':s<260?'4:00–4:19/km':s<300?'4:20–4:59/km':'≥5:00/km'}
  function achRows(){return flat.map(f=>{const fb=getFeedback(f.label);return fb?.achilles?{f,ach:fb.achilles,shoe:fb.shoe&&shoeMeta[fb.shoe]?fb.shoe:'',rpe:Number(fb.rpe||0),pace:fb.pace||''}:null}).filter(Boolean)}
  function groupAch(rows,keyFn,min=2){const m={};rows.forEach(r=>{const k=keyFn(r);if(!k)return;(m[k]||(m[k]=[])).push(r)});return Object.entries(m).map(([name,rs])=>({name,n:rs.length,worse:rs.filter(x=>x.ach==='worse').length,same:rs.filter(x=>x.ach==='same').length,better:rs.filter(x=>x.ach==='better').length,rpe:rs.filter(x=>x.rpe).length?rs.filter(x=>x.rpe).reduce((a,x)=>a+x.rpe,0)/rs.filter(x=>x.rpe).length:null})).filter(x=>x.n>=min).sort((a,b)=>b.n-a.n||b.worse-a.worse)}
  function achSignal(g){const ratio=g.n?g.worse/g.n:0;if(g.n>=5&&ratio>=.6)return{level:'yellow',label:'TYDELIG OBSERVASJON'};if(g.n>=4&&ratio>=.5)return{level:'yellow',label:'FØLG MED'};if(g.n>=5&&g.worse===0)return{level:'green',label:'STABILT I DATA'};return{level:'neutral',label:g.n>=3?'BLANDET':'LITE DATA'}}
  function achGroupHTML(g){const s=achSignal(g);return`<div class="ach-map-row ${s.level}"><div><b>${esc(g.name)}</b><span>${g.n} registrering${g.n===1?'':'er'}${g.rpe?` · snitt RPE ${g.rpe.toFixed(1)}`:''}</span></div><strong>${s.label}</strong><small>↑ ${g.better} bedre · → ${g.same} lik · ↓ ${g.worse} verre</small></div>`}
  function ensureAchMap(){
    if($('achillesLoadMap'))return;const shoe=$('shoeAchillesInsight'),wall=$('shoeWall');if(!shoe&&!wall)return;const s=document.createElement('section');s.id='achillesLoadMap';s.className='ach-load-map';s.innerHTML=`<div class="metric-divider"></div><div class="kicker"><span>AKILLES · BELASTNINGSKART</span><span>mønster, ikke diagnose</span></div><p class="ach-map-intro">RunnerBear ser etter gjentakelser på tvers av økttype, sko × økttype og faktisk arbeidsfart når den er registrert.</p><div id="achLoadSummary"></div><div id="achLoadTypes"></div><div id="achLoadCombos"></div><div id="achLoadPace"></div><p class="shoe-causality">Korrelasjon er ikke årsak. Underlag, søvn, totalbelastning, teknikk og tilfeldige variasjoner kan påvirke samme morgenrespons.</p>`;(shoe||wall).insertAdjacentElement('afterend',s);
  }
  function renderAchMap(){
    ensureAchMap();const rows=achRows(),summary=$('achLoadSummary');if(!summary)return;const byType=groupAch(rows,r=>loadType(r.f),3),byCombo=groupAch(rows,r=>r.shoe?`${r.shoe} · ${loadType(r.f)}`:null,2),byPace=groupAch(rows,r=>paceBand(r.pace),3);
    const worse=rows.filter(r=>r.ach==='worse').length;summary.innerHTML=`<div class="ach-map-summary"><b>${rows.length}</b><span>komplette morgenresponser</span><strong>${worse}</strong><span>registrert «verre»</span></div>`;
    $('achLoadTypes').innerHTML=byType.length?`<h4>Økttype</h4>${byType.map(achGroupHTML).join('')}`:'';
    $('achLoadCombos').innerHTML=byCombo.length?`<h4>Sko × økttype</h4>${byCombo.slice(0,8).map(achGroupHTML).join('')}`:'';
    $('achLoadPace').innerHTML=byPace.length?`<h4>Fartsområde · kun når faktisk fart er registrert</h4>${byPace.map(achGroupHTML).join('')}`:'';
  }

  // -----------------------------
  // Plan integrity / Bakken guardrail
  // -----------------------------
  function postprocessLoadChart(){const bars=[...document.querySelectorAll('#loadChart .loadbar')],max=Math.max(...weeks.map(w=>w.km));bars.forEach((bar,i)=>{const w=weeks[i];if(!w)return;const has=Object.keys(weekAdjustments(w)).length,val=has?plannedWeekKm(w,true):w.km,b=bar.querySelector('b'),line=bar.querySelector('i');bar.classList.toggle('revised',has);if(b)b.textContent=has?`${w.km}→${val}`:String(w.km);if(line)line.style.height=`${25+val/max*78}px`})}
  function adjustedKeySessions(){return flat.map(f=>({orig:f,eff:applyAdjustment(f),date:effectiveDate(f)})).filter(x=>isKey(x.eff)).sort((a,b)=>a.date-b.date)}
  function planIntegrity(){
    const keys=adjustedKeySessions();let min=99;for(let i=1;i<keys.length;i++)min=Math.min(min,dayDiff(keys[i-1].date,keys[i].date));
    const w=currentWeek(),orig=w.km,now=plannedWeekKm(w,true),wa=weekAdjustments(w),adds=Object.entries(wa).some(([label,a])=>Number(a.km||0)>Number(workoutByLabel(label)?.km||0));
    if(min<2||adds)return{level:'red',label:'STRUKTUR MÅ SJEKKES',text:'En endring har komprimert nøkkeløkter eller økt belastningen. Ikke gjennomfør før planen er rettet.'};
    return{level:'green',label:'BAKKEN-GUARDRAIL OK',text:`Nøkkeløktene er separert, ingen ekstra kvalitet er lagt til og ukevolumet er ${now<=orig?'ikke økt':'økt'}.`};
  }
  function ensurePlanIntegrity(){
    if($('planIntegrity'))return;const chart=$('loadChart');if(!chart)return;const box=document.createElement('div');box.id='planIntegrity';box.className='plan-integrity';chart.insertAdjacentElement('afterend',box);
  }
  function renderPlanIntegrity(){ensurePlanIntegrity();postprocessLoadChart();const box=$('planIntegrity');if(!box)return;const p=planIntegrity();box.className=`plan-integrity ${p.level}`;box.innerHTML=`<b>${p.label}</b><span>${p.text}</span>`}

  // -----------------------------
  // Render hooks
  // -----------------------------
  const prevRenderToday=renderToday;
  renderToday=function(){prevRenderToday();const f=nextSession();const a=adjustmentFor(f);if(a){$('moveWorkoutBtn')?.classList.add('hidden');$('moveWorkoutPanel')?.classList.add('hidden')}renderRevisionCard()};

  const prevRenderPlan=renderPlan;
  renderPlan=function(){prevRenderPlan();postprocessRevisionPlan();document.querySelectorAll('#weeks .day').forEach(node=>{const label=node.dataset.originalLabel||node.querySelector('.daydate')?.textContent,f=workoutByLabel(label);if(f)injectAeroQuick(node,f)});renderPlanIntegrity()};

  const prevRenderWeekStrip=renderWeekStrip;
  renderWeekStrip=function(){prevRenderWeekStrip();postprocessRevisionStrip()};

  function completedRunKmForWeek(w){return flat.filter(f=>f.week===w.n&&isDone(f.label)).reduce((sum,f)=>{const a=adjustmentFor(f),ef=applyAdjustment(f);if(a)return sum+(ef.type==='rest'||ef.type==='cross'?0:Number(ef.km||0));const mode=defaultEasyMode(f);if((f.type==='easy'||f.type==='cross'||f.type==='rest')&&mode&&mode!=='run')return sum;return sum+(mode==='run'?fallbackRunKm(f):Number(f.km||0))},0)}
  const prevRenderReview=renderReview;
  renderReview=function(){prevRenderReview();const w=currentWeek();if(Object.keys(weekAdjustments(w)).length){const done=completedRunKmForWeek(w),target=plannedWeekKm(w,true),el=$('reviewText');if(el&&/^\d/.test(el.textContent))el.textContent=el.textContent.replace(/^\d+(?:\.\d+)? av \d+(?:\.\d+)? km er registrert\./,`${done.toFixed(1).replace('.0','')} av ${target} reviderte løpskm er registrert.`);$('reviewWatch').textContent='Følg revidert plan · ingen treningsgjeld'}renderRevisionCard()};

  const prevRenderThreshold=renderThreshold;
  renderThreshold=function(){prevRenderThreshold();renderAero();renderAchMap()};

  const prevRenderShoes=renderShoes;
  renderShoes=function(){prevRenderShoes();renderAchMap()};

  const prevStatus=buildStatusText;
  buildStatusText=function(){const a=aeroInsight(),w=currentWeek(),rev=Object.keys(weekAdjustments(w)).length;return prevStatus()+`\nAerob effektivitet: ${a.title}.`+(rev?`\nUke ${w.n}: revidert plan aktiv (${plannedWeekKm(w,true)} km mot original ${w.km} km).`:'')};

  ensureRevisionCard();ensureAeroCard();ensureAchMap();ensurePlanIntegrity();renderAll();
})();