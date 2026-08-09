/* RunnerBear · Bakken Coach
   Regelbasert coach inspirert av prinsippene i planen: kontroll, repeterbarhet og riktig belastning.
   Ingen etterligning av Marius Bakken som person. */
(function(){
  function pct(n,d){ return d ? Math.round(n/d*100) : 0; }
  function qualityEntriesForWeek(w){
    return flat.filter(f=>f.week===w.n && f.type==='quality' && isDone(f.raw[0]));
  }
  function feedbackEntriesForWeek(w){
    return flat.filter(f=>f.week===w.n).map(f=>({f,fb:getFeedback(f.raw[0])})).filter(x=>Object.keys(x.fb).length);
  }
  function parsePace(v){
    if(!v) return null;
    const m=String(v).match(/(\d+):([0-5]\d)/);
    return m ? Number(m[1])*60 + Number(m[2]) : null;
  }
  function achillesText(v){return ({better:'bedre',same:'stabil',worse:'verre'})[v]||'ikke registrert';}
  function nextCoachMessage(){
    const n=nextSession();
    const recent=[...flat].reverse().map(f=>({f,fb:getFeedback(f.raw[0])})).find(x=>Object.keys(x.fb).length);
    const worse=recent && recent.fb.achilles==='worse';
    if(worse) return {tone:'red',title:'Akilles først',text:'Siste respons var verre. Ikke vinn dagens økt. Ved festesmerte eller økt morgenstivhet: velg lett Zwift eller roligere belastning og vurder på nytt i morgen.'};
    if(n.type==='quality'){
      if(/GATE 2/i.test(n.title)) return {tone:'gold',title:'Test – ikke eksamen',text:'Gate 2 skal vise om 3:56/km er kontrollert nok til halvmaraton. Åpne disiplinert. Et grønt resultat er verdifullt; et gult resultat er også nyttig informasjon.'};
      if(/GATE 1/i.test(n.title)) return {tone:'gold',title:'Kontroll er svaret',text:'Målet er ikke å bevise 1:23 i dag. Jevn fart, stabil puls og følelsen av at du kunne tatt ett drag til er et bedre resultat enn en rask avslutning.'};
      if(/45\/15|400|X-element/i.test(n.title)) return {tone:'orange',title:'Flyt før fart',text:'Korte drag tåler høyere fart, men økten skal fortsatt være repeterbar. Ikke bruk de siste dragene til å gjøre en kontrollert økt om til en test.'};
      return {tone:'green',title:'Bygg terskel – ikke ego',text:'Start et hakk roligere enn du føler du kan. Hvis puls, pust og steg fortsatt er stabile sent i økten, får farten komme til deg.'};
    }
    if(n.type==='easy') return {tone:'blue',title:'Rolig betyr produktivt',text:'Dagens jobb er å absorbere kvaliteten. Hold steget avslappet og pulsen lav nok til at du bygger morgendagens kapasitet, ikke dagens Strava-tall.'};
    if(n.type==='cross') return {tone:'purple',title:'Aerob bonus uten støt',text:'Hold sykkel/roing lett nok til at beina er bedre etterpå. Kryss-treningen skal støtte løpingen, ikke konkurrere med den.'};
    if(n.type==='rest') return {tone:'purple',title:'Hvile er en del av blokken',text:'Ikke kompenser for en planlagt hviledag. Friskhet er en treningsvariabel, særlig når akillesen også skal tåle neste kvalitetsøkt.'};
    if(n.type==='race') return {tone:'gold',title:'Nå handler det om utførelse',text:'Første 2–3 km skal føles nesten for enkle. Du taper lite på kontrollert åpning og kan tape mye på å løpe første del som om løpet er 10 km.'};
    return {tone:'green',title:'Hold kurs',text:'Gjennomfør planen slik den står. Kontinuitet slår enkeltøkter.'};
  }
  function weekReview(){
    const w=currentWeek();
    const wd=flat.filter(f=>f.week===w.n);
    const completed=wd.filter(f=>isDone(f.raw[0]));
    const completedRuns=completed.filter(f=>f.km>0);
    const km=completed.reduce((a,f)=>a+f.km,0);
    const q=qualityEntriesForWeek(w);
    const fbs=feedbackEntriesForWeek(w);
    const rpes=fbs.map(x=>Number(x.fb.rpe)).filter(Boolean);
    const avgRpe=rpes.length ? (rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1) : null;
    const worse=fbs.some(x=>x.fb.achilles==='worse');
    const stable=fbs.filter(x=>x.fb.achilles==='same'||x.fb.achilles==='better').length;
    const todayIdx=wd.findIndex(f=>sameDay(f.date,today));
    const due=todayIdx>=0 ? wd.slice(0,todayIdx+1) : (today>wd[wd.length-1].date?wd:[]);
    const dueDone=due.filter(f=>isDone(f.raw[0])).length;
    const adherence=pct(dueDone,due.length);
    let verdict='Uken bygges',tone='neutral',review='Hold deg til planen og registrer respons etter kvalitet/langtur. Da blir vurderingen mer presis.';
    if(due.length){
      if(worse){verdict='Juster belastningen',tone='red';review='Akillesresponsen veier tyngst akkurat nå. Behold den aerobe rytmen, men fjern unødvendig løpsstøt til responsen er tilbake på normalen.';}
      else if(rpes.some(r=>r>=8)){verdict='Kontroll før progresjon',tone='yellow';review='Minst én økt har kostet mer enn ønskelig. Neste steg er ikke mer fart; neste steg er å få samme kvalitet til lavere kostnad.';}
      else if(adherence>=85 && (stable>0 || !fbs.length)){verdict='Godkjent – hold kurs',tone='green';review='Kontinuiteten er god og registrert respons er stabil. Ikke belønn en god uke med å gjøre neste uke hardere enn planen allerede tilsier.';}
      else if(adherence<70){verdict='Ingen panikk – prioriter nøkkeløktene',tone='yellow';review='Noe av planen har falt bort. Ikke jag tapte kilometer. Prioriter neste nøkkeløkt og la totalbelastningen finne rytmen igjen.';}
    }
    const nextKey=flat.find(f=>f.week===Math.min(8,w.n+1) && f.type==='quality') || nextSession();
    return {w,km,q,avgRpe,verdict,tone,review,focus:nextKey?nextKey.title:'Runfest',completedRuns:completedRuns.length};
  }
  function readiness(){
    const g1=gateVal(1),g2=gateVal(2);
    const qualityDone=flat.filter(f=>f.type==='quality'&&isDone(f.raw[0])).length;
    const fb=flat.map(f=>({f,fb:getFeedback(f.raw[0])})).filter(x=>x.f.type==='quality'&&Object.keys(x.fb).length);
    const good=fb.filter(x=>Number(x.fb.rpe)>0 && Number(x.fb.rpe)<=6 && x.fb.achilles!=='worse').length;
    let level=1,label='BYGGES',text='1:23 er et A-mål, men er ikke dokumentert av dagens Garmin-terskel alene.';
    if(qualityDone>=3 || good>=2){level=2;label='PÅ VEI';text='Kontinuiteten begynner å bygge et bedre grunnlag. Vi trenger fortsatt spesifikk bekreftelse.';}
    if(g1==='green'){level=3;label='NÆRMER SEG';text='Gate 1 var kontrollert. Det styrker caset, men Gate 2 er fortsatt nøkkeltesten.';}
    if(g1==='yellow'){level=Math.max(level,2);label='PÅ VEI';text='Gate 1 ga nyttig, men ikke tydelig grønn informasjon. Ikke øk treningsfarten for å tvinge fram svaret.';}
    if(g1==='red'){level=1;label='MÅ BYGGES';text='Gate 1 kostet for mye. Behold 1:23 som ambisjon, men tren etter dagens kapasitet.';}
    if(g2==='yellow'){level=3;label='NÆR – IKKE LÅST';text='Gate 2 var nesten der. Raceplan bør foreløpig lene mot 1:24 og åpne for progresjon.';}
    if(g2==='red'){level=2;label='IKKE KVALIFISERT';text='Gate 2 var for hard. 3:56/km skal ikke tvinges på løpsdagen.';}
    if(g2==='green'){level=5;label='KVALIFISERT';text='Gate 2 var kontrollert. 1:23 kan brukes som A-mål, fortsatt med kontrollert åpning.';}
    return {level,label,text};
  }
  function coachSummaryLine(){
    const r=weekReview(),rd=readiness(),msg=nextCoachMessage();
    return `Bakken Coach: ${r.verdict}. 1:23 readiness: ${rd.label}. Dagens fokus: ${msg.title}.`;
  }
  function renderBakkenCoach(){
    const host=document.getElementById('coachPlus');
    if(!host) return;
    const msg=nextCoachMessage(),r=weekReview(),rd=readiness();
    const blocks=Array.from({length:5},(_,i)=>`<i class="readySeg ${i<rd.level?'on':''}"></i>`).join('');
    host.innerHTML=`
      <div class="coachHero coach-${msg.tone}">
        <div class="micro">Bakken Coach · AI-inspirert</div>
        <h2>${msg.title}</h2>
        <p>${msg.text}</p>
      </div>
      <div class="coachGrid">
        <div class="coachMini">
          <div class="micro">Uke ${r.w.n} · coach review</div>
          <h3>${r.verdict}</h3>
          <p>${r.review}</p>
          <div class="coachStats"><span>${r.km.toFixed(1).replace('.0','')} / ${r.w.km} km</span><span>${r.q.length} kvalitet</span><span>${r.avgRpe?'RPE '+r.avgRpe:'RPE –'}</span></div>
          <div class="coachFocus"><b>Neste fokus:</b> ${r.focus}</div>
        </div>
        <div class="coachMini readinessBox">
          <div class="micro">1:23 readiness</div>
          <h3>${rd.label}</h3>
          <div class="readyBar">${blocks}</div>
          <p>${rd.text}</p>
          <div class="readinessNote">5/5 betyr «kvalifisert av Gate 2» – ikke en sannsynlighetsprosent.</div>
        </div>
      </div>`;
    const base=document.getElementById('coachText');
    if(base){ base.textContent=coachSummaryLine(); }
  }
  function install(){
    const dash=document.getElementById('dash');
    if(!dash) return;
    if(!document.getElementById('coachPlus')){
      const host=document.createElement('div');
      host.id='coachPlus';host.className='coachPlus';
      const firstGrid=dash.querySelector('.grid2');
      if(firstGrid) firstGrid.insertAdjacentElement('afterend',host); else dash.prepend(host);
    }
    if(typeof renderDashboard==='function' && !renderDashboard.__coachWrapped){
      const original=renderDashboard;
      const wrapped=function(){original();setTimeout(renderBakkenCoach,0)};
      wrapped.__coachWrapped=true;
      renderDashboard=wrapped;
    }
    renderBakkenCoach();
    document.addEventListener('change',e=>{
      if(e.target.closest('.feedbackGrid') || e.target.id==='gate1' || e.target.id==='gate2' || e.target.matches('.checkline input')) setTimeout(renderBakkenCoach,0);
    });
  }
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',install); else install();
})();