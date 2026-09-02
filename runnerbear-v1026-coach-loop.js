/* RunnerBear v10.26 · Coach Loop shared browser policy helpers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1026=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const BUILD='10.26.0',POLICY_VERSION='coach-loop-1';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])])):value;
  const stable=value=>JSON.stringify(canonical(value));
  function assertRevision(snapshot={}){
    const revision=clean(snapshot.planRevisionId||snapshot.activePlan?.planRevisionId);
    const activeRevision=clean(snapshot.activePlan?.planRevisionId||revision),decision=clean(snapshot.coachDecision?.planRevisionId),workout=clean(snapshot.todayWorkout?.planRevisionId||revision);
    if(!revision)return{ok:false,code:'MISSING_PLAN_REVISION'};
    if(activeRevision!==revision)return{ok:false,code:'ACTIVE_PLAN_REVISION_MISMATCH'};
    if(snapshot.activePlan?.status&&snapshot.activePlan.status!=='active')return{ok:false,code:'INACTIVE_PLAN_REVISION'};
    if(decision&&decision!==revision)return{ok:false,code:'DECISION_REVISION_MISMATCH'};
    if(workout&&workout!==revision)return{ok:false,code:'WORKOUT_REVISION_MISMATCH'};
    for(const key of ['bodyResponse','oneDecision','contextualCoach','coachBrief','weeklyReview']){
      const value=snapshot[key],bound=clean(value?.planRevisionId);
      if(value&&bound&&bound!==revision)return{ok:false,code:`${key.replace(/([A-Z])/g,'_$1').toUpperCase()}_REVISION_MISMATCH`};
    }
    const ids=new Set(),slots=new Set();
    for(const row of snapshot.activePlan?.items||[]){
      const rowRevision=clean(row?.planRevisionId||revision),id=clean(row?.workoutId),date=dateOnly(row?.localDate||row?.local_date),slot=Number(row?.slotIndex??row?.slot_index??0);
      if(rowRevision!==revision)return{ok:false,code:'PLAN_ITEM_REVISION_MISMATCH'};
      if(!id||!date||!Number.isInteger(slot)||slot<0)return{ok:false,code:'INVALID_PLAN_ITEM_IDENTITY'};
      if(ids.has(id))return{ok:false,code:'DUPLICATE_WORKOUT_ID'};
      const slotKey=`${date}:${slot}`;if(slots.has(slotKey))return{ok:false,code:'DUPLICATE_PLAN_SLOT'};
      ids.add(id);slots.add(slotKey);
    }
    return{ok:true,planRevisionId:revision,itemCount:ids.size};
  }
  function idempotency(prefix='rb'){
    const random=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return`${prefix}:${random}`;
  }
  function safeAutoAllowed(decision={}){
    const action=decision.action||{},change=action.change||{},affected=Array.isArray(action.affectedWorkoutIds)?action.affectedWorkoutIds:[];
    if(decision.confidence!=='high'||affected.length>2)return false;
    if(['ILLNESS','PAIN','CONSTRAINT_CONFLICT'].some(code=>(decision.reasonCodes||[]).includes(code)))return false;
    if(change.kind==='reduce_duration'||change.kind==='reduce_repetitions')return Number(change.reductionPercent)>0&&Number(change.reductionPercent)<=20;
    return['replace_with_rest','replace_with_existing_alternative','remove_optional_easy','move_within_two_days'].includes(change.kind);
  }
  return{BUILD,POLICY_VERSION,clean,dateOnly,stable,assertRevision,idempotency,safeAutoAllowed};
});
