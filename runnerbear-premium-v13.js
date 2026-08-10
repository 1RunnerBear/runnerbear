/* RunnerBear v6 · Proposal 2 branding shell */
(function(){
  const MARK='runnerbear-brand-mark-flat.png?v=13';
  function ensureBrand(){
    document.body.classList.add('runnerbear-premium');
    const rb=document.querySelector('.brand .rb');
    if(rb&&!rb.querySelector('img')) rb.innerHTML=`<img src="${MARK}" alt="RunnerBear">`;
    const brand=document.querySelector('.brand>div:last-child');
    if(brand){
      const b=brand.querySelector('b'),s=brand.querySelector('span');
      if(b)b.textContent='RunnerBear';
      if(s)s.textContent='Smart. Lighter. Faster.';
    }
    const today=document.getElementById('today');
    if(today&&!document.getElementById('premiumGreeting')){
      const g=document.createElement('div');g.id='premiumGreeting';g.className='premium-greeting';
      g.innerHTML='<span class="premium-eyebrow">SMART. LIGHTER. FASTER.</span><h1>God morgen, Torbjørn 👋</h1><p>Én tydelig plan. Ingen støy. La dagens økt gjøre jobben sin.</p>';
      today.insertBefore(g,today.firstChild);
    }
    const shield=document.querySelector('.backup-shield');
    if(shield&&!shield.querySelector('img')) shield.innerHTML=`<img src="${MARK}" alt="">`;
  }
  function refineLabels(){
    const todayType=document.getElementById('todayType');
    if(todayType&&todayType.textContent==='–') todayType.setAttribute('aria-live','polite');
    document.querySelectorAll('.card').forEach(c=>c.classList.add('premium-surface'));
  }
  ensureBrand();refineLabels();
  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function'){
    window.renderAll=function(){const r=oldRenderAll.apply(this,arguments);ensureBrand();refineLabels();return r};
  }
})();
