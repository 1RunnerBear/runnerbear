function weekCheck(){return localStorage.getItem(`runfest26_weekcheck_${currentWeek().n}`)||''}
function recentFeedback(n=3){return flat.filter(f=>f.date<=addDays(today,1)).map(f=>({f,fb:getFeedback(f.label)})).filter(x=>Object.keys(x.fb).length).slice(-n)}
function renderCoach(){
 const f=nextSession(),recent=recentFeedback(),check=weekCheck();let level='neutral',head='Bygg rytmen',msg='Registrer RPE og akilles etter nøkkeløktene. Da blir coachen mer presis.';
 if(recent.length){const worse=recent.some(x=>x.fb.achilles==='worse'),hard=recent.some(x=>Number(x.fb.rpe)>=9),yellow=recent.some(x=>Number(x.fb.rpe)>=8);
  if(worse||hard){level='red';head='Avlast før du bygger videre';msg=worse?'Akillesresponsen er viktigere enn kalenderen. Velg lavere støtbelastning og vurder neste morgen.':'En nylig økt kostet for mye. Neste kvalitet skal ikke bli hardere.'}
  else if(check==='heavy'||yellow){level='yellow';head='Hold igjen – ikke mist rytmen';msg='Kropp/RPE peker mot høyere kostnad. Behold intensitetskontrollen og kutt heller volum hvis nødvendig.'}
  else{level='green';head='Planen står';msg='Responsen ser repeterbar ut. Ikke belønn gode bein med ekstra fart.'}
 } else if(check==='heavy'){level='yellow';head='Kroppen er tung';msg='Start uka konservativt. Ingen ekstra belastning før følelsen normaliseres.'}
 $('coachLight').className=`status-pill ${level}`;$('coachLight').textContent=level==='green'?'GRØNN':level==='yellow'?'GUL':level==='red'?'RØD':'UAVKLART';
 $('coachHeadline').textContent=head;$('coachMessage').textContent=msg;$('coachFocus').textContent=coachBefore(f);
}
function thresholdHistory(){
 let extra=[];try{extra=JSON.parse(localStorage.getItem('runfest26_threshold_history')||'[]')}catch{}
 const all=[baselineThreshold,...extra].sort((a,b)=>a.date.localeCompare(b.date));
 return all.filter((x,i)=>i===0||x.date!==all[i-1].date||x.pace!==all[i-1].pace||x.hr!==all[i-1].hr);
}
function greenQualityCount(){return flat.filter(f=>f.type==='quality'&&isDone(f.label)&&evaluateStimulus(f,getFeedback(f.label))?.level==='green').length}
function thresholdTrendInfo(){
 const h=thresholdHistory(),last=h[h.length-1],prev=h[h.length-2]||baselineThreshold;const diff=paceSec(prev.pace)-paceSec(last.pace),hrDiff=last.hr-prev.hr;
 if(h.length<2)return{tone:'neutral',text:'Baseline 9. august. Nye Garmin-verdier legges til her – planen endres ikke automatisk.',diff:0};
 if(diff>=3&&Math.abs(hrDiff)<=3)return{tone:'green',text:`Positiv trend: ${diff} sek/km raskere med terskelpuls omtrent på samme nivå.`,diff};
 if(diff<=-3)return{tone:'yellow',text:`Terskelfarten er ${Math.abs(diff)} sek/km svakere enn forrige registrering. Ikke jag gamle fartstall – bruk kontrollert intensitet.`,diff};
 return{tone:'neutral',text:'Endringen er liten eller terskelpulsen har samtidig flyttet seg. Behandle dette som informasjon, ikke som et nytt treningskrav.',diff};
}
function thresholdProposalInfo(){
 const h=thresholdHistory(),tr=thresholdTrendInfo(),last=h[h.length-1],prev=h[h.length-2]||baselineThreshold;
 const confirmed=greenQualityCount()>0;
 if(h.length<2)return{ok:false,text:'Ingen fartsendring foreslås før Garmin faktisk flytter terskelen.'};
 if(tr.diff>=5&&Math.abs(last.hr-prev.hr)<=3&&confirmed){const shift=-Math.min(3,Math.max(2,Math.round(tr.diff/2)));return{ok:true,shift,text:`Coach-forslag: flytt kun lange subterskeldrag ${Math.abs(shift)} sek/km raskere. Korte drag, Gate-tester og racefart forblir uendret.`}}
 if(tr.diff>=3&&!confirmed)return{ok:false,text:'Positiv Garmin-endring, men RunnerBear venter på minst én kontrollert kvalitetsøkt før fart kan foreslås endret.'};
 return{ok:false,text:'Behold dagens treningsfarter. Bakken-prinsippet prioriterer bekreftet respons fremfor små estimatendringer.'};
}
function evidence(){
 const pastRuns=flat.filter(f=>f.km>0&&f.date<=today).slice(-10),done=pastRuns.filter(f=>isDone(f.label)).length,cont=pastRuns.length?done/pastRuns.length:null;
 const tr=thresholdTrendInfo(),g1=gateVal(1),g2=gateVal(2),recent=recentFeedback(4),achWorse=recent.some(x=>x.fb.achilles==='worse'),achKnown=recent.some(x=>x.fb.achilles);
 const hm=flat.find(f=>/HM-spesifikk/i.test(f.title)),hmStim=hm&&isDone(hm.label)?evaluateStimulus(hm,getFeedback(hm.label)):null;
 return[
  {name:'Kontinuitet',state:cont==null?'neutral':cont>=.85?'green':cont>=.7?'yellow':'red',text:cont==null?'Planen har ikke startet ennå.':`${done}/${pastRuns.length} siste planlagte løpeøkter.`},
  {name:'Terskeltrend',state:tr.diff>=3?'green':'neutral',text:tr.diff>=3?tr.text:'Baseline er 4:02/km · 175 bpm.'},
  {name:'Gate 1',state:g1||'neutral',text:g1?({green:'Kontrollert.',yellow:'Måtte jobbe.',red:'For hardt.'}[g1]):'Venter på 11. september.'},
  {name:'Gate 2',state:g2||'neutral',text:g2?({green:'1:23 kvalifisert.',yellow:'Nær, men ikke klart grønt.',red:'3:56/km skal ikke tvinges.'}[g2]):'Venter på 18. september.'},
  {name:'Akilles',state:achWorse?'red':achKnown?'green':'neutral',text:achWorse?'Nylig verre respons.':achKnown?'Siste registreringer er stabile/bedre.':'Trenger feedback.'},
  {name:'HM-spesifikk',state:hmStim?.level||'neutral',text:hmStim?hmStim.text:'2 × 3 km kommer 25. september.'}
 ];
}
function readiness(){
 const ev=evidence(),g1=gateVal(1),g2=gateVal(2),greens=greenQualityCount(),tr=thresholdTrendInfo();
 let stage=1,name='BYGGES',text='1:23 er et A-mål, men er ikke dokumentert nå.';
 if(g2==='green'){stage=5;name='KVALIFISERT';text='Gate 2 ga kontrollert respons. 1:23 kan brukes som A-mål – fortsatt med kontrollert åpning.'}
 else if(g2==='yellow'){stage=4;name='NÆR';text='Kapasiteten er nær, men 3:56/km er ikke et klart grønt valg ennå.'}
 else if(g1==='green'){stage=3;name='NÆRMER SEG';text='Gate 1 er grønn. Neste store bevis er Gate 2.'}
 else if(greens>=2||tr.diff>=3){stage=2;name='PÅ VEI';text='Treningsresponsen beveger seg riktig vei. Fortsett å bygge bevis.'}
 if(g2==='red'){stage=2;name='IKKE KVALIFISERT';text='Gate 2 var for hard. Raceplanen skal justeres ned fremfor å tvinge 3:56/km.'}
 return{stage,name,text,ev};
}
function renderReadiness(){
 const r=readiness();$('readinessStage').textContent=r.name;$('readinessText').textContent=r.text;$('roadFill').style.width=`${[8,28,53,77,100][r.stage-1]}%`;
 $('evidenceList').innerHTML=r.ev.map(e=>`<div class="evidence"><span class="icon">${e.state==='green'?'✓':e.state==='yellow'?'△':e.state==='red'?'!':'○'}</span><b>${e.name}</b><span>${e.text}</span></div>`).join('');
 $('evidenceSummary').textContent=r.name;$('showEvidence').onclick=()=>switchTab('race',true);
}
function renderWeekStrip(){
 const w=currentWeek(),wd=flat.filter(f=>f.week===w.n),km=wd.filter(f=>isDone(f.label)).reduce((a,f)=>a+f.km,0);$('weekKmTop').textContent=`${km.toFixed(1).replace('.0','')} / ${w.km} km`;
 $('weekStrip').innerHTML=wd.map(f=>`<div class="week-mini ${sameDay(f.date,today)?'today':''} ${isDone(f.label)?'done':''}"><span>${f.label.split(' ')[0]} · ${f.km?f.km+' km':classLabel[f.type]}</span><b>${f.title}</b></div>`).join('');
}
function renderCheckin(){
 const v=weekCheck();document.querySelectorAll('[data-check]').forEach(b=>b.classList.toggle('active',b.dataset.check===v));
 $('checkinHint').textContent=v==='fresh'?'Registrert: kroppen kjennes frisk.':v==='tired'?'Registrert: litt sliten. Coachen blir mer konservativ med ekstra belastning.':v==='heavy'?'Registrert: tung. Ikke legg til trening og vurder «Tilpass dagen» på kvalitet.':'Ett svar i uka er nok. Dette erstatter ikke Garmin-data – det fanger hvordan du faktisk føler deg.';
}
function renderReview(){
 const w=currentWeek(),wd=flat.filter(f=>f.week===w.n),done=wd.filter(f=>isDone(f.label)),km=done.reduce((a,f)=>a+f.km,0),qs=wd.filter(f=>f.type==='quality'&&isDone(f.label)).map(f=>({f,s:evaluateStimulus(f,getFeedback(f.label))})),bad=qs.some(x=>x.s?.level==='red'),yellow=qs.some(x=>x.s?.level==='yellow'),check=weekCheck(),worse=wd.some(f=>getFeedback(f.label).achilles==='worse');
 let head='Bygg uka med kontroll',text=`${km.toFixed(1).replace('.0','')} av ${w.km} km er registrert.`,good='Kontinuitet',watch='Respons etter kvalitet',next=nextSession().title;
 if(done.length===0){text='Ingen økter registrert ennå. Første mål er rytme, ikke fart.';good='Planen er tydelig';watch='Ikke start for hardt'}
 else if(worse||bad){head='Kostnaden er for høy';text+=' Minst ett signal sier at planen må håndteres mer konservativt.';good='Du registrerer ærlig';watch=worse?'Akilles neste morgen':'RPE / intensitet'}
 else if(check==='heavy'||yellow){head='Godt arbeid – behold kontroll';text+=' Belastningen er merkbar. Ikke legg på ekstra volum eller fart.';good='Du holder strukturen';watch='Total friskhet'}
 else if(qs.some(x=>x.s?.level==='green')){head='Godkjent uke så langt';text+=' Kvalitetsarbeidet ser repeterbart ut.';good='Stimulus treffer';watch='Ikke belønn dette med mer fart'}
 $('reviewWeek').textContent=`Uke ${w.n}`;$('reviewHeadline').textContent=head;$('reviewText').textContent=text;$('reviewGood').textContent=good;$('reviewWatch').textContent=watch;$('reviewNext').textContent=next;
}
