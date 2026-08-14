/* RunnerBear v10.24 · persistent Tredict transport queue.
   RunnerBear owns the plan, Tredict transports scheduled workouts to Garmin. */
(function(root,factory){
  const api=factory(root.RunnerBearV1023||(typeof module==='object'&&module.exports?require('./runnerbear-v1023-plan-integrity.js'):null));
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1024=api;
})(typeof window!=='undefined'?window:globalThis,function(base){
  'use strict';

  if(!base)throw new Error('RunnerBear v10.23 plan integrity is required');
  const BUILD='10.24';
  const clean=(value,max=180)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
  const memoryStorage=base.memoryStorage;

  function createTredictSyncService(options={}){
    const storage=options.storage||memoryStorage();
    const stateKey=options.stateKey||'runnerbear_v1024_tredict_sync';
    const legacyStateKey=options.legacyStateKey||'runnerbear_v1023_garmin_sync';
    const clock=options.now||(()=>Date.now());
    const schedule=options.setTimer||((fn,ms)=>setTimeout(fn,ms));
    const cancelTimer=options.clearTimer||clearTimeout;
    const transportFor=typeof options.transport==='function'?options.transport:()=>options.transport;
    const notify=typeof options.onEvent==='function'?options.onEvent:()=>{};
    const debounceMs=Math.max(0,Number(options.debounceMs??500));
    const retryDelays=options.retryDelays||[0,1500,6000,20000];
    let timer=0,flushing=null;

    const empty=()=>({version:2,transport:'tredict',items:{},queue:[]});
    const parse=raw=>{try{const value=JSON.parse(raw||'{}');return{version:2,transport:'tredict',items:value.items&&typeof value.items==='object'?value.items:{},queue:Array.isArray(value.queue)?value.queue:[]}}catch{return empty()}};
    function read(){
      const current=storage.getItem(stateKey);
      if(current)return parse(current);
      const legacy=storage.getItem(legacyStateKey);
      if(!legacy)return empty();
      const migrated=parse(legacy);
      for(const item of Object.values(migrated.items)){
        if(item?.lastError==='training_api_unavailable'){item.status='pending';item.lastError=''}
      }
      save(migrated);
      return migrated;
    }
    const save=value=>storage.setItem(stateKey,JSON.stringify(value));
    const emit=(name,detail={})=>{try{notify(name,detail)}catch{}};
    const capable=transport=>transport?.available===true&&typeof transport.syncWorkout==='function';
    const nowIso=()=>new Date(clock()).toISOString();
    function status(externalId){const state=read();return state.items[String(externalId||'')]||{status:'not_synced',externalId:String(externalId||''),retryCount:0,transport:'tredict'}}
    function all(){return read()}
    function queue(event,workout){
      const state=read(),externalId=base.stableExternalId(workout),hash=base.workoutHash(workout),previous=state.items[externalId]||{},transport=transportFor();
      if(['synced','awaiting_activation','review_required'].includes(previous.status)&&previous.lastSyncedHash===hash)return{queued:false,idempotent:true,state:previous};
      const entry={externalId,event:{...event,externalId},workout:{...workout,externalId},hash,queuedAt:nowIso(),attempt:0,nextAttemptAt:clock()};
      state.queue=state.queue.filter(row=>row.externalId!==externalId);state.queue.push(entry);
      state.items[externalId]={...previous,externalId,transport:'tredict',status:capable(transport)?'pending':'not_synced',lastError:capable(transport)?'':'tredict_transport_unavailable',retryCount:Number(previous.retryCount||0),updatedAt:entry.queuedAt};
      save(state);emit('tredict_sync_queued',{externalId,eventType:event.type});
      if(capable(transport)){if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},debounceMs)}
      return{queued:true,idempotent:false,state:state.items[externalId]};
    }
    async function send(transport,entry){
      const cancel=entry.event.type==='plan:workout-cancelled'||entry.event.type==='plan:workout-replaced'||entry.workout.cancelled===true;
      const operation=cancel?'cancel':entry.event.type==='plan:workout-moved'?'reschedule':'upsert';
      return transport.syncWorkout({event:entry.event,workout:entry.workout,hash:entry.hash,operation});
    }
    function resultStatus(result){
      if(result?.status==='awaiting-calendar-activation'||result?.awaitingActivation)return'awaiting_activation';
      if(result?.status==='review-required'||result?.requiresAction)return'review_required';
      return'synced';
    }
    async function flush(){
      if(flushing)return flushing;
      flushing=(async()=>{
        const transport=transportFor(),state=read();
        if(!capable(transport)){
          for(const entry of state.queue)state.items[entry.externalId]={...(state.items[entry.externalId]||{}),externalId:entry.externalId,transport:'tredict',status:'not_synced',lastError:'tredict_transport_unavailable'};
          save(state);return{ok:false,blocked:true,processed:0};
        }
        let processed=0;const remaining=[];
        for(const entry of state.queue){
          if(Number(entry.nextAttemptAt||0)>clock()){remaining.push(entry);continue}
          const current=state.items[entry.externalId]||{};
          if(['synced','awaiting_activation','review_required'].includes(current.status)&&current.lastSyncedHash===entry.hash)continue;
          state.items[entry.externalId]={...current,status:'syncing',lastError:'',updatedAt:nowIso()};save(state);
          try{
            const result=await send(transport,entry),nextStatus=resultStatus(result);
            state.items[entry.externalId]={...state.items[entry.externalId],transport:'tredict',status:nextStatus,lastSyncedAt:nowIso(),lastSyncedHash:entry.hash,tredictWorkoutId:String(result?.tredictWorkoutId||result?.workoutId||state.items[entry.externalId].tredictWorkoutId||''),tredictPlanId:String(result?.planId||state.items[entry.externalId].tredictPlanId||''),lastError:'',message:clean(result?.message||''),retryCount:0};
            processed++;emit(nextStatus==='synced'?'tredict_sync_success':'tredict_sync_action_required',{externalId:entry.externalId,status:nextStatus});
          }catch(error){
            const attempt=Number(entry.attempt||0)+1,retryCount=Number(current.retryCount||0)+1,delay=retryDelays[Math.min(attempt,retryDelays.length-1)];
            state.items[entry.externalId]={...state.items[entry.externalId],transport:'tredict',status:'error',lastError:clean(error?.message||error),retryCount,updatedAt:nowIso()};
            emit('tredict_sync_failed',{externalId:entry.externalId,retryCount});
            if(attempt<retryDelays.length){remaining.push({...entry,attempt,nextAttemptAt:clock()+delay});emit('tredict_sync_retry',{externalId:entry.externalId,retryCount,delay})}
          }
          save(state);
        }
        state.queue=remaining;save(state);
        if(remaining.length){const next=Math.max(0,Math.min(...remaining.map(row=>Number(row.nextAttemptAt||clock())))-clock());if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},next)}
        return{ok:remaining.length===0,blocked:false,processed,remaining:remaining.length};
      })().finally(()=>{flushing=null});
      return flushing;
    }
    function retry(externalId=''){
      const state=read(),ids=externalId?[externalId]:Object.keys(state.items).filter(id=>state.items[id].status==='error');
      for(const id of ids){const item=state.items[id],entry=state.queue.find(row=>row.externalId===id);if(!item||!entry)continue;item.status='pending';item.lastError='';entry.nextAttemptAt=clock();entry.attempt=0}
      save(state);if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},0);return ids.length;
    }
    function init(){
      const state=read();
      if(state.queue.length){const transport=transportFor();if(capable(transport)){if(timer)cancelTimer(timer);timer=schedule(()=>{timer=0;void flush()},0)}else{for(const entry of state.queue)state.items[entry.externalId]={...(state.items[entry.externalId]||{}),externalId:entry.externalId,transport:'tredict',status:'not_synced',lastError:'tredict_transport_unavailable'};save(state)}}
      return state;
    }
    return{BUILD,stateKey,queue,flush,retry,status,all,init,available:()=>capable(transportFor())};
  }

  return{...base,BUILD,createTredictSyncService,memoryStorage};
});
