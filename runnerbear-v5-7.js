/* RunnerBear v5.8 · Bakken traffic light + standardized control trend
   Core guardrails:
   - Multiple signals matter more than one metric.
   - Green means execute the plan with control, not add bonus load.
   - Red Achilles response overrides the calendar.
   - Standardized control points are harvested from planned sessions; never add a test rep just to create data. */
(function(){
  const PRE_KEY=label=>`runfest26_precheck_${slug(label)}`;
  const CONTROL_KEY='runfest26_control_history';
  const factorMeta={
    legs:{label:'Bein',choices:[['g','Lette'],['y','Normale'],['r','Tunge']]},
    sleep:{label:'Søvn',choices:[['g','God'],['y','OK'],['r','Dårlig']]},
    achilles:{label:'Akilles',choices:[['g','Rolig'],['y','Merkbar'],['r','Verre']]},
    warmup:{label:'Oppvarming',choices:[['g','Løsner fint'],['y','Litt treg'],['r','Unormalt tung']]}
  };

  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'');return v&&typeof v==='object'?v:fallback}catch{return fallback}}
  function readPre(f){return f?readJson(PRE_KEY(f.label),{}):{}}
  function writePre(f,obj){if(f)localStorage.setItem(PRE_KEY(f.label),JSON.stringify(obj))}
  function localDateString(){const d=new Date(),z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}

  function precheckState(f){
    const v=readPre(f),vals=Object.values(v).filter(x=>['g','y','r'].includes(x)),filled=vals.length;
    if(filled<3)return{level:'neutral',label:'UAVKLART',text:'Svar på minst tre signaler. Oppvarming kan fylles inn etter 10–15 rolige minutter.'};
    const reds=vals.filter(x=>x==='r').length,yellows=vals.filter(x=>x==='y').length;
    if(v.achilles==='r')return{level:'red',label:'RØD',text:'Akilles er verre. Ikke la kalenderen overstyre dette: velg smertefri cross/hvile fremfor løpekvalitet.'};
    if(v.warmup==='r'&&(v.legs!=='g'||v.sleep==='r'||v.achilles==='y'))return{level:'red',label:'RØD',text:'Oppvarmingen bekrefter at kroppen ikke er klar for planlagt kvalitet. Bytt til lett økt eller hvile.'};
    if(reds>=2)return{level:'red',label:'RØD',text:'Flere signaler peker feil vei. Ikke gjennomfør kvalitet bare for å «holde planen».'};
    if(reds>=1||yellows>=2)return{level:'yellow',label:'GUL',text:'Innenfor normal variasjon, men uten margin. Gjør planlagt økt konservativt og legg ikke til ekstra belastning.'};
    return{level:'green',label:'GRØNN',text:'Signalene støtter planen. RunnerBear tolker grønt som «gjennomfør kontrollert» – ikke som tillatelse til bonusfart eller bonusvolum.'};
  }

  function precheckAdvice(f,state){
    if(state.level==='neutral')return state.text;
    if(state.level==='green')return state.text;
    if(state.level==='yellow'){
      if(f?.type==='quality')return'Start rolig. Første drag er kalibrering. Hvis puls, pust eller følelse driver feil vei, kutt volum før du vurderer fart.';
      if(/langtur/i.test(f?.title||''))return'Behold langturen rolig og dropp all progresjon. Kort ned hvis kroppen ikke bedrer seg underveis.';
      return'Hold dette tydelig lett. Målet er å bli bedre rustet til neste kvalitetsøkt.';
    }
    if(f?.type==='race')return'Rødt lys på løpsdag må tolkes etter årsak. Ved sykdomstegn, tydelig skade eller unormal oppvarming: ikke bruk racemålet som tvang.';
    if(f?.type==='quality')return'Ikke gjør terskel/X-element i dag. Velg lett løp, Concept2, Zwift eller hvile etter hva kroppen tåler.';
    return'Gjør dagen lettere enn planlagt. Ved rød Akilles: velg aktivitet uten smerteprovokasjon eller hvile.';
  }

  function ensurePrecheck(){
    const card=$('todayCard');if(!card)return;
    let panel=$('precheckPanel');
    if(!panel){
      panel=document.createElement('section');panel.id='precheckPanel';panel.className='precheck-panel';
      panel.innerHTML=`
        <div class="precheck-top">
          <div><span class="micro">FØR ØKT · TRAFIKKLYS</span><b id="precheckTitle">Dagens signaler</b></div>
          <span id="precheckLight" class="precheck-light neutral">UAVKLART</span>
        </div>
        <p id="precheckSummary">Kombiner flere signaler før du bestemmer belastningen.</p>
        <details id="precheckDetails">
          <summary>30 sek kroppssjekk</summary>
          <div class="precheck-grid" id="precheckGrid"></div>
          <div class="precheck-actions"><button type="button" id="clearPrecheck">Nullstill sjekk</button></div>
        </details>
        <div id="precheckAdvice" class="precheck-advice neutral"></div>`;
      const anchor=card.querySelector('.coach-note');
      if(anchor)anchor.insertAdjacentElement('afterend',panel);else card.appendChild(panel);
      const grid=$('precheckGrid');
      Object.entries(factorMeta).forEach(([factor,m])=>{
        const row=document.createElement('div');row.className='precheck-row';row.dataset.factor=factor;
        row.innerHTML=`<span>${m.label}</span><div>${m.choices.map(([v,l])=>`<button type="button" data-pre-factor="${factor}" data-pre-value="${v}">${l}</button>`).join('')}</div>`;
        grid.appendChild(row);
      });
      grid.querySelectorAll('[data-pre-factor]').forEach(btn=>btn.onclick=()=>{
        const f=nextSession();if(!f)return;
        const obj=readPre(f);obj[btn.dataset.preFactor]=btn.dataset.preValue;writePre(f,obj);renderAll();
      });
      $('clearPrecheck').onclick=()=>{const f=nextSession();if(f)localStorage.removeItem(PRE_KEY(f.label));renderAll()};
    }
  }

  function renderPrecheck(f){
    ensurePrecheck();const panel=$('precheckPanel');if(!panel||!f)return;
    const pureRest=f.type==='rest'&&!/Zwift|Concept2|roing|shakeout/i.test(f.title);
    panel.classList.toggle('hidden',pureRest);
    if(pureRest)return;
    $('precheckTitle').textContent=sameDay(f.date,today)?'Dagens signaler':`Før ${f.label}`;
    const v=readPre(f),state=precheckState(f);
    $('precheckLight').className=`precheck-light ${state.level}`;$('precheckLight').textContent=state.label;
    $('precheckSummary').textContent=state.text;
    const adv=$('precheckAdvice');adv.className=`precheck-advice ${state.level}`;adv.textContent=precheckAdvice(f,state);
    document.querySelectorAll('#precheckGrid [data-pre-factor]').forEach(btn=>{
      btn.classList.toggle('active',v[btn.dataset.preFactor]===btn.dataset.preValue);
      btn.setAttribute('aria-pressed',v[btn.dataset.preFactor]===btn.dataset.preValue?'true':'false');
    });
  }

  const previousCoachBefore=coachBefore;
  coachBefore=function(f){
    const s=precheckState(f);
    if(s.level==='red')return'Rødt trafikklys: planen skal bøyes for kroppen i dag. Ikke press kvalitet gjennom flere negative signaler.';
    if(s.level==='yellow'&&f.type==='quality')return'Gult trafikklys: gjennomfør bare hvis oppvarmingen bedrer bildet. Første drag er kalibrering, ikke bevis.';
    return previousCoachBefore(f);
  };

  const previousRenderToday=renderToday;
  renderToday=function(){previousRenderToday();renderPrecheck(nextSession())};

  function readControls(){
    const rows=readJson(CONTROL_KEY,[]);if(!Array.isArray(rows))return[];
    return rows.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&['mill','road'].includes(x.context)&&paceSec(x.pace)&&Number(x.hr)>=100&&Number(x.hr)<=200&&Number(x.rpe)>=1&&Number(x.rpe)<=10)
      .map(x=>({date:x.date,context:x.context,pace:x.pace.match(/\d:\d{2}/)[0],hr:Number(x.hr),rpe:Number(x.rpe),note:String(x.note||'')}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }
  function writeControls(rows){localStorage.setItem(CONTROL_KEY,JSON.stringify(rows))}
  function contextName(c){return c==='mill'?'Mølle':'Flat ute'}
  function comparablePair(){
    const h=readControls();if(h.length<2)return null;const latest=h[h.length-1],ps=paceSec(latest.pace);
    for(let i=h.length-2;i>=0;i--){const p=h[i];if(p.context===latest.context&&Math.abs(paceSec(p.pace)-ps)<=5)return{latest,prev:p}}
    return{latest,prev:null};
  }
  function controlInsight(){
    const pair=comparablePair();
    if(!pair)return{level:'neutral',title:'Bygg en baseline',text:'Registrer et kontrollpunkt fra en planlagt terskeløkt. Ikke legg inn et ekstra testdrag bare for appens skyld.'};
    if(!pair.prev)return{level:'neutral',title:'Trenger sammenlignbart punkt',text:'Siste punkt har ingen tidligere måling på samme underlag og omtrent samme fart (±5 s/km). Behold det som baseline.'};
    const {latest:l,prev:p}=pair,pd=paceSec(p.pace)-paceSec(l.pace),hd=l.hr-p.hr,rd=l.rpe-p.rpe;
    if((pd>=2&&hd<=1&&rd<=0)||(Math.abs(pd)<=3&&(hd<=-3||(hd<=0&&rd<=-1))))return{level:'green',title:'Mer fart / lavere kostnad',text:`Sammenlignet med ${p.date}: ${hd<0?Math.abs(hd)+' bpm lavere':hd>0?hd+' bpm høyere':'samme puls'} og ${rd<0?Math.abs(rd)+' RPE lavere':rd>0?rd+' RPE høyere':'samme RPE'} ved omtrent samme belastning. Positivt kontrollsignal.`};
    if(hd>=4||rd>=2)return{level:'yellow',title:'Høyere kostnad enn baseline',text:`Sammenlignet med ${p.date} koster omtrent samme fart mer. Ikke jag gamle tall; bruk dette sammen med søvn, kroppsfølelse og neste terskelrespons.`};
    return{level:'neutral',title:'Stabil kontroll',text:`Sammenlignet med ${p.date} er responsen omtrent stabil. Det er nyttig informasjon – ikke et krav om å øke farten.`};
  }

  function ensureControlCard(){
    if($('controlTrendCard'))return;
    const more=$('more'),grid=more?.querySelector('.more-grid');if(!more||!grid)return;
    const card=document.createElement('article');card.id='controlTrendCard';card.className='card control-trend-card';
    card.innerHTML=`
      <div class="kicker"><span>STANDARDISERT KONTROLL</span><span>Bakken-ånd · samme forhold</span></div>
      <div class="control-intro"><b>Høst data fra økten – ikke lag en ny test.</b><span>Bruk et 6–10 min kontrollert segment rundt ca. 4:05/km fra en planlagt terskeløkt, helst samme mølle eller samme flate rute. Registrer snittpuls + RPE.</span></div>
      <div id="controlInsight" class="control-insight neutral"></div>
      <div id="controlList" class="control-list"></div>
      <details class="add-control"><summary>+ Registrer kontrollpunkt</summary>
        <div class="control-form">
          <input id="controlDate" type="date">
          <select id="controlContext"><option value="mill">Mølle</option><option value="road">Flat ute</option></select>
          <input id="controlPace" inputmode="numeric" placeholder="fart 4:05">
          <input id="controlHr" type="number" min="100" max="200" placeholder="snittpuls">
          <input id="controlRpe" type="number" min="1" max="10" step="1" placeholder="RPE 1–10">
          <input id="controlNote" placeholder="valgfri kort note">
          <button type="button" id="addControl">Lagre</button>
        </div>
      </details>
      <p class="control-note">Sammenlignes bare mot samme underlag og omtrent samme fart (±5 s/km). Kontrolltrenden kan støtte coachen, men endrer ikke terskelfart eller Gate-status alene.</p>`;
    grid.insertAdjacentElement('afterend',card);
    $('controlDate').value=localDateString();
    $('addControl').onclick=addControl;
  }

  function addControl(){
    const date=$('controlDate')?.value,context=$('controlContext')?.value,pace=$('controlPace')?.value.trim(),hr=Number($('controlHr')?.value),rpe=Number($('controlRpe')?.value),note=$('controlNote')?.value.trim()||'';
    const ps=paceSec(pace);
    if(!date||!['mill','road'].includes(context)||!ps||ps<210||ps>330||hr<100||hr>200||rpe<1||rpe>10){alert('Fyll inn dato, underlag, fart (f.eks. 4:05), snittpuls og RPE 1–10.');return}
    const rows=readControls();rows.push({date,context,pace:pace.match(/\d:\d{2}/)[0],hr,rpe,note});writeControls(rows);
    $('controlPace').value='';$('controlHr').value='';$('controlRpe').value='';$('controlNote').value='';renderAll();
  }

  function renderControlTrend(){
    ensureControlCard();const box=$('controlInsight'),list=$('controlList');if(!box||!list)return;
    const insight=controlInsight();box.className=`control-insight ${insight.level}`;box.innerHTML=`<b>${insight.title}</b><span>${insight.text}</span>`;
    const h=readControls();list.innerHTML=[...h].reverse().slice(0,8).map((x,i)=>`<div class="control-row"><span>${x.date}</span><b>${x.pace}/km</b><span>${x.hr} bpm</span><span>RPE ${x.rpe}</span><small>${contextName(x.context)}</small><button type="button" data-control-delete="${h.length-1-i}">Slett</button></div>`).join('');
    list.querySelectorAll('[data-control-delete]').forEach(btn=>btn.onclick=()=>{const rows=readControls(),idx=Number(btn.dataset.controlDelete);if(idx>=0&&idx<rows.length){rows.splice(idx,1);writeControls(rows);renderAll()}});
    if($('controlDate')&&!$('controlDate').value)$('controlDate').value=localDateString();
  }

  const previousRenderThreshold=renderThreshold;
  renderThreshold=function(){previousRenderThreshold();renderControlTrend()};

  const previousBuildStatusText=buildStatusText;
  buildStatusText=function(){
    const f=nextSession(),s=precheckState(f),h=readControls(),last=h[h.length-1];
    return previousBuildStatusText()+`\nTrafikklys før neste økt: ${s.label}.`+(last?`\nSiste kontrollpunkt: ${last.date} · ${contextName(last.context)} · ${last.pace}/km · ${last.hr} bpm · RPE ${last.rpe}.`:'\nStandardisert kontroll: ingen datapunkter ennå.');
  };

  ensurePrecheck();ensureControlCard();renderAll();
})();
