/* RunnerBear v10.5 · flexible activity polish + stale activity retry */
(function(){
  'use strict';

  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const EMOJI_ONLY=/^(?:🏃(?:‍♂️|‍♀️)?|🚣(?:‍♂️|‍♀️)?|🚴(?:‍♂️|‍♀️)?|🚲)$/u;
  let queued=false;

  function activeMode(box){
    return box?.querySelector('[data-mode].active,[data-mode][aria-pressed="true"]')?.dataset?.mode||'';
  }

  function cleanButton(btn){
    qsa(':scope > span',btn).forEach(span=>{
      const text=(span.textContent||'').trim();
      if(!span.querySelector('svg')&&EMOJI_ONLY.test(text))span.remove();
    });

    const iconSpans=qsa(':scope > span',btn).filter(span=>span.querySelector('svg'));
    if(iconSpans.length>1){
      const keep=iconSpans.find(x=>x.classList.contains('rb9-choice-icon'))||iconSpans.at(-1);
      iconSpans.forEach(x=>{if(x!==keep)x.remove()});
    }
  }

  function syncChoice(box){
    qsa('[data-mode]',box).forEach(cleanButton);

    const mode=activeMode(box);
    if(!mode)return;
    box.dataset.rb105Mode=mode;

    const day=box.closest('.day');
    if(day){
      const title=box.querySelector('.easy-prescription strong')?.textContent?.trim();
      const h=day.querySelector('.day-summary h3')||day.querySelector('h3');
      if(title&&h&&h.textContent.trim()!==title)h.textContent=title;
      day.dataset.rbActualMode=mode;
    }
  }

  function syncAll(){
    queued=false;
    qsa('.easy-choice').forEach(syncChoice);
    document.documentElement.classList.add('rb105-choice-clean');
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(syncAll);
  }

  function localDay(value){
    const d=new Date(value);if(Number.isNaN(d.getTime()))return'';
    const z=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }

  function maybeRetryStaleActivities(){
    if(sessionStorage.getItem('rb105_stale_sync_tried')==='1')return;
    let cache=null;try{cache=JSON.parse(localStorage.getItem('runnerbear_tredict_cache_v1')||'null')}catch{}
    const acts=Array.isArray(cache?.activities)?cache.activities:[];
    if(!acts.length)return;
    const latest=acts.map(a=>localDay(a?.date)).filter(Boolean).sort().at(-1)||'';
    const y=new Date();y.setDate(y.getDate()-1);const yesterday=localDay(y);
    if(!latest||latest>=yesterday)return;
    if(typeof window.RunnerBearBridge?.sync!=='function')return;
    sessionStorage.setItem('rb105_stale_sync_tried','1');
    setTimeout(()=>window.RunnerBearBridge.sync(false),700);
  }

  document.addEventListener('click',e=>{
    if(!e.target.closest('.easy-choice [data-mode]'))return;
    schedule();setTimeout(schedule,35);setTimeout(schedule,140);
  },true);

  const observer=new MutationObserver(muts=>{
    if(muts.some(m=>m.type==='childList'||m.type==='attributes'))schedule();
  });
  ['today','plan'].forEach(id=>{
    const root=document.getElementById(id);
    if(root)observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
  });

  document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();maybeRetryStaleActivities()}});
  syncAll();
  setTimeout(syncAll,120);
  setTimeout(maybeRetryStaleActivities,900);
})();
