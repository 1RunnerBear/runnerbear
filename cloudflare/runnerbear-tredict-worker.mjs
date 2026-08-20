/* RunnerBear v10.25.1 · Tredict Transport Bridge · Cloudflare Worker
   Secrets (Cloudflare): TREDICT_TOKEN, RUNNERBEAR_BRIDGE_KEY
   Browser fetch remains backwards-compatible. RunnerBear Cloud uses the named
   TredictService RPC entrypoint through a private Cloudflare Service Binding.
*/
import { WorkerEntrypoint } from 'cloudflare:workers';
import { describeTredictPlanResponse,extractTredictPlanId,splitTredictPlanPayload,tredictPlanTrainingRetryDelay } from './tredict-plan-response.mjs';

const TREDICT='https://www.tredict.com/api/oauth/v2/';
const TREDICT_MCP='https://www.tredict.com/api/mcp/v2';
const DEFAULT_ORIGIN='https://1runnerbear.github.io';

function cors(origin,allowed){
  return {
    'Access-Control-Allow-Origin':allowed?origin:'null',
    'Access-Control-Allow-Methods':'GET,OPTIONS',
    'Access-Control-Allow-Headers':'Accept,Content-Type,X-RunnerBear-Key',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin',
    'Cache-Control':'no-store',
    'Content-Type':'application/json;charset=UTF-8'
  };
}
function json(body,status,origin,allowed=true){return new Response(JSON.stringify(body),{status,headers:cors(origin,allowed)})}
function daysAgo(n){const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d}
function finiteValues(values){return(values||[]).map(Number).filter(Number.isFinite)}
function mean(values){const xs=finiteValues(values);return xs.length?xs.reduce((sum,x)=>sum+x,0)/xs.length:0}
function quantile(values,q){const xs=finiteValues(values).sort((a,b)=>a-b);if(!xs.length)return 0;return xs[Math.min(xs.length-1,Math.max(0,Math.round((xs.length-1)*q)))]}
function heartRateBins(values,sampleSize=1){
  const seconds=Math.max(1,Number(sampleSize)||1),bins=new Map();
  for(const value of values||[]){const bpm=Math.round(Number(value));if(!Number.isFinite(bpm)||bpm<35||bpm>240)continue;bins.set(bpm,(bins.get(bpm)||0)+seconds)}
  return[...bins].sort((a,b)=>a[0]-b[0]);
}
function compactActivityDetail(raw){
  const a=raw?.activity||raw||{},summary=a?.summary||{},series=a?.seriesSampled||{},data=series?.data||{};
  const sampleSize=Math.max(1,Number(series.sampleSize)||1),speed=(data.speed||[]).map(x=>Number.isFinite(Number(x))?Number(x):0),heartrate=(data.heartrate||[]).map(x=>Number.isFinite(Number(x))?Number(x):NaN);
  const analysis={sampleSize,workBlocks:[],workDuration:0,workPace:0,workHr:0,hrDrift:0,paceFade:0,confidence:'summary'};
  if(a.sportType==='running'&&speed.length>=8){
    const positive=speed.filter(x=>x>1),threshold=Math.max(3.55,Math.min(4.35,quantile(positive,.58)*.97));
    const groups=[];let start=-1;
    for(let i=0;i<speed.length;i++){
      const working=speed[i]>=threshold;
      if(working&&start<0)start=i;
      if((!working||i===speed.length-1)&&start>=0){const end=working&&i===speed.length-1?i:i-1;if((end-start+1)*sampleSize>=28)groups.push([start,end]);start=-1}
    }
    analysis.workBlocks=groups.map(([from,to],index)=>{
      const speeds=speed.slice(from,to+1),hrs=heartrate.slice(from,to+1),avgSpeed=mean(speeds);
      return{index:index+1,duration:(to-from+1)*sampleSize,pace:avgSpeed?1000/avgSpeed:0,hr:mean(hrs),start:from*sampleSize,end:(to+1)*sampleSize};
    }).filter(x=>x.pace>0&&x.pace<360).slice(0,40);
    if(analysis.workBlocks.length){
      analysis.workDuration=analysis.workBlocks.reduce((sum,x)=>sum+x.duration,0);
      analysis.workPace=mean(analysis.workBlocks.map(x=>x.pace));analysis.workHr=mean(analysis.workBlocks.map(x=>x.hr));
      const first=analysis.workBlocks[0],last=analysis.workBlocks.at(-1);analysis.hrDrift=last.hr-first.hr;analysis.paceFade=last.pace-first.pace;
      analysis.confidence=analysis.workBlocks.length>=3?'high':'medium';
    }
  }
  const bins=heartRateBins(data.heartrate,sampleSize);
  return{
    summary:{intensityDistribution:summary.intensityDistribution||null,zonesDistribution:summary.zonesDistribution||null,effort:summary.effort||null,vo2max:Number(summary.vo2max)||null,speedAerobicFactor:Number(summary.speedAerobicFactor)||null},
    weather:a?.weather?{temperature:Number(a.weather.temperature)||null,windSpeed:Number(a.weather.windSpeed)||null}:null,
    capacities:a?.currentCapacities||null,heartRateBins:bins,validHeartRateSeconds:bins.reduce((sum,row)=>sum+row[1],0),analysis
  };
}
function pickSummary(a){
  const s=a?.summary||a?.extendedSummary||{};
  return {
    id:a?.id||a?._id||'',date:a?.date||'',sportType:a?.sportType||'',subSportType:a?.subSportType||'',title:a?.title||s?.title||'',timezone:a?.timezone||'',
    summary:{
      duration:Number(s.duration||s.durationTotal||0),distance:Number(s.distance||0),pace:Number(s.pace||0),speed:Number(s.speed||0),
      heartrate:Number(s.heartrate||0),heartrateMax:Number(s.heartrateMax||0),power:Number(s.power||0),powerMax:Number(s.powerMax||0),
      cadence:Number(s.cadence||0),cadenceMax:Number(s.cadenceMax||0),calories:Number(s.calories||0),
      ascent:Number(s?.altitude?.ascent||0),temperature:Number(a?.weather?.temperature||s.temperature||0)
    },detail:a?.detail||undefined
  };
}
function trimBody(rows,cutoff){
  return (rows||[]).filter(x=>x?.timestamp&&new Date(x.timestamp)>=cutoff).map(x=>({
    timestamp:x.timestamp,timezoneOffsetInSeconds:x.timezoneOffsetInSeconds,
    restingHeartrate:Number(x.restingHeartrate||0)||undefined,hrRestDynamic:Number(x.hrRestDynamic||0)||undefined
  }));
}
async function boundedText(response,limit=300){
  if(!response.body)return'';const reader=response.body.getReader(),decoder=new TextDecoder();let out='';
  try{while(out.length<limit){const{done,value}=await reader.read();if(done)break;out+=decoder.decode(value,{stream:true})}}finally{if(out.length>=limit)await reader.cancel('RunnerBear error preview limit').catch(()=>{})}
  return out.slice(0,limit);
}
async function td(env,path,params={}){
  const u=new URL(TREDICT+path);Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,String(v)));
  const r=await fetch(u,{headers:{Authorization:`Bearer ${env.TREDICT_TOKEN}`,Accept:'application/json;charset=UTF-8'}});
  if(!r.ok){let msg='';try{msg=await boundedText(r)}catch{};const e=new Error(`Tredict ${path}: HTTP ${r.status}${msg?` · ${msg}`:''}`);e.status=r.status;throw e}
  return r.json();
}
async function tdPost(env,path,body){
  const r=await fetch(new URL(TREDICT+path),{method:'POST',headers:{Authorization:`Bearer ${env.TREDICT_TOKEN}`,Accept:'application/json;charset=UTF-8','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){let msg='';try{msg=await boundedText(r)}catch{};const e=new Error(`Tredict ${path}: HTTP ${r.status}${msg?` · ${msg}`:''}`);e.status=r.status;throw e}
  return r.json();
}
function parseMcpEnvelope(raw){
  const text=String(raw||'').trim();if(!text)return{};
  if(!text.startsWith('event:')&&!text.startsWith('data:'))return JSON.parse(text);
  const messages=text.split(/\r?\n\r?\n/).flatMap(block=>block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim())).filter(Boolean);
  if(!messages.length)return{};return JSON.parse(messages.at(-1));
}
async function mcpPost(env,body,sessionId=''){
  const headers={Authorization:`Bearer ${env.TREDICT_TOKEN}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'};
  if(sessionId)headers['Mcp-Session-Id']=sessionId;
  const response=await fetch(TREDICT_MCP,{method:'POST',headers,body:JSON.stringify(body)});
  const nextSession=response.headers.get('Mcp-Session-Id')||sessionId;
  if(response.status===202||response.status===204)return{envelope:{},sessionId:nextSession};
  const raw=await boundedText(response,120000);
  if(!response.ok){const error=new Error(`Tredict MCP: HTTP ${response.status}${raw?` · ${raw.slice(0,300)}`:''}`);error.status=response.status;throw error}
  return{envelope:parseMcpEnvelope(raw),sessionId:nextSession};
}
async function createPlanViaMcp(env,payload){
  const initialized=await mcpPost(env,{jsonrpc:'2.0',id:'rb-init',method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'RunnerBear',version:'10.25.1'}}});
  const sessionId=initialized.sessionId;
  await mcpPost(env,{jsonrpc:'2.0',method:'notifications/initialized'},sessionId);
  const listed=await mcpPost(env,{jsonrpc:'2.0',id:'rb-tools',method:'tools/list',params:{}},sessionId),tools=listed.envelope?.result?.tools||[],tool=tools.find(x=>x?.name==='plan-creation');
  if(!tool)throw new Error('Tredict MCP plan-creation tool is unavailable');
  const properties=tool?.inputSchema?.properties||{};
  const args=properties.plan
    ?{...payload,...(properties.llmDescription?{llmDescription:'RunnerBear v10.25.1 deterministic 10-day training calendar sync'}:{})}
    :{...payload.plan,planTrainings:payload.planTrainings,...(properties.llmDescription?{llmDescription:'RunnerBear v10.25.1 deterministic 10-day training calendar sync'}:{})};
  const called=await mcpPost(env,{jsonrpc:'2.0',id:'rb-plan',method:'tools/call',params:{name:'plan-creation',arguments:args}},sessionId),envelope=called.envelope;
  if(envelope?.error)throw new Error(`Tredict MCP plan-creation failed · ${String(envelope.error?.message||'unknown error').slice(0,300)}`);
  const result=envelope?.result||{};
  if(result?.isError)throw new Error(`Tredict MCP rejected plan · ${describeTredictPlanResponse(result)}`);
  const planId=extractTredictPlanId(result);
  if(!planId)throw new Error(`Tredict MCP response did not include planId · ${describeTredictPlanResponse(result)}`);
  return{planId,trainingCount:payload.planTrainings.length,transport:'mcp'};
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function addPlanTraining(env,body){
  for(let attempt=0;;attempt++){
    try{return await tdPost(env,'plan/training',body)}catch(error){
      const delay=tredictPlanTrainingRetryDelay(error,attempt);
      if(!delay)throw error;
      await wait(delay);
    }
  }
}
async function safe(name,fn){try{return{name,ok:true,data:await fn()}}catch(e){return{name,ok:false,status:e.status||0,error:e.message||String(e)}}}

async function buildSnapshot(env,requestedDays=365){
  if(!env.TREDICT_TOKEN)return{ok:false,error:'TREDICT_NOT_CONFIGURED',status:503,parts:[]};
  const days=Math.max(30,Math.min(365,Number(requestedDays||365))),healthDays=Math.min(days,120);
  const now=new Date(),old=daysAgo(days),healthOld=daysAgo(healthDays),nowIso=now.toISOString(),oldIso=old.toISOString(),healthOldIso=healthOld.toISOString();
  const calls=await Promise.all([
    safe('activities',()=>td(env,'activityList',{startDate:nowIso,endDate:oldIso,pageSize:500,extendedSummary:1})),
    safe('hrv',()=>td(env,'hrv',{startDate:nowIso,endDate:healthOldIso})),
    safe('sleep',()=>td(env,'sleep',{startDate:nowIso,endDate:healthOldIso})),
    safe('body',()=>td(env,'bodyvalues')),
    safe('capacity',()=>td(env,'capacity',{sportType:'running'})),
    safe('zones',()=>td(env,'zones',{sportType:'running'}))
  ]);
  const by=Object.fromEntries(calls.map(x=>[x.name,x]));
  if(!by.activities.ok)return{ok:false,error:'TREDICT_ACTIVITY_READ_FAILED',detail:by.activities.error,status:by.activities.status||502,parts:calls.map(({name,ok,status})=>({name,ok,status}))};
  const activityRows=by.activities.data?._embedded?.activityList||by.activities.data?.activityList||[],summaries=activityRows.map(pickSummary);
  const detailCutoff=daysAgo(28),detailCandidates=summaries.filter((a,index)=>index<8||a.sportType==='running'&&new Date(a.date)>=detailCutoff).filter((a,index,rows)=>rows.findIndex(x=>x.id===a.id)===index).slice(0,40);
  const detailRows=await Promise.all(detailCandidates.map(a=>safe(a.id,()=>td(env,`activity/${encodeURIComponent(a.id)}`))));
  const details=new Map(detailRows.filter(x=>x.ok).map(x=>[x.name,compactActivityDetail(x.data)]));
  summaries.forEach(a=>{if(details.has(a.id))a.detail=details.get(a.id)});
  const bodyRows=by.body.ok?(by.body.data?.bodyvalues||by.body.data?._embedded?.bodyvalues||[]):[];
  return{
    ok:true,version:'10.25.1',syncedAt:new Date().toISOString(),windowDays:days,
    activities:summaries,
    hrv:by.hrv.ok?(by.hrv.data?.hrv||{}):{},
    sleep:by.sleep.ok?(by.sleep.data?.sleep||{}):{},
    body:trimBody(bodyRows,healthOld),
    capacity:by.capacity.ok?(by.capacity.data?.capacity||{}):{},
    zones:by.zones.ok?(by.zones.data?.zones||{}):{},
    parts:[...calls.map(({name,ok,status,error})=>({name,ok,status,error:error||undefined})),{name:'activity-details',ok:detailRows.some(x=>x.ok),count:details.size}]
  };
}

export class TredictService extends WorkerEntrypoint {
  async snapshot(days=365){
    const out=await buildSnapshot(this.env,days);
    if(!out.ok)throw new Error(`${out.error}${out.detail?` · ${out.detail}`:''}`);
    return out;
  }
  async plannedWorkouts(startDate,endDate){
    if(!this.env.TREDICT_TOKEN)throw new Error('TREDICT_NOT_CONFIGURED');
    return td(this.env,'plannedTrainingList',{startDate,endDate,sportType:'running'});
  }
  async createPlan(payload){
    if(!this.env.TREDICT_TOKEN)throw new Error('TREDICT_NOT_CONFIGURED');
    const split=splitTredictPlanPayload(payload);let result=null,restError=null;
    try{result=await tdPost(this.env,'plan',split.create)}catch(error){if(Number(error?.status)!==400)throw error;restError=error}
    const planId=extractTredictPlanId(result);
    if(!planId){
      const rejected=restError||result?.error?new Error(restError?.message||`Tredict plan rejected · ${describeTredictPlanResponse(result)}`):null;
      if(!rejected)throw new Error(`Tredict plan response did not include planId · ${describeTredictPlanResponse(result)}`);
      try{return await createPlanViaMcp(this.env,payload)}catch(mcpError){throw new Error(`${rejected.message}; MCP fallback: ${mcpError instanceof Error?mcpError.message:String(mcpError)}`)}
    }
    let added=0;
    for(const addition of split.additions){
      const response=await addPlanTraining(this.env,{planId,...addition});
      if(response?.error)throw new Error(`Tredict rejected plan training ${added+1}/${split.additions.length} · ${describeTredictPlanResponse(response)}`);
      added++;
    }
    return{planId,trainingCount:added};
  }
  async changePlannedWorkoutDate(trainingId,date){
    if(!this.env.TREDICT_TOKEN)throw new Error('TREDICT_NOT_CONFIGURED');
    const id=String(trainingId||'').trim(),target=String(date||'').trim();
    if(!id||!/^\d{4}-\d{2}-\d{2}T/.test(target))throw new Error('TREDICT_CHANGE_DATE_INVALID');
    const result=await tdPost(this.env,'plannedTraining/changeDate',{trainingId:id,date:target});
    return{ok:true,trainingId:id,date:target,result};
  }
  async health(){return{ok:!!this.env.TREDICT_TOKEN,service:'RunnerBear Tredict RPC',version:'10.25.1',outbound:true,transport:'tredict-garmin',calendarWrite:true}}
}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const allowedOrigin=env.RUNNERBEAR_ORIGIN||DEFAULT_ORIGIN;
    const allowed=origin===allowedOrigin;
    if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors(origin,allowed)});
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin,allowed);
    if(!allowed)return json({ok:false,error:'ORIGIN_DENIED'},403,origin,false);
    if(!env.TREDICT_TOKEN||!env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_NOT_CONFIGURED'},503,origin,true);
    if(request.headers.get('X-RunnerBear-Key')!==env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_AUTH_FAILED'},401,origin,true);

    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true,service:'RunnerBear Tredict Bridge',version:'10.25.1',outbound:true,transport:'tredict-garmin',calendarWrite:true},200,origin,true);
    if(url.pathname!=='/api/snapshot')return json({ok:false,error:'NOT_FOUND'},404,origin,true);
    const out=await buildSnapshot(env,url.searchParams.get('days')||365);
    return json(out,out.ok?200:(out.status||502),origin,true);
  }
};
