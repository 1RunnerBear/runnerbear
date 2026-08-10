/* RunnerBear v8.1.3 · activity icon consistency + coach review cleanup */
(function(){
  'use strict';

  const iconSvg={
    run:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="14.5" cy="4.5" r="2"/><path d="m12.5 8-3 4 3 2.5 2.5 4M12.5 8l3.5 2 3 .5M9.5 12 6 16.5M15 18.5l3.5 1"/></svg>`,
    row:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="5" r="2"/><path d="m9 8-2.5 4.5h5L14 16M11.5 12.5l5-1.5M4 18h16M6 21h12"/></svg>`,
    bike:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="m6 17 4-7h3l5 7M9 10h-2M10 17h4l-2.7-5"/></svg>`
  };
  const meta={run:{name:'Rolig jogg',kind:'Rolig'},row:{name:'Concept2',kind:'Cross'},bike:{name:'Zwift',kind:'Cross'}};

  function activeMode(box){
    const active=box?.querySelector('[data-mode].active');
    if(active&&meta[active.dataset.mode])return active.dataset.mode;
    const pressed=box?.querySelector('[data-mode][aria-pressed="true"]');
    return pressed&&meta[pressed.dataset.mode]?pressed.dataset.mode:'run';
  }
  function normalizeButtons(box){
    box.classList.add('rb-clean-choice');
    box.querySelectorAll('[data-mode]').forEach(btn=>{
      const mode=btn.dataset.mode;if(!meta[mode])return;
      btn.innerHTML=`<span class="rb-mode-icon">${iconSvg[mode]}</span><span class="rb-mode-label">${meta[mode].name}</span>`;
      btn.setAttribute('aria-label',meta[mode].name);
    });
  }
  function actualTitle(box,mode){return box.querySelector('.easy-prescription strong')?.textContent?.trim()||(mode==='run'?'Rolig jogg':mode==='row'?'Concept2 · rolig roing':'Zwift · rolig sykling')}
  function setTag(tag,mode,long=false){
    if(!tag)return;const m=meta[mode];
    tag.className=`tag ${mode==='run'?'easy':'cross'} rb-actual-mode`;
    tag.innerHTML=`<span class="rb-tag-icon">${iconSvg[mode]}</span><span>${long&&mode==='run'?'Langtur':m.name}</span>`;
    tag.setAttribute('aria-label',`${m.kind}: ${m.name}`);
  }
  function patchPlanChoice(box){
    const mode=activeMode(box),day=box.closest('.day');if(!day)return;
    day.classList.remove('rb-selected-run','rb-selected-row','rb-selected-bike');day.classList.add(`rb-selected-${mode}`);day.dataset.rbActualMode=mode;
    const title=day.querySelector('h3'),tag=day.querySelector('.tag'),isLong=/LANGTUR/i.test(box.querySelector('.easy-choice-head span')?.textContent||'');
    if(title)title.textContent=actualTitle(box,mode);setTag(tag,mode,isLong);
    const metaLine=day.querySelector('.daymeta');if(metaLine){const gear=box.querySelector('.easy-prescription small')?.textContent?.trim();metaLine.textContent=mode==='run'?(gear||'Løpesko'):mode==='row'?'Concept2 RowErg · Cross':'Zwift · Cross';metaLine.classList.remove('rb-choice-duplicate')}
  }
  function patchTodayChoice(box){
    const mode=activeMode(box),title=document.getElementById('todayTitle'),desc=document.getElementById('todayDesc'),type=document.getElementById('todayType'),shoe=document.getElementById('todayShoe');
    const line=box.querySelector('.easy-prescription span')?.textContent?.trim(),gear=box.querySelector('.easy-prescription small')?.textContent?.trim();
    if(title)title.textContent=actualTitle(box,mode);if(desc&&line)desc.textContent=line;setTag(type,mode,/LANGTUR/i.test(box.querySelector('.easy-choice-head span')?.textContent||''));
    if(shoe){shoe.classList.remove('rb-choice-duplicate');shoe.textContent=mode==='run'?(gear||'Løpesko'):mode==='row'?'Concept2 RowErg · Cross':'Zwift · Cross'}
  }
  function patchWeekMini(){document.querySelectorAll('#weekStrip .mode-mini').forEach(el=>{const text=(el.textContent||'').toLowerCase(),mode=text.includes('concept2')?'row':text.includes('zwift')?'bike':'run';el.innerHTML=`· <span class="rb-mini-icon">${iconSvg[mode]}</span> ${meta[mode].name}`})}
  function cleanCoachReview(){
    document.getElementById('copyStatus')?.remove();document.getElementById('copyToast')?.remove();
    const card=document.querySelector('.week-review');if(!card)return;
    const kicker=card.querySelector('.kicker span:first-child');if(kicker)kicker.textContent='COACH REVIEW · HELHET';
    card.classList.add('rb-coach-review-clean');
  }
  function postprocess(){
    document.querySelectorAll('.easy-choice').forEach(box=>{normalizeButtons(box);box.dataset.easySlot==='today'?patchTodayChoice(box):patchPlanChoice(box)});
    patchWeekMini();cleanCoachReview();document.documentElement.classList.add('rb-choice-ui-v813');
  }
  const previousRenderAll=window.renderAll;if(typeof previousRenderAll==='function'){window.renderAll=function(){const result=previousRenderAll.apply(this,arguments);postprocess();return result}}
  document.addEventListener('click',e=>{if(e.target.closest('.easy-choice [data-mode]'))requestAnimationFrame(postprocess)},true);
  postprocess();
})();