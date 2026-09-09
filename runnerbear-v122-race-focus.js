/* Race Focus is a read-only view model. The checklist is device-local, never a plan input. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunnerBearRaceFocus=api})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const storageKey='runnerbear_v122_race_checklist';
  const distances={five:5000,ten:10000,half:21097.5,marathon:42195};
  const checklist=[
    {id:'arrival',label:'Starttid, oppmøte og transport er sjekket'},
    {id:'bib',label:'Startnummer og eventuell legitimasjon er klart'},
    {id:'kit',label:'Klær til løpet og etterpå er lagt frem'},
    {id:'watch',label:'Klokken er ladet og visningen er sjekket'},
    {id:'food',label:'Kjent mat og drikke er planlagt'}
  ];
  function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const ms=Date.parse(value+'T12:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?ms/86400000:null}
  function localDate(now,timezone){try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-')}catch{return ''}}
  function identity(goal){return JSON.stringify([goal.id||'',String(goal.name||'').trim(),goal.date,goal.distance])}
  function goalMatches(canonical,local){return !!local&&(!local.status||local.status==='active')&&canonical?.mode==='race'&&['name','date','distance'].every(k=>String(canonical[k]||'').trim()===String(local[k]||'').trim())&&Number(canonical.targetSeconds||0)===Number(local.targetSeconds||0)}
  function target(goal){const meters=distances[goal.distance],seconds=Number(goal.targetSeconds);if(!meters||!Number.isFinite(seconds)||seconds<=0||seconds>86400)return null;const marks={five:[1000,2000,3000,4000],ten:[2000,4000,6000,8000],half:[5000,10000,15000,20000],marathon:[10000,20000,30000,40000]}[goal.distance];return {seconds:Math.round(seconds),paceSeconds:seconds/(meters/1000),splits:[...marks,meters].map(m=>({meters:m,finish:m===meters,seconds:Math.round(seconds*m/meters)}))}}
  function model({snapshot,goal,now=Date.now(),practicalOnly=false}={}){
    const unavailable=reason=>({available:false,reason});
    const canonical=snapshot?.config?.goal,timezone=snapshot?.config?.timezone;
    if(!goalMatches(canonical,goal))return unavailable('Løpsforberedelsene venter til målet og den gjeldende planen stemmer overens.');
    const date=timezone?localDate(now,timezone):'',raceDay=day(canonical.date),currentDay=day(date);
    if(raceDay===null||currentDay===null||!distances[canonical.distance]||!String(canonical.name||'').trim())return unavailable('Løpsdato eller tidssone kunne ikke bekreftes.');
    const days=raceDay-currentDay;
    if(days<0)return unavailable('Løpsdatoen er passert. Resultat og neste mål håndteres under Administrer mål.');
    const revision=snapshot?.planRevisionId,plan=snapshot?.activePlan;
    if(!revision||!practicalOnly&&snapshot?.flags?.coach_loop_ui!==true||plan?.planRevisionId!==revision||plan?.status!=='active'||!Array.isArray(plan.items)||plan.items.some(item=>!item||item.planRevisionId!==revision))return unavailable('Gjeldende plan kunne ikke verifiseres. Løpsforberedelsene åpnes når planen er klar.');
    if(practicalOnly){const age=now-Date.parse(snapshot.generatedAt);if(snapshot.ok!==true||age< -60000||!(age<=6*3600000))return unavailable('Målet oppdateres før sjekklisten åpnes.');return{available:true,practicalOnly:true,key:identity(goal),phase:'preview',days,date,raceDate:canonical.date,name:canonical.name,revision,headline:'Løpsforberedelser',summary:'Gjør det praktiske klart litt etter litt. Øktene finner du i Plan.',todayVisible:false,blocked:true,target:null,items:[]}}
    const decision=snapshot.oneDecision,body=snapshot.bodyResponse,generated=Date.parse(decision?.generatedAt);
    // Canonical rest/result envelopes intentionally have no decision expiry. Bound their display cache.
    const expires=decision?.validUntil==null&&['rest','completed','reflect'].includes(decision?.state)?generated+15*60000:Date.parse(decision?.validUntil);
    const verified=['one-decision-1','one-decision-2'].includes(decision?.version)&&body?.version==='body-response-1'&&decision?.planRevisionId===revision&&body?.planRevisionId===revision&&decision?.safety?.planWritesByAi===false;
    const fresh=verified&&Number.isFinite(generated)&&generated<=now+60000&&localDate(generated,timezone)===date&&expires>now&&decision?.freshness==='current'&&body?.freshness?.status==='fresh';
    const attention=body?.checkIn?.required===true||body?.state!=='as_planned'||!['follow','rest','completed','reflect'].includes(decision?.state)||(body?.reasonCodes||[]).some(code=>/pain|illness|sickness/i.test(code));
    const blocked=!fresh||attention;
    const phase=days===0?'race':days===1?'eve':days<=7?'week':'preview';
    const copy={
      preview:['Løpsforberedelser','Ta det praktiske litt etter litt. Konkurranseuken samles her når den er i planvinduet.'],
      week:['Løpsuken, samlet','Dagens coachråd står først. Her finner du de gjenstående øktene og det praktiske før start.'],
      eve:['I morgen er løpsdagen','Samle det praktiske i kveld. Dagens økt og eventuelle tilpasninger ligger fortsatt i planen.'],
      race:['Løpsdagen, samlet','Det praktiske og måltidens mellomtider på ett sted. Dagens helseavklaring og coachråd gjelder fortsatt.']
    }[phase];
    const from=Math.max(currentDay,raceDay-7),items=plan.items.filter(item=>day(item.localDate)!==null&&day(item.localDate)>=from&&day(item.localDate)<=raceDay&&item.status==='scheduled').sort((a,b)=>a.localDate.localeCompare(b.localDate)||Number(a.slotIndex||0)-Number(b.slotIndex||0)).map(item=>({workoutId:item.workoutId,date:item.localDate,title:item.title||'Planlagt økt',type:item.workoutType,distanceM:Number(item.plannedDistanceM)||0}));
    return {available:true,key:identity(goal),phase,days,date,raceDate:canonical.date,name:canonical.name,revision,headline:copy[0],summary:copy[1],todayVisible:days<=7&&!blocked,blocked,safetyCopy:!fresh?'Dagens grunnlag må fornyes før mellomtidene vises. Se dagens coachråd først.':attention?'Dagens helse eller belastning trenger oppmerksomhet. Se coachens avklaring før du bruker en målfart.':'Mellomtidene er kun regnet fra måltiden din. De sier ikke om du er klar til å løpe på denne tiden.',target:blocked?null:target(canonical),items};
  }
  function records(storage){try{const value=JSON.parse(storage.getItem(storageKey)||'[]');return Array.isArray(value)?value.filter(row=>row&&typeof row.key==='string'&&Array.isArray(row.checked)).slice(-12):[]}catch{return []}}
  function checked(storage,key){return new Set((records(storage).find(row=>row.key===key)?.checked||[]).filter(id=>checklist.some(item=>item.id===id)))}
  function setChecked(storage,key,id,value){if(typeof key!=='string'||!key||!checklist.some(item=>item.id===id)||typeof value!=='boolean')return false;const rows=records(storage),set=checked(storage,key);if(value)set.add(id);else set.delete(id);try{storage.setItem(storageKey,JSON.stringify([...rows.filter(row=>row.key!==key),{key,checked:[...set]}].slice(-12)));return true}catch{return false}}
  return {model,preparation:options=>model({...options,practicalOnly:true}),localDate,day,target,identity,checklist,checked,setChecked,storageKey};
});
