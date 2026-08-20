/* Pure Tredict calendar reconciliation helpers used by RunnerBear v10.25. */

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

export function rowExternalId(row={}){
  const match=String(row.notes||row.description||row.structuredWorkout?.notes||row.training?.notes||'').match(/\[RB:([^\]]+)\]/i);
  return match?String(match[1]).trim().toLowerCase():'';
}

export function findPlannedWorkout(rows,expected={},dates=[]){
  const externalId=String(expected.externalId||'').toLowerCase(),title=String(expected.title||''),wanted=new Set([expected.date,...dates].map(isoDate).filter(Boolean));
  const byId=(rows||[]).find(row=>externalId&&rowExternalId(row)===externalId);
  if(byId)return byId;
  return(rows||[]).find(row=>String(row.title||row.workoutName||row.structuredWorkout?.title||row.training?.title||'')===title&&(!wanted.size||wanted.has(isoDate(row.date||row.startDate))));
}

export function scheduledDateTime(row,newDate){
  const date=isoDate(newDate);if(!date)throw new Error('Tredict requires a valid future workout date');
  const current=String(row?.date||row?.startDate||'');
  const suffix=/^\d{4}-\d{2}-\d{2}(T.+)$/.exec(current)?.[1]||'T15:00:00.000Z';
  return`${date}${suffix}`;
}

export function expectedFromBundle(bundle,addDays){
  return(bundle?.payload?.planTrainings||[]).map((row,index)=>({
    externalId:String(bundle?.source?.externalIds?.[index]||''),
    date:addDays(bundle.source.startDate,Number(row.day||1)-1),
    title:String(row?.structuredWorkout?.title||''),
  }));
}
