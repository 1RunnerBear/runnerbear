/* RunnerBear v10.26 · atomic plan read model. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory(require('./runnerbear-v1026-coach-loop.js'));return}
  const api=factory(root.RunnerBearV1026);
  root.RunnerBearPlanReadModel=api;
})(typeof window!=='undefined'?window:globalThis,function(core){
  'use strict';
  let current=null;
  function install(snapshot){
    const check=core?.assertRevision?.(snapshot)||{ok:false};
    if(!check.ok)throw Object.assign(new Error(check.code||'Invalid Coach Loop snapshot'),{code:check.code});
    current=Object.freeze({...snapshot,installedAt:new Date().toISOString()});
    return current;
  }
  const get=()=>current;
  function workoutForDate(date){
    const rows=current?.activePlan?.items||[];
    return rows.find(row=>row.localDate===date||row.local_date===date)||null;
  }
  function consistent(workout,decision=current?.coachDecision){
    if(!current||!workout)return false;
    return workout.planRevisionId===current.planRevisionId&&(!decision||decision.planRevisionId===current.planRevisionId);
  }
  return{install,get,workoutForDate,consistent};
});
