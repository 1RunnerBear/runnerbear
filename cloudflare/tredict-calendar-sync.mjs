/* RunnerBear v11.8 · pure desired-state Tredict calendar reconciliation. */

export function isoDate(value){
  const date=String(value||'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)?date:'';
}

export function plannedRows(raw){
  const embedded=raw?._embedded||{};
  for(const value of [embedded.plannedTrainingList,embedded.plannedWorkoutList,raw?.plannedTrainingList,raw?.plannedWorkoutList,raw?.trainings]){
    if(Array.isArray(value))return value;
  }
  return[];
}

export function marker(externalId){return`[RB:${String(externalId||'').trim()}]`}
const markerValue=(row,name)=>String(row?.notes||row?.description||row?.structuredWorkout?.notes||row?.training?.notes||'').match(new RegExp(`\\[${name}:([^\\]]+)\\]`,'i'))?.[1]?.trim()||'';
export function rowExternalId(row={}){return markerValue(row,'RB').toLowerCase()}
export function rowPlanId(row={}){return markerValue(row,'PLAN')}
export function rowRevisionId(row={}){return markerValue(row,'REV')}
export function rowFingerprint(row={}){return markerValue(row,'FPR').toLowerCase()}
export function remoteId(row={}){return String(row.id||row.trainingId||row.plannedTrainingId||'')}
export function remoteDate(row={}){return isoDate(row.date||row.startDate||row.scheduledDate)}
export function isCompletedWorkout(row={}){return row.completed===true||row.isCompleted===true||['completed','done'].includes(String(row.status||row.state||'').toLowerCase())||!!row.activityId}
export function isRunnerBearOwned(row={},bindingRemoteId=''){return!!rowExternalId(row)||!!bindingRemoteId&&remoteId(row)===String(bindingRemoteId)}

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined&&key!=='remoteWorkoutId').map(key=>[key,canonical(value[key])])):value;
export function stableJson(value){return JSON.stringify(canonical(value))}
export function deterministicFingerprint(value){
  const text=stableJson(value);let a=2166136261,b=2246822519;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917)}
  return`${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}

export function findPlannedWorkout(rows,expected={},dates=[]){return findPlannedWorkouts(rows,expected,dates)[0]}
export function findPlannedWorkouts(rows,expected={},dates=[]){
  const externalId=String(expected.externalId||'').toLowerCase(),boundId=String(expected.remoteWorkoutId||''),title=String(expected.title||''),wanted=new Set([expected.date,...dates].map(isoDate).filter(Boolean));
  const byBinding=(rows||[]).filter(row=>boundId&&remoteId(row)===boundId),byId=(rows||[]).filter(row=>externalId&&rowExternalId(row)===externalId);
  if(byBinding.length||byId.length)return[...new Map([...byBinding,...byId].map(row=>[remoteId(row),row])).values()];
  return(rows||[]).filter(row=>String(row.title||row.workoutName||row.structuredWorkout?.title||row.training?.title||'')===title&&(!wanted.size||wanted.has(remoteDate(row))));
}

export function scheduledDateTime(row,newDate){
  const date=isoDate(newDate);if(!date)throw new Error('Tredict requires a valid future workout date');
  const current=String(row?.date||row?.startDate||''),suffix=/^\d{4}-\d{2}-\d{2}(T.+)$/.exec(current)?.[1]||'T15:00:00.000Z';
  return`${date}${suffix}`;
}

export function expectedFromBundle(bundle,addDays){return(bundle?.payload?.planTrainings||[]).map((row,index)=>({externalId:String(bundle?.source?.externalIds?.[index]||''),date:addDays(bundle.source.startDate,Number(row.day||1)-1),title:String(row?.structuredWorkout?.title||'')}))}

export function chooseDuplicateKeeper(rows=[],desired={},bindingRemoteId=''){
  return[...rows].sort((a,b)=>{
    const score=row=>(remoteId(row)===String(bindingRemoteId||'')?16:0)+(rowRevisionId(row)===String(desired.planRevisionId||'')?8:0)+(remoteDate(row)===isoDate(desired.date)?4:0)+(rowFingerprint(row)===String(desired.fingerprint||'').toLowerCase()?2:0)+(isCompletedWorkout(row)?1:0);
    return score(b)-score(a)||remoteId(a).localeCompare(remoteId(b));
  })[0]||null;
}

export function classifyDesiredState(operation={},rows=[]){
  const type=String(operation.operationType||operation.operation_type||'').toLowerCase(),externalId=String(operation.externalId||operation.external_id||operation.workoutId||operation.workout_id||''),date=isoDate(operation.date||operation.localDate||operation.local_date),desired={...operation,externalId,date},matches=findPlannedWorkouts(rows,{...desired,remoteWorkoutId:operation.remoteWorkoutId},[operation.previousDate,date]),keeper=chooseDuplicateKeeper(matches,desired,operation.remoteWorkoutId),duplicates=matches.filter(row=>row!==keeper),owned=keeper?isRunnerBearOwned(keeper,operation.remoteWorkoutId):false;
  if(!['create','update','move','cancel','replace'].includes(type))return{action:'CONFLICT',code:'INVALID_OPERATION',externalId,keeper,duplicates};
  if(type==='cancel'){
    if(!keeper)return{action:'UNCHANGED',code:'ALREADY_ABSENT',externalId,keeper,duplicates};
    if(!owned)return{action:'CONFLICT',code:'OWNERSHIP_REQUIRED',externalId,keeper,duplicates};
    if(isCompletedWorkout(keeper)||remoteDate(keeper)<isoDate(operation.today||new Date().toISOString()))return{action:'UNCHANGED',code:'IMMUTABLE_HISTORY',externalId,keeper,duplicates};
    return{action:'DELETE',code:'DELETE_REQUIRED',externalId,keeper,duplicates};
  }
  if(!keeper)return{action:'CREATE',code:'CREATE_REQUIRED',externalId,keeper,duplicates};
  if(!owned)return{action:'CONFLICT',code:'OWNERSHIP_REQUIRED',externalId,keeper,duplicates};
  if(isCompletedWorkout(keeper)||remoteDate(keeper)<isoDate(operation.today||new Date().toISOString()))return{action:'UNCHANGED',code:'IMMUTABLE_HISTORY',externalId,keeper,duplicates};
  const dateChanged=remoteDate(keeper)!==date,fingerprint=String(operation.fingerprint||'').toLowerCase(),contentChanged=!!fingerprint&&rowFingerprint(keeper)!==fingerprint;
  if(dateChanged&&contentChanged)return{action:'MOVE_UPDATE',code:'MOVE_AND_UPDATE_REQUIRED',externalId,keeper,duplicates};
  if(dateChanged)return{action:'MOVE',code:'MOVE_REQUIRED',externalId,keeper,duplicates};
  if(contentChanged)return{action:'UPDATE',code:'UPDATE_REQUIRED',externalId,keeper,duplicates};
  return{action:'UNCHANGED',code:'DESIRED_STATE_CONFIRMED',externalId,keeper,duplicates};
}

function confirmed(operation,row,code='CONFIRMED'){return{status:'confirmed',code,externalId:operation.externalId,tredictWorkoutId:remoteId(row),date:isoDate(operation.date),fingerprint:String(operation.fingerprint||'')}}
async function verifyExactlyOne(provider,operation,{allowTwo=false}={}){
  const rows=await provider.listPlannedWorkouts(operation.windowStart||operation.previousDate||operation.date,operation.windowEnd||operation.date),matches=findPlannedWorkouts(rows,{externalId:operation.externalId,remoteWorkoutId:operation.remoteWorkoutId,date:operation.date,title:operation.title},[operation.previousDate,operation.date]),desired=matches.filter(row=>remoteDate(row)===isoDate(operation.date)&&(!operation.fingerprint||rowFingerprint(row)===String(operation.fingerprint).toLowerCase()));
  if(allowTwo&&desired.length>=1)return{ok:true,row:desired.at(-1),matches,rows};
  return{ok:desired.length===1&&matches.length===1,row:desired[0]||matches[0]||null,matches,rows};
}

export async function reconcileDesiredState(provider,rawOperation={}){
  const operation={...rawOperation,externalId:String(rawOperation.externalId||rawOperation.workoutId||''),date:isoDate(rawOperation.date||rawOperation.localDate),today:isoDate(rawOperation.today||new Date().toISOString())},capabilities=await provider.discoverCapabilities(),initialRows=await provider.listPlannedWorkouts(operation.windowStart||operation.previousDate||operation.date,operation.windowEnd||operation.date),classified=classifyDesiredState(operation,initialRows),safeDuplicates=classified.duplicates.filter(row=>isRunnerBearOwned(row,operation.remoteWorkoutId)&&!isCompletedWorkout(row)&&remoteDate(row)>=operation.today);
  if(safeDuplicates.length&&capabilities.supportsDelete)for(const duplicate of safeDuplicates)await provider.deleteWorkout(duplicate,operation);
  let current=classified.keeper;
  if(classified.action==='CONFLICT')return{status:'failed_terminal',code:classified.code,action:'CONFLICT',externalId:operation.externalId,capabilities};
  if(classified.action==='UNCHANGED'){
    if(!current)return{status:'confirmed',code:classified.code,action:'UNCHANGED',externalId:operation.externalId,date:operation.date,capabilities};
    const verification=await verifyExactlyOne(provider,operation);return verification.ok?{...confirmed(operation,verification.row,classified.code),action:'UNCHANGED',capabilities,duplicatesRemoved:safeDuplicates.length}:{status:'failed_retryable',code:'VERIFY_EXACTLY_ONE_FAILED',action:'UNCHANGED',externalId:operation.externalId,capabilities};
  }
  if(classified.action==='DELETE'){
    if(!capabilities.supportsDelete)return{status:'failed_terminal',code:'DELETE_UNSUPPORTED',externalId:operation.externalId,capabilities};
    await provider.deleteWorkout(current,operation);const rows=await provider.listPlannedWorkouts(operation.windowStart||operation.previousDate||operation.date,operation.windowEnd||operation.date),matches=findPlannedWorkouts(rows,{externalId:operation.externalId,remoteWorkoutId:operation.remoteWorkoutId},[operation.previousDate,operation.date]);
    return matches.length?{status:'failed_retryable',code:'DELETE_VERIFY_FAILED',action:'DELETE',externalId:operation.externalId,capabilities}:{status:'confirmed',code:'DELETED',action:'DELETE',externalId:operation.externalId,capabilities};
  }
  if(classified.action==='CREATE'){
    if(!capabilities.supportsCreate)return{status:'failed_terminal',code:'CREATE_UNSUPPORTED',externalId:operation.externalId,capabilities};
    current=await provider.createWorkout(operation);const verification=await verifyExactlyOne(provider,{...operation,remoteWorkoutId:remoteId(current)});
    return verification.ok?{...confirmed(operation,verification.row,'CREATED'),action:'CREATE',capabilities}:{status:'failed_retryable',code:'CREATE_VERIFY_FAILED',action:'CREATE',externalId:operation.externalId,capabilities};
  }
  if(classified.action==='MOVE'||classified.action==='MOVE_UPDATE'){
    if(!capabilities.supportsMove)return{status:'failed_terminal',code:'MOVE_UNSUPPORTED',externalId:operation.externalId,capabilities};
    await provider.moveWorkout(current,operation);
  }
  let appliedAction=classified.action;
  if(classified.action==='UPDATE'||classified.action==='MOVE_UPDATE'){
    if(capabilities.supportsUpdate)await provider.updateWorkout(current,operation);
    else if(capabilities.supportsReplace&&capabilities.supportsCreate&&capabilities.supportsDelete){
      const replacement=await provider.createWorkout({...operation,replacesRemoteWorkoutId:remoteId(current)}),created=await verifyExactlyOne(provider,{...operation,remoteWorkoutId:remoteId(replacement)},{allowTwo:true});
      if(!created.ok)return{status:'failed_retryable',code:'REPLACEMENT_CREATE_VERIFY_FAILED',externalId:operation.externalId,capabilities};
      await provider.deleteWorkout(current,operation);current=replacement;appliedAction='REPLACE';
    }else return{status:'failed_terminal',code:'CONTENT_UPDATE_UNSUPPORTED',externalId:operation.externalId,capabilities};
  }
  const verification=await verifyExactlyOne(provider,{...operation,remoteWorkoutId:remoteId(current)});
  return verification.ok?{...confirmed(operation,verification.row,classified.action==='MOVE'?'MOVED':classified.action==='UPDATE'?'UPDATED':'RECONCILED'),action:appliedAction,capabilities,duplicatesRemoved:safeDuplicates.length}:{status:'failed_retryable',code:'WRITE_VERIFY_FAILED',action:appliedAction,externalId:operation.externalId,capabilities};
}

export function canonicalOperationResult(operation={},rows=[]){
  const classified=classifyDesiredState(operation,rows),keeper=classified.keeper;
  if(classified.action==='UNCHANGED')return{status:'confirmed',code:classified.code,externalId:classified.externalId,tredictWorkoutId:remoteId(keeper)};
  if(classified.action==='MOVE')return{status:'processing',code:'MOVE_REQUIRED',externalId:classified.externalId,tredictWorkoutId:remoteId(keeper)};
  if(classified.action==='CREATE')return{status:'processing',code:'CREATE_REQUIRED',externalId:classified.externalId};
  if(classified.action==='UPDATE'||classified.action==='MOVE_UPDATE')return{status:'processing',code:classified.code,externalId:classified.externalId,tredictWorkoutId:remoteId(keeper)};
  if(classified.action==='DELETE')return{status:'processing',code:'DELETE_REQUIRED',externalId:classified.externalId,tredictWorkoutId:remoteId(keeper)};
  return{status:'failed_terminal',code:classified.code,externalId:classified.externalId,tredictWorkoutId:remoteId(keeper)};
}
