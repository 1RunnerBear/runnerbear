/* RunnerBear v6.3 · Focused Plan
   UI/navigation layer only. Keeps the existing workout data model intact. */
(function(){
  'use strict';
  const state={week:null};
  const weekDays=n=>flat.filter(f=>f.week===n);
  const plannedQuality=wd=>wd.filter(f=>f.type==='quality'||f.type==='race').length;
  const longCount=wd=>wd.filter(f=>/langtur/i.test(f.title)).length;
  const doneKm=wd=>wd.filter(f=>isDone(f.label)).reduce((a,f)=>a+Number(f.km||0),0);

  function initialWeek(){
    const saved=Number(sessionStorage.getItem('runfest26_plan_week')||0);
    if(saved&&weeks.some(w=>w.n===saved))return saved;
    return currentWeek().n;
  }
  function weekBy(n){return weeks.find(w=>w.n===n)||weeks[0]}
  function setWeek(n,openToday=false){
    state.week=Math.max(weeks[0].n,Math.min(weeks[weeks.length-1].n,n));
    sessionStorage.setItem('runfest26_plan_week',String(state.week));
    const sel=$('weekFilter');if(sel){sel.value=String(state.week);renderPlan();}
    requestAnimationFrame(()=>enhancePlan(openToday));
  }
  function buildToolbar(){
    const plan=document.getElementById('plan'),head=plan?.querySelector('.section-head');if(!plan||!head)return;
    let bar=document.getElementById('rbPlanNav');
    if(!bar){
      bar=document.createElement('div');bar.id='rbPlanNav';bar.className='rb-plan-nav';
      bar.innerHTML=`<button class="rb-week-arrow" data-dir="-1" aria-label="Forrige uke">‹</button><button class="rb-week-center" id="rbWeekCenter" type="button"><span id="rbWeekIndex"></span><strong id="rbWeekTitle"></strong><small id="rbWeekPhase"></small></button><button class="rb-week-arrow" data-dir="1" aria-label="Neste uke">›</button>`;
      head.insertAdjacentElement('afterend',bar);
      bar.querySelectorAll('.rb-week-arrow').forEach(b=>b.onclick=()=>setWeek(state.week+Number(b.dataset.dir)));
      bar.querySelector('#rbWeekCenter').onclick=()=>setWeek(currentWeek().n,true);
    }
    const w=weekBy(state.week);bar.querySelector('#rbWeekIndex').textContent=`UKE ${w.n} AV ${weeks.length}`;bar.querySelector('#rbWeekTitle').textContent=w.range;bar.querySelector('#rbWeekPhase').textContent=w.phase;
    const arrows=bar.querySelectorAll('.rb-week-arrow');arrows[0].disabled=state.week===weeks[0].n;arrows[1].disabled=state.week===weeks[weeks.length-1].n;
    const sel=$('weekFilter');if(sel){sel.value=String(state.week);sel.classList.add('rb-plan-filter-hidden')}
  }
  function weekIntent(w){
    const text=(w.focus||'').trim();
    return text||'Gjør kvalitetsarbeidet kontrollert nok til at neste nøkkeløkt fortsatt kan gjennomføres godt.';
  }
  function addWeekBrief(sec,w){
    if(sec.querySelector('.rb-week-brief'))return;
    const wd=weekDays(w.n),brief=document.createElement('div');brief.className='rb-week-brief';
    brief.innerHTML=`<div class="rb-week-intent"><span>UKAS JOBB</span><b>${weekIntent(w)}</b></div><div class="rb-week-stats"><div><strong>${w.km}</strong><span>løpskm</span></div><div><strong>${plannedQuality(wd)}</strong><span>kvalitet</span></div><div><strong>${longCount(wd)}</strong><span>langtur</span></div><div><strong>${wd.filter(f=>isDone(f.label)).length}/7</strong><span>registrert</span></div></div>`;
    sec.querySelector('.weekhead')?.insertAdjacentElement('afterend',brief);
  }
  function oneOpenDay(sec,openToday=false){
    const cards=[...sec.querySelectorAll('.day')];if(!cards.length)return;
    let target=cards.find(d=>d.classList.contains('today'));
    if(!target&&!openToday)target=cards.find(d=>d.classList.contains('open'));
    cards.forEach(d=>d.classList.toggle('open',d===target));
    cards.forEach(d=>{const summary=d.querySelector('.day-summary');if(!summary||summary.dataset.rbOneOpen)return;summary.dataset.rbOneOpen='1';summary.onclick=()=>{const opening=!d.classList.contains('open');cards.forEach(x=>x.classList.remove('open'));if(opening)d.classList.add('open')};});
  }
  function compactLoad(){
    const card=document.querySelector('#plan .load-card');if(!card)return;
    card.classList.add('rb-load-compact');
    let summary=card.querySelector('.rb-load-summary');if(!summary){summary=document.createElement('div');summary.className='rb-load-summary';card.querySelector('.kicker')?.insertAdjacentElement('afterend',summary)}
    const w=weekBy(state.week),prev=weeks.find(x=>x.n===w.n-1),delta=prev?w.km-prev.km:0;
    const deltaText=!prev?'Startuke':delta===0?'samme som forrige':`${delta>0?'+':''}${delta} km fra forrige`;
    summary.innerHTML=`<div><span>DENNE UKA</span><strong>${w.km} km</strong><small>${deltaText}</small></div><button type="button" class="textbtn rb-load-toggle">Detaljer</button>`;
    const chart=$('loadChart');if(chart){chart.classList.add('rb-load-chart-collapsed');summary.querySelector('.rb-load-toggle').onclick=()=>{const open=chart.classList.toggle('rb-load-chart-open');summary.querySelector('.rb-load-toggle').textContent=open?'Skjul':'Detaljer'}}
  }
  function swipePlan(){
    const weeksEl=$('weeks');if(!weeksEl||weeksEl.dataset.rbSwipe)return;weeksEl.dataset.rbSwipe='1';let x=0,y=0;
    weeksEl.addEventListener('touchstart',e=>{const t=e.changedTouches[0];x=t.clientX;y=t.clientY},{passive:true});
    weeksEl.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-x,dy=t.clientY-y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.35)setWeek(state.week+(dx<0?1:-1))},{passive:true});
  }
  function enhancePlan(openToday=false){
    if(!document.getElementById('plan'))return;
    if(state.week==null)state.week=initialWeek();
    buildToolbar();
    const sec=document.querySelector('#weeks .week');if(sec){addWeekBrief(sec,weekBy(state.week));oneOpenDay(sec,openToday)}
    compactLoad();swipePlan();document.documentElement.classList.add('rb-focused-plan');
  }
  function ensureWeekSelected(){
    if(state.week==null)state.week=initialWeek();
    const sel=$('weekFilter');if(!sel)return;
    if(![...sel.options].some(o=>String(o.value)===String(state.week)))return;
    if(sel.value!==String(state.week)){sel.value=String(state.week);renderPlan();}
  }
  const prevRenderAll=window.renderAll;
  if(typeof prevRenderAll==='function')window.renderAll=function(){const r=prevRenderAll.apply(this,arguments);ensureWeekSelected();requestAnimationFrame(()=>enhancePlan());return r};
  const prevSwitch=window.switchTab;
  if(typeof prevSwitch==='function')window.switchTab=function(id,scroll){const r=prevSwitch.apply(this,arguments);if(id==='plan'){ensureWeekSelected();requestAnimationFrame(()=>enhancePlan(true))}return r};
  state.week=initialWeek();ensureWeekSelected();requestAnimationFrame(()=>enhancePlan(true));
})();