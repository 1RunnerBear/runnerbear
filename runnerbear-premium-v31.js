/* RunnerBear v9.2 · Plan Overview + Safe Completion
   Mobile-first weekly overview. Automatic activity matching is primary;
   manual completion is an explicit fallback and never re-renders the whole app mid-click. */
(function(){
  'use strict';
  const LEGACY='runfest-2026';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso=d=>{const x=d instanceof Date?d:new Date(d),z=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const date=s=>new Date(String(s).slice(0,10)+'T12:00:00');
  const same=(a,b)=>iso(a)===iso(b);
  const dayFmt=d=>new Intl.DateTimeFormat('nb-NO',{weekday:'short'}).format(d).replace('.','').slice(0,3).toUpperCase();
  const dateFmt=d=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(d).replace('.','');
  const activeGoal=()=>window.RunnerBearV7?.activeGoal?.()||null;
  const isLegacy=()=>!activeGoal()||activeGoal()?.id===LEGACY;
  const manualKey=k=>`runnerbear_v9_manual_${k}`;
  const matchKey=ds=>`runnerbear_tredict_match_${ds}`;

  const ICON={
    run:`<svg viewBox="0 0 24 24"><circle cx="15.3" cy="4.3" r="1.55"/><path d="M13.2 7.1 10.5 10l2.3 2.1 2 3.2M13.2 7.1l3 2.1 2.7-.5M10.5 10 7 14M14.8 15.4l3.5 2.6M12.7 12l-1.6 4.8-4 2"/></svg>`,
    quality:`<svg viewBox="0 0 24 24"><circle cx="14.7" cy="4.2" r="1.5"/><path d="M12.7 7 10.2 10l2.2 2 2 3M12.7 7l3.2 2.3 2.4-.4M10.2 10 7 14M14.4 15l3.7 2.7M12.3 12l-1.5 4.6-3.6 2"/><path d="M4 6h4M3 9h4"/></svg>`,
    bike:`<svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17 9.5 10h4l4.5 7M9.5 10 12 17h6M8.5 7.6h3M13.5 10l1.3-2.5h2.2"/></svg>`,
    row:`<svg viewBox="0 0 24 24"><circle cx="8.1" cy="5.8" r="1.5"/><path d="M9.2 7.8 12 10.7l4-1.1M10.8 10.9 8 14.2h5.2l2.5 3.1M3.2 18.2h13M5 20.5h10M16.3 9.2l2.2 8.1M18.5 8.7h2.2M20 8.7l1 8.7"/></svg>`,
    long:`<svg viewBox="0 0 24 24"><circle cx="14.7" cy="4.2" r="1.5"/><path d="M12.7 7 10.2 10l2.2 2 2 3M12.7 7l3.2 2.3 2.4-.4M10.2 10 7 14M14.4 15l3.7 2.7M12.3 12l-1.5 4.6-3.6 2"/><path d="M2.8 19.5h5"/></svg>`,
    rest:`<svg viewBox="0 0 24 24"><path d="M18.5 15.2A7 7 0 0 1 8.8 5.5a7 7 0 1 0 9.7 9.7Z"/></svg>`,
    sync:`<svg viewBox="0 0 24 24"><path d="M19 8a7 7 0 0 0-12-2L4 9M5 16a7 7 0 0 0 12 2l3-3"/><path d="M4 5v4h4M20 19v-4h-4"/></svg>`,
    check:`<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>`
  };
  const icon=(k,cls='rb31-icon')=>`<span class="${cls}" aria-hidden="true">${ICON[k]||ICON.run}</span>`;

  function legacyWeekNo(){
    const saved=Number(sessionStorage.getItem('runfest26_plan_week')||0);
    try{if(saved&&weeks.some(w=>w.n===saved))return saved;return currentWeek().n}catch{return 1}
  }
  function permanentWeekIndex(){return Math.max(0,Math.min(3,Number(sessionStorage.getItem('runnerbear_v72_week')||0)))}

  function activityChoiceForLegacy(f){
    if(!f)return'';
    try{
      const s=slug(f.label),m=localStorage.getItem(`runfest26_easychoice_${s}`)||'';
      if(m==='row')return'row';if(m==='bike')return'bike';if(m==='run')return'run';
    }catch{}
    if(/Concept2|roing/i.test(f.title))return'row';if(/Zwift|sykkel/i.test(f.title)||f.type==='cross')return'bike';return'run';
  }
  function kindFor(d,legacyItem=null){
    const t=String(d?.title||'');
    if(legacyItem){const m=activityChoiceForLegacy(legacyItem);if((legacyItem.type==='cross'||legacyItem.type==='rest'||legacyItem.type==='easy')&&m!=='run')return m}
    if(/Concept2|roing|RowErg/i.test(t))return'row';
    if(/Zwift|sykkel/i.test(t))return'bike';
    if(/langtur/i.test(t))return'long';
    if(d?.type==='quality'||d?.type==='race'||/terskel|45\/15|intervall|gate|x-element/i.test(t))return'quality';
    if(d?.type==='rest'||/hvile/i.test(t))return'rest';
    return'run';
  }
  function legacyDoneKey(f){return `runfest26_date_${String(f.label).toLowerCase().replace(/\s+/g,'_')}`}
  function permanentDoneKey(g,d){return `runnerbear_v7_done_${g.id}_${iso(d.date)}`}
  function matchFor(ds){return read(matchKey(ds),null)}
  function actualSummary(m){
    const a=m?.activity;if(!a)return'';
    const km=Number(a.distance)>0?`${(Number(a.distance)/1000).toFixed(1).replace('.0','')} km`:'';
    const sec=Math.round(Number(a.duration)||0),time=sec?`${Math.floor(sec/3600)?Math.floor(sec/3600)+':':''}${String(Math.floor((sec%3600)/60)).padStart(Math.floor(sec/3600)?2:1,'0')}:${String(sec%60).padStart(2,'0')}`:'';
    return [km,time].filter(Boolean).join(' · ');
  }
  function completion(doneKey,ds){
    const m=matchFor(ds),done=localStorage.getItem(doneKey)==='1',manual=localStorage.getItem(manualKey(doneKey))==='1';
    if(m)return{done:true,source:'auto',label:'Matchet automatisk',detail:actualSummary(m)};
    if(done&&manual)return{done:true,source:'manual',label:'Manuelt registrert',detail:''};
    if(done)return{done:true,source:'legacy',label:'Tidligere registrert',detail:''};
    return{done:false,source:'none',label:'Ikke registrert',detail:''};
  }

  function legacySource(){
    try{
      const n=legacyWeekNo(),w=weeks.find(x=>x.n===n)||weeks[0],days=flat.filter(f=>f.week===w.n).map(f=>({
        id:f.label,label:f.label,date:f.date,type:f.type,title:f.title,desc:f.desc,detail:f.detail,km:Number(f.km||0),raw:f,
        doneKey:legacyDoneKey(f),kind:kindFor(f,f)
      }));
      return{mode:'legacy',index:weeks.findIndex(x=>x.n===w.n),count:weeks.length,title:`Uke ${w.n}`,range:w.range,phase:w.phase||'',focus:w.focus||'',km:Number(w.km||0),days,raw:w};
    }catch{return null}
  }
  function permanentSource(){
    const g=activeGoal();if(!g||g.id===LEGACY)return null;
    let data=null;try{data=window.RunnerBearV8?.rollingPlan?.(g)||window.RunnerBearAdaptive?.adaptivePlan?.(g)||null}catch{}
    const arr=data?.weeks||[];if(!arr.length)return null;
    const i=Math.max(0,Math.min(arr.length-1,permanentWeekIndex())),w=arr[i];
    const days=(w.days||[]).map((d,di)=>({id:iso(d.date),label:d.label||dateFmt(d.date),date:d.date,type:d.type,title:d.title,desc:d.desc||'',detail:d.detail||'',km:Number(d.km||0),raw:d,doneKey:permanentDoneKey(g,d),kind:kindFor(d)}));
    return{mode:'permanent',index:i,count:arr.length,title:`Uke ${i+1}`,range:w.range||`${dateFmt(w.start)}–${dateFmt(w.end)}`,phase:w.phase||'',focus:w.focus||data?.decision?.text||'',km:Number(w.km||0),days,raw:w,goal:g};
  }
  function source(){return isLegacy()?legacySource():permanentSource()}

  function selectWeek(delta){
    const s=source();if(!s)return;
    const ni=Math.max(0,Math.min(s.count-1,s.index+delta));
    if(s.mode==='legacy'){
      try{const w=weeks[ni];sessionStorage.setItem('runfest26_plan_week',String(w.n));const sel=$('weekFilter');if(sel){sel.value=String(w.n);if(typeof renderPlan==='function')renderPlan()}}
      catch{}
    }else{
      sessionStorage.setItem('runnerbear_v72_week',String(ni));
      try{window.RunnerBearAdaptive?.renderFlexiblePlan?.()}catch{}
    }
    sessionStorage.removeItem('runnerbear_v92_plan_day');
    requestAnimationFrame(enhance);setTimeout(enhance,40);
  }
  function jumpCurrent(){
    if(isLegacy()){
      try{sessionStorage.setItem('runfest26_plan_week',String(currentWeek().n));const sel=$('weekFilter');if(sel){sel.value=String(currentWeek().n);renderPlan()}}catch{}
    }else{
      sessionStorage.setItem('runnerbear_v72_week','0');
      try{window.RunnerBearAdaptive?.renderFlexiblePlan?.()}catch{}
    }
    sessionStorage.removeItem('runnerbear_v92_plan_day');requestAnimationFrame(enhance);setTimeout(enhance,40);
  }

  function openPlanAtToday(){
    jumpCurrent();
    const apply=()=>{
      const s=source();if(!s)return;
      const d=s.days.find(x=>iso(x.date)===iso(new Date()))||s.days[0];if(!d)return;
      sessionStorage.setItem('runnerbear_v92_plan_day',d.id);
      ensureOverview(s);compactPlan(s);securePlanCompletion(s);selectDay(d.id,false);
    };
    requestAnimationFrame(apply);setTimeout(apply,70);
  }

  function weekStats(s){
    const q=s.days.filter(d=>d.type==='quality'||d.type==='race').length,long=s.days.filter(d=>/langtur/i.test(d.title)).length;
    const cs=s.days.map(d=>completion(d.doneKey,iso(d.date))),done=cs.filter(x=>x.done).length,auto=cs.filter(x=>x.source==='auto').length;
    return{q,long,done,auto};
  }
  function overviewHtml(s){
    const st=weekStats(s),todayIso=iso(new Date()),selected=sessionStorage.getItem('runnerbear_v92_plan_day')||s.days.find(d=>iso(d.date)===todayIso)?.id||s.days[0]?.id;
    return `<article class="card rb31-plan-overview">
      <div class="rb31-week-nav">
        <button type="button" class="rb31-nav-btn" data-rb31-week="-1" ${s.index===0?'disabled':''} aria-label="Forrige uke">‹</button>
        <button type="button" class="rb31-week-center" data-rb31-current><span>${esc(s.title)} · ${s.index+1}/${s.count}</span><strong>${esc(s.range)}</strong><small>${esc(s.phase||'Planlagt uke')}</small></button>
        <button type="button" class="rb31-nav-btn" data-rb31-week="1" ${s.index===s.count-1?'disabled':''} aria-label="Neste uke">›</button>
      </div>
      <div class="rb31-week-stats"><div><b>${s.km||'–'}</b><span>løpskm</span></div><div><b>${st.q}</b><span>kvalitet</span></div><div><b>${st.long}</b><span>langtur</span></div><div><b>${st.done}/7</b><span>registrert</span></div></div>
      <div class="rb31-week-focus"><span>UKAS JOBB</span><b>${esc(s.focus||'Kontrollert kvalitet. Rolig betyr rolig.')}</b></div>
      <div class="rb31-day-map" role="list" aria-label="Ukeoversikt">${s.days.map(d=>{
        const c=completion(d.doneKey,iso(d.date)),sel=d.id===selected,today=iso(d.date)===todayIso;
        return `<button type="button" role="listitem" class="rb31-day-chip ${sel?'selected':''} ${today?'today':''} ${c.done?'done':''} ${c.source==='auto'?'auto':''}" data-rb31-day="${esc(d.id)}"><span>${dayFmt(d.date)}</span><b>${new Date(d.date).getDate()}</b>${icon(d.kind,'rb31-chip-icon')}<i></i></button>`
      }).join('')}</div>
      <div class="rb31-sync-note">${icon('sync')}<span><b>Garmin/Tredict blir hovedkilden.</b> Manuell fullføring er kun fallback og påvirker aldri andre økter.</span></div>
    </article>`;
  }
  function ensureOverview(s){
    const plan=$('plan');if(!plan||!s)return;
    let el=$('rb31PlanOverview');if(!el){el=document.createElement('div');el.id='rb31PlanOverview';const head=qs('.section-head',plan);head?.insertAdjacentElement('afterend',el)}
    el.innerHTML=overviewHtml(s);
    qs('[data-rb31-week="-1"]',el)?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectWeek(-1)});
    qs('[data-rb31-week="1"]',el)?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectWeek(1)});
    qs('[data-rb31-current]',el)?.addEventListener('click',e=>{e.preventDefault();jumpCurrent()});
    qsa('[data-rb31-day]',el).forEach(b=>b.addEventListener('click',e=>{e.preventDefault();selectDay(b.dataset.rb31Day,true)}));
  }

  function dayCardById(s,id){
    if(!s)return null;
    if(s.mode==='legacy')return qsa('#weeks .day').find(d=>qs('.daydate',d)?.textContent?.trim()===id)||null;
    const target=s.days.find(x=>x.id===id),cards=qsa('#weeks .day');
    if(!target)return null;
    return cards.find(d=>qs('.daydate',d)?.textContent?.trim()===target.label)||cards[s.days.indexOf(target)]||null;
  }
  function selectDay(id,scroll=false){
    const s=source();if(!s)return;const found=s.days.some(d=>d.id===id)?id:s.days[0]?.id;if(!found)return;
    sessionStorage.setItem('runnerbear_v92_plan_day',found);
    qsa('#weeks .day').forEach(d=>d.classList.remove('open','rb31-selected'));
    const card=dayCardById(s,found);if(card){card.classList.add('open','rb31-selected');if(scroll)card.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}
    qsa('#rb31PlanOverview [data-rb31-day]').forEach(b=>b.classList.toggle('selected',b.dataset.rb31Day===found));
  }

  function updateDayStatus(card,c){
    if(!card)return;card.classList.toggle('done',c.done);card.dataset.rb31Completion=c.source;
    const st=qs('.daystatus',card);if(st)st.textContent=c.source==='auto'?'✓ SYNC':c.done?'✓':'›';
  }
  function completionUi(c,doneKey,ds){
    const future=date(ds)>new Date(new Date().setHours(23,59,59,999));
    if(c.source==='auto')return `<div class="rb31-auto-complete">${icon('check')}<div><b>Matchet automatisk</b><span>${esc(c.detail||'Garmin/Tredict aktivitet koblet til denne økten.')}</span></div></div>`;
    if(c.done)return `<div class="rb31-manual-wrap"><div class="rb31-complete-state">${icon('check')}<div><b>${esc(c.label)}</b><span>${c.source==='manual'?'Fallback · venter normalt på Garmin/Tredict':'Registrering fra tidligere versjon'}</span></div></div><button type="button" class="rb31-undo" data-rb31-complete="undo" data-done-key="${esc(doneKey)}" data-date="${ds}">Angre registrering</button></div>`;
    if(future)return `<div class="rb31-future-state"><span>Planlagt</span><small>Fullføring blir tilgjengelig på øktdagen og matches normalt fra Garmin/Tredict.</small></div>`;
    return `<div class="rb31-manual-wrap"><button type="button" class="rb31-manual" data-rb31-complete="mark" data-done-key="${esc(doneKey)}" data-date="${ds}">Marker manuelt gjennomført</button><small>Brukes bare når økten ikke kan matches fra Garmin/Tredict.</small></div>`;
  }
  function securePlanCompletion(s){
    if(!s)return;
    s.days.forEach(d=>{
      const card=dayCardById(s,d.id);if(!card)return;const ds=iso(d.date),c=completion(d.doneKey,ds);updateDayStatus(card,c);
      const actions=qs('.day-actions',card);if(actions){qsa('input[data-done]',actions).forEach(i=>{i.disabled=true;i.tabIndex=-1});actions.innerHTML=completionUi(c,d.doneKey,ds)}
    });
  }
  function todayItem(){
    if(!isLegacy()){
      const s=permanentSource();if(!s)return null;const label=$('todayDate')?.textContent?.trim(),todayIso=iso(new Date());return s.days.find(d=>iso(d.date)===todayIso)||s.days.find(d=>d.label===label)||null;
    }
    try{
      const label=$('todayDate')?.textContent?.trim();if(label&&label!=='I dag'){const by=flat.find(f=>f.label===label);if(by)return{id:by.label,label:by.label,date:by.date,doneKey:legacyDoneKey(by)}}
      const exact=flat.find(f=>same(f.date,new Date()));if(exact)return{id:exact.label,label:exact.label,date:exact.date,doneKey:legacyDoneKey(exact)};
      return null;
    }catch{return null}
  }
  function secureTodayCompletion(){
    const row=qs('#todayCard .action-row');if(!row)return;
    const old=qs('.complete',row),inp=$('todayDone');if(inp){inp.disabled=true;inp.tabIndex=-1}if(old)old.classList.add('rb31-old-complete-hidden');
    let host=$('rb31TodayManual');if(!host){host=document.createElement('div');host.id='rb31TodayManual';host.className='rb31-today-manual';row.insertBefore(host,qs('#adaptBtn',row)||null)}
    const d=todayItem();if(!d){host.innerHTML='<span class="rb31-await-sync">Fullføring matches fra aktivitet når integrasjonen er klar.</span>';return}
    host.innerHTML=completionUi(completion(d.doneKey,iso(d.date)),d.doneKey,iso(d.date));
  }

  function refreshWithoutRerender(doneKey,ds,card){
    const c=completion(doneKey,ds);updateDayStatus(card,c);
    try{if(typeof renderWeekStrip==='function')renderWeekStrip()}catch{}
    try{if(typeof renderReview==='function')renderReview()}catch{}
    try{if(typeof renderShoes==='function')renderShoes()}catch{}
    const s=source();ensureOverview(s);securePlanCompletion(s);secureTodayCompletion();selectDay(sessionStorage.getItem('runnerbear_v92_plan_day')||s?.days?.find(d=>iso(d.date)===iso(new Date()))?.id||s?.days?.[0]?.id,false);
  }
  function manualAction(btn){
    const key=btn.dataset.doneKey,ds=btn.dataset.date,action=btn.dataset.rb31Complete;if(!key||!ds)return;
    const card=btn.closest('.day');
    if(action==='mark'){localStorage.setItem(key,'1');localStorage.setItem(manualKey(key),'1')}
    else{localStorage.removeItem(key);localStorage.removeItem(manualKey(key))}
    refreshWithoutRerender(key,ds,card);
  }

  function enforceSelectedWeek(s){
    if(!s||s.mode!=='legacy')return;
    try{const sel=$('weekFilter');if(sel&&String(sel.value)!==String(s.raw.n)){sel.value=String(s.raw.n);renderPlan()}}catch{}
  }
  function repairFutureCompletions(s){
    if(!s)return;const endToday=new Date();endToday.setHours(23,59,59,999);
    let rows=s.days;
    if(s.mode==='legacy'){try{rows=flat.map(f=>({date:f.date,doneKey:legacyDoneKey(f)}))}catch{}}
    rows.forEach(d=>{const ds=iso(d.date);if(date(ds)<=endToday)return;if(matchFor(ds))return;if(localStorage.getItem(d.doneKey)==='1'){localStorage.removeItem(d.doneKey);localStorage.removeItem(manualKey(d.doneKey))}});
  }
  function compactPlan(s){
    const plan=$('plan');if(!plan||!s)return;plan.classList.add('rb31-plan');
    qs('#rbPlanNav',plan)?.classList.add('rb31-old-nav');qs('#rbV72WeekNav',plan)?.classList.add('rb31-old-nav');
    const sec=qs('#weeks .week');if(sec){qs('.weekhead',sec)?.classList.add('rb31-old-weekhead');qs('.rb-week-brief',sec)?.classList.add('rb31-old-weekhead')}
    const chosen=sessionStorage.getItem('runnerbear_v92_plan_day')||s.days.find(d=>iso(d.date)===iso(new Date()))?.id||s.days[0]?.id;
    selectDay(chosen,false);
  }
  function enhance(){
    const s=source();if(!s)return;repairFutureCompletions(s);enforceSelectedWeek(s);ensureOverview(s);compactPlan(s);securePlanCompletion(s);secureTodayCompletion();document.documentElement.classList.add('rb31');
  }

  document.addEventListener('click',e=>{
    const manual=e.target.closest('[data-rb31-complete]');if(manual){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();manualAction(manual);return}
    if(e.target.closest('#plan .complete input[data-done],#todayDone')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return}
    if(e.target.closest('.navbtn,[data-mode],[data-rb-goalview]')){requestAnimationFrame(enhance);setTimeout(enhance,60)}
  },true);

  const prev=window.renderAll;
  if(typeof prev==='function')window.renderAll=function(){const out=prev.apply(this,arguments);requestAnimationFrame(enhance);setTimeout(enhance,50);return out};
  const prevSwitch=window.switchTab;
  if(typeof prevSwitch==='function')window.switchTab=function(id,scroll){
    const out=prevSwitch.apply(this,arguments);
    if(id==='plan')openPlanAtToday();
    else if(id==='today'){requestAnimationFrame(enhance);setTimeout(enhance,60)}
    return out;
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestAnimationFrame(enhance)});
  enhance();requestAnimationFrame(enhance);setTimeout(enhance,100);
})();
