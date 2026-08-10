/* RunnerBear v8.2.1 · unified activity icons + robust mode sync */
(function(){
  'use strict';

  const ICONS={
    run:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="14.8" cy="4.2" r="1.8"/><path d="M12.8 7.1 10 10.3l2.8 2.1 2.1 3.2M12.8 7.1l3.3 2.1 2.6-.2M10 10.3l-2.8 4.1M14.9 15.6l3.3 2.3M12.1 12.2l-1.6 4.6-3.6 1.8"/></svg>`,
    row:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.2" cy="6" r="1.7"/><path d="m9.2 8.1 3.2 3.4 4.1-1.2M10.6 11.5l-3 3.6h5.6l2.6 3.1M3.5 18.5h12.7M5.6 21h8.7M17.1 8.9l2.8 7.8M18.2 12.2h2.3"/></svg>`,
    bike:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.1"/><circle cx="18" cy="17" r="3.1"/><path d="M6 17 9.4 10h4.1l4.5 7M9.4 10 12 17h6M8.5 7.7h3.1M13.5 10l1.3-2.5h2.2"/></svg>`
  };
  const META={
    run:{label:'Rolig jogg',tag:'Rolig',gear:'Løpesko'},
    row:{label:'Concept2',tag:'Cross',gear:'Concept2 RowErg · Cross'},
    bike:{label:'Zwift',tag:'Cross',gear:'Zwift · Cross'}
  };

  function modeFromBox(box){
    const active=box?.querySelector('[data-mode].active,[data-mode][aria-pressed="true"]');
    return META[active?.dataset?.mode]?active.dataset.mode:'run';
  }
  function icon(mode,cls='rb-activity-icon'){return `<span class="${cls}">${ICONS[mode]||ICONS.run}</span>`}

  function setButtons(box,forcedMode){
    const mode=forcedMode||modeFromBox(box);
    box.querySelectorAll('[data-mode]').forEach(btn=>{
      const m=btn.dataset.mode;if(!META[m])return;
      btn.innerHTML=`${icon(m)}<span class="rb-mode-label">${META[m].label}</span>`;
      btn.classList.toggle('active',m===mode);
      btn.setAttribute('aria-pressed',m===mode?'true':'false');
      btn.setAttribute('aria-label',META[m].label);
    });
    return mode;
  }

  function selectedPrescription(box){
    return {
      title:box.querySelector('.easy-prescription strong')?.textContent?.trim()||'',
      desc:box.querySelector('.easy-prescription span')?.textContent?.trim()||'',
      gear:box.querySelector('.easy-prescription small')?.textContent?.trim()||''
    };
  }

  function tagMarkup(mode,isLong){
    const text=isLong&&mode==='run'?'Langtur':META[mode].label;
    return `${icon(mode,'rb-tag-icon')}<span>${text}</span>`;
  }

  function syncPlan(box,mode){
    const day=box.closest('.day');if(!day)return;
    const p=selectedPrescription(box),isLong=/LANGTUR/i.test(box.querySelector('.easy-choice-head')?.textContent||'');
    const title=day.querySelector('h3');if(title)title.textContent=p.title||META[mode].label;
    const tag=day.querySelector('.tag');if(tag){tag.className=`tag ${mode==='run'?'easy':'cross'} rb-actual-mode`;tag.innerHTML=tagMarkup(mode,isLong)}
    const meta=day.querySelector('.daymeta');if(meta)meta.textContent=mode==='run'?(p.gear||META.run.gear):META[mode].gear;
    day.dataset.rbActualMode=mode;
  }

  function syncToday(box,mode){
    const p=selectedPrescription(box),isLong=/LANGTUR/i.test(box.querySelector('.easy-choice-head')?.textContent||'');
    const title=document.getElementById('todayTitle');if(title)title.textContent=p.title||META[mode].label;
    const desc=document.getElementById('todayDesc');if(desc&&p.desc)desc.textContent=p.desc;
    const tag=document.getElementById('todayType');if(tag){tag.className=`tag ${mode==='run'?'easy':'cross'} rb-actual-mode`;tag.innerHTML=tagMarkup(mode,isLong)}
    const gear=document.getElementById('todayShoe');if(gear)gear.textContent=mode==='run'?(p.gear||META.run.gear):META[mode].gear;
  }

  function syncBox(box,forcedMode){
    if(!box)return;
    const mode=setButtons(box,forcedMode);
    box.classList.add('rb-activity-choice-v27');
    box.dataset.easySlot==='today'?syncToday(box,mode):syncPlan(box,mode);
  }

  function syncWeekStrip(){
    document.querySelectorAll('#weekStrip .mode-mini').forEach(el=>{
      const t=(el.textContent||'').toLowerCase();
      const mode=t.includes('concept2')?'row':t.includes('zwift')?'bike':'run';
      el.innerHTML=`· ${icon(mode,'rb-mini-icon')}<span>${META[mode].label}</span>`;
    });
  }

  function syncAll(){document.querySelectorAll('.easy-choice').forEach(box=>syncBox(box));syncWeekStrip();document.documentElement.classList.add('rb-activity-ui-v27')}

  /* Let the legacy handler persist the choice first, then make UI follow it. */
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.easy-choice [data-mode]');if(!btn||!META[btn.dataset.mode])return;
    const box=btn.closest('.easy-choice'),mode=btn.dataset.mode;
    requestAnimationFrame(()=>{syncBox(box,mode);syncWeekStrip();requestAnimationFrame(()=>syncBox(box,mode))});
  },false);

  const previous=window.renderAll;
  if(typeof previous==='function')window.renderAll=function(){const r=previous.apply(this,arguments);requestAnimationFrame(syncAll);return r};

  const observer=new MutationObserver(muts=>{
    if(muts.some(m=>m.type==='childList' || (m.type==='attributes'&&m.attributeName==='class')))requestAnimationFrame(syncAll);
  });
  const today=document.getElementById('today'),plan=document.getElementById('plan');
  if(today)observer.observe(today,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
  if(plan)observer.observe(plan,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});

  syncAll();
})();