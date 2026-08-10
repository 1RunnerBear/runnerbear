/* RunnerBear v9.1 · Mobile-first clarity + semantic activity metrics */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

  const MI={
    effort:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14a7 7 0 0 1 14 0"/><path d="m12 14 3-4"/><path d="M7 18h10"/></svg>`,
    pulse:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l1.8-5 3.1 10 2.2-7 1.8 2H21"/></svg>`,
    cadence:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a7 7 0 0 0-11-2L4 9"/><path d="M4 5v4h4M6 16a7 7 0 0 0 11 2l3-3"/><path d="M20 19v-4h-4"/></svg>`,
    stroke:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h13M6 20h10"/><path d="m8 15 4-5 4 2"/><path d="M16 12l3-4"/></svg>`,
    clock:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,
    distance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c2-5 4-7 7-7s4-2 7-5"/><circle cx="5" cy="18" r="1.5"/><circle cx="19" cy="6" r="1.5"/></svg>`
  };

  function todayMode(){
    const box=qs('#todayCard .easy-choice[data-easy-slot="today"]');
    if(!box)return 'run';
    const active=qs('[data-mode].active,[data-mode][aria-pressed="true"]',box);
    return active?.dataset.mode==='row'?'row':active?.dataset.mode==='bike'?'bike':'run';
  }
  function metricEls(){return qsa('#todayCard .keymetrics > div').slice(0,3)}
  function labelEl(metric){return qsa(':scope > span',metric).find(x=>!x.classList.contains('rb9-metric-icon'))||null}
  function iconEl(metric){return qs('.rb9-metric-icon',metric)}
  function setMetric(metric,value,label,icon){
    if(!metric)return;
    const b=qs(':scope > b',metric),l=labelEl(metric),i=iconEl(metric);
    if(b&&value!=null)b.textContent=value;
    if(l)l.textContent=label;
    if(i&&MI[icon])i.innerHTML=MI[icon];
  }
  function semanticMetrics(){
    const mode=todayMode(),m=metricEls();if(m.length<3)return;
    if(mode==='row'){
      setMetric(m[0],$('todayPace')?.textContent||'RPE 2–3','intensitet','effort');
      setMetric(m[1],'18–22 spm','takfrekvens','stroke');
      setMetric(m[2],$('todayKm')?.textContent||'–','total','clock');
    }else if(mode==='bike'){
      setMetric(m[0],$('todayPace')?.textContent||'Z1/Z2','intensitet','effort');
      setMetric(m[1],'85–95 rpm','kadens','cadence');
      setMetric(m[2],$('todayKm')?.textContent||'–','total','clock');
    }else{
      setMetric(m[0],$('todayPace')?.textContent||'rolig','styring / fart','effort');
      setMetric(m[1],$('todayHr')?.textContent||'–','puls','pulse');
      setMetric(m[2],$('todayKm')?.textContent||'–','total','distance');
    }
    document.documentElement.dataset.rb30Mode=mode;
  }

  function compactTodayDetails(){
    const card=$('todayCard');if(!card)return;
    const shoe=$('todayShoe'),coach=$('todayCoach'),fuel=$('todayFuel');
    let wrap=$('rb30TodayDetails');
    if(!wrap){wrap=document.createElement('div');wrap.id='rb30TodayDetails';wrap.className='rb30-today-details';const purpose=qs('.purpose',card);purpose?.insertAdjacentElement('afterend',wrap)}
    if(shoe&&shoe.parentElement!==wrap){shoe.dataset.rb30Label='UTSTYR';wrap.appendChild(shoe)}
    if(fuel&&fuel.textContent.trim()&&fuel.parentElement!==wrap){fuel.dataset.rb30Label='ENERGI';wrap.appendChild(fuel)}
    if(coach&&coach.parentElement!==wrap){coach.dataset.rb30Label='ØKTSTYRING';wrap.appendChild(coach)}
    const choice=qs('.easy-choice[data-easy-slot="today"]',card);choice?.classList.add('rb30-today-choice');
  }

  function reorderToday(){
    const today=$('today'),intel=$('rb9Intelligence'),review=qs('.week-review',today),below=qs('.below-grid',today);
    if(today&&review&&intel&&review.previousElementSibling!==intel)intel.insertAdjacentElement('afterend',review);
    if(below)below.classList.add('rb30-below');
  }

  function responsiveGuards(){
    qsa('#weeks .day-summary h3,#goals h2,#goals h3,#more h2,#more h3,.review-grid b,.rb9-capacity-row b').forEach(el=>el.classList.add('rb30-break-safe'));
    qsa('#weeks .day,#goals .card,#more .card,#today .card').forEach(el=>el.classList.add('rb30-min0'));
  }

  function refine(){
    semanticMetrics();compactTodayDetails();reorderToday();responsiveGuards();
    document.documentElement.classList.add('rb30');
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-mode],.navbtn,[data-rb-goalview],[data-v72]')){
      requestAnimationFrame(refine);setTimeout(refine,40);setTimeout(refine,140);
    }
  },true);
  window.addEventListener('resize',()=>requestAnimationFrame(refine),{passive:true});

  const prev=window.renderAll;
  if(typeof prev==='function')window.renderAll=function(){const out=prev.apply(this,arguments);refine();requestAnimationFrame(refine);return out};
  refine();requestAnimationFrame(refine);setTimeout(refine,100);
})();