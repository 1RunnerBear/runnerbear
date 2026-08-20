/* RunnerBear v10.25 · calm intelligence, evidence and active-equipment rules.
   Pure helpers only: UI and transport layers remain responsible for storage
   and side effects. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1025=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.25';
  const isoDate=value=>{
    const match=String(value||'').match(/\d{4}-\d{2}-\d{2}/);
    return match?match[0]:'';
  };
  const finite=value=>{
    const number=Number(value);
    return Number.isFinite(number)?number:0;
  };
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();

  function vo2Sample(activity={},syncedAt=''){
    const detail=activity.detail||activity.raw?.detail||{};
    const value=finite(detail?.summary?.vo2max??activity?.summary?.vo2max??activity?.vo2max);
    const date=isoDate(activity.ds||activity.date||activity.startTime);
    if(!date||value<20||value>100)return null;
    return{
      date,
      value:Math.round(value*10)/10,
      source:'Garmin',
      activityId:String(activity.id||activity._id||activity.sourceId||''),
      syncedAt:String(syncedAt||activity.syncedAt||new Date().toISOString())
    };
  }

  function mergeVo2History(existing=[],activities=[],syncedAt=''){
    const samples=[];
    for(const row of Array.isArray(existing)?existing:[]){
      const date=isoDate(row?.date),value=finite(row?.value);
      if(date&&value>=20&&value<=100)samples.push({...row,date,value:Math.round(value*10)/10,source:row.source||'Garmin',activityId:String(row.activityId||''),syncedAt:String(row.syncedAt||'')});
    }
    for(const activity of Array.isArray(activities)?activities:[]){const row=vo2Sample(activity,syncedAt);if(row)samples.push(row)}
    const byIdentity=new Map();
    for(const row of samples){
      const key=row.activityId?`activity:${row.activityId}`:`date:${row.date}`;
      const current=byIdentity.get(key);
      if(!current||row.date>current.date||(row.date===current.date&&String(row.syncedAt)>=String(current.syncedAt)))byIdentity.set(key,row);
    }
    return[...byIdentity.values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.activityId).localeCompare(String(b.activityId))).slice(-180);
  }

  function latestVo2(history=[]){
    return(Array.isArray(history)?history:[]).filter(row=>isoDate(row?.date)&&finite(row?.value)>=20&&finite(row?.value)<=100).sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null;
  }

  function runningActivity(activity={}){
    const sport=clean(activity.sportType||activity.sport).toLowerCase();
    return sport==='running'||sport==='run';
  }

  function thresholdEvidenceFromSessions(sessions=[]){
    const rows=[];
    for(const session of Array.isArray(sessions)?sessions:[]){
      const plan=session?.plan||{},activity=session?.activity||{},feedback=session?.feedback||{},assessment=session?.assessment||{};
      const analysis=activity?.detail?.analysis||activity?.raw?.detail?.analysis||assessment?.work||{};
      const blocks=Array.isArray(analysis?.workBlocks)?analysis.workBlocks:[];
      const pace=finite(analysis?.workPace)||finite(feedback?.paceSeconds)||finite(feedback?.pace);
      const hr=finite(analysis?.workHr)||finite(feedback?.hr);
      const workDuration=finite(analysis?.workDuration)||blocks.reduce((sum,row)=>sum+finite(row?.duration),0);
      const representative=runningActivity(activity)&&(plan.type==='quality'||blocks.length>=3)&&(blocks.length>=3||workDuration>=600);
      if(!representative||pace<120||pace>480||hr<80||hr>220)continue;
      const date=isoDate(activity.ds||activity.date||plan.ds||plan.baseDs);
      if(!date)continue;
      rows.push({
        date,
        label:clean(plan.title||activity.title||'Kvalitetsøkt'),
        pace:Math.round(pace),
        hr:Math.round(hr),
        rpe:finite(feedback.rpe),
        source:blocks.length?'Garmin arbeidsdel':'Manuell vurdering',
        activityId:String(activity.id||activity._id||''),
        family:clean(session.family||plan.family||plan.title||activity.title||'terskel'),
        confidence:clean(assessment?.confidence?.code||analysis?.confidence||(blocks.length>=3?'high':'medium')),
        workBlocks:blocks.length,
        workDuration:Math.round(workDuration),
        hrDrift:Math.round(finite(analysis?.hrDrift)*10)/10,
        paceFade:Math.round(finite(analysis?.paceFade)*10)/10
      });
    }
    const byActivity=new Map();
    for(const row of rows){
      const key=row.activityId?`activity:${row.activityId}`:`${row.date}|${row.family}|${row.pace}|${row.hr}`;
      byActivity.set(key,row);
    }
    return[...byActivity.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-24);
  }

  function comparableThresholdEvidence(rows=[]){
    const groups=new Map();
    for(const row of Array.isArray(rows)?rows:[]){const key=clean(row?.family||row?.label||'terskel');groups.set(key,[...(groups.get(key)||[]),row])}
    return[...groups.values()].sort((a,b)=>b.length-a.length||String(b.at(-1)?.date||'').localeCompare(String(a.at(-1)?.date||'')))[0]||[];
  }

  function activeShoes(shoes=[]){return(Array.isArray(shoes)?shoes:[]).filter(shoe=>shoe&&shoe.active!==false)}
  const normalized=value=>clean(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ');
  function workoutShoeCategory(plan={}){
    const text=normalized(`${plan.type||''} ${plan.title||''} ${plan.desc||''}`);
    if(plan.type==='quality'||plan.type==='race'||/terskel|tempo|intervall|gate|konkurranse/.test(text))return'Terskel-/temposko';
    return'Komfortabel roligsko';
  }
  function shoeScore(shoe={},plan={}){
    const text=normalized(`${shoe.role||''} ${shoe.surface||''} ${shoe.plate||''}`),target=workoutShoeCategory(plan);let score=0;
    if(target==='Terskel-/temposko'){
      if(/terskel|tempo|kvalitet|konkurranse/.test(text))score+=5;
      if(/plate/.test(text))score+=1;
      if(/rolig|restitusjon/.test(text))score-=2;
    }else{
      if(/rolig|langtur|restitusjon|komfort/.test(text))score+=5;
      if(/uten plate/.test(text))score+=1;
      if(/konkurranse/.test(text))score-=2;
    }
    if(/terreng|grus/.test(normalized(`${plan.title||''} ${plan.desc||''}`))&&/terreng|grus/.test(text))score+=3;
    return score;
  }
  function ensureActiveShoe(plan={},shoes=[],options={}){
    const current=clean(plan.shoe),rows=Array.isArray(shoes)?shoes:[];
    if(options.historical===true||!current||!rows.length)return{shoe:current,replaced:false,previous:'',fallback:false};
    const referenced=rows.find(row=>normalized(current).includes(normalized(row?.name)));
    if(!referenced||referenced.active!==false)return{shoe:current,replaced:false,previous:'',fallback:false};
    const candidates=activeShoes(rows).map(row=>({row,score:shoeScore(row,plan)})).sort((a,b)=>b.score-a.score||clean(a.row.name).localeCompare(clean(b.row.name)));
    const selected=candidates.find(x=>x.score>0)?.row||null;
    return{shoe:selected?.name||workoutShoeCategory(plan),replaced:true,previous:referenced.name,fallback:!selected};
  }

  return{BUILD,isoDate,vo2Sample,mergeVo2History,latestVo2,thresholdEvidenceFromSessions,comparableThresholdEvidence,activeShoes,workoutShoeCategory,ensureActiveShoe};
});
