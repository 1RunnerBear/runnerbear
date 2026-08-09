/* RunnerBear v5.7 · performance trend
   VO2 max is recorded as a secondary Garmin trend. It never changes training pace,
   readiness gates or race targets on its own. Threshold control remains primary. */
(function(){
  const VO2_KEY='runfest26_vo2_history';

  function readVo2(){
    let rows=[];
    try{rows=JSON.parse(localStorage.getItem(VO2_KEY)||'[]')}catch{}
    return (Array.isArray(rows)?rows:[])
      .filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number(x.value)>=30&&Number(x.value)<=90)
      .map(x=>({date:x.date,value:Number(x.value),source:x.source||'Garmin'}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }
  function writeVo2(rows){localStorage.setItem(VO2_KEY,JSON.stringify(rows))}
  function numberFmt(v){return Number.isInteger(v)?String(v):v.toFixed(1)}
  function vo2Delta(){
    const h=readVo2();if(h.length<2)return null;
    return +(h[h.length-1].value-h[h.length-2].value).toFixed(1);
  }
  function ensureVo2Panel(){
    const card=document.querySelector('.threshold-card');if(!card)return;
    const k=card.querySelector('.kicker');
    if(k){const s=k.querySelectorAll('span');if(s[0])s[0].textContent='FORMTREND';if(s[1])s[1].textContent='terskel + VO₂ maks'}
    if(document.getElementById('vo2Section'))return;
    card.insertAdjacentHTML('beforeend',`
      <section class="vo2-section" id="vo2Section">
        <div class="metric-divider"></div>
        <div class="kicker metric-kicker"><span>VO₂ MAKS</span><span>Garmin · sekundær trend</span></div>
        <div class="vo2-headline"><strong id="vo2Current">–</strong><span id="vo2Delta">Ingen historikk ennå</span></div>
        <div id="formTrendInsight" class="form-trend-insight">VO₂ maks er støtteinformasjon. Terskelrespons og kontroll veier tyngre i RunnerBear.</div>
        <div id="vo2List" class="vo2-list"></div>
        <details class="add-vo2"><summary>+ Registrer Garmin VO₂ maks</summary>
          <div class="vo2-form"><input id="vo2Date" type="date"><input id="vo2Value" type="number" min="30" max="90" step="0.1" inputmode="decimal" placeholder="f.eks. 57"><button type="button" id="addVo2">Lagre</button></div>
        </details>
        <p class="vo2-note">Bruk trend over tid – ikke én enkelt måling. VO₂ maks endrer ikke treningsfart, Gate-status eller racemål alene.</p>
      </section>`);
    const d=document.getElementById('vo2Date');if(d)d.value=new Date().toISOString().slice(0,10);
    document.getElementById('addVo2').onclick=addVo2;
  }
  function formInsight(){
    const vd=vo2Delta(),tr=typeof thresholdTrendInfo==='function'?thresholdTrendInfo():{diff:0};
    const td=Number(tr.diff||0);
    if(td>=3&&vd!=null&&vd>=1)return'Begge trendene peker opp. RunnerBear lar likevel terskelfart og kontroll være hovedsignalet for halvmaratonformen.';
    if(td>=3)return'Terskelfarten beveger seg riktig vei. Det er et sterkere halvmaratonsignal enn at VO₂ maks nødvendigvis må øke.';
    if(vd!=null&&vd>=1)return'VO₂ maks peker opp. Bra støtte, men vent på terskeløkter og Gate-signaler før trenings- eller racemål endres.';
    if(vd!=null&&vd<=-1&&td>=0)return'VO₂ maks har falt litt, men ikke overtolk enkeltmålinger. Behold fokus på kontrollert terskel og faktisk treningsrespons.';
    if(vd!=null&&vd<=-1&&td<0)return'Begge trendene er svakere akkurat nå. Ikke jag gamle tall; hold intensiteten kontrollert og se etter flere datapunkter.';
    return'VO₂ maks er støtteinformasjon. Terskelrespons, RPE, puls og kontroll veier tyngre i RunnerBear.';
  }
  function renderVo2(){
    ensureVo2Panel();
    const h=readVo2(),current=document.getElementById('vo2Current'),delta=document.getElementById('vo2Delta'),list=document.getElementById('vo2List');
    if(!current||!delta||!list)return;
    if(!h.length){current.textContent='–';delta.textContent='Ingen historikk ennå';list.innerHTML='';}
    else{
      current.textContent=numberFmt(h[h.length-1].value);
      const d=vo2Delta();
      delta.textContent=d==null?'Baseline registrert':d>0?`↑ +${numberFmt(d)} siden sist`:d<0?`↓ ${numberFmt(d)} siden sist`:'→ uendret siden sist';
      list.innerHTML=[...h].reverse().slice(0,8).map((x,i)=>`<div class="vo2-row"><span>${x.date}</span><b>${numberFmt(x.value)}</b><button type="button" data-vo2-delete="${h.length-1-i}" aria-label="Slett VO₂ maks ${x.value} fra ${x.date}">Slett</button></div>`).join('');
      list.querySelectorAll('[data-vo2-delete]').forEach(btn=>btn.onclick=()=>{const rows=readVo2(),idx=Number(btn.dataset.vo2Delete);if(idx>=0&&idx<rows.length){rows.splice(idx,1);writeVo2(rows);renderAll()}});
    }
    const insight=document.getElementById('formTrendInsight');if(insight)insight.textContent=formInsight();
    const date=document.getElementById('vo2Date');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
  }
  function addVo2(){
    const date=document.getElementById('vo2Date')?.value,value=Number(document.getElementById('vo2Value')?.value);
    if(!date||!Number.isFinite(value)||value<30||value>90){alert('Fyll inn dato og Garmin VO₂ maks mellom 30 og 90.');return}
    const rows=readVo2();
    const same=rows.findIndex(x=>x.date===date);
    const item={date,value:+value.toFixed(1),source:'Garmin'};
    if(same>=0)rows[same]=item;else rows.push(item);
    writeVo2(rows);
    const input=document.getElementById('vo2Value');if(input)input.value='';
    renderAll();
  }

  const baseRenderThreshold=renderThreshold;
  renderThreshold=function(){baseRenderThreshold();ensureVo2Panel();renderVo2()};

  const baseBuildStatusText=buildStatusText;
  buildStatusText=function(){
    const h=readVo2(),last=h[h.length-1];
    return baseBuildStatusText()+(last?`\nVO₂ maks (Garmin): ${numberFmt(last.value)} · ${last.date}.`:'\nVO₂ maks (Garmin): ikke registrert.');
  };

  ensureVo2Panel();
  renderAll();
})();
