/* RunnerBear v10.23 · plan integrity, safe same-week swaps and Garmin sync orchestration.
   Pure rules live here so matching, UI state and outbound sync share one meaning. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1023=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.23';
  const TERMINAL=new Set(['completed','replaced','cancelled','expired']);
  const QUALITY=new Set(['quality','race']);
  const STATUS={
    planned:{code:'planned',label:'Planlagt'},
    completed:{code:'completed',label:'Gjennomført'},
    replaced:{code:'replaced',label:'Erstattet'},
    cancelled:{code:'cancelled',label:'Utgått'},
    expired:{code:'expired',label:'Utgått'},
    moved:{code:'moved',label:'Flyttet'}
  };
  const clean=(value,max=180)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
  const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
  const dateMs=value=>Date.parse(`${dateOnly(value)||'1970-01-01'}T12:00:00Z`);
  const dayDiff=(a,b)=>Math.round((dateMs(a)-dateMs(b))/86400000);
  const slug=value=>clean(value,100).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  function activityKind(activity={}){
    const sport=clean(activity.sportType||activity.sport).toLowerCase(),sub=clean(activity.subSportType).toLowerCase(),title=clean(activity.title).toLowerCase();
    if(['running','run'].includes(sport))return'run';
    if(['cycling','bike'].includes(sport))return'bike';
    if(sport==='rowing'||/rowing|rowerg|concept2|roing/.test(`${sub} ${title}`))return'row';
    if(sport==='misc'&&/generic/.test(sub)&&Number(activity.duration)>=900&&Number(activity.distance)>=2000&&Number(activity.power)>0)return'row';
    return'other';
  }
  function planKind(plan={}){
    const type=clean(plan.type).toLowerCase(),text=`${plan.title||''} ${plan.desc||''} ${plan.detail||''}`.toLowerCase();
    if(['easy','quality','race'].includes(type))return'run';
    if(type==='cross'&&/concept2|rowerg|roing/.test(text))return'row';
    if(type==='cross'&&/zwift|sykkel|cycling/.test(text))return'bike';
    if(type==='cross')return'cross';
    if(type==='rest')return'rest';
    return'other';
  }
  function intensityBand(activity={},maxHr=188){
    const title=clean(activity.title).toLowerCase(),hr=Number(activity.heartrate||activity.avgHr||0),pct=hr&&maxHr?hr/maxHr:0,blocks=activity.detail?.analysis?.workBlocks;
    if(/intervall|terskel|tempo|45\s*\/\s*15|6\s*[×x]\s*6/.test(title)||Array.isArray(blocks)&&blocks.length>=2||pct>=.82)return'hard';
    if(/rolig|easy|recovery|rest/.test(title)||pct&&pct<=.76)return'easy';
    return'unknown';
  }
  function sameIntent({plan={},activity={},assessment=null,matchConfidence='likely',maxHr=188}={}){
    const expected=planKind(plan),actual=activityKind(activity),type=clean(plan.type).toLowerCase(),band=intensityBand(activity,maxHr);
    if(expected==='rest')return false;
    if(expected==='cross')return['row','bike'].includes(actual);
    if(expected!==actual)return false;
    if(expected!=='run')return true;
    const plannedKm=Number(plan.km||0),actualKm=Number(activity.distance||0)/1000,ratio=plannedKm&&actualKm?actualKm/plannedKm:1;
    if(type==='easy')return band!=='hard'&&(!plannedKm||!actualKm||ratio>=.6&&ratio<=1.45);
    if(type==='race')return actualKm>0&&(!plannedKm||ratio>=.75&&ratio<=1.3);
    if(type==='quality'){
      const confirmed=Number(assessment?.confidence?.confirmed||0),blocks=activity.detail?.analysis?.workBlocks;
      const structured=confirmed>0||Array.isArray(blocks)&&blocks.length>=2||assessment?.confidence?.code==='high';
      const named=/intervall|terskel|tempo|45\s*\/\s*15|6\s*[×x]\s*6/i.test(activity.title||'');
      return band==='hard'&&(structured||named||matchConfidence==='high'&&assessment?.code!=='limited');
    }
    return true;
  }
  function replacementCoach(plan={},activity={},assessment=null,maxHr=188){
    const expected=planKind(plan),actual=activityKind(activity),band=intensityBand(activity,maxHr),minutes=Math.max(0,Math.round(Number(activity.duration||0)/60)),activityLabel=actual==='row'?'Concept2':actual==='bike'?'sykkel':actual==='run'?'løp':'aktiviteten';
    if(expected==='run'&&actual==='row')return{headline:'Løpeøkten er erstattet',message:`God kontrollert aerob belastning${minutes?` i ${minutes} min`:''}. Du fikk den viktigste aerobe effekten uten løpsstøt. Den planlagte løpeturen utgår og tas ikke igjen.`,consequence:'Planen videre står. Ingen treningsgjeld.'};
    if(QUALITY.has(plan.type)&&actual==='run'&&band==='easy')return{headline:'Kvalitetsøkten er erstattet',message:'Belastningen ble betydelig lavere enn planlagt. Det er helt greit, og den planlagte terskeløkten flyttes ikke automatisk.',consequence:'Neste kvalitetsøkt vurderes som planlagt.'};
    if(QUALITY.has(plan.type)&&actual==='run'&&band==='hard')return{headline:'Kvalitetsøkten er erstattet',message:'Du gjennomførte en annen hard løpeøkt enn den planlagte. Den faktiske belastningen registreres, uten at den opprinnelige økten tas igjen.',consequence:'Neste nøkkeløkt vurderes ut fra faktisk belastning.'};
    return{headline:'Den planlagte økten er erstattet',message:`${activityLabel[0].toUpperCase()+activityLabel.slice(1)} er registrert som dagens faktiske belastning. Den opprinnelige økten utgår og tas ikke igjen.`,consequence:assessment?.highCost?'Neste økt vurderes konservativt.':'Planen videre står. Ingen treningsgjeld.'};
  }
  function classifySession({plan={},activity=null,assessment=null,matchConfidence='likely',today='',cancelled=false,maxHr=188}={}){
    const scheduled=dateOnly(plan.scheduledDate||plan.ds||plan.date),original=dateOnly(plan.originalDate||plan.baseDs||plan.date),now=dateOnly(today),moved=!!(scheduled&&original&&scheduled!==original),activityDate=dateOnly(activity?.date||activity?.ds||activity?.startTime),activityOnEffectiveDate=!!activity&&(!activityDate||!scheduled||activityDate===scheduled);
    if(activityOnEffectiveDate){
      if(sameIntent({plan,activity,assessment,matchConfidence,maxHr}))return{...STATUS.completed,terminal:true,actualActivityId:String(activity.id||''),replacementActivityId:'',moved};
      const coach=replacementCoach(plan,activity,assessment,maxHr);return{...STATUS.replaced,terminal:true,actualActivityId:'',replacementActivityId:String(activity.id||''),moved,coach};
    }
    if(cancelled)return{...STATUS.cancelled,terminal:true,moved};
    if(now&&scheduled&&scheduled<now)return{...STATUS.expired,terminal:true,moved};
    if(moved)return{...STATUS.moved,terminal:false,moved};
    return{...STATUS.planned,terminal:false,moved:false};
  }
  function statusPrecedence(rows=[]){
    const order=['completed','replaced','cancelled','expired','moved','planned'];
    return order.map(code=>rows.find(row=>row?.code===code)).find(Boolean)||STATUS.planned;
  }
  function terminalStatus(status){return TERMINAL.has(typeof status==='string'?status:status?.code)}
  function qualitySpacingSafe(rows=[]){
    const quality=rows.filter(row=>QUALITY.has(row.type)&&!terminalStatus(row.status)).sort((a,b)=>dateOnly(a.ds).localeCompare(dateOnly(b.ds)));
    return!quality.some((row,index)=>index&&dayDiff(row.ds,quality[index-1].ds)<2);
  }
  function validateSwap({rows=[],sourceBaseDs='',targetBaseDs='',today=''}={}){
    const source=rows.find(row=>row.baseDs===sourceBaseDs),target=rows.find(row=>row.baseDs===targetBaseDs);
    if(!source||!target||source===target)return{ok:false,code:'missing',message:'Velg en annen dag i samme uke.'};
    if(source.week!==target.week)return{ok:false,code:'cross_week',message:'Økten kan bare flyttes innenfor samme uke.'};
    if(source.locked||target.locked)return{ok:false,code:'locked',message:'En av øktene er låst. Lås opp før du flytter.'};
    if(terminalStatus(source.status)||terminalStatus(target.status)||today&&(source.ds<today||target.ds<today))return{ok:false,code:'history',message:'Gjennomførte eller tidligere dager kan ikke flyttes.'};
    const swapped=rows.map(row=>row.baseDs===source.baseDs?{...row,ds:target.ds}:row.baseDs===target.baseDs?{...row,ds:source.ds}:row);
    if(!qualitySpacingSafe(swapped))return{ok:false,code:'adjacent_quality',message:'Dette ville lagt to kvalitetsøkter for tett. Velg en annen dag.'};
    return{ok:true,source,target,rows:swapped};
  }
  function stableExternalId(plan={}){
    const original=dateOnly(plan.originalDate||plan.baseDs||plan.date||plan.ds),fallback=slug(plan.workoutId||plan.sourceLabel||plan.label||plan.title||'workout');
    return clean(plan.externalId||`rb-workout-${original||fallback}`,160).replace(/[^a-z0-9._-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
  }
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
    return value;
  }
  function workoutHash(workout={}){
    const value=JSON.stringify(canonical({externalId:stableExternalId(workout),date:dateOnly(workout.date||workout.ds),type:workout.type,stimulus:workout.stimulus||'',title:workout.title,km:Number(workout.km||0),structure:workout.structure||workout.structuredWorkout||null,targets:workout.targets||workout.target||'',cancelled:workout.cancelled===true,planRevision:Number(workout.planRevision||0)}));
    let a=2166136261,b=2246822519;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917)}
    return`${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
  }
  function planEvent(type,workout={},detail={}){return{type,workoutId:workout.workoutId||workout.baseDs||'',externalId:stableExternalId(workout),previousDate:dateOnly(detail.previousDate),newDate:dateOnly(detail.newDate||workout.date||workout.ds),reason:clean(detail.reason||'plan-change'),planRevision:Math.max(0,Number(detail.planRevision||workout.planRevision||0)),mutationId:clean(detail.mutationId||workout.mutationId||'',160),updatedAt:detail.updatedAt||new Date().toISOString()}}

  function memoryStorage(){const map=new Map();return{getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)}}
  function createGarminSyncService(options={}){
    const storage=options.storage||memoryStorage(),stateKey=options.stateKey||'runnerbear_v1023_garmin_sync',clock=options.now||(()=>Date.now()),schedule=options.setTimer||((fn,ms)=>setTimeout(fn,ms)),cancelTimer=options.clearTimer||clearTimeout,transportFor=typeof options.transport==='function'?options.transport:()=>options.transport,notify=typeof options.onEvent==='function'?options.onEvent:()=>{},debounceMs=Math.max(0,Number(options.debounceMs??500)),retryDelays=options.retryDelays||[0,1200,5000];let timer=0,flushing=null;
    const read=()=>{try{const value=JSON.parse(storage.getItem(stateKey)||'{}');return{version:1,items:value.items&&typeof value.items==='object'?value.items:{},queue:Array.isArray(value.queue)?value.queue:[]}}catch{return{version:1,items:{},queue:[]}}};
    const save=value=>storage.setItem(stateKey,JSON.stringify(value));
    const emit=(name,detail={})=>{try{notify(name,detail)}catch{}};
    const capable=transport=>transport?.available===true&&transport?.trainingApi===true&&['syncWorkout','upsert','reschedule','cancel'].some(name=>typeof transport[name]==='function');
    function status(externalId){const state=read();return state.items[String(externalId||'')]||{status:'not_synced',externalId:String(externalId||''),retryCount:0}}
    function all(){return read()}
    function queue(event,workout){
      const state=read(),externalId=stableExternalId(workout),hash=workoutHash(workout),previous=state.items[externalId]||{},transport=transportFor();
      if(previous.status==='synced'&&previous.lastSyncedHash===hash&&event.type!=='plan:workout-cancelled'&&event.type!=='plan:workout-replaced')return{queued:false,idempotent:true,state:previous};
      const entry={externalId,event:{...event,externalId},workout:{...workout,externalId},hash,queuedAt:new Date(clock()).toISOString(),attempt:0,nextAttemptAt:clock()};
      state.queue=state.queue.filter(row=>row.externalId!==externalId);state.queue.push(entry);
      state.items[externalId]={...previous,externalId,status:capable(transport)?'pending':'not_synced',lastError:capable(transport)?'':'training_api_unavailable',retryCount:Number(previous.retryCount||0),updatedAt:entry.queuedAt};save(state);emit('garmin_sync_queued',{externalId,eventType:event.type});
      if(capable(transport)){if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},debounceMs)}
      return{queued:true,idempotent:false,state:state.items[externalId]};
    }
    async function send(transport,entry){
      const cancel=entry.event.type==='plan:workout-cancelled'||entry.event.type==='plan:workout-replaced'||entry.workout.cancelled===true;
      if(typeof transport.syncWorkout==='function')return transport.syncWorkout({event:entry.event,workout:entry.workout,hash:entry.hash,operation:cancel?'cancel':entry.event.type==='plan:workout-moved'?'reschedule':'upsert'});
      if(cancel&&typeof transport.cancel==='function')return transport.cancel(entry.workout);
      if(entry.event.type==='plan:workout-moved'&&typeof transport.reschedule==='function')return transport.reschedule(entry.workout,entry.event.previousDate,entry.event.newDate);
      if(typeof transport.upsert==='function')return transport.upsert(entry.workout);
      throw new Error('Garmin Training API-adapteren mangler nødvendig operasjon');
    }
    async function flush(){
      if(flushing)return flushing;
      flushing=(async()=>{
        const transport=transportFor(),state=read();
        if(!capable(transport)){for(const entry of state.queue)state.items[entry.externalId]={...(state.items[entry.externalId]||{}),externalId:entry.externalId,status:'not_synced',lastError:'training_api_unavailable'};save(state);return{ok:false,blocked:true,processed:0}}
        let processed=0;const remaining=[];
        for(const entry of state.queue){
          if(Number(entry.nextAttemptAt||0)>clock()){remaining.push(entry);continue}
          const current=state.items[entry.externalId]||{};
          if(current.status==='synced'&&current.lastSyncedHash===entry.hash){continue}
          state.items[entry.externalId]={...current,status:'syncing',lastError:'',updatedAt:new Date(clock()).toISOString()};save(state);
          try{
            const result=await send(transport,entry);state.items[entry.externalId]={...state.items[entry.externalId],status:'synced',lastSyncedAt:new Date(clock()).toISOString(),lastSyncedHash:entry.hash,garminWorkoutId:String(result?.garminWorkoutId||result?.workoutId||state.items[entry.externalId].garminWorkoutId||''),garminScheduleId:String(result?.garminScheduleId||result?.scheduleId||state.items[entry.externalId].garminScheduleId||''),lastError:'',retryCount:0};processed++;emit('garmin_sync_success',{externalId:entry.externalId});
          }catch(error){
            const attempt=Number(entry.attempt||0)+1,retryCount=Number(current.retryCount||0)+1,delay=retryDelays[Math.min(attempt,retryDelays.length-1)];state.items[entry.externalId]={...state.items[entry.externalId],status:'error',lastError:clean(error?.message||error),retryCount,updatedAt:new Date(clock()).toISOString()};emit('garmin_sync_failed',{externalId:entry.externalId,retryCount});
            if(attempt<retryDelays.length){remaining.push({...entry,attempt,nextAttemptAt:clock()+delay});emit('garmin_sync_retry',{externalId:entry.externalId,retryCount,delay})}
          }
          save(state);
        }
        state.queue=remaining;save(state);
        if(remaining.length){const next=Math.max(0,Math.min(...remaining.map(row=>Number(row.nextAttemptAt||clock())))-clock());if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},next)}
        return{ok:remaining.length===0,blocked:false,processed,remaining:remaining.length};
      })().finally(()=>{flushing=null});return flushing;
    }
    function retry(externalId=''){
      const state=read(),ids=externalId?[externalId]:Object.keys(state.items).filter(id=>state.items[id].status==='error');for(const id of ids){const item=state.items[id],entry=state.queue.find(row=>row.externalId===id);if(!item||!entry)continue;item.status='pending';item.lastError='';entry.nextAttemptAt=clock();entry.attempt=0}save(state);if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},0);return ids.length;
    }
    function init(){const state=read();if(state.queue.length){const transport=transportFor();if(capable(transport)){if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},0)}else{for(const entry of state.queue)state.items[entry.externalId]={...(state.items[entry.externalId]||{}),externalId:entry.externalId,status:'not_synced',lastError:'training_api_unavailable'};save(state)}}return state}
    return{BUILD,stateKey,queue,flush,retry,status,all,init,available:()=>capable(transportFor())};
  }

  return{BUILD,STATUS,activityKind,planKind,intensityBand,sameIntent,replacementCoach,classifySession,statusPrecedence,terminalStatus,qualitySpacingSafe,validateSwap,stableExternalId,workoutHash,planEvent,createGarminSyncService,memoryStorage};
});
