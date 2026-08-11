/* RunnerBear v10.6 · completed activity linking + Bakken review
   Historical flexible sessions are linked to real Tredict activities, including
   Concept2 files that arrive as misc/generic. Plan owns the concise performance
   summary; the full data source remains available on demand. */
(function(){
  'use strict';

  const CACHE='runnerbear_tredict_cache_v1',MATCH='runnerbear_tredict_match_',LEG='runfest-2026';
  const $=id=>document.getElementById(id),qs=(s,r=document)=>r?.querySelector?.(s)||null,qsa=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const localIso=d=>{const x=d instanceof Date?d:new Date(d),z=n=>String(n).padStart(2,'0');return`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const slug=s=>String(s||'').toLowerCase().replace(/\s+/g,'_');
  const choiceKey=p=>`runfest26_easychoice_${String(p?.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`;
  const modeFor=p=>localStorage.getItem(choiceKey(p))||(/concept2|roing|rowerg/i.test(`${p?.title||''} ${p?.desc||''}`)?'row':/zwift|sykkel/i.test(`${p?.title||''} ${p?.desc||''}`)?'bike':'');
  const engine=()=>window.RunnerBearCoachEngine||null;
  const schedule=()=>engine()?.schedule?.()||[];
  const planFor=ds=>schedule().find(x=>x.ds===ds)||null;
  const flexible=p=>!!p&&(p.type==='cross'||(p.type==='rest'&&/zwift|concept2|roing|sykkel/i.test(`${p.title||''} ${p.desc||''} ${p.detail||''}`)));

  function flat(a){
    const s=a?.summary||a?.extendedSummary||{};
    return {
      raw:a,id:String(a?.id||a?._id||''),date:a?.date||'',ds:a?.date?localIso(a.date):'',
      sportType:String(a?.sportType||'').toLowerCase(),subSportType:String(a?.subSportType||'').toLowerCase(),title:a?.title||'',
      duration:Number(a?.duration||s.duration||s.durationTotal||0),distance:Number(a?.distance||s.distance||0),
      heartrate:Number(a?.heartrate||s.heartrate||0),heartrateMax:Number(a?.heartrateMax||s.heartrateMax||0),
      power:Number(a?.power||s.power||0),powerMax:Number(a?.powerMax||s.powerMax||0),calories:Number(a?.calories||s.calories||0),
      cadence:Number(a?.cadence||s.cadence||0)
    };
  }
  function activities(){return(read(CACHE,{}).activities||[]).map(flat).filter(a=>a.id&&a.ds)}
  function explicitRow(a){return a?.subSportType==='rowing'||a?.subSportType==='indoor_rowing'||a?.sportType==='rowing'||/concept2|rowerg|rowing|roing/i.test(a?.title||'')}
  function inferredRow(a,p){
    if(explicitRow(a))return true;
    if(!a||!p||!flexible(p)||modeFor(p)!=='row')return false;
    const generic=a.sportType==='misc'&&(!a.subSportType||a.subSportType==='generic');
    const ergProfile=a.duration>=10*60&&a.duration<=2*3600&&a.distance>=1000&&a.power>=40;
    return generic&&ergProfile;
  }
  function rowLike(a,p){return inferredRow(a,p)}
  function usedActivityIds(){
    const out=new Set();schedule().forEach(p=>{const m=read(MATCH+p.ds,null),id=String(m?.activityId||m?.activity?.id||'');if(id)out.add(id)});return out;
  }
  function legacyDoneKeys(p){
    const raw=`runfest26_date_${slug(p.label)}`;
    const clean=`runfest26_date_${String(p.label||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}`;
    return[raw,clean];
  }
  function saveMatch(p,a){
    if(!p||!a||read(MATCH+p.ds,null))return false;
    write(MATCH+p.ds,{activityId:a.id,activity:a.raw||a,planned:{goalId:LEG,date:p.ds,type:p.type,title:p.title,km:Number(p.km||0),label:p.label,source:'legacy'},automatic:true,matchedAt:new Date().toISOString(),matcher:'runnerbear-v10.6-row-inference'});
    legacyDoneKeys(p).forEach(k=>localStorage.setItem(k,'1'));
    return true;
  }
  function reconcile(){
    const now=Date.now(),cut=now-35*86400000,acts=activities(),used=usedActivityIds();let linked=0;
    schedule().filter(p=>flexible(p)&&Date.parse(`${p.ds}T12:00:00`)>=cut&&Date.parse(`${p.ds}T12:00:00`)<=now).forEach(p=>{
      if(read(MATCH+p.ds,null))return;
      const same=acts.filter(a=>a.ds===p.ds&&!used.has(a.id));
      let c=[];
      if(modeFor(p)==='row')c=same.filter(a=>rowLike(a,p));
      else if(modeFor(p)==='bike')c=same.filter(a=>a.sportType==='cycling');
      if(c.length!==1)return;
      if(saveMatch(p,c[0])){used.add(c[0].id);linked++}
    });
    return linked;
  }

  function fmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
  function rowSplit(a){if(!a.distance||!a.duration)return'';const sec=a.duration/(a.distance/500);return`${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,'0')}/500 m`}
  function selectedDate(){
    const stored=sessionStorage.getItem('runnerbear_v92_plan_day')||'';
    if(/^\d{4}-\d{2}-\d{2}$/.test(stored))return stored;
    const selected=qs('#weeks .day.rb31-selected')||qs('#weeks .day.open'),label=qs('.daydate',selected)?.textContent?.trim()||'';
    return schedule().find(x=>x.label===label)?.ds||'';
  }
  function maxHr(){return Number(engine()?.policy?.()?.profile?.maxHr||188)}
  function nextQuality(p){return schedule().find(x=>x.ds>p.ds&&x.type==='quality')||null}
  function pct(v,max){return v&&max?Math.round(v/max*100):0}
  function bakkenReview(p,a,isRow){
    const mh=maxHr(),avg=pct(a.heartrate,mh),peak=pct(a.heartrateMax,mh),next=nextQuality(p);
    if(isRow){
      if(a.heartrate&&avg<=70&&(peak===0||peak<=75))return`Kontrollert støtteøkt. ${Math.round(a.heartrate)} bpm i snitt (${avg}% av makspuls)${a.heartrateMax?` og ${Math.round(a.heartrateMax)} maks (${peak}%)`:''} holder belastningen tydelig aerob. Dette følger Bakken-prinsippet om at rolige dager skal være reelt rolige, slik at kvalitetsøktene kan være presise og repeterbare.${next?` ${next.title} kan stå som planlagt ut fra denne økta alene.`:''}`;
      if(a.heartrate&&avg<=78)return`God aerob cross, men litt høyere kostnad enn en helt rolig støttedag (${avg}% av makspuls i snitt). Bakken-prinsippet er å beskytte kvaliteten: ikke legg på ekstra intensitet før neste nøkkeløkt.${next?` Møt ${next.title} kontrollert.`:''}`;
      return`Alternativøkta er registrert som en reell belastning. I Bakken-modellen skal cross støtte terskelarbeidet, ikke bli en skjult kvalitetsøkt. RunnerBear tar denne belastningen med videre før neste nøkkeløkt.`;
    }
    if(p.type==='easy'||/langtur/i.test(p.title||'')){
      if(a.heartrate&&avg<=70)return`Rolig betyr rolig — og det traff du her. Snittpulsen tilsvarer ${avg}% av makspuls. Det gir aerob stimulus med lav kostnad og beskytter neste kvalitetsøkt.`;
      if(a.heartrate&&avg>75)return`Denne rolige økta kostet mer enn Bakken-rammen tilsier (${avg}% av makspuls i snitt). RunnerBear vil være mer konservativ med ekstra fart og volum før neste kvalitetsøkt.`;
      return`Økta er registrert som rolig belastning. RunnerBear bruker den til å beskytte kontinuitet og kvalitet i de neste terskeløktene.`;
    }
    if(p.type==='quality')return`Kvalitetsøkta er registrert. I Bakken-modellen vurderes den først og fremst på kontroll og repeterbarhet — ikke på hvor hard den kunne gjøres. RunnerBear bruker puls, fart og terskelrespons videre i neste dosering.`;
    return`Gjennomføringen er registrert og tas med i den løpende belastningsvurderingen. Kontinuitet og repeterbar kvalitet veier tyngre enn enkeltøkter.`;
  }
  function actualHtml(p,m){
    const a=flat(m?.activity||{}),isRow=rowLike(a,p),kind=isRow?'Concept2 · rolig aerob':a.sportType==='running'?'Løp':a.sportType==='cycling'?'Zwift / sykkel':'Aktivitet';
    const metrics=[];
    if(a.duration)metrics.push(['Tid',fmtTime(a.duration)]);
    if(a.distance)metrics.push(['Distanse',`${(a.distance/1000).toFixed(2).replace('.',',')} km`]);
    if(isRow&&rowSplit(a))metrics.push(['Snitt',rowSplit(a)]);
    if(a.power)metrics.push(['Effekt',`${Math.round(a.power)} W`]);
    if(a.heartrate)metrics.push(['Snittpuls',`${Math.round(a.heartrate)} bpm`]);
    if(a.heartrateMax)metrics.push(['Makspuls',`${Math.round(a.heartrateMax)} bpm`]);
    if(a.calories)metrics.push(['Energi',`${Math.round(a.calories)} kcal`]);
    const review=bakkenReview(p,a,isRow),source=isRow&&!explicitRow(a)?'Tredict: misc/generic · RunnerBear: Concept2':'Tredict';
    return`<section class="rb106-plan-actual" id="rb106PlanActual" data-activity-id="${esc(a.id)}">
      <div class="rb106-head"><div><span>UTFØRT · ${isRow?'CONCEPT2':'TREDICT'}</span><h3>${esc(kind)}</h3></div><strong>✓</strong></div>
      <div class="rb106-metrics">${metrics.slice(0,5).map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>
      <div class="rb106-coach"><span>RB COACH · BAKKEN</span><p>${esc(review)}</p></div>
      <details class="rb106-details"><summary>Se øktdata <span>↓</span></summary><div class="rb106-detail-grid">${metrics.map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}<div><span>Klassifisering</span><b>${esc(source)}</b></div><div><span>Match</span><b>Automatisk</b></div></div>${a.id?`<a class="rb106-tredict-link" href="https://www.tredict.com/app/training/activity/${encodeURIComponent(a.id)}" target="_blank" rel="noopener noreferrer">Åpne full økt i Tredict ↗</a>`:''}</details>
    </section>`;
  }
  function decoratePlan(){
    const ds=selectedDate(),p=planFor(ds),m=ds?read(MATCH+ds,null):null,card=qs('#weeks .day.rb31-selected')||qs('#weeks .day.open');
    qsa('#weeks #rb97PlanActual').forEach(x=>x.classList.add('rb106-hide-legacy-actual'));
    qsa('#weeks #rb106PlanActual').forEach(x=>{if(!card||!card.contains(x))x.remove()});
    if(!p||!m?.activity||!card)return;
    const id=String(m.activityId||m.activity?.id||'');let actual=qs('#rb106PlanActual',card);
    if(actual?.dataset.activityId===id)return;
    actual?.remove();const wrap=document.createElement('div');wrap.innerHTML=actualHtml(p,m);actual=wrap.firstElementChild;
    const body=qs('.day-body',card)||card,manual=qs('.rb32-manual-menu',body);manual?body.insertBefore(actual,manual):body.appendChild(actual);
    const status=qs('.daystatus',card);if(status){status.textContent='✓ UTFØRT';status.classList.add('rb97-live-status')}
    const title=qs('.day-summary h3',card);if(rowLike(flat(m.activity),p)&&title)title.textContent='Concept2 · rolig aerob';
  }
  function patchEngineLabels(){
    const e=engine();if(!e||e.__rb106Patched)return;e.__rb106Patched=true;
    const baseSport=e.sportName?.bind(e),baseClass=e.classified?.bind(e);
    if(baseSport)e.sportName=a=>{const p=planFor(a?.ds||localIso(a?.date||''));return rowLike(flat(a),p)?'Concept2 / roing':baseSport(a)};
    if(baseClass)e.classified=()=>baseClass().map(x=>rowLike(flat(x.activity),x.plan)&&flexible(x.plan)?{...x,kind:x.kind==='planned'?'alternative':x.kind}:x);
  }
  function style(){if($('rb106Style'))return;const s=document.createElement('style');s.id='rb106Style';s.textContent=`
    .rb106-hide-legacy-actual{display:none!important}.rb106-plan-actual{margin-top:14px;padding:16px;border:1px solid #dce5df;border-radius:20px;background:#fbfcfb;color:#182019}.rb106-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rb106-head span,.rb106-coach span,.rb106-detail-grid span{font-size:8px;letter-spacing:.12em;font-weight:850;color:#718078}.rb106-head h3{margin:4px 0 0;font-size:22px;letter-spacing:-.035em}.rb106-head>strong{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e8f3eb;color:#2f6848}.rb106-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:14px 0}.rb106-metrics>div,.rb106-detail-grid>div{padding:10px;border:1px solid #e2e8e4;border-radius:12px;background:#fff;display:grid;gap:3px}.rb106-metrics span{font-size:7px;letter-spacing:.1em;color:#7b8780;font-weight:800}.rb106-metrics b{font-size:13px}.rb106-coach{padding:13px 14px;border-left:4px solid #5b8b6c;border-radius:12px;background:#eef5f0}.rb106-coach p{margin:5px 0 0;font-size:11px;line-height:1.55;color:#385344}.rb106-details{margin-top:11px}.rb106-details summary{cursor:pointer;font-size:10px;font-weight:800;color:#476955}.rb106-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.rb106-detail-grid b{font-size:10px}.rb106-tredict-link{display:inline-block;margin-top:10px;font-size:10px;font-weight:800;color:#376348;text-decoration:none}
    @media(max-width:720px){.rb106-plan-actual{padding:14px}.rb106-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rb106-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rb106-head h3{font-size:20px}.rb106-coach p{font-size:10.5px}}
  `;document.head.appendChild(s)}

  let queued=false,reRender=false;
  function run(){
    if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;style();patchEngineLabels();const linked=reconcile();if(linked&&!reRender&&typeof window.renderAll==='function'){reRender=true;setTimeout(()=>{try{window.renderAll()}finally{reRender=false;setTimeout(decoratePlan,40)}},0)}else decoratePlan()})
  }
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const out=prev.apply(this,arguments);setTimeout(run,0);return out};
  document.addEventListener('click',e=>{if(e.target.closest('.navbtn,#rb31PlanOverview [data-rb31-day],[data-rb97-sync],#rb94Sync,[data-mode]'))setTimeout(run,100)},true);
  const obs=new MutationObserver(()=>run());obs.observe(document.body,{subtree:true,childList:true});
  window.RunnerBearActivityIntelligence={version:'10.6',reconcile,rowLike,bakkenReview,run};
  setTimeout(run,0);setTimeout(run,700);
})();
