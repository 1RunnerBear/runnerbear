/* RunnerBear v10.22 · deterministic daily readiness and real intensity distribution.
   This module is pure and testable. UI layers may present the result, but must
   not invent parallel thresholds, recovery rules or zone percentages. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1022=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.22';
  const SUBJECTIVE_STATES=new Set(['unknown','fresh','tired','heavy']);
  const REASONS=new Set(['poor_sleep','fatigue','heavy_legs','stress','illness','achilles']);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const roundHalf=value=>Math.round(Number(value||0)*2)/2;

  function unique(values=[]){return[...new Set(values.filter(Boolean))]}
  function deriveIntensityRanges({thresholdHr=0,maxHr=0}={}){
    const maximum=clamp(Math.round(maxHr)||188,150,230),threshold=clamp(Math.round(thresholdHr)||Math.round(maximum*.91),Math.round(maximum*.82),maximum-1),recoveryHigh=clamp(Math.round(maximum*.70),95,threshold-25),thresholdLow=clamp(threshold-13,recoveryHigh+12,threshold-5),greyHigh=thresholdLow-1,greyLow=clamp(greyHigh-9,recoveryHigh+2,greyHigh),easyLow=recoveryHigh+1,easyHigh=greyLow-1;
    return{build:BUILD,thresholdHr:threshold,maxHr:maximum,ranges:[
      {key:'recovery',label:'Restitusjon',min:null,max:recoveryHigh,description:'Svært lett arbeid',guidance:'Brukes når målet er å hente seg inn.'},
      {key:'easy',label:'Rolig',min:easyLow,max:easyHigh,description:'Mesteparten av mengdetreningen',guidance:'Snakketempo og lav kostnad.'},
      {key:'grey',label:'Gråsone',min:greyLow,max:greyHigh,description:'Begrenset bruk',guidance:'Unngå unødvendig mellomintensitet.'},
      {key:'threshold',label:'Terskel',min:thresholdLow,max:threshold,description:'Kontrollert kvalitetsarbeid',guidance:'Repeterbar kvalitet rundt individuell terskel.'},
      {key:'above_threshold',label:'Over terskel',min:threshold+1,max:null,description:'Kun når planen krever det',guidance:'Kortere og hardere arbeid med tydelig formål.'}
    ]};
  }
  function validateIntensityRanges(value){
    const rows=Array.isArray(value)?value:value?.ranges;if(!Array.isArray(rows)||rows.length!==5)return false;
    for(let i=0;i<rows.length;i++){const current=rows[i];if(current.min!=null&&current.max!=null&&current.min>current.max)return false;if(i&&rows[i-1].max+1!==current.min)return false}
    return rows[0].min==null&&rows.at(-1).max==null;
  }
  function normalizeReadinessInput(input={}){
    const subjective=input.subjective&&typeof input.subjective==='object'?input.subjective:{};
    const recovery=input.recovery&&typeof input.recovery==='object'?input.recovery:{};
    const training=input.training&&typeof input.training==='object'?input.training:{};
    const injury=input.injury&&typeof input.injury==='object'?input.injury:{};
    const state=SUBJECTIVE_STATES.has(subjective.state)?subjective.state:'unknown';
    const reasons=unique(Array.isArray(subjective.reasons)?subjective.reasons:[]).filter(x=>REASONS.has(x));
    const flags=unique(Array.isArray(recovery.flags)?recovery.flags:[]).filter(x=>['sleep','hrv','rhr'].includes(x));
    return{
      subjective:{state,reasons},
      recovery:{
        available:recovery.available===true||flags.length>0||['green','yellow','red'].includes(recovery.level),
        level:['green','yellow','red'].includes(recovery.level)?recovery.level:'unknown',
        flags,
        sleepLow:recovery.sleepLow===true||flags.includes('sleep'),
        hrvLow:recovery.hrvLow===true||flags.includes('hrv'),
        restingHrHigh:recovery.restingHrHigh===true||flags.includes('rhr')
      },
      training:{
        recentLoad:training.recentLoad==='high'?'high':'normal',
        latestRpe:clamp(training.latestRpe,0,10),
        nextWorkoutType:String(training.nextWorkoutType||'easy'),
        rawLevel:['green','yellow','red'].includes(training.rawLevel)?training.rawLevel:'green'
      },
      injury:{achilles:injury.achilles===true||reasons.includes('achilles')}
    };
  }

  function reduceWorkoutTitle(title='',factor=.75){
    const text=String(title||'').trim();
    const match=text.match(/(\d+)\s*[×x]\s*(\d+\s*(?:\/\s*\d+|(?:[.,]\d+)?\s*(?:min|m)\b))/i);
    if(match){
      const count=Number(match[1]),reduced=Math.max(1,Math.round(count*factor));
      return text.replace(match[0],`${reduced} × ${match[2].replace(/\s+/g,' ').replace(/\s*\/\s*/,'/')}`);
    }
    return `Kortversjon · ${text||'kontrollert kvalitet'}`;
  }

  function proposedWorkout(plan={},severity='green',signals={}){
    const type=String(plan.type||'easy'),km=Number(plan.km||0),base={type,title:String(plan.title||'Planlagt økt'),desc:String(plan.desc||''),detail:String(plan.detail||''),km,shoe:plan.shoe||'',fuel:plan.fuel||''};
    if(severity==='green')return{...base,changed:false};
    if(signals.illness)return{...base,changed:true,type:'rest',title:'Hvile · prioriter restitusjon',desc:'Ingen planlagt trening i dag.',detail:'Sykdomsfølelse skal aldri kombineres med kvalitetsbelastning. Økten tas ikke igjen.',km:0,shoe:'',fuel:''};
    if(signals.achilles)return{...base,changed:true,type:'cross',title:'Concept2 · rolig aerob',desc:'30–45 min svært rolig roing.',detail:'Akilles- eller hælfestesignal overstyrer friskhetsfølelse. Lav støtbelastning og ingen treningsgjeld.',km:0,shoe:'',fuel:''};
    if(severity==='yellow'){
      if(type==='quality'||type==='race')return{...base,changed:true,title:reduceWorkoutTitle(base.title,.75),desc:'20–30 % lavere arbeidsvolum, samme intensitetskontroll.',detail:`${base.detail} Kutt volum, ikke øk farten.`.trim(),km:km?Math.max(5,roundHalf(km*.75)):km};
      if(type==='easy')return{...base,changed:true,title:km?`${String(Math.max(4,roundHalf(km*.85))).replace('.',',')} km rolig · med margin`:`Kortere rolig økt · med margin`,desc:'Behold rolig intensitet og reduser varigheten moderat.',detail:`${base.detail} Ingen progresjon eller bonusarbeid.`.trim(),km:km?Math.max(4,roundHalf(km*.85)):km};
      return{...base,changed:false};
    }
    if(severity==='orange'){
      if(type==='quality'||type==='race')return{...base,changed:true,type:'easy',title:'35 min svært rolig løp',desc:'Lavkostalternativ som beskytter neste nøkkeløkt.',detail:'Snakketempo og tydelig lav intensitet. Dagens kvalitet flyttes ikke automatisk.',km:0,shoe:plan.shoe||'Komfortabel roligsko',fuel:''};
      if(type==='easy')return{...base,changed:true,type:'easy',title:'30–40 min svært rolig',desc:'Kortere rolig økt med lav kostnad.',detail:'Avslutt tidlig hvis kroppen ikke løsner. Ingen kilometer tas igjen.',km:km?Math.max(4,roundHalf(km*.7)):0};
      return{...base,changed:true,type:'rest',title:'Hvile',desc:'Restitusjon er riktig belastning i dag.',detail:'Ingen treningsgjeld.',km:0,shoe:'',fuel:''};
    }
    return{...base,changed:true,type:'rest',title:'Hvile · prioriter restitusjon',desc:'Kvalitetsbelastning skal ikke gjennomføres normalt.',detail:'Ingen treningsgjeld. Neste kvalitetsøkt vurderes på nytt når den dagen kommer.',km:0,shoe:'',fuel:''};
  }

  function dailyReadiness(input={},plan={}){
    const normalized=normalizeReadinessInput(input),{subjective,recovery,training,injury}=normalized;
    const reasons=subjective.reasons,poorSleep=reasons.includes('poor_sleep')||recovery.sleepLow,illness=reasons.includes('illness'),achilles=injury.achilles;
    const moderate=[];
    if(subjective.state==='tired'||reasons.some(x=>['fatigue','heavy_legs','stress'].includes(x)))moderate.push('subjective');
    if(reasons.includes('poor_sleep')||recovery.sleepLow)moderate.push('sleep');
    if(recovery.hrvLow)moderate.push('hrv');
    if(recovery.restingHrHigh)moderate.push('rhr');
    if(recovery.level==='yellow'&&!recovery.flags.length)moderate.push('recovery');
    if(training.recentLoad==='high')moderate.push('load');
    if(training.latestRpe>=8)moderate.push('rpe');
    if(training.rawLevel==='yellow'&&!recovery.flags.length&&recovery.level!=='yellow'&&training.recentLoad!=='high'&&training.latestRpe<8)moderate.push('engine');
    const combined=unique(moderate),physiologyCount=['sleep','hrv','rhr'].filter(x=>combined.includes(x)).length;
    let severity='green';
    if(illness||achilles||subjective.state==='heavy'||recovery.level==='red'||training.latestRpe>=9||training.rawLevel==='red'||(poorSleep&&(recovery.hrvLow||recovery.restingHrHigh))||physiologyCount>=2||combined.length>=4)severity='red';
    else if(combined.length>=2)severity='orange';
    else if(combined.length===1)severity='yellow';
    const status={
      green:{key:'plan_stands',headline:'Planen står',score:8,label:'Klar',copy:'Det er trygt å følge dagens plan.'},
      yellow:{key:'plan_margin',headline:'Planen står – med margin',score:6,label:'Med margin',copy:'Reduser dosen og behold samme kontroll.'},
      orange:{key:'adjust_day',headline:'Juster dagen',score:4,label:'Juster',copy:'Velg et lavkostalternativ og beskytt neste nøkkeløkt.'},
      red:{key:'prioritize_recovery',headline:'Prioriter restitusjon',score:2,label:'Restitusjon',copy:'Kvalitetsbelastning bør ikke gjennomføres i dag.'}
    }[severity];
    const proposed=proposedWorkout(plan,severity,{illness,achilles});
    const message={
      green:'RunnerBear ser ingen tydelige signaler som tilsier at dagens plan bør endres.',
      yellow:'Planen kan gjennomføres med margin. Reduser arbeidsvolumet og behold samme kontroll.',
      orange:'Dagens kvalitet gir mindre verdi når friskheten er redusert. Vi beskytter neste nøkkeløkt og skaper ingen treningsgjeld.',
      red:illness?'Sykdomsfølelse og hard trening hører ikke sammen. Prioriter restitusjon og vurder neste treningsdag på nytt.':achilles?'Akilles- eller hælfestesignal har høyest prioritet. Velg lav støtbelastning og vurder neste løpedag på nytt.':'Flere signaler tilsier restitusjon fremfor kvalitet. Det som tas ut skal ikke tas igjen.'
    }[severity];
    return{build:BUILD,severity,...status,message,readiness:{score:status.score,label:status.label,copy:status.copy},input:normalized,signals:{poorSleep,illness,achilles,moderate:combined},planned:{...plan},proposed,requiresChoice:proposed.changed&&severity!=='green'};
  }

  function hrBins(activity={}){
    const detail=activity.detail||activity.raw?.detail||{},direct=detail.heartRateBins||detail.hrBins||activity.heartRateBins||activity.hrBins;
    if(Array.isArray(direct)&&direct.length){
      return direct.map(row=>Array.isArray(row)?{bpm:Number(row[0]),seconds:Number(row[1])}:{bpm:Number(row?.bpm??row?.hr),seconds:Number(row?.seconds??row?.duration)}).filter(row=>Number.isFinite(row.bpm)&&row.bpm>=35&&row.bpm<=240&&Number.isFinite(row.seconds)&&row.seconds>0);
    }
    const sampled=detail.seriesSampled||activity.seriesSampled||activity.raw?.seriesSampled,values=sampled?.data?.heartrate;
    if(Array.isArray(values)&&values.length){const seconds=Math.max(1,Number(sampled.sampleSize)||1);return values.map(Number).filter(value=>Number.isFinite(value)&&value>=35&&value<=240).map(bpm=>({bpm,seconds}))}
    const samples=detail.samples||activity.samples;
    if(Array.isArray(samples)&&samples.length){return samples.map(row=>({bpm:Number(row?.heartrate??row?.heartRate??row?.hr),seconds:Math.max(1,Number(row?.seconds??row?.duration??detail.sampleSize??1))})).filter(row=>Number.isFinite(row.bpm)&&row.bpm>=35&&row.bpm<=240)}
    return[];
  }

  function distributionPercents(seconds=[]){
    const total=seconds.reduce((sum,value)=>sum+value,0);if(!total)return seconds.map(()=>0);
    const raw=seconds.map(value=>value/total*100),base=raw.map(Math.floor),remaining=100-base.reduce((sum,value)=>sum+value,0),order=raw.map((value,index)=>({index,fraction:value-base[index]})).sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
    for(let i=0;i<remaining;i++)base[order[i%order.length].index]++;
    return base;
  }

  function activityFingerprint(activity={}){
    const date=String(activity.startTime||activity.date||activity.ds||'').slice(0,19),duration=Math.round(Number(activity.duration||activity.summary?.duration||0)/5)*5,distance=Math.round(Number(activity.distance||activity.summary?.distance||0)/10)*10;
    return`${date}|${duration}|${distance}`;
  }

  function intensityDistribution({activities=[],ranges=[],now=new Date(),days=28,minValidSeconds=600}={}){
    const end=now instanceof Date?new Date(now):new Date(now),endDay=new Date(end);endDay.setHours(23,59,59,999);const start=new Date(endDay);start.setHours(0,0,0,0);start.setDate(start.getDate()-Math.max(1,Number(days)||28)+1);
    const seen=new Set(),runs=[];
    for(const activity of Array.isArray(activities)?activities:[]){
      const status=String(activity.status||activity.state||'').toLowerCase();if(activity.completed===false||['planned','scheduled','uncompleted'].includes(status))continue;
      const sport=String(activity.sportType||activity.sport||'').toLowerCase();if(sport!=='running'&&sport!=='run')continue;
      const date=new Date(activity.date||activity.ds||activity.startTime||0);if(Number.isNaN(date.getTime())||date<start||date>endDay)continue;
      const fingerprint=activityFingerprint(activity);if(seen.has(fingerprint))continue;seen.add(fingerprint);runs.push(activity);
    }
    const seconds=Array.from({length:ranges.length},()=>0);let coveredActivities=0,totalValidSeconds=0;
    for(const activity of runs){
      const bins=hrBins(activity);if(!bins.length)continue;let activitySeconds=0;
      for(const bin of bins){const index=ranges.findIndex(range=>(range.min==null||bin.bpm>=range.min)&&(range.max==null||bin.bpm<=range.max));if(index<0)continue;seconds[index]+=bin.seconds;activitySeconds+=bin.seconds}
      if(activitySeconds>0){coveredActivities++;totalValidSeconds+=activitySeconds}
    }
    const percentages=distributionPercents(seconds),available=ranges.length===5&&coveredActivities>0&&totalValidSeconds>=minValidSeconds,greyIndex=ranges.findIndex(x=>x.key==='grey'),grey=greyIndex>=0?percentages[greyIndex]:0;
    const insight=!available?'RunnerBear venter på detaljerte pulsdata før treningsfordelingen tolkes.':grey>=20?'Litt mye tid havner i gråsonen over 28 dager. Hold de rolige dagene tydelig roligere.':grey>=12?'Noe av løpingen ligger i gråsonen. Følg utviklingen, men én periode er ikke et problem i seg selv.':'Mesteparten av løpingen ligger uten unødvendig mellomintensitet, slik vi ønsker.';
    return{build:BUILD,days,start:start.toISOString().slice(0,10),end:endDay.toISOString().slice(0,10),available,totalValidSeconds,totalActivities:runs.length,coveredActivities,missingActivities:Math.max(0,runs.length-coveredActivities),rows:ranges.map((range,index)=>({...range,seconds:seconds[index],percent:percentages[index]})),insight};
  }

  return{BUILD,deriveIntensityRanges,validateIntensityRanges,normalizeReadinessInput,reduceWorkoutTitle,proposedWorkout,dailyReadiness,hrBins,distributionPercents,intensityDistribution};
});
