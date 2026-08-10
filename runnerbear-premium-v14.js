/* RunnerBear v6.1 · Premium Cleanup
   UI-only layer. No training or localStorage data model changes. */
(function(){
  'use strict';

  const iconSvg={
    run:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5c3.2.2 5.7-.6 7.6-2.6l2.1-2.2 1.8 1.4c1.3 1 2.8 1.5 4.5 1.5v3.2H4z"/><path d="M8.2 12.6 10.7 9l4 2.7"/></svg>`,
    row:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.5" r="2"/><path d="m10.7 9.1-2.8 4.4h8.6l-2.7-4.4M3.5 17.5h17M6 20h12"/></svg>`,
    bike:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="m6 17 4-7h3l5 7M9 10h-2M10 17h4l-2.7-5"/></svg>`
  };

  function cleanEasyChoices(){
    const todayChoice=document.querySelector('#todayCard .easy-choice[data-easy-slot="today"]');
    const todayShoe=document.getElementById('todayShoe');
    if(todayShoe)todayShoe.classList.toggle('rb-choice-duplicate',!!todayChoice);

    document.querySelectorAll('.easy-choice').forEach(box=>{
      box.classList.add('rb-clean-choice');
      const isLong=/LANGTUR/i.test(box.querySelector('.easy-choice-head span')?.textContent||'');
      const head=box.querySelector('.easy-choice-head');
      if(head){
        const left=head.querySelector('span'),right=head.querySelector('b');
        if(left)left.textContent=isLong?'LANGTUR · ALTERNATIV':'ROLIG DAG';
        if(right)right.textContent=isLong?'LØP ANBEFALT':'VELG AKTIVITET';
      }
      box.querySelectorAll('[data-mode]').forEach(btn=>{
        const mode=btn.dataset.mode;
        const label=mode==='run'?'Rolig jogg':mode==='row'?'Concept2':'Zwift';
        if(iconSvg[mode])btn.innerHTML=`<span class="rb-mode-icon">${iconSvg[mode]}</span><span class="rb-mode-label">${label}</span>`;
      });
      const p=box.querySelector('.easy-prescription');
      if(p){
        const strong=p.querySelector('strong'),small=p.querySelector('small');
        if(strong)strong.classList.add('rb-prescription-title');
        if(small){small.classList.add('rb-prescription-gear');small.textContent=small.textContent.replace(/^[🏃🚣🚴👟]\s*/,'');}
      }
      const day=box.closest('.day');
      if(day)day.querySelectorAll('.daymeta').forEach(el=>el.classList.toggle('rb-choice-duplicate',/^\s*👟/.test(el.textContent||'')));
    });
  }

  function shoeResponseMap(){
    const map=new Map();
    document.querySelectorAll('#shoeResponseList .shoe-response').forEach(row=>{
      const name=row.querySelector('b')?.textContent?.trim();
      if(!name)return;
      const badge=row.querySelector('strong')?.textContent?.trim()||'Bygger data';
      const tone=row.classList.contains('green')?'green':row.classList.contains('yellow')?'yellow':'neutral';
      const counts=row.querySelector('.shoe-response-counts')?.textContent?.replace(/\s+/g,' ')?.trim()||'';
      map.set(name,{badge,tone,counts});
    });
    return map;
  }

  function inferredShoe(f){
    try{
      const fb=getFeedback(f.label);
      if(fb?.shoe&&shoeMeta[fb.shoe])return fb.shoe;
      const raw=f.shoe||'';
      const exact=Object.keys(shoeMeta).find(s=>raw.includes(s));
      if(exact)return exact;
      const first=raw.split('/')[0].replace(/\(.*?\)/g,'').trim();
      return shoeMeta[first]?first:'';
    }catch{return''}
  }

  function lastUseFor(name){
    try{
      const rows=flat.filter(f=>isDone(f.label)&&f.km>0&&inferredShoe(f)===name).sort((a,b)=>a.date-b.date);
      return rows.length?rows[rows.length-1].label:'Ingen registrert økt ennå';
    }catch{return'–'}
  }

  function cleanShoes(openName=''){
    const wall=document.getElementById('shoeWall');
    if(!wall)return;
    if(wall.querySelector('.rb-shoe-item'))return;
    const responses=shoeResponseMap();
    const boxes=[...wall.querySelectorAll('.shoebox')];
    if(!boxes.length)return;

    wall.classList.add('rb-shoe-accordion');
    const frag=document.createDocumentFragment();
    boxes.forEach(box=>{
      const km=box.querySelector('strong')?.textContent?.trim()||'0 km';
      const name=box.querySelector('b')?.textContent?.trim()||'Sko';
      const role=box.querySelector('.small')?.textContent?.trim()||'';
      const resp=responses.get(name)||{badge:'BYGGER DATA',tone:'neutral',counts:''};
      const details=document.createElement('details');
      details.className='rb-shoe-item';details.dataset.shoe=name;
      if(openName===name)details.open=true;
      details.innerHTML=`<summary><div class="rb-shoe-title"><b>${name}</b><span>${role}</span></div><div class="rb-shoe-summary"><strong>${km}</strong><em class="${resp.tone}">${resp.badge}</em><i aria-hidden="true"></i></div></summary><div class="rb-shoe-body"><div><span>Registrert løping</span><b>${km}</b></div><div><span>Sist brukt</span><b>${lastUseFor(name)}</b></div><div><span>Akillesmønster</span><b class="${resp.tone}">${resp.badge}</b></div>${resp.counts?`<p>${resp.counts}</p>`:'<p>Registrer faktisk sko og akillesrespons etter økter for å bygge et personlig mønster.</p>'}</div>`;
      details.addEventListener('toggle',()=>{
        if(!details.open)return;
        wall.querySelectorAll('.rb-shoe-item[open]').forEach(other=>{if(other!==details)other.open=false});
      });
      frag.appendChild(details);
    });
    wall.replaceChildren(frag);
  }

  function collapseAnalytics(panelId,label){
    const panel=document.getElementById(panelId);if(!panel||panel.querySelector(':scope > .rb-analysis-details'))return;
    const fixed=[...panel.children].filter(n=>n.classList?.contains('metric-divider')||n.classList?.contains('kicker'));
    const movable=[...panel.children].filter(n=>!fixed.includes(n));
    if(!movable.length)return;
    const details=document.createElement('details');details.className='rb-analysis-details';
    details.innerHTML=`<summary><span>${label}</span><i aria-hidden="true"></i></summary>`;
    movable.forEach(n=>details.appendChild(n));panel.appendChild(details);
  }

  function cleanMore(){
    cleanShoes();
    collapseAnalytics('shoeAchillesInsight','Se sko × akilles-analyse');
    collapseAnalytics('achillesLoadMap','Se belastningskart');
    const wall=document.getElementById('shoeWall');const card=wall?.closest('.card');
    if(card)card.classList.add('rb-shoe-card');
  }

  function cleanGreeting(){
    const g=document.getElementById('premiumGreeting');if(!g)return;
    const h=g.querySelector('h1'),p=g.querySelector('p');
    const hour=new Date().getHours();
    const salute=hour<10?'God morgen':hour<17?'God dag':'God kveld';
    if(h)h.textContent=`${salute}, Torbjørn`;
    if(p)p.textContent='Dagens plan, kontrollert og uten unødvendig støy.';
  }

  function postprocess(openShoe=''){
    cleanGreeting();cleanEasyChoices();cleanMore();
    if(openShoe){const d=[...document.querySelectorAll('#shoeWall .rb-shoe-item')].find(x=>x.dataset.shoe===openShoe);if(d)d.open=true;}
    document.documentElement.classList.add('rb-premium-cleanup');
  }

  const previousRenderAll=window.renderAll;
  if(typeof previousRenderAll==='function'){
    window.renderAll=function(){
      const openShoe=document.querySelector('#shoeWall .rb-shoe-item[open]')?.dataset.shoe||'';
      const result=previousRenderAll.apply(this,arguments);
      postprocess(openShoe);
      return result;
    };
  }

  postprocess();
})();
