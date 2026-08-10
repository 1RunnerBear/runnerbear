/* RunnerBear v8.1.2 · choice UI consistency */
(function(){
  'use strict';

  const iconSvg={
    run:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5c3.2.2 5.7-.6 7.6-2.6l2.1-2.2 1.8 1.4c1.3 1 2.8 1.5 4.5 1.5v3.2H4z"/><path d="M8.2 12.6 10.7 9l4 2.7"/></svg>`,
    row:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.5" r="2"/><path d="m10.7 9.1-2.8 4.4h8.6l-2.7-4.4M3.5 17.5h17M6 20h12"/></svg>`,
    bike:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="m6 17 4-7h3l5 7M9 10h-2M10 17h4l-2.7-5"/></svg>`
  };
  const meta={
    run:{name:'Rolig jogg',kind:'Rolig',className:'easy'},
    row:{name:'Concept2',kind:'Cross',className:'cross'},
    bike:{name:'Zwift',kind:'Cross',className:'cross'}
  };

  function activeMode(box){
    const active=box?.querySelector('[data-mode].active');
    if(active&&meta[active.dataset.mode])return active.dataset.mode;
    const pressed=box?.querySelector('[data-mode][aria-pressed="true"]');
    return pressed&&meta[pressed.dataset.mode]?pressed.dataset.mode:'run';
  }

  function normalizeButtons(box){
    box.classList.add('rb-clean-choice');
    box.querySelectorAll('[data-mode]').forEach(btn=>{
      const mode=btn.dataset.mode;
      if(!meta[mode])return;
      const label=mode==='run'?'Rolig jogg':mode==='row'?'Concept2':'Zwift';
      btn.innerHTML=`<span class="rb-mode-icon">${iconSvg[mode]}</span><span class="rb-mode-label">${label}</span>`;
    });
  }

  function actualTitle(box,mode){
    const strong=box.querySelector('.easy-prescription strong')?.textContent?.trim();
    if(strong)return strong;
    return mode==='run'?'Rolig jogg':mode==='row'?'Concept2 · rolig roing':'Zwift · rolig sykling';
  }

  function setTag(tag,mode,long=false){
    if(!tag)return;
    const m=meta[mode];
    tag.className=`tag ${mode==='run'?'easy':'cross'} rb-actual-mode`;
    tag.innerHTML=`<span class="rb-tag-icon">${iconSvg[mode]}</span><span>${long&&mode==='run'?'Langtur':m.name}</span>`;
    tag.setAttribute('aria-label',`${m.kind}: ${m.name}`);
  }

  function patchPlanChoice(box){
    const mode=activeMode(box),day=box.closest('.day');
    if(!day)return;
    day.classList.remove('rb-selected-run','rb-selected-row','rb-selected-bike');
    day.classList.add(`rb-selected-${mode}`);
    day.dataset.rbActualMode=mode;

    const title=day.querySelector('h3');
    const tag=day.querySelector('.tag');
    const head=(box.querySelector('.easy-choice-head span')?.textContent||'');
    const isLong=/LANGTUR/i.test(head);
    if(title)title.textContent=actualTitle(box,mode);
    setTag(tag,mode,isLong);

    const metaLine=day.querySelector('.daymeta');
    if(metaLine){
      if(mode==='run'){
        const gear=box.querySelector('.easy-prescription small')?.textContent?.trim();
        if(gear)metaLine.textContent=gear;
      }else{
        metaLine.textContent=mode==='row'?'Concept2 RowErg · Cross':'Zwift · Cross';
      }
      metaLine.classList.remove('rb-choice-duplicate');
    }
  }

  function patchTodayChoice(box){
    const mode=activeMode(box);
    const title=document.getElementById('todayTitle');
    const desc=document.getElementById('todayDesc');
    const type=document.getElementById('todayType');
    const shoe=document.getElementById('todayShoe');
    const line=box.querySelector('.easy-prescription span')?.textContent?.trim();
    const gear=box.querySelector('.easy-prescription small')?.textContent?.trim();

    if(title)title.textContent=actualTitle(box,mode);
    if(desc&&line)desc.textContent=line;
    setTag(type,mode,/LANGTUR/i.test(box.querySelector('.easy-choice-head span')?.textContent||''));
    if(shoe){
      shoe.classList.remove('rb-choice-duplicate');
      shoe.textContent=mode==='run'?(gear||'Løpesko'):mode==='row'?'Concept2 RowErg · Cross':'Zwift · Cross';
    }
  }

  function patchWeekMini(){
    document.querySelectorAll('#weekStrip .mode-mini').forEach(el=>{
      const text=(el.textContent||'').toLowerCase();
      const mode=text.includes('concept2')?'row':text.includes('zwift')?'bike':'run';
      el.innerHTML=`· <span class="rb-mini-icon">${iconSvg[mode]}</span> ${meta[mode].name}`;
    });
  }

  function postprocess(){
    document.querySelectorAll('.easy-choice').forEach(box=>{
      normalizeButtons(box);
      if(box.dataset.easySlot==='today')patchTodayChoice(box);
      else patchPlanChoice(box);
    });
    patchWeekMini();
    document.documentElement.classList.add('rb-choice-ui-v812');
  }

  const previousRenderAll=window.renderAll;
  if(typeof previousRenderAll==='function'){
    window.renderAll=function(){
      const result=previousRenderAll.apply(this,arguments);
      postprocess();
      return result;
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('.easy-choice [data-mode]'))requestAnimationFrame(postprocess);
  },true);

  postprocess();
})();