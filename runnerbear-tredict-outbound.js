/* RunnerBear v10.8.1 · deterministic Tredict structured-workout compiler */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RunnerBearTredictOutbound=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const z=n=>String(n).padStart(2,'0');
  const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
  const dateFrom=ds=>new Date(`${ds}T12:00:00Z`);
  const dayDiff=(a,b)=>Math.round((dateFrom(a)-dateFrom(b))/86400000);
  const paceSeconds=value=>{const m=String(value||'').match(/(\d+):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clean=(value,max=2048)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
  const sourceId=p=>clean(p?.externalId||`runnerbear-${p?.date||''}-${p?.title||'workout'}`,160).replace(/[^a-z0-9._-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();

  function paceTarget(text){
    const s=String(text||'').replace(/[–—]/g,'-');
    const range=s.match(/(\d+:\d{2})\s*-\s*(\d+:\d{2})\s*\/\s*km\b/i);
    if(range){
      const a=paceSeconds(range[1]),b=paceSeconds(range[2]),value=Math.round((a+b)/2);
      return{targetMode:'padding',targetZoneType:'pace',targets:{pace:{value,padding:Math.max(2,Math.ceil(Math.abs(a-b)/2))}}};
    }
    const single=s.match(/(?:ca\.?|~)?\s*(\d+:\d{2})(?:\s*\/\s*km)/i);
    if(single)return{targetMode:'padding',targetZoneType:'pace',targets:{pace:{value:paceSeconds(single[1]),padding:5}}};
    return{};
  }
  function recoverySeconds(text,fallback=60){
    const s=String(text||'').replace(/[–—]/g,'-');
    const seconds=s.match(/(\d+)\s*(?:-\s*(\d+)\s*)?s(?:ek)?\b/i);
    if(seconds)return Math.round((Number(seconds[1])+Number(seconds[2]||seconds[1]))/2);
    const minutes=s.match(/(\d+(?:[.,]\d+)?)\s*min\b/i);
    return minutes?Math.round(Number(minutes[1].replace(',','.'))*60):fallback;
  }
  function baseStep({note,intensityType='active',durationType='open',duration,distance,target={}}){
    const step={note:clean(note,255),intensityType,durationType,...target};
    if(durationType==='time')step.duration=clamp(Math.round(Number(duration)||1),1,86400);
    if(durationType==='distance')step.distance=clamp(Math.round(Number(distance)||1),1,100000);
    return step;
  }
  function workStep(p,durationType,value){
    const copy=`${p.title}. ${p.detail||p.desc||''}`;
    return baseStep({
      note:copy,
      intensityType:'active',
      durationType,
      duration:durationType==='time'?value:undefined,
      distance:durationType==='distance'?value:undefined,
      target:paceTarget(`${p.target||''} ${p.detail||''}`)
    });
  }
  function recoverStep(seconds){
    return baseStep({note:'Rolig jogg. Finn kontroll før neste drag.',intensityType:'recover',durationType:'time',duration:seconds});
  }
  function repeat(repetitions,steps){return{repetitions:clamp(Math.round(Number(repetitions)||1),1,100),steps}}
  function intervalMain(p){
    const title=String(p.title||'').replace(/[–—]/g,'-');
    const detail=`${p.desc||''} ${p.detail||''}`;
    let m=title.match(/(\d+)\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)\s*\/\s*(\d+)/i);
    if(m){
      const series=clamp(Number(m[1]),1,20),reps=clamp(Number(m[2]),1,100),work=Number(m[3]),rest=Number(m[4]),out=[];
      for(let i=0;i<series;i++){
        out.push(repeat(reps,[workStep(p,'time',work),recoverStep(rest)]));
        if(i<series-1)out.push(recoverStep(recoverySeconds(detail,120)));
      }
      return out;
    }
    m=title.match(/(\d+)\s*[×x]\s*(\d+)\s*\/\s*(\d+)/i);
    if(m)return[repeat(Number(m[1]),[workStep(p,'time',Number(m[2])),recoverStep(Number(m[3]))])];
    m=title.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*km\b/i);
    if(m)return[repeat(Number(m[1]),[workStep(p,'distance',Number(m[2].replace(',','.'))*1000),recoverStep(recoverySeconds(detail,90))])];
    m=title.match(/(\d+)\s*[×x]\s*(\d+)\s*m\b/i);
    if(m)return[repeat(Number(m[1]),[workStep(p,'distance',Number(m[2])),recoverStep(recoverySeconds(detail,45))])];
    m=title.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*min\b/i);
    if(m)return[repeat(Number(m[1]),[workStep(p,'time',Number(m[2].replace(',','.'))*60),recoverStep(recoverySeconds(detail,60))])];
    return[baseStep({note:`Kontrollert hoveddel. ${p.title}. ${p.desc||''} ${p.detail||''}`,intensityType:'active',durationType:'open',target:paceTarget(`${p.target||''} ${p.detail||''}`)})];
  }
  function qualitySteps(p){
    return[
      baseStep({note:'10–15 min rolig. Fortsett ved behov. Legg eventuelt inn 2–4 kontrollerte stigninger, og trykk rundetasten når du er klar.',intensityType:'warmup',durationType:'open'}),
      ...intervalMain(p),
      baseStep({note:'10–15 min svært rolig. Avslutt med rundetasten når det passer.',intensityType:'cooldown',durationType:'open'})
    ];
  }
  function easySteps(p){
    const title=String(p.title||''),copy=`${title}. ${p.desc||''} ${p.detail||''}`;
    const strides=title.match(/(?:\+\s*)?(\d+)\s*(?:strides|[×x]\s*15\s*s)/i);
    const easy=baseStep({note:copy,intensityType:'active',durationType:'open'});
    if(!strides)return[easy];
    return[easy,repeat(Number(strides[1]),[
      baseStep({note:'Kort, kontrollert stigning. Avslappet – ikke sprint.',intensityType:'active',durationType:'time',duration:15}),
      baseStep({note:'Full rolig pause.',intensityType:'recover',durationType:'time',duration:60})
    ]),baseStep({note:'Rolig til du ønsker å avslutte.',intensityType:'cooldown',durationType:'open'})];
  }
  function raceSteps(p){
    const km=Number(p.km)||Number(String(p.title||'').match(/(\d+(?:[.,]\d+)?)\s*[kK]/)?.[1]?.replace(',','.'))||0;
    return[baseStep({note:`${p.title}. ${p.detail||p.desc||''}`,intensityType:'active',durationType:km?'distance':'open',distance:km?km*1000:undefined,target:paceTarget(`${p.target||''} ${p.detail||''}`)})];
  }
  function workout(p){
    const date=isoDate(p?.date||p?.ds);if(!date)throw new Error('Workout date is required');
    const type=String(p?.type||'').toLowerCase(),id=sourceId({...p,date}),title=clean(p?.title||'RunnerBear workout',255);
    const steps=type==='quality'?qualitySteps(p):type==='race'?raceSteps(p):easySteps(p);
    return{
      externalId:id,date,title,type,stimulus:String(p?.stimulus||type),planRevision:Math.max(0,Number(p?.planRevision||0)),km:Number(p?.km)||0,
      structuredWorkout:{
        title,
        notes:clean(`[RB:${id}] [REV:${Math.max(0,Number(p?.planRevision||0))}] [STIMULUS:${p?.stimulus||type}] ${p?.purpose||''} ${p?.desc||''} ${p?.detail||''}`,1024),
        trainingType:'planned',sportType:'running',subSportType:'generic',steps
      }
    };
  }
  function formatDate(ds){
    const d=dateFrom(ds);return`${z(d.getUTCDate())}.${z(d.getUTCMonth()+1)}.${d.getUTCFullYear()}`;
  }
  function plan(queue){
    const rows=(Array.isArray(queue)?queue:[]).map(workout).sort((a,b)=>a.date.localeCompare(b.date)||a.externalId.localeCompare(b.externalId));
    if(!rows.length)throw new Error('No publishable running workouts');
    const start=rows[0].date,end=rows.at(-1).date;
    return{
      source:{version:'10.25.1',startDate:start,endDate:end,workoutCount:rows.length,externalIds:rows.map(x=>x.externalId),planRevision:Math.max(0,...rows.map(x=>Number(x.planRevision||0)))},
      payload:{
        plan:{
          title:`RunnerBear · ${formatDate(start)}–${formatDate(end)}`,
          description:'RunnerBear-generated running plan. Controlled threshold, explicit stimulus lock, repeatable training and conservative load management. Stable RunnerBear IDs and plan revisions are included in every workout note.',
          categories:['building','intensity','race_specific'],targetgroups:['intermediate'],zonetypes:['heartrate','pace'],language:'en'
        },
        planTrainings:rows.map(x=>({day:dayDiff(x.date,start)+1,time:1020,structuredWorkout:x.structuredWorkout}))
      },
      workouts:rows
    };
  }
  function signature(queue){
    const built=plan(queue),value=JSON.stringify({planRevision:built.source.planRevision,rows:built.source.externalIds.map((id,i)=>[id,built.workouts[i].date,built.workouts[i].structuredWorkout])});let a=2166136261,b=2246822519;
    for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917)}
    return`${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
  }

  return{version:'10.25.1',paceSeconds,paceTarget,recoverySeconds,workout,plan,signature};
});
