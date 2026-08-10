/* RunnerBear v8.2 · Intelligence Dashboard shell
   Pre-integration layer: improves hierarchy now, consumes Tredict automatically later. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch{return f}};
  function latestThreshold(){
    const v7=window.RunnerBearV7?.profile?.();
    if(v7?.thresholdPace||v7?.thresholdHr)return{pace:v7.thresholdPace||'–',hr:v7.thresholdHr||'–',source:'RunnerBear'};
    const rows=read('runfest26_threshold_history',[]);const r=Array.isArray(rows)?rows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1):null;
    return r?{pace:r.pace||'–',hr:r.hr||'–',source:r.source||'Garmin · manuelt'}:{pace:'4:02',hr:175,source:'Garmin · manuelt'};
  }
  function latestVo2(){const rows=read('runfest26_vo2_history',[]);const r=Array.isArray(rows)?rows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1):null;return r?{value:r.value,date:r.date,source:r.source||'Garmin · manuelt'}:null}
  function recovery(){try{return window.RunnerBearTredict?.recoverySignal?.()||null}catch{return null}}
  function coachState(){
    const r=recovery();
    if(r?.level==='red')return{tone:'red',label:'BREMS',title:'Gjør dagen lettere',text:'Flere recovery-signaler avviker. Følg oppvarming og kroppsfølelse; kvalitet skal ikke presses gjennom røde signaler.'};
    if(r?.level==='yellow')return{tone:'yellow',label:'OBS',title:'Planen står – med margin',text:'Ett recovery-signal avviker. Gjennomfør konservativt og kutt heller volum enn å jage fart.'};
    const light=$('coachLight')?.textContent?.trim();
    if(light&&/RØD|REDUSER/i.test(light))return{tone:'red',label:'BREMS',title:'Belastningen justeres',text:$('coachMessage')?.textContent||'RunnerBear velger en mer konservativ dag.'};
    return{tone:'green',label:'PLANEN STÅR',title:'Gjennomfør planlagt',text:'Ingen samlet grunn til å øke eller redusere belastningen. Gode signaler betyr kontrollert gjennomføring – ikke bonusarbeid.'};
  }
  function trend(){
    try{
      const w=currentWeek(),done=flat.filter(f=>f.week===w.n&&isDone(f.label)).length,total=flat.filter(f=>f.week===w.n).length;
      const th=latestThreshold(),vo=latestVo2();
      return{label:done>=Math.max(1,total-2)?'STABIL':'BYGGES',text:`${done}/${total} økter registrert denne uka · terskel ${th.pace}/km${vo?` · VO₂ ${vo.value}`:''}`};
    }catch{return{label:'BYGGES',text:'RunnerBear bygger trend fra faktisk gjennomføring, terskel og respons.'}}
  }
  function ensureDashboard(){
    const today=$('today');if(!today||$('rbIntelDashboard'))return;
    const below=today.querySelector('.below-grid');if(!below)return;
    const sec=document.createElement('section');sec.id='rbIntelDashboard';sec.className='rb-intel-dashboard';
    sec.innerHTML=`<article class="card rb-intel-coach"><div class="kicker"><span>RB COACH · STATUS</span><span id="rbIntelCoachPill" class="status-pill neutral">–</span></div><h2 id="rbIntelCoachTitle">–</h2><p id="rbIntelCoachText">–</p></article><article class="card rb-intel-body"><div class="kicker"><span>KROPP I DAG</span><span id="rbIntelBodySource">klar for Tredict</span></div><div class="rb-intel-body-grid"><div><span>HRV</span><b id="rbIntelHrv">–</b><small id="rbIntelHrvSub">venter på sync</small></div><div><span>SØVN</span><b id="rbIntelSleep">–</b><small id="rbIntelSleepSub">venter på sync</small></div><div><span>HVILEPULS</span><b id="rbIntelRhr">–</b><small id="rbIntelRhrSub">venter på sync</small></div></div></article><article class="card rb-intel-trend"><div class="kicker"><span>TRENINGSTREND · 28 DAGER</span><span id="rbIntelTrendLabel">–</span></div><h3 id="rbIntelTrendText">–</h3><div class="rb-capacity-strip"><div><span>TERSKEL</span><b id="rbIntelThreshold">–</b><small id="rbIntelThresholdSource">–</small></div><div><span>VO₂ MAKS</span><b id="rbIntelVo2">–</b><small id="rbIntelVo2Source">manuell inntil API</small></div></div></article>`;
    below.insertAdjacentElement('beforebegin',sec);
  }
  function renderDashboard(){
    ensureDashboard();if(!$('rbIntelDashboard'))return;
    const c=coachState();$('rbIntelCoachPill').className=`status-pill ${c.tone}`;$('rbIntelCoachPill').textContent=c.label;$('rbIntelCoachTitle').textContent=c.title;$('rbIntelCoachText').textContent=c.text;
    const r=recovery();
    if(r){$('rbIntelBodySource').textContent='Tredict';$('rbIntelHrv').textContent=r.hrv?.value?`${Math.round(r.hrv.value)} ms`:'–';$('rbIntelHrvSub').textContent=r.hrv?.baseline?`baseline ${Math.round(r.hrv.baseline)} ms`:'ingen baseline';const s=r.sleep?.value;$('rbIntelSleep').textContent=s?`${Math.floor(s/3600)} t ${Math.round((s%3600)/60)} min`:'–';$('rbIntelSleepSub').textContent=r.sleep?.baseline?`baseline ${Math.floor(r.sleep.baseline/3600)} t ${Math.round((r.sleep.baseline%3600)/60)} min`:'ingen baseline';$('rbIntelRhr').textContent=r.rhr?.value?`${Math.round(r.rhr.value)} bpm`:'–';$('rbIntelRhrSub').textContent=r.rhr?.baseline?`median ${Math.round(r.rhr.baseline)} bpm`:'ingen baseline';}
    const t=trend();$('rbIntelTrendLabel').textContent=t.label;$('rbIntelTrendText').textContent=t.text;
    const th=latestThreshold(),vo=latestVo2();$('rbIntelThreshold').textContent=`${th.pace}/km · ${th.hr} bpm`;$('rbIntelThresholdSource').textContent=th.source;$('rbIntelVo2').textContent=vo?String(vo.value):'–';$('rbIntelVo2Source').textContent=vo?`${vo.source} · ${vo.date}`:'manuell fallback inntil Tredict/Garmin støtter verdien';
  }
  function relabelCapacity(){
    const card=document.querySelector('.threshold-card');if(!card)return;const k=card.querySelector('.kicker');if(k){const s=k.querySelectorAll('span');if(s[0])s[0].textContent='KAPASITET';if(s[1])s[1].textContent='automatisk når tilgjengelig'}
    const thDetails=card.querySelector('.add-threshold');if(thDetails){const sum=thDetails.querySelector('summary');if(sum)sum.textContent='+ Manuell terskel · fallback'}
    const vo=$('vo2Section');if(vo){const sum=vo.querySelector('.add-vo2 summary');if(sum)sum.textContent='+ Manuell VO₂ maks · fallback';const note=vo.querySelector('.vo2-note');if(note)note.textContent='RunnerBear bruker automatisk verdi hvis integrasjonen leverer den. Inntil da beholdes manuell Garmin-verdi som støtteinformasjon.'}
  }
  function upgradeReview(){
    const card=document.querySelector('.week-review');if(!card)return;card.classList.add('rb-review-intelligence');
    const good=$('reviewGood'),watch=$('reviewWatch'),next=$('reviewNext'),txt=$('reviewText');
    if(txt&&!/helhet/i.test(txt.textContent||''))txt.dataset.rbHolistic='1';
    const r=recovery();if(r?.level==='red'&&watch)watch.textContent='Recovery-signaler avviker. Prioriter kontroll og friskhet før neste kvalitetsøkt.';
    if(r?.level==='green'&&good&&/–/.test(good.textContent||''))good.textContent='Kroppssignalene støtter dagens plan. Stabil gjennomføring er hovedmålet.';
    if(next&&/–/.test(next.textContent||'')){try{const n=nextSession();next.textContent=n?.title||'Neste planlagte nøkkeløkt'}catch{}}
  }
  function render(){renderDashboard();relabelCapacity();upgradeReview();document.documentElement.classList.add('rb-intelligence-v82')}
  const old=window.renderAll;if(typeof old==='function')window.renderAll=function(){const r=old.apply(this,arguments);requestAnimationFrame(render);return r};
  render();
})();