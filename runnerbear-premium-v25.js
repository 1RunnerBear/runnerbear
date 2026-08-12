/* RunnerBear compatibility shim · v10.15 goal progress card
   The historical v25 asset remains intentionally small. Newer RunnerBear layers
   own the app; this shim only adds a resilient presentation upgrade after the
   coach-first goal view has rendered. */
(function(){
  'use strict';
  document.documentElement.dataset.runnerbearV25='compat';

  const parseTime=value=>{
    const parts=String(value||'').trim().split(':').map(Number);
    if(parts.some(x=>!Number.isFinite(x)))return 0;
    if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
    if(parts.length===2)return parts[0]*60+parts[1];
    return 0;
  };
  const shortTime=seconds=>{
    seconds=Math.max(0,Math.round(Number(seconds)||0));
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  };
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function upgradeGoalProgress(){
    const root=document.getElementById('rb107Goals');
    if(!root)return;
    const card=root.querySelector('.rb109-goal-status');
    if(!card||card.dataset.rb115==='1')return;
    const hero=root.querySelector('.rb109-goal-hero');
    if(!hero)return;

    const nowText=hero.querySelector('.rb107-goal-now b')?.textContent?.trim()||'';
    const targetText=hero.querySelector('.rb107-race-range>div:first-child b')?.textContent?.trim()||'';
    const now=parseTime(nowText),target=parseTime(targetText);
    if(!now||!target)return;

    const oldTitle=card.querySelector('h2')?.textContent?.trim()||'Bygger kapasitet';
    const oldCopy=card.querySelector('p')?.textContent?.trim()||'RunnerBear vurderer utviklingen mot målet.';
    const tone=card.classList.contains('amber')?'amber':card.classList.contains('neutral')?'neutral':'green';
    const gap=now-target;
    const headline=gap>0?`${shortTime(gap)} igjen til mål`:gap<0?`${shortTime(Math.abs(gap))} foran målet`:'Målkapasiteten er nådd';
    const chipIcon=tone==='green'?'✓':'i';

    card.dataset.rb115='1';
    card.classList.add('rb115-goal-progress');
    card.setAttribute('aria-label',`Mot målet. ${headline}. ${oldTitle}.`);
    card.innerHTML=`
      <div class="rb115-goal-head">
        <div><span class="rb107-overline">Mot målet</span><h2>${esc(headline)}</h2></div>
        <span class="rb115-info" aria-hidden="true">i</span>
      </div>
      <div class="rb115-goal-scale">
        <div class="rb115-goal-value"><span>Nå</span><b>${esc(nowText)}</b></div>
        <div class="rb115-goal-track ${tone}" aria-hidden="true"><i></i><em></em></div>
        <div class="rb115-goal-value target"><span>Mål</span><b>${esc(targetText)}</b></div>
      </div>
      <div class="rb115-goal-coach">
        <span class="rb115-goal-chip ${tone}"><i aria-hidden="true">${chipIcon}</i>${esc(oldTitle)}</span>
        <p>${esc(oldCopy)}</p>
      </div>`;
  }

  function init(){
    upgradeGoalProgress();
    const observer=new MutationObserver(()=>upgradeGoalProgress());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
