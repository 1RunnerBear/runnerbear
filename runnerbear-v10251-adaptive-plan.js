/* RunnerBear v10.25.1 · adaptive plan rules, workout bank and revision model.
   Pure helpers only. Storage, rendering and transport remain in their own layers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV10251=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.25.1';
  const QUALITY=new Set(['threshold','x','race']);
  const WEEK_MODES=new Set(['BUILD','NORMAL','HOLD','DELOAD','RECOVERY']);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
  const dateMs=value=>Date.parse(`${dateOnly(value)||'1970-01-01'}T12:00:00Z`);
  const dayDiff=(a,b)=>Math.round((dateMs(a)-dateMs(b))/86400000);
  const dayIndex=value=>{const day=new Date(`${dateOnly(value)}T12:00:00Z`).getUTCDay();return(day+6)%7};
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const spec=row=>({type:row?.type||'',title:row?.title||'',desc:row?.desc||'',detail:row?.detail||'',km:Number(row?.km||0),shoe:row?.shoe||'',fuel:row?.fuel||'',stimulus:stimulusForWorkout(row)});

  function stimulusForWorkout(workout={}){
    const type=clean(workout.type).toLowerCase(),text=clean(`${workout.title||''} ${workout.desc||''} ${workout.detail||''}`).toLowerCase();
    if(type==='race')return'race';
    if(/langtur|long run/.test(text))return'long';
    if(type==='quality'&&(/45\s*\/\s*15|terskel|threshold|6\s*[×x]\s*6|5\s*[×x]\s*8|4\s*[×x]\s*10/.test(text)))return'threshold';
    if(type==='quality'||/vo2|bakkeintervall|x[- ]?økt|konkurransefart|race pace/.test(text))return'x';
    if(type==='easy')return'easy';
    if(type==='cross')return'cross';
    return'recovery';
  }

  const QUALITY_BANK=Object.freeze([
    {id:'threshold-6x6',stimulus:'threshold',title:'6 × 6 min terskel',type:'quality',km:12,desc:'6 × 6 min kontrollert terskel med 2 min rolig jogg.',detail:'Repeterbar terskel. Stabil pust og kontrollert puls; avslutt før økten glir over i X-belastning.',workMinutes:36},
    {id:'threshold-20x45-15',stimulus:'threshold',title:'20 × 45/15',type:'quality',km:9,desc:'20 × 45 sek kontrollert / 15 sek flytende rolig.',detail:'Kort terskelvariant med god rytme. Farten styres slik at siste tredel er like kontrollert som den første.',workMinutes:15},
    {id:'threshold-5x8',stimulus:'threshold',title:'5 × 8 min terskel',type:'quality',km:13,desc:'5 × 8 min kontrollert terskel med 90 sek rolig jogg.',detail:'Lang, jevn arbeidsdel. Prioriter repeterbar fart fremfor høyest mulig puls.',workMinutes:40},
    {id:'threshold-4x10',stimulus:'threshold',title:'4 × 10 min terskel',type:'quality',km:13,desc:'4 × 10 min kontrollert terskel med 90 sek rolig jogg.',detail:'Sammenhengende terskelkapasitet med lav kostnad og tydelig kontroll.',workMinutes:40},
    {id:'x-hills',stimulus:'x',title:'10 × 60 sek korte bakker',type:'quality',km:9,desc:'10 × 60 sek kontrollert hardt i slak motbakke.',detail:'X-element. Full rolig retur og god teknikk. Brukes målrettet, ikke som terskelerstatning uten coachbegrunnelse.',workMinutes:10},
    {id:'x-5x1000',stimulus:'x',title:'5 × 1000 m · VO₂',type:'quality',km:10,desc:'5 × 1000 m i kontrollert VO₂-fart med 2 min rolig jogg.',detail:'X-element med høyere kostnad enn terskel. Krever god helse, riktig fase og restitusjon rundt økten.',workMinutes:18}
  ]);

  function workoutSuitabilityScore(candidate={},context={}){
    const intended=context.intendedStimulus||stimulusForWorkout(context.plan||{}),candidateStimulus=candidate.stimulus||stimulusForWorkout(candidate);
    let score=candidateStimulus===intended?70:QUALITY.has(candidateStimulus)&&QUALITY.has(intended)?26:8;
    if(candidateStimulus==='threshold')score+=18;
    if(context.healthTrend==='negative'&&candidateStimulus==='x')score-=55;
    if(context.weekMode==='DELOAD'&&candidateStimulus==='x')score-=45;
    if(context.weekMode==='RECOVERY')score-=candidateStimulus==='x'?80:25;
    const daysToNext=Number(context.daysToNextQuality);if(Number.isFinite(daysToNext)&&daysToNext<=2&&candidateStimulus==='x')score-=28;
    const daysToLong=Number(context.daysToLongRun);if(Number.isFinite(daysToLong)&&daysToLong<=1&&candidateStimulus==='x')score-=24;
    if(clean(context.lastQualityId)===candidate.id)score-=7;
    if(context.phase==='race'&&candidateStimulus==='x')score+=8;
    if(candidate.id==='threshold-6x6'&&intended==='threshold')score+=6;
    return Math.max(0,Math.min(100,Math.round(score)));
  }

  function rankWorkoutBank(context={}){
    return QUALITY_BANK.map(workout=>({...workout,suitabilityScore:workoutSuitabilityScore(workout,context)}))
      .sort((a,b)=>b.suitabilityScore-a.suitabilityScore||a.title.localeCompare(b.title,'nb'));
  }

  function negativeHealthDays(signals=[]){
    return(Array.isArray(signals)?signals:[]).slice(-4).filter(row=>['red','low','negative'].includes(clean(row?.level||row).toLowerCase())).length;
  }

  function decideWeekMode(input={}){
    const negative=negativeHealthDays(input.healthSignals),missed=Number(input.missedWorkouts||0),aborted=Number(input.abortedWorkouts||0),downshifts=Number(input.manualDownshifts||0),load7=Number(input.load7||0),load28Weekly=Number(input.load28Weekly||0),ratio=load28Weekly>0?load7/load28Weekly:1,performance=Number(input.performanceTrend||0);
    let mode='NORMAL',reason='Belastning og helsesignaler støtter en normal treningsuke.',confidence='clear';
    if(input.injury===true||input.illness===true||negative>=3){mode='RECOVERY';reason='Flere samtidige signaler tilsier at restitusjon og kontinuitet må prioriteres.'}
    else if(negative>=2&&ratio>1.05||missed+aborted+downshifts>=3||performance<-2&&ratio>1){mode='DELOAD';reason='En vedvarende negativ trend tilsier lavere belastning før vi bygger videre.'}
    else if(negative>=2||ratio>1.22||missed+aborted>=2){mode='HOLD';reason='Coachen holder belastningen stabil mens responsen avklares.'}
    else if(negative===0&&ratio<1.08&&performance>=0&&input.continuityGood===true){mode='BUILD';reason='Kontinuitet og respons gir rom for kontrollert progresjon.'}
    if(negative===1&&mode==='NORMAL'){reason='Ett avvikende signal er ikke nok til å endre uken. Planen står med normal margin.';confidence='mixed'}
    return{mode:WEEK_MODES.has(mode)?mode:'NORMAL',reason,confidence,negativeHealthDays:negative,loadRatio:Math.round(ratio*100)/100};
  }

  function missedWorkoutDecision({missed={},future=[],healthTrend='normal'}={}){
    const stimulus=stimulusForWorkout(missed),nextQuality=(Array.isArray(future)?future:[]).filter(row=>QUALITY.has(stimulusForWorkout(row))).sort((a,b)=>dateOnly(a.ds).localeCompare(dateOnly(b.ds)))[0];
    const gap=nextQuality&&missed?.ds?dayDiff(nextQuality.ds,missed.ds):99;
    if(healthTrend==='negative')return{action:'drop',headline:'Økten utgår',message:'Helsesignalene er svake over flere dager. Vi lager ikke treningsgjeld.'};
    if(QUALITY.has(stimulus)&&nextQuality&&gap<=3)return{action:'drop',headline:'Behold neste kvalitetsøkt',message:'Den missede økten flyttes ikke blindt. Neste nøkkeløkt beholdes med kontrollert inngang.'};
    if(QUALITY.has(stimulus)&&gap>3)return{action:'reschedule',headline:'Kan flyttes med ny vurdering',message:'Det finnes nok avstand til neste belastning, men coachen kontrollerer resten av uken først.'};
    return{action:'drop',headline:'Planen går videre',message:'Støtteøkten tas ikke igjen. Kontinuitet er viktigere enn treningsgjeld.'};
  }

  function permutations(values){
    if(values.length<=1)return[values.slice()];const out=[];
    values.forEach((value,index)=>{for(const rest of permutations([...values.slice(0,index),...values.slice(index+1)]))out.push([value,...rest])});
    return out;
  }
  function preferenceScore(row,ds,prefs={}){
    const day=dayIndex(ds),stimulus=stimulusForWorkout(row),quality=Array.isArray(prefs.qualityDays)?prefs.qualityDays:[],runs=Array.isArray(prefs.runDays)?prefs.runDays:[],alternative=Array.isArray(prefs.alternativeDays)?prefs.alternativeDays:[];
    if(stimulus==='long')return day===Number(prefs.longRunDay)?55:-Math.abs(day-Number(prefs.longRunDay))*7;
    if(QUALITY.has(stimulus))return quality.includes(day)?48-quality.indexOf(day)*2:-24;
    if(stimulus==='easy')return runs.includes(day)?24:-13;
    if(['cross','recovery'].includes(stimulus))return alternative.includes(day)?18:4;
    return 0;
  }
  function hardViolations(rows=[]){
    const sorted=rows.slice().sort((a,b)=>dateOnly(a.ds).localeCompare(dateOnly(b.ds))),quality=sorted.filter(row=>QUALITY.has(stimulusForWorkout(row))),long=sorted.filter(row=>stimulusForWorkout(row)==='long'),issues=[];
    quality.forEach((row,index)=>{if(index&&dayDiff(row.ds,quality[index-1].ds)<2)issues.push({code:'adjacent_quality',rows:[quality[index-1].baseDs,row.baseDs]})});
    long.forEach(longRow=>quality.forEach(qualityRow=>{if(dayDiff(qualityRow.ds,longRow.ds)===1)issues.push({code:'quality_after_long',rows:[longRow.baseDs,qualityRow.baseDs]})}));
    return issues;
  }
  function assignmentScore(rows=[],originalById=new Map(),prefs={}){
    let score=0;for(const row of rows){score+=preferenceScore(row,row.ds,prefs);score-=Math.abs(dayDiff(row.ds,originalById.get(row.baseDs)?.ds||row.ds))*2}
    const issues=hardViolations(rows);score-=issues.length*1000;return{score,issues};
  }

  function replanFuture(rows=[],preferences={},options={}){
    const today=dateOnly(options.today)||new Date().toISOString().slice(0,10),pinned=options.pinned&&typeof options.pinned==='object'?options.pinned:{},source=(Array.isArray(rows)?rows:[]).map(row=>({...row,ds:dateOnly(row.ds),baseDs:dateOnly(row.baseDs||row.originalDate||row.ds)})),originalById=new Map(source.map(row=>[row.baseDs,row])),weeks=new Map();
    for(const row of source){const key=String(row.week??`${dateOnly(row.ds)}-week`);weeks.set(key,[...(weeks.get(key)||[]),row])}
    const output=[];let warnings=[];
    for(const weekRows of weeks.values()){
      const fixed=weekRows.filter(row=>row.ds<today||row.terminal===true||row.locked===true||pinned[row.baseDs]),movable=weekRows.filter(row=>!fixed.includes(row));
      for(const row of fixed)if(pinned[row.baseDs])row.ds=dateOnly(pinned[row.baseDs])||row.ds;
      const occupied=new Set(fixed.map(row=>row.ds)),slots=weekRows.map(row=>row.ds).filter(ds=>ds>=today&&!occupied.has(ds)).sort();
      if(!movable.length||slots.length!==movable.length){output.push(...weekRows);continue}
      let best=null;for(const candidateSlots of permutations(slots)){
        const assigned=movable.map((row,index)=>({...row,ds:candidateSlots[index]})),candidate=[...fixed,...assigned],evaluated=assignmentScore(candidate,originalById,preferences);
        if(!best||evaluated.score>best.score)best={rows:candidate,score:evaluated.score,issues:evaluated.issues};
      }
      if(best?.issues?.length)warnings.push(...best.issues);output.push(...(best?.rows||weekRows));
    }
    const sorted=output.sort((a,b)=>dateOnly(a.ds).localeCompare(dateOnly(b.ds))||String(a.baseDs).localeCompare(String(b.baseDs))),changes=sorted.filter(row=>originalById.get(row.baseDs)?.ds!==row.ds).map(row=>({workoutId:row.baseDs,previousDate:originalById.get(row.baseDs)?.ds||'',newDate:row.ds,stimulus:stimulusForWorkout(row)}));
    return{rows:sorted,changes,warnings,valid:warnings.length===0};
  }

  function previewMove({rows=[],sourceBaseDs='',targetBaseDs='',today='',preferences={}}={}){
    const source=rows.find(row=>row.baseDs===sourceBaseDs),target=rows.find(row=>row.baseDs===targetBaseDs),now=dateOnly(today);
    if(!source||!target||source===target)return{ok:false,code:'missing',message:'Velg en annen dag i samme uke.'};
    if(source.week!==target.week)return{ok:false,code:'cross_week',message:'Økten kan bare flyttes innenfor samme uke.'};
    if(source.locked||target.locked)return{ok:false,code:'locked',message:'En av øktene er låst.'};
    if(source.terminal||target.terminal||now&&(source.ds<now||target.ds<now))return{ok:false,code:'history',message:'Historiske eller gjennomførte økter kan ikke flyttes.'};
    const directRows=rows.map(row=>row.baseDs===source.baseDs?{...row,ds:target.ds}:row.baseDs===target.baseDs?{...row,ds:source.ds}:row),hard=hardViolations(directRows);
    if(hard.length)return{ok:false,code:hard[0].code,message:hard[0].code==='quality_after_long'?'Kvalitet kan ikke legges dagen etter langturen.':'To krevende kvalitetsdager ville kommet for tett.'};
    const quality=directRows.filter(row=>QUALITY.has(stimulusForWorkout(row))).sort((a,b)=>a.ds.localeCompare(b.ds)),moved=directRows.find(row=>row.baseDs===source.baseDs),at=quality.indexOf(moved),near=[quality[at-1],quality[at+1]].filter(Boolean).map(row=>Math.abs(dayDiff(row.ds,moved.ds))).filter(gap=>gap===2),warnings=near.length?['Dette gir kortere restitusjon til en annen kvalitetsøkt.']:[];
    const coach=replanFuture(directRows,preferences,{today:now,pinned:{[source.baseDs]:target.ds}}),coachChanges=coach.rows.filter(row=>rows.find(old=>old.baseDs===row.baseDs)?.ds!==row.ds);
    return{ok:true,source,target,directRows,coachRows:coach.rows,warnings,coachChanges,useCoach:coachChanges.length>2};
  }

  function createPlanMutation({previousRows=[],nextRows=[],previousRevision=0,type='plan:changed',reason='plan-change',now='',id=''}={}){
    const before=new Map((Array.isArray(previousRows)?previousRows:[]).map(row=>[row.baseDs||row.workoutId,row])),after=new Map((Array.isArray(nextRows)?nextRows:[]).map(row=>[row.baseDs||row.workoutId,row])),affected=[];
    for(const workoutId of new Set([...before.keys(),...after.keys()])){
      const a=before.get(workoutId)||{},b=after.get(workoutId)||{};if(dateOnly(a.ds||a.date)===dateOnly(b.ds||b.date)&&same(spec(a),spec(b)))continue;
      affected.push({workoutId:String(workoutId||''),previousDate:dateOnly(a.ds||a.date),newDate:dateOnly(b.ds||b.date),previousWorkout:spec(a),newWorkout:spec(b)});
    }
    const createdAt=now||new Date().toISOString(),mutationId=id||`rbm-${createdAt.replace(/[^0-9]/g,'').slice(0,17)}-${affected.map(row=>row.workoutId).join('|').length}`;
    return{mutationId,type,reason,affectedWorkoutIds:affected.map(row=>row.workoutId),affected,previousRevision:Number(previousRevision)||0,planRevision:(Number(previousRevision)||0)+1,createdAt,syncStatus:'pending'};
  }

  return{BUILD,QUALITY_BANK,stimulusForWorkout,workoutSuitabilityScore,rankWorkoutBank,decideWeekMode,missedWorkoutDecision,hardViolations,replanFuture,previewMove,createPlanMutation};
});
