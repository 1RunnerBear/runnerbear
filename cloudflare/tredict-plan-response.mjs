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
    value.meta?.planId,value.meta?.id,value.meta?._id,
    value.structuredContent?.planId,value.structuredContent?.id,value.structuredContent?._id
  ];
}

function contentIds(value){
  const rows=Array.isArray(value?.content)?value.content:[];
  const ids=[];
  for(const row of rows){
    if(row?.type!=='text'||typeof row.text!=='string')continue;
    try{ids.push(...objectIds(JSON.parse(row.text)))}catch{}
    const match=row.text.match(/\bplanId\b[\s"':=]+([A-Za-z0-9_-]{5,160})/i);
    if(match)ids.push(match[1]);
  }
  return ids;
}

export function extractTredictPlanId(result){
  const direct=scalarId(result);if(direct)return direct;
  const candidates=[...objectIds(result),...contentIds(result),...contentIds(result?.result)];
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
  const content=Array.isArray(result.content)
    ?result.content.filter(row=>row?.type==='text'&&typeof row.text==='string').map(row=>compact(row.text)).filter(Boolean).slice(0,3).join(' | ')
    :'';
  const success=Object.prototype.hasOwnProperty.call(result,'success')?compact(result.success):'';
  return`${detail?`detail=${detail}; `:''}${content?`content=${content}; `:''}keys=${keys}${success?`; success=${success}`:''}`.slice(0,700);
}

export function splitTredictPlanPayload(payload){
  const plan=payload?.plan&&typeof payload.plan==='object'?payload.plan:null;
  const trainings=Array.isArray(payload?.planTrainings)?payload.planTrainings:[];
  if(!plan)throw new Error('Tredict plan metadata is missing');
  if(!trainings.length)throw new Error('Tredict plan requires trainings');
  return{
    // Plan Create is atomic. Tredict requires planTrainings in this request;
    // appending later both loses idempotency and leaves partial plans behind.
    create:{plan,planTrainings:trainings},
    additions:[]
  };
}

const PLAN_TRAINING_RETRY_DELAYS=[800,1800,3600];

export function tredictPlanTrainingRetryDelay(error,attempt){
  const status=Number(error?.status)||0;
  if(![400,404,409,429].includes(status))return 0;
  return PLAN_TRAINING_RETRY_DELAYS[attempt]||0;
}

export function normalizeTredictMutationResult(result={},fallback={}){
  const allowed=new Set(['confirmed','review_required','failed_retryable','failed_terminal','superseded']),status=allowed.has(result.status)?result.status:'review_required',externalId=String(result.externalId||fallback.externalId||''),tredictWorkoutId=String(result.tredictWorkoutId||result.trainingId||'');
  return{ok:status==='confirmed',status,code:String(result.code||fallback.code||'UNCONFIRMED'),externalId,tredictWorkoutId,idempotencyKey:String(result.idempotencyKey||fallback.idempotencyKey||''),retryable:status==='failed_retryable'};
}
