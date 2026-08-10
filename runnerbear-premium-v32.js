/* RunnerBear v9.3 · Plan Cleanup
   Strict view isolation + a calendar-only Plan experience. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

  function shortName(title=''){
    const t=String(title).trim();
    let m=t.match(/(\d+)\s*×\s*(\d+)\s*min/i); if(m)return `${m[1]}×${m[2]}`;
    m=t.match(/(\d+)\s*×\s*(\d+)\s*×\s*45\/15/i); if(m)return `${m[1]}×${m[2]}×45`;
    if(/45\/15/i.test(t))return '45/15';
    if(/gate|kontrollpunkt/i.test(t))return 'Kontroll';
    if(/langtur/i.test(t))return 'Langtur';
    if(/concept2|rowerg|roing/i.test(t))return 'C2';
    if(/zwift|sykkel/i.test(t))return 'Zwift';
    if(/styrke/i.test(t)&&/hvile/i.test(t))return 'Styrke';
    if(/styrke/i.test(t))return 'Styrke';
    if(/hvile/i.test(t))return 'Hvile';
    if(/rolig/i.test(t))return 'Rolig';
    if(/race|runfest|konkurranse/i.test(t))return 'Race';
    return t.split(/\s+/).slice(0,1).join('').slice(0,9)||'Økt';
  }

  function fixViewIsolation(){
    qsa('.view').forEach(v=>{
      v.setAttribute('aria-hidden',v.classList.contains('active')?'false':'true');
    });
  }

  function labelPlan(){
    const plan=$('plan'); if(!plan)return;
    const head=qs('.section-head',plan);
    if(head){
      const eye=qs('.eyebrow',head),h=qs('h1',head),p=qs('p',head);
      if(eye)eye.textContent='PLAN';
      if(h)h.textContent='Ukeplan';
      if(p)p.textContent='Velg en dag for øktdetaljer.';
    }
    const ov=$('rb31PlanOverview');
    if(ov&&head&&ov.previousElementSibling!==head)head.insertAdjacentElement('afterend',ov);
  }

  function decorateDayMap(){
    const chips=qsa('#rb31PlanOverview [data-rb31-day]');
    const cards=qsa('#weeks .day');
    chips.forEach((chip,i)=>{
      let e=qs('.rb32-day-name',chip);
      if(!e){e=document.createElement('em');e.className='rb32-day-name';const dot=qs('i',chip);if(dot)chip.insertBefore(e,dot);else chip.appendChild(e)}
      const title=qs('h3',cards[i])?.textContent||'';
      e.textContent=shortName(title);
      chip.setAttribute('aria-label',`${qs('span',chip)?.textContent||''} ${qs('b',chip)?.textContent||''}: ${title||e.textContent}`);
    });
  }

  function makeManualFallbackQuiet(){
    qsa('#plan .rb31-manual-wrap').forEach(wrap=>{
      if(wrap.closest('.rb32-manual-menu'))return;
      const btn=qs('.rb31-manual',wrap);
      if(!btn)return;
      const details=document.createElement('details');details.className='rb32-manual-menu';
      const summary=document.createElement('summary');summary.innerHTML='<span>•••</span><small>Manuell fallback</small>';
      wrap.parentNode?.insertBefore(details,wrap);details.append(summary,wrap);
    });
  }

  function keepSelectedOpen(){
    const card=qs('#weeks .day.rb31-selected');
    if(card)card.classList.add('open');
  }

  function enableOverviewSwipe(){
    const ov=$('rb31PlanOverview');if(!ov||ov.dataset.rb32Swipe)return;
    ov.dataset.rb32Swipe='1';let x=0,y=0;
    ov.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(t){x=t.clientX;y=t.clientY}},{passive:true});
    ov.addEventListener('touchend',e=>{
      const t=e.changedTouches?.[0];if(!t)return;
      const dx=t.clientX-x,dy=t.clientY-y;
      if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.35)return;
      const btn=qs(`[data-rb31-week="${dx<0?'1':'-1'}"]`,ov);
      if(btn&&!btn.disabled)btn.click();
    },{passive:true});
  }

  function clean(){
    document.documentElement.classList.add('rb32');
    fixViewIsolation();labelPlan();decorateDayMap();makeManualFallbackQuiet();keepSelectedOpen();enableOverviewSwipe();
  }

  /* A selected workout should stay open; the week map is the navigation. */
  document.addEventListener('click',e=>{
    if(e.target.closest('#weeks .day.rb31-selected .day-summary')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();keepSelectedOpen();return;
    }
    if(e.target.closest('.navbtn,[data-rb31-day],[data-rb31-week],[data-rb31-current],[data-mode]')){
      requestAnimationFrame(clean);setTimeout(clean,60);setTimeout(clean,180);
    }
  },true);

  const prev=window.renderAll;
  if(typeof prev==='function')window.renderAll=function(){const out=prev.apply(this,arguments);requestAnimationFrame(clean);setTimeout(clean,60);return out};
  const prevSwitch=window.switchTab;
  if(typeof prevSwitch==='function')window.switchTab=function(id,scroll){const out=prevSwitch.apply(this,arguments);requestAnimationFrame(clean);setTimeout(clean,60);return out};
  window.addEventListener('resize',()=>requestAnimationFrame(clean),{passive:true});
  clean();requestAnimationFrame(clean);setTimeout(clean,100);
})();