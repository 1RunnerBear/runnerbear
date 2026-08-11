function scalarId(value){
  if(typeof value!=='string'&&typeof value!=='number')return'';
  const id=String(value).trim();
  return /^[A-Za-z0-9_-]{5,160}$/.test(id)?id:'';
}

function objectIds(value){
  if(!value||typeof value!=='object')return[];
  return[
    value.planId,value.planID,value.trainingPlanId,value.id,value._id,
    value.plan?.planId,value.plan?.id,value.plan?._id,
    value.data?.planId,value.data?.id,value.data?._id,
    value.result?.planId,value.result?.id,value.result?._id,
    value.meta?.planId,value.meta?.id,value.meta?._id
  ];
}

export function extractTredictPlanId(result){
  const direct=scalarId(result);if(direct)return direct;
  const candidates=[...objectIds(result)];
  const success=result&&typeof result==='object'?result.success:null;
  if(Array.isArray(success))success.forEach(item=>candidates.push(...objectIds(item),item));
  else candidates.push(...objectIds(success),success);
  for(const value of candidates){const id=scalarId(value);if(id)return id}
  return'';
}

function compact(value){
  if(value===undefined||value===null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value).slice(0,180);
  try{return JSON.stringify(value).slice(0,240)}catch{return Object.prototype.toString.call(value)}
}

export function describeTredictPlanResponse(result){
  if(result===undefined)return'empty response';
  if(result===null)return'null response';
  if(typeof result!=='object')return`value=${compact(result)}`;
  const keys=Object.keys(result).slice(0,20).join(',')||'(none)';
  const detail=[result.error,result.message,result.detail,result.reason].map(compact).find(Boolean);
  const success=Object.prototype.hasOwnProperty.call(result,'success')?compact(result.success):'';
  return`${detail?`detail=${detail}; `:''}keys=${keys}${success?`; success=${success}`:''}`.slice(0,420);
}
