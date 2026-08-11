/* RunnerBear v9.6 · Today Decision Surface
   Clean, decision-first Today view. Existing coach/training logic remains authoritative. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const text=id=>($(id)?.textContent||'').trim();
  const clean=s=>String(s||'').replace(/^RB Coach\s*·\s*/i,'').replace(/^👟\s*/,'').replace(/^⚡\s*/,'').trim();
  const fmtDate=d=>new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long'}).format(d).replace(/^./,c=>c.toUpperCase());
  let lastSignature='';

  function greeting(){
    const hour=new Date().getHours();
    return hour<10?'God morgen':hour<17?'God dag':'God kveld';
  }

  function tone(){
    const pill=$('rb9CoachPill')||$('coachLight');
    if(pill?.classList.contains('red'))return'red';
    if(pill?.classList.contains('yellow'))return'yellow';
    if(pill?.classList.contains('green'))return'green';
    const load=text('rb9Load').toLowerCase();
    if(/høy|brems|rød/.test(load))return'red';
    if(/obs|gul/.test(load))return'yellow';
    return'green';
  }
  function statusLabel(t){return t==='red'?'Juster dagen':t==='yellow'?'Planen står · med margin':'Planen står'}
  function statusMessage(t){
    const live=text('rb9CoachText')||text('coachMessage');
    if(live&&live!=='–')return live;
    return t==='red'?'Recovery-signaler tilsier lavere belastning i dag.':t==='yellow'?'Ett eller flere signaler avviker. Hold god margin.':'Kroppen ser normal ut. Gjennomfør som planlagt.';
  }

  function health(){
    const load=text('rb9Load')||'–';
    const t=/høy/i.test(load)?'red':/obs/i.test(load)?'yellow':'green';
    return{
      tone:t,
      label:t==='red'?'Avvik':t==='yellow'?'Følg med':'Normal',
      items:[
        ['HRV',text('rb9Hrv')||'–',text('rb9HrvSub')],
        ['Søvn',text('rb9Sleep')||'–',text('rb9SleepSub')],
        ['Hvilepuls',text('rb9Rhr')||'–',text('rb9RhrSub')],
        ['Belastning',load,text('rb9LoadSub')]
      ]
    };
  }

  function actual(){
    const host=$('rbActualWorkout');
    const card=host?.querySelector('.rb95-actual');
    if(!card)return null;
    const title=card.querySelector('.rb95-actual-head b')?.textContent?.trim()||'Gjennomført økt';
    const metrics=qsa('.rb95-actual-grid>div',card).slice(0,4).map(x=>{
      const k=x.querySelector('span')?.textContent?.trim()||'';
      const v=x.querySelector('b')?.textContent?.trim()||'';
      return k&&v?`${k} ${v}`:'';
    }).filter(Boolean);
    return{title,metrics};
  }

  function workout(){
    return{
      title:text('todayTitle')||'Dagens økt',
      desc:text('todayDesc'),
      pace:text('todayPace')||'–',
      hr:text('todayHr')||'–',
      total:text('todayKm')||'–',
      shoe:clean(text('todayShoe')),
      fuel:clean(text('todayFuel')),
      purpose:text('todayPurpose'),
      focus:clean(text('todayCoach')),
      actual:actual()
    };
  }

  function healthLine(h){
    return h.items.map(([k,v])=>`${k==='Hvilepuls'?'RHR':k} ${v}`).join(' · ');
  }

  function metric(label,value){return `<div><span>${esc(label)}</span><b>${esc(value||'–')}</b></div>`}

  function surfaceHtml(){
    const t=tone(),h=health(),w=workout();
    const actualHtml=w.actual?`<div class="rb35-actual"><span>GJENNOMFØRT · GARMIN/TREDICT</span><b>✓ ${esc(w.actual.title)}</b><small>${esc(w.actual.metrics.join(' · '))}</small></div>`:'';
    const details=[w.desc&&`<div><span>ØKT</span><p>${esc(w.desc)}</p></div>`,w.purpose&&`<div><span>HENSIKT</span><p>${esc(w.purpose)}</p></div>`,w.shoe&&`<div><span>SKO</span><p>${esc(w.shoe)}</p></div>`,w.fuel&&`<div><span>ENERGI</span><p>${esc(w.fuel)}</p></div>`].filter(Boolean).join('');
    const healthDetails=h.items.map(([k,v,sub])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b><small>${esc(sub||'')}</small></div>`).join('');
    return `<section class="rb35-surface" aria-label="I dag">
      <header class="rb35-greeting">
        <span>SMART. LIGHTER. FASTER.</span>
        <h1>${esc(greeting())}, Torbjørn</h1>
        <div><p>${esc(fmtDate(new Date()))}</p><small>RUNNERBEAR · I DAG</small></div>
      </header>
      <article class="rb35-status rb35-${t}">
        <div class="rb35-status-mark" aria-hidden="true"></div>
        <div><span>RB COACH</span><h2>${esc(statusLabel(t))}</h2><p>${esc(statusMessage(t))}</p></div>
      </article>

      <article class="rb35-workout">
        <div class="rb35-kicker"><span>DAGENS ØKT</span><span>${esc(text('todayType')||'')}</span></div>
        <h1>${esc(w.title)}</h1>
        <div class="rb35-metrics">${metric('Styring / fart',w.pace)}${metric('Puls',w.hr)}${metric('Total',w.total)}</div>
        ${w.shoe?`<div class="rb35-shoe">${esc(w.shoe)}</div>`:''}
        ${w.focus?`<div class="rb35-focus"><span>FOKUS</span><b>${esc(w.focus)}</b></div>`:''}
        ${actualHtml}
        <details class="rb35-details" id="rb35WorkoutDetails">
          <summary>Se øktdetaljer <span>↓</span></summary>
          <div class="rb35-detail-grid">${details||'<div><p>Ingen ekstra detaljer nødvendig i dag.</p></div>'}</div>
          <div class="rb35-adapt">
            <span>TILPASS DAGEN</span>
            <div class="rb35-adapt-buttons"><button type="button" data-rb35-reason="tired">Sliten</button><button type="button" data-rb35-reason="achilles">Akilles</button><button type="button" data-rb35-reason="time">Dårlig tid</button><button type="button" data-rb35-reason="skip">Kan ikke i dag</button></div>
            <p id="rb35AdaptAdvice"></p>
          </div>
        </details>
      </article>

      <article class="rb35-health">
        <div class="rb35-health-head"><div><span>KROPP I DAG</span><h3>${esc(h.label)}</h3></div><i class="rb35-dot rb35-${h.tone}" aria-hidden="true"></i></div>
        <p>${esc(healthLine(h))}</p>
        <details id="rb35HealthDetails"><summary>Se helsedata <span>↓</span></summary><div class="rb35-health-grid">${healthDetails}</div></details>
      </article>
    </section>`;
  }

  function bind(root){
    qsa('[data-rb35-reason]',root).forEach(btn=>btn.addEventListener('click',()=>{
      const original=qs(`#adaptPanel [data-reason="${btn.dataset.rb35Reason}"]`);
      if(original){original.click();setTimeout(()=>{const advice=text('adaptAdvice');const out=$('rb35AdaptAdvice');if(out)out.innerHTML=$('adaptAdvice')?.innerHTML||esc(advice)},30)}
      qsa('[data-rb35-reason]',root).forEach(x=>x.classList.toggle('active',x===btn));
    }));
  }

  function render(){
    const today=$('today');if(!today)return;
    let root=$('rb35Today');
    if(!root){root=document.createElement('div');root.id='rb35Today';today.prepend(root)}
    const sig=[greeting(),fmtDate(new Date()),tone(),text('rb9CoachText'),text('todayTitle'),text('todayDesc'),text('todayPace'),text('todayHr'),text('todayKm'),text('todayShoe'),text('todayCoach'),text('rb9Hrv'),text('rb9Sleep'),text('rb9Rhr'),text('rb9Load'),actual()?.title||''].join('|');
    if(sig===lastSignature&&root.children.length)return;
    const open=new Set(qsa('details[open]',root).map(x=>x.id));
    lastSignature=sig;
    root.innerHTML=surfaceHtml();
    open.forEach(id=>{const d=$(id);if(d)d.open=true});
    bind(root);
    document.documentElement.classList.add('rb35');
  }

  function init(){
    render();requestAnimationFrame(render);setTimeout(render,80);setTimeout(render,240);
    const today=$('today');if(today){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;render()},30)}).observe(today,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']})}
    document.addEventListener('click',e=>{if(e.target.closest('.navbtn,[data-mode],[data-rb31-day],[data-rb31-week],#rb94Sync'))setTimeout(render,80)},true);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(render,100)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
