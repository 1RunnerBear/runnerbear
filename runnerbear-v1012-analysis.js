/* RunnerBear v10.12 · structured workout and trustworthy session analysis
   Pure, testable rules. The Bakken plan remains the source of the prescription. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1012=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.12';
  const roundHalf=n=>Math.round(Number(n||0)*2)/2;
  const decimal=n=>Number(n||0).toFixed(1).replace('.0','').replace('.',',');
  const paceSeconds=value=>{const m=String(value||'').match(/(\d):([0-5]\d)/);return m?Number(m[1])*60+Number(m[2]):0};
  const paceLabel=seconds=>{seconds=Math.max(0,Math.round(Number(seconds)||0));return seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'–'};
  const durationLabel=seconds=>{seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`};
  const activityKind=a=>{
    const sport=String(a?.sportType||'').toLowerCase(),sub=String(a?.subSportType||'').toLowerCase(),title=String(a?.title||'').toLowerCase();
    if(sport==='running')return'run';
    if(sport==='cycling')return'bike';
    if(sport==='rowing'||/rowing|rowerg|concept2|roing/.test(`${sub} ${title}`))return'row';
    if(sport==='misc'&&/generic/.test(sub)&&Number(a?.duration)>=900&&Number(a?.distance)>=2000&&Number(a?.power)>0)return'row';
    return'other';
  };

  function intervalSpec(plan={}){
    const title=String(plan.title||''),detail=`${plan.desc||''} ${plan.detail||''}`;
    if(/45\s*\/\s*15/i.test(title)){
      const factors=[...title.matchAll(/(\d+)\s*[×x]/gi)].map(x=>Number(x[1]));
      const series=factors.length>1?factors[0]:1,repsPerSeries=factors.length>1?factors.slice(1).reduce((a,b)=>a*b,1):(factors[0]||0);
      return{mode:'45/15',count:series*repsPerSeries,series,repsPerSeries,workSeconds:45,recoverySeconds:15,seriesRecoverySeconds:series>1?recoverySeconds(detail):0};
    }
    let m=title.match(/(\d+)\s*[×x]\s*(\d+)\s*min/i);
    if(m)return{mode:'time',count:Number(m[1]),workSeconds:Number(m[2])*60,recoverySeconds:recoverySeconds(detail)};
    m=title.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*km/i);
    if(m)return{mode:'distance',count:Number(m[1]),workDistanceM:Number(m[2].replace(',','.'))*1000,recoverySeconds:recoverySeconds(detail)};
    m=title.match(/(\d+)\s*[×x]\s*(\d+)\s*m\b/i);
    if(m){
      const seconds=detail.match(/(\d+)\s*[–-]\s*(\d+)\s*s\s*\/\s*400/i);
      return{mode:'distance',count:Number(m[1]),workDistanceM:Number(m[2]),workSeconds:seconds?(Number(seconds[1])+Number(seconds[2]))/2:0,recoverySeconds:recoverySeconds(detail)};
    }
    return{mode:'continuous',count:0,workSeconds:0,recoverySeconds:recoverySeconds(detail)};
  }
  function recoverySeconds(text=''){
    const m=String(text).match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?(s|min)\s*(?:rolig\s*)?(?:jogg|pause|hvile|mellom)/i);
    if(!m)return 0;const value=m[2]?(Number(m[1])+Number(m[2]))/2:Number(m[1]);return Math.round(value*(m[3].toLowerCase()==='min'?60:1));
  }
  function targetPace(text=''){
    const rows=[...String(text).matchAll(/(\d:[0-5]\d)\s*[–-]\s*(\d:[0-5]\d)(?:\s*\/\s*km)?/gi)].filter(m=>paceSeconds(m[1])>=150&&paceSeconds(m[2])>=150).map(m=>`${m[1]}–${m[2]}`);
    const label=[...new Set(rows)].join(' → ');return label?`${label}/km`:'';
  }
  function targetHr(text=''){
    const m=String(text).match(/(?:puls|HR)[^\d]{0,30}(\d{3})\s*[–-]\s*(\d{3})/i);
    return m?`${m[1]}–${m[2]} bpm`:'';
  }
  function totalRange(plan={}){
    const km=Number(plan.km||0);if(!km)return{low:0,high:0,label:'Fleksibel total'};
    if(plan.type==='quality')return{low:Math.max(1,roundHalf(km-1)),high:roundHalf(km+1),label:`ca. ${decimal(Math.max(1,roundHalf(km-1)))}–${decimal(roundHalf(km+1))} km`};
    if(plan.type==='race')return{low:roundHalf(km*.98),high:roundHalf(km*1.02),label:`ca. ${decimal(km)} km`};
    return{low:roundHalf(km*.9),high:roundHalf(km*1.1),label:`ca. ${decimal(roundHalf(km*.9))}–${decimal(roundHalf(km*1.1))} km`};
  }
  function structuredWorkout(plan={}){
    const spec=intervalSpec(plan),text=`${plan.detail||''} ${plan.desc||''}`,total=totalRange(plan),quality=plan.type==='quality';
    const recovery=spec.mode==='45/15'?(spec.seriesRecoverySeconds?`15 s jogg mellom dragene · ${durationLabel(spec.seriesRecoverySeconds)} rolig jogg mellom seriene`:'15 s jogg mellom dragene · kontinuerlig serie'):spec.recoverySeconds?`${durationLabel(spec.recoverySeconds)} rolig jogg mellom dragene`:'';
    return{
      build:BUILD,
      family:workoutFamily(plan),
      mainLabel:quality?String(plan.title||'Kontrollert kvalitetsarbeid'):String(plan.title||plan.desc||'Planlagt økt'),
      mainMetricLabel:quality?'Hoveddel':Number(plan.km||0)>0?'Distanse':'Varighet',
      expectedIntervals:spec.count,
      expectedWorkSeconds:spec.count&&spec.workSeconds?spec.count*spec.workSeconds:0,
      interval:spec,
      recoveryLabel:recovery,
      warmup:'Åpen oppvarming · 10–15 min rolig, fortsett ved behov',
      cooldown:'Åpen nedjogg · 10–15 min svært rolig',
      total,
      paceLabel:targetPace(text)||(plan.type==='easy'?'Rolig':quality?'Kontrollert':'Lett'),
      hrLabel:targetHr(text)||(plan.type==='easy'?'130–148 bpm':quality?'Under terskel':'Lav kostnad')
    };
  }
  function workoutFamily(plan={},kind=''){
    const title=String(plan.title||'').toLowerCase().replace(/gate\s*\d+\s*·?\s*/g,'').trim(),spec=intervalSpec(plan),sport=kind||String(plan.activityKind||'');
    if(plan.flexible||plan.type==='cross')return`aerobic:${sport||'flex'}`;
    if(plan.type==='quality'){
      if(spec.mode==='45/15')return`quality:45/15:${spec.series}x${spec.repsPerSeries}`;
      if(spec.mode==='time')return`quality:time:${spec.count}x${spec.workSeconds}`;
      if(spec.mode==='distance')return`quality:distance:${spec.count}x${spec.workDistanceM||spec.workSeconds}`;
      return`quality:${title}`;
    }
    if(plan.type==='easy')return /langtur/.test(title)?'easy:long':/stride/.test(title)?'easy:strides':'easy:plain';
    if(plan.type==='race')return`race:${Number(plan.km||0).toFixed(1)}`;
    return`${plan.type||'other'}:${title}`;
  }
  function blockFit(model,blocks=[]){
    const expected=Number(model.expectedIntervals||0),seconds=Number(model.interval?.workSeconds||0);
    if(!expected)return{confirmed:0,extras:blocks.length,matching:blocks};
    const matching=seconds?blocks.filter(b=>Number(b?.duration)>=seconds*.62&&Number(b?.duration)<=seconds*1.5):blocks.slice();
    return{confirmed:Math.min(expected,matching.length),extras:Math.max(0,blocks.length-Math.min(expected,matching.length)),matching};
  }
  function confidenceFor(plan,activity,model=structuredWorkout(plan),matchConfidence='high'){
    const work=activity?.detail?.analysis||{},blocks=Array.isArray(work.workBlocks)?work.workBlocks:[],fit=blockFit(model,blocks),kind=activityKind(activity);
    if(plan?.type==='quality'){
      if(!blocks.length)return{code:'limited',label:'Begrenset',copy:'Arbeidsdelen kan ikke skilles sikkert fra oppvarming og nedjogg.',...fit};
      const metrics=Number(work.workPace)>0&&Number(work.workHr)>0,sourceHigh=work.confidence==='high',enough=model.expectedIntervals?fit.confirmed>=model.expectedIntervals:blocks.length>=3;
      if(sourceHigh&&metrics&&enough&&matchConfidence==='high')return{code:'high',label:'Høy',copy:'Planmatch, arbeidsdrag, fart og puls er tydelig identifisert.',...fit};
      if(metrics&&(fit.confirmed||blocks.length)>=Math.max(1,Math.ceil((model.expectedIntervals||blocks.length)*.7)))return{code:'adequate',label:'Tilstrekkelig',copy:'Arbeidsdelen er brukbar, men minst ett signal har lavere sikkerhet.',...fit};
      return{code:'limited',label:'Begrenset',copy:'Noe kvalitetsarbeid er registrert, men arbeidsdelen er ikke sikker nok til en sterk konklusjon.',...fit};
    }
    if(kind==='row'||kind==='bike')return Number(activity?.duration)>0&&(Number(activity?.heartrate)>0||Number(activity?.power)>0)?{code:'adequate',label:'Tilstrekkelig',copy:'Varighet og aerob belastning er registrert.',...fit}:{code:'limited',label:'Begrenset',copy:'Alternativøkten mangler puls eller effekt.',...fit};
    if(Number(activity?.distance)>0&&Number(activity?.duration)>0)return{code:Number(activity?.heartrate)>0?'high':'adequate',label:Number(activity?.heartrate)>0?'Høy':'Tilstrekkelig',copy:Number(activity?.heartrate)>0?'Distanse, tid og puls er registrert.':'Distanse og tid er registrert, men puls mangler.',...fit};
    return{code:'limited',label:'Begrenset',copy:'Aktiviteten mangler nok data til en sterk konklusjon.',...fit};
  }
  function statusDetails(code){
    return{
      planned:{label:'Gjennomført som planlagt',tone:'green',badge:'Som planlagt'},
      controlled:{label:'Godkjent – kontrollert avvik',tone:'yellow',badge:'Godkjent'},
      partial:{label:'Delvis gjennomført',tone:'yellow',badge:'Delvis'},
      limited:{label:'Begrenset analysegrunnlag',tone:'neutral',badge:'Begrenset'}
    }[code];
  }
  function assessSession({plan={},activity={},thresholdHr=173,maxHr=188,matchConfidence='high',flexible=false}={}){
    const normalizedPlan={...plan,flexible:flexible||plan.flexible},model=structuredWorkout(normalizedPlan),kind=activityKind(activity),work=activity?.detail?.analysis||{},blocks=Array.isArray(work.workBlocks)?work.workBlocks:[],confidence=confidenceFor(normalizedPlan,activity,model,matchConfidence),actualKm=Number(activity?.distance||0)/1000,pct=Number(activity?.heartrate)>0?Math.round(Number(activity.heartrate)/Number(maxHr||188)*100):0;
    const below=model.total.low&&actualKm<model.total.low,above=model.total.high&&actualKm>model.total.high,deltaKm=above?actualKm-model.total.high:below?actualKm-model.total.low:0;
    const expected=model.expectedIntervals,confirmed=confidence.confirmed||0,partialByWork=normalizedPlan.type==='quality'&&expected&&confirmed>0&&confirmed<Math.ceil(expected*.7),partialByTotal=normalizedPlan.type==='quality'&&model.total.low&&actualKm>0&&actualKm<model.total.low*.7;
    const highCost=normalizedPlan.type==='quality'&&(Number(work.workHr)>Number(thresholdHr||173)+1||Number(work.hrDrift)>12),easyCost=normalizedPlan.type==='easy'&&pct>76;
    let code='planned';
    if(normalizedPlan.type==='quality'&&!blocks.length)code='limited';
    else if(partialByWork||partialByTotal)code='partial';
    else if(confidence.code==='limited'&&normalizedPlan.type==='quality')code='limited';
    else if(above||below||highCost||easyCost)code='controlled';
    const status=statusDetails(code),extraCopy=confidence.extras===1?' Én kortere arbeidsperiode ble også registrert.':confidence.extras>1?` ${confidence.extras} ekstra arbeidsperioder ble holdt utenfor hovedvurderingen.`:'';
    let title=status.label,review='',consequence='Planen står. Ingen endring er nødvendig.';
    if(normalizedPlan.flexible&&kind==='row'){
      title='Concept2 traff hensikten';review=pct&&pct<=72?`Concept2-økten traff lav aerob belastning (${pct} % av makspuls${activity.power?` · ${Math.round(activity.power)} W`:''}).`:'Concept2-økten er registrert som aerob belastning. Den skal støtte løpingen, ikke bli skjult kvalitet.';consequence='Dagens aerobe økt er komplett. Ingen joggetur skal tas igjen.';
    }else if(normalizedPlan.flexible&&kind==='bike'){
      title='Zwift traff hensikten';review='Sykkeløkten er registrert som aerob støtte og erstatter dagens fleksible alternativ.';consequence='Dagens aerobe økt er komplett. Ingen joggetur skal tas igjen.';
    }else if(code==='limited'){
      review='Garmin/Tredict har registrert totalen, men arbeidsdelen kan ikke skilles sikkert fra oppvarming og nedjogg.';consequence='Økten teller i belastningen. RunnerBear gjør ingen offensiv planendring på dette grunnlaget.';
    }else if(code==='partial'){
      review=`${confirmed||'Færre enn planlagt'} av ${expected||'de planlagte'} arbeidsdrag ble sikkert identifisert. Det som mangler skal ikke tas igjen senere.`;consequence='Belastningen registreres som lavere enn planlagt. Neste planlagte økt beholdes.';
    }else if(normalizedPlan.type==='quality'){
      const blockCopy=expected&&confirmed>=expected?`${expected} planlagte arbeidsdrag er bekreftet.`:`Arbeidsdelen er identifisert i ${blocks.length} blokker.`;
      review=`${blockCopy}${extraCopy} ${highCost?'Puls eller pulsdrift viser høyere kostnad enn ønsket.':'Arbeidsdelen ser kontrollert og repeterbar ut.'}`;
      if(above)review+=` Totalen var ${decimal(deltaKm)} km over planens øvre ramme.`;
      if(below)review+=` Totalen var ${decimal(Math.abs(deltaKm))} km under planens nedre ramme.`;
      consequence=code==='planned'?'Planen står. Økten støtter videre kontrollert terskelarbeid.':'Neste kvalitetsøkt beholdes, men RunnerBear legger ikke på fart eller volum.';
      title=code==='planned'?'Hensikten er truffet':status.label;
    }else if(normalizedPlan.type==='easy'){
      title=easyCost?'Rolig økt · høyere kostnad':'Rolig betyr rolig';review=easyCost?`Snittpulsen var ${pct} % av makspuls, høyere enn ønsket for en ren rolig dag.`:`Rolig belastning er registrert${pct?` ved ${pct} % av makspuls`:''}.`;
      consequence=easyCost?'Planen står, men uten bonusfart eller ekstra volum.':'Planen står. Den rolige økten beskytter neste kvalitetsøkt.';
    }else if(normalizedPlan.type==='race'){title='Løpet er registrert';review='Gjennomføringen tas med i kapasitetsbildet og den videre målreisen.'}
    return{build:BUILD,code,tone:status.tone,status:{code,label:status.label},badge:status.badge,title,review,consequence,confidence,model,kind,blocks,work,actualKm,pct,deltaKm,above:!!above,below:!!below,highCost};
  }
  function selectComparableSessions(plan,sessions=[],kind=''){
    const key=workoutFamily({...plan,activityKind:kind},kind),at=Date.parse(`${plan.ds||plan.date||'1970-01-01'}T12:00:00Z`);
    return(Array.isArray(sessions)?sessions:[]).filter(row=>{
      const other=row?.plan||{},date=Date.parse(`${other.ds||other.date||'1970-01-01'}T12:00:00Z`),otherKind=row?.kind||activityKind(row?.activity);
      return date<at&&at-date<=120*86400000&&workoutFamily({...other,activityKind:otherKind},otherKind)===key;
    }).slice(-8);
  }
  function matchAllowed({activityId='',usedIds=[],excludedId=''}={}){
    const id=String(activityId||'');return!!id&&!new Set((usedIds||[]).map(String)).has(id)&&String(excludedId||'')!==id;
  }

  return{BUILD,structuredWorkout,workoutFamily,confidenceFor,assessSession,selectComparableSessions,matchAllowed,activityKind,paceSeconds,paceLabel,durationLabel};
});
