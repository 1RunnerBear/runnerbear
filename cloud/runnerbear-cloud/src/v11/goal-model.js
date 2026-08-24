const DISTANCES=new Set(['five','ten','half']);
const EFFORTS=new Set(['controlled','race']);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';

export function normalizeSecondaryGoals(value=[]){
  return(Array.isArray(value)?value:[]).filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).map((row,index)=>({
    id:clean(row.id)||`b-race-${index+1}`,
    name:clean(row.name)||'B-løp',
    date:dateOnly(row.date),
    distance:DISTANCES.has(row.distance)?row.distance:'ten',
    effort:EFFORTS.has(row.effort)?row.effort:'controlled',
    status:row.status==='cancelled'?'cancelled':'active',
    created:clean(row.created),
  })).filter(row=>row.date);
}

export function restorePausedPrimaryGoalState(value={},today=new Date().toISOString().slice(0,10),now=new Date().toISOString()){
  const state=value&&typeof value==='object'&&!Array.isArray(value)?structuredClone(value):{};
  const history=Array.isArray(state.history)?state.history:[];
  if(state.mode!=='base'||state.primary)return{changed:false,state,primary:null};
  let index=-1;
  for(let i=history.length-1;i>=0;i--){
    const candidate=history[i];
    if(candidate?.status==='paused'&&dateOnly(candidate.date)>=today){index=i;break}
  }
  if(index<0)return{changed:false,state,primary:null};
  const archived={...history[index]},primary={...archived,status:'active',updatedAt:now};
  delete primary.closedAt;delete primary.resultSeconds;
  state.mode='race';state.primary=primary;state.history=history.filter((_,i)=>i!==index);state.transitionUntil='';state.updatedAt=now;
  return{changed:true,state,primary};
}

export function createReleaseGoalRepairState(value={},request={},today=new Date().toISOString().slice(0,10),now=new Date().toISOString()){
  const state=value&&typeof value==='object'&&!Array.isArray(value)?structuredClone(value):{},date=dateOnly(request.date),id=clean(request.id);
  if(state.primary||!id||!date||date<today)return{changed:false,state,primary:null};
  const primary={id,name:clean(request.name)||'A-mål',date,distance:DISTANCES.has(request.distance)?request.distance:'half',targetSeconds:Math.max(0,Number(request.targetSeconds)||0),status:'active',created:clean(request.created)||now,updatedAt:now};
  const secondaryByKey=new Map();
  for(const goal of normalizeSecondaryGoals([...(Array.isArray(state.secondary)?state.secondary:[]),...(Array.isArray(request.secondary)?request.secondary:[])]))secondaryByKey.set(goal.date,goal);
  state.version=Number(state.version)||1;state.mode='race';state.primary=primary;state.secondary=[...secondaryByKey.values()];state.history=Array.isArray(state.history)?state.history:[];state.transitionUntil='';state.updatedAt=now;
  return{changed:true,state,primary};
}
